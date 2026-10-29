// Приложение «Подбор нарядов»: фото, проверка и разбор типажа.
// Всё считается прямо в браузере — фото никуда не уходит.

const MAX_BYTES = 25 * 1024 * 1024;
const ANALYSIS_SIDE = 720;

const LIMITS = {
  darkBelow: 52,
  brightAbove: 226,
  sharpBelow: 42,
  faceAreaMin: 0.05,
};

const MEDIAPIPE_VERSION = "0.10.14";
const MEDIAPIPE_MODULE =
  `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/vision_bundle.mjs`;
const MEDIAPIPE_WASM =
  `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;
const FACE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";
const LANDMARK_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

const RAZBOR_KEY = "naryady.razbor.v1";

const RAZBOR_FIELDS = [
  {
    key: "shape",
    title: "Форма лица",
    options: [
      {
        value: "овал",
        note: "Самая универсальная форма. Подходит почти любой вырез и любая длина.",
      },
      {
        value: "круг",
        note: "Лицо чуть шире, чем длиннее. Хорошо работают вытянутые вырезы и вертикали.",
      },
      {
        value: "квадрат",
        note: "Заметные скулы и линия челюсти. Их подчёркивают угловатые вырезы.",
      },
      {
        value: "сердце",
        note: "Широкий лоб и узкий подбородок. Баланс дают объём и детали снизу.",
      },
      {
        value: "треугольник",
        note: "Узкий лоб и широкая нижняя часть. Помогают объём сверху и открытая шея.",
      },
      {
        value: "вытянутое",
        note: "Лицо заметно длиннее, чем шире. Его уравновешивают горизонтали и округлые формы.",
      },
    ],
  },
  {
    key: "features",
    title: "Черты",
    options: [
      {
        value: "мягкие",
        note: "Плавные линии без резких углов. Идут мягкие ткани и округлые силуэты.",
      },
      {
        value: "резкие",
        note: "Заметные скулы и углы. Идут чёткие линии, плотные ткани и графичные формы.",
      },
    ],
  },
  {
    key: "temperature",
    title: "Температура",
    options: [
      {
        value: "тёплые",
        note: "В коже и волосах золотистый оттенок. Идут персиковый, оливковый, терракота.",
      },
      {
        value: "холодные",
        note: "В коже и волосах розовый или голубоватый оттенок. Идут серо-голубой, изумрудный, винный.",
      },
    ],
  },
  {
    key: "contrast",
    title: "Контраст",
    options: [
      {
        value: "высокий",
        note: "Кожа и тёмные волосы или брови сильно отличаются. Идут чистые цвета и контрастные сочетания.",
      },
      {
        value: "спокойный",
        note: "Тона близки друг к другу. Идут мягкие, приглушённые сочетания.",
      },
    ],
  },
];

const el = {
  screenStart: document.getElementById("screen-start"),
  screenReview: document.getElementById("screen-review"),
  screenAnalysis: document.getElementById("screen-analysis"),
  titleReview: document.getElementById("title-review"),
  titleAnalysis: document.getElementById("title-analysis"),
  steps: document.getElementById("steps"),
  dropzone: document.getElementById("dropzone"),
  pickBtn: document.getElementById("pickBtn"),
  cameraBtn: document.getElementById("cameraBtn"),
  fileInput: document.getElementById("fileInput"),
  cameraInput: document.getElementById("cameraInput"),
  preview: document.getElementById("preview"),
  status: document.getElementById("status"),
  checks: document.getElementById("checks"),
  actions: document.getElementById("actions"),
  notice: document.getElementById("notice"),
  analysisStatus: document.getElementById("analysisStatus"),
  analysisPhoto: document.getElementById("analysisPhoto"),
  analysisCards: document.getElementById("analysisCards"),
  analysisNote: document.getElementById("analysisNote"),
  analysisActions: document.getElementById("analysisActions"),
};

const state = {
  runId: 0,
  busy: false,
  previewUrl: null,
  canvas: null,
  manual: {},
  razbor: null,
};

let detectorPromise = null;
let landmarkerPromise = null;
let slowTimer = 0;

// ── выбор файла ─────────────────────────────────────────────

function pickFile() {
  clearNotice();
  el.fileInput.value = "";
  el.fileInput.click();
}

function takePhoto() {
  clearNotice();
  el.cameraInput.value = "";
  el.cameraInput.click();
}

el.pickBtn.addEventListener("click", pickFile);
el.cameraBtn.addEventListener("click", takePhoto);

el.fileInput.addEventListener("change", () => {
  const file = el.fileInput.files && el.fileInput.files[0];
  if (file) start(file);
});

el.cameraInput.addEventListener("change", () => {
  const file = el.cameraInput.files && el.cameraInput.files[0];
  if (file) start(file);
});

["dragenter", "dragover"].forEach((type) => {
  el.dropzone.addEventListener(type, (event) => {
    event.preventDefault();
    el.dropzone.classList.add("is-dragging");
  });
});

["dragleave", "drop"].forEach((type) => {
  el.dropzone.addEventListener(type, (event) => {
    event.preventDefault();
    if (type === "dragleave" && event.relatedTarget &&
        el.dropzone.contains(event.relatedTarget)) return;
    el.dropzone.classList.remove("is-dragging");
  });
});

el.dropzone.addEventListener("drop", (event) => {
  const file = event.dataTransfer && event.dataTransfer.files
    ? event.dataTransfer.files[0]
    : null;
  if (file) start(file);
});

// ── проверка фото ───────────────────────────────────────────

async function start(file) {
  const runId = ++state.runId;
  clearNotice();

  const problem = validateFile(file);
  if (problem) {
    // человек мог выбирать файл уже с другого экрана — вернём его к началу,
    // иначе сообщение об ошибке останется на скрытом экране
    if (!el.screenStart.hidden) {
      showNotice(problem);
    } else {
      reset();
      showNotice(problem);
    }
    return;
  }

  if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
  state.previewUrl = URL.createObjectURL(file);
  state.canvas = null;

  el.preview.src = state.previewUrl;
  showScreen("review");
  setBusy(true);
  setStatus("wait", "Смотрим фото…");

  clearTimeout(slowTimer);
  slowTimer = setTimeout(() => {
    if (runId === state.runId && state.busy) {
      setStatus("wait", "Загружаем проверку лица. В первый раз это пара секунд…");
    }
  }, 2500);

  renderChecks([
    { key: "light", state: "wait", title: "Свет" },
    { key: "sharp", state: "wait", title: "Резкость" },
    { key: "faces", state: "wait", title: "Лицо в кадре" },
  ]);
  el.actions.replaceChildren();

  try {
    const source = await decodeImage(file);
    if (runId !== state.runId) return;

    const canvas = drawSmall(source, ANALYSIS_SIDE);
    state.canvas = canvas;
    const { brightness, sharpness } = measurePixels(canvas);
    if (runId !== state.runId) return;

    const lightCheck = brightnessCheck(brightness);
    // в темноте резкость не оценить — не ругаем зря
    const sharpCheck =
      lightCheck.state === "bad"
        ? {
            key: "sharp",
            state: "skip",
            title: "Резкость",
            note: "Проверим, когда будет больше света.",
          }
        : sharpnessCheck(sharpness);

    renderChecks([lightCheck, sharpCheck, { key: "faces", state: "wait", title: "Лицо в кадре" }]);

    const faces = await detectFaces(canvas);
    if (runId !== state.runId) return;

    const faceChecks = faceResultChecks(faces, canvas);
    const checks = [lightCheck, sharpCheck, ...faceChecks];
    renderChecks(checks);
    finish(checks);
  } catch (error) {
    if (runId !== state.runId) return;
    clearTimeout(slowTimer);
    setBusy(false);
    if (error instanceof AppError) {
      setStatus("bad", error.message);
      renderChecks([{ key: "photo", state: "bad", title: "Файл", note: error.message }]);
      showRetry();
    } else {
      console.error(error);
      setStatus("bad", "Не получилось проверить фото: нет связи с проверкой. Проверьте интернет и попробуйте снова.");
      renderChecks([{ key: "photo", state: "bad", title: "Проверка", note: "Похоже, пропал интернет." }]);
      showRetry();
    }
  }
}

function validateFile(file) {
  if (!file) return "Не удалось прочитать файл. Попробуйте выбрать фото ещё раз.";

  if (!/^image\//.test(file.type)) {
    return "Это не похоже на фото. Подойдёт JPG или PNG.";
  }

  if (/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name || "")) {
    return "Формат HEIC пока не открывается. В настройках телефона можно сохранить снимок как JPG.";
  }

  if (file.size > MAX_BYTES) {
    return "Фото слишком тяжёлое. Подойдёт файл до 25 МБ.";
  }

  return "";
}

async function decodeImage(file) {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(file);
    } catch {
      // попробуем обычный способ ниже
    }
  }

  return await new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new AppError("Не получилось открыть это фото. Подойдёт JPG или PNG."));
    };
    img.src = url;
  });
}

function drawSmall(source, maxSide) {
  const width = source.width || source.naturalWidth;
  const height = source.height || source.naturalHeight;
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

// ── свет и резкость ─────────────────────────────────────────

function measurePixels(canvas) {
  const { width, height } = canvas;
  const data = canvas
    .getContext("2d", { willReadFrequently: true })
    .getImageData(0, 0, width, height).data;

  const gray = new Float32Array(width * height);
  let sum = 0;
  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    const value = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    gray[p] = value;
    sum += value;
  }
  const brightness = sum / (width * height);

  const innerW = width - 2;
  const innerH = height - 2;
  if (innerW < 3 || innerH < 3) return { brightness, sharpness: 0 };

  const laplacian = new Float32Array(innerW * innerH);
  let mean = 0;
  let count = 0;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const p = y * width + x;
      const value =
        -4 * gray[p] + gray[p - 1] + gray[p + 1] + gray[p - width] + gray[p + width];
      laplacian[(y - 1) * innerW + (x - 1)] = value;
      mean += value;
      count += 1;
    }
  }
  mean /= count;

  let spread = 0;
  for (let i = 0; i < laplacian.length; i += 1) {
    const diff = laplacian[i] - mean;
    spread += diff * diff;
  }

  return { brightness, sharpness: spread / laplacian.length };
}

function brightnessCheck(brightness) {
  if (brightness < LIMITS.darkBelow) {
    return {
      key: "light",
      state: "bad",
      title: "Свет",
      note: "На фото темно. Попробуйте у окна или включите свет.",
    };
  }
  if (brightness > LIMITS.brightAbove) {
    return {
      key: "light",
      state: "bad",
      title: "Свет",
      note: "Слишком ярко, лицо засвечено. Отойдите от окна или лампы.",
    };
  }
  return { key: "light", state: "ok", title: "Свет", note: "Достаточно светло." };
}

function sharpnessCheck(sharpness) {
  if (sharpness < LIMITS.sharpBelow) {
    return {
      key: "sharp",
      state: "bad",
      title: "Резкость",
      note: "Фото размытое. Держите телефон ровно и нажмите на экран, чтобы камера навелась.",
    };
  }
  return { key: "sharp", state: "ok", title: "Резкость", note: "Черты лица чёткие." };
}

// ── поиск лица ──────────────────────────────────────────────

async function detectFaces(canvas) {
  try {
    const detector = await getDetector();
    const result = detector.detect(canvas);
    return (result.detections || []).map((item) => item.boundingBox);
  } catch (error) {
    console.warn("MediaPipe не сработал, пробуем встроенный распознаватель", error);
    const native = await detectNative(canvas);
    if (native) return native;
    throw new AppError(
      "Не получилось проверить лицо: похоже, нет связи. Проверьте интернет и попробуйте снова."
    );
  }
}

async function getDetector() {
  if (!detectorPromise) {
    detectorPromise = createDetector().catch((error) => {
      detectorPromise = null;
      throw error;
    });
  }
  return detectorPromise;
}

async function createDetector() {
  const module = await import(MEDIAPIPE_MODULE);
  const fileset = await module.FilesetResolver.forVisionTasks(MEDIAPIPE_WASM);

  const options = (delegate) => ({
    baseOptions: { modelAssetPath: FACE_MODEL, delegate },
    runningMode: "IMAGE",
    minDetectionConfidence: 0.5,
  });

  try {
    return await module.FaceDetector.createFromOptions(fileset, options("GPU"));
  } catch {
    return await module.FaceDetector.createFromOptions(fileset, options("CPU"));
  }
}

async function detectNative(canvas) {
  if (!("FaceDetector" in window)) return null;
  try {
    const detector = new window.FaceDetector({ maxDetectedFaces: 4, fastMode: false });
    const faces = await detector.detect(canvas);
    return faces.map((face) => ({
      originX: face.boundingBox.x,
      originY: face.boundingBox.y,
      width: face.boundingBox.width,
      height: face.boundingBox.height,
    }));
  } catch {
    return null;
  }
}

function faceResultChecks(faces, canvas) {
  if (faces.length === 0) {
    return [
      {
        key: "faces",
        state: "bad",
        title: "Лицо в кадре",
        note: "Лица не видно или оно слишком мелкое. Подойдите ближе и смотрите в камеру.",
      },
    ];
  }

  if (faces.length > 1) {
    return [
      {
        key: "faces",
        state: "bad",
        title: "Лицо в кадре",
        note: `На фото ${faces.length} лица. Нужно фото, где только вы.`,
      },
    ];
  }

  const box = faces[0];
  const frameArea = canvas.width * canvas.height;
  const faceArea = (box.width * box.height) / frameArea;

  if (faceArea < LIMITS.faceAreaMin) {
    return [
      {
        key: "faces",
        state: "bad",
        title: "Лицо в кадре",
        note: "Лицо слишком далеко. Подойдите ближе или обрежьте фото.",
      },
    ];
  }

  return [
    { key: "faces", state: "ok", title: "Лицо в кадре", note: "Одно лицо, хорошо видно." },
  ];
}

// ── разбор типажа ───────────────────────────────────────────

const LM = {
  forehead: 10,
  chin: 152,
  leftCheek: 234,
  rightCheek: 454,
  leftTemple: 127,
  rightTemple: 356,
  leftJaw: 58,
  rightJaw: 288,
  leftJawMid: 172,
  rightJawMid: 397,
  leftCheekMid: 50,
  rightCheekMid: 280,
};

async function getLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = createLandmarker().catch((error) => {
      landmarkerPromise = null;
      throw error;
    });
  }
  return landmarkerPromise;
}

async function createLandmarker() {
  const module = await import(MEDIAPIPE_MODULE);
  const fileset = await module.FilesetResolver.forVisionTasks(MEDIAPIPE_WASM);

  const options = (delegate) => ({
    baseOptions: { modelAssetPath: LANDMARK_MODEL, delegate },
    runningMode: "IMAGE",
    numFaces: 1,
    outputFaceBlendshapes: false,
    outputFacialTransformationMatrixes: false,
  });

  try {
    return await module.FaceLandmarker.createFromOptions(fileset, options("GPU"));
  } catch {
    return await module.FaceLandmarker.createFromOptions(fileset, options("CPU"));
  }
}

async function readFace(canvas) {
  const landmarker = await getLandmarker();
  const result = landmarker.detect(canvas);
  const faces = result.faceLandmarks || [];
  if (!faces.length) {
    throw new AppError("Не получилось разобрать черты лица. Попробуйте фото, где лицо крупнее.");
  }
  return faces[0];
}

function toPoint(landmark, width, height) {
  return { x: landmark.x * width, y: landmark.y * height };
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function angleAt(a, b, c) {
  const v1 = { x: a.x - b.x, y: a.y - b.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };
  const length = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y) || 1;
  const cos = Math.max(-1, Math.min(1, (v1.x * v2.x + v1.y * v2.y) / length));
  return (Math.acos(cos) * 180) / Math.PI;
}

function analyzeFace(canvas, landmarks) {
  const w = canvas.width;
  const h = canvas.height;
  const p = (index) => toPoint(landmarks[index], w, h);

  const forehead = p(LM.forehead);
  const chin = p(LM.chin);
  const cheek = distance(p(LM.leftCheek), p(LM.rightCheek));
  const jawSharp = distance(p(LM.leftJaw), p(LM.rightJaw));
  const length = distance(forehead, chin);

  // пропорции лица, а не сантиметры: длина и ширина челюсти
  const L = length / (cheek || 1);
  const J = jawSharp / (cheek || 1);

  // решаем только то, в чём уверены; спорное (сердце, треугольник) — руками
  let shape = "овал";
  if (L >= 1.35) shape = "вытянутое";
  else if (L <= 1.21) shape = "круг";
  else if (J >= 0.91) shape = "квадрат";

  const jawAngle = Math.min(
    angleAt(p(LM.leftCheek), p(LM.leftJawMid), chin),
    angleAt(p(LM.rightCheek), p(LM.rightJawMid), chin)
  );
  const features = jawAngle <= 136 ? "резкие" : "мягкие";

  const pixels = canvas
    .getContext("2d", { willReadFrequently: true })
    .getImageData(0, 0, w, h).data;

  const skin = averagePatch(pixels, w, h, [p(LM.leftCheekMid), p(LM.rightCheekMid)]);

  const bbox = faceBox(landmarks, w, h);
  const stats = faceLuminanceStats(pixels, w, h, bbox);
  const contrastLevel = (stats.median - stats.p10) / 255;
  const contrast = contrastLevel >= 0.28 ? "высокий" : "спокойный";

  const warmth = skin.r - skin.b;
  const temperature = warmth >= 55 ? "тёплые" : "холодные";

  return { shape, features, temperature, contrast };
}

function faceBox(landmarks, width, height) {
  let minX = 1;
  let maxX = 0;
  let minY = 1;
  let maxY = 0;
  for (const point of landmarks) {
    if (point.x < minX) minX = point.x;
    if (point.x > maxX) maxX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.y > maxY) maxY = point.y;
  }
  return {
    x: minX * width,
    y: minY * height,
    width: (maxX - minX) * width,
    height: (maxY - minY) * height,
  };
}

function faceLuminanceStats(pixels, width, height, box) {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const rx = (box.width / 2) * 0.82;
  const ry = (box.height / 2) * 0.82;
  const values = [];
  const step = 2;

  for (let y = Math.max(0, Math.floor(cy - ry)); y < Math.min(height, cy + ry); y += step) {
    for (let x = Math.max(0, Math.floor(cx - rx)); x < Math.min(width, cx + rx); x += step) {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      if (nx * nx + ny * ny > 1) continue;
      const index = (y * width + x) * 4;
      values.push(0.2126 * pixels[index] + 0.7152 * pixels[index + 1] + 0.0722 * pixels[index + 2]);
    }
  }

  if (!values.length) return { median: 128, p10: 128 };
  values.sort((a, b) => a - b);
  return {
    median: values[Math.floor(values.length * 0.5)],
    p10: values[Math.floor(values.length * 0.1)],
  };
}

function averagePatch(pixels, width, height, points, radius = 4) {
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;

  for (const point of points) {
    const cx = Math.round(point.x);
    const cy = Math.round(point.y);
    for (let y = cy - radius; y <= cy + radius; y += 1) {
      if (y < 0 || y >= height) continue;
      for (let x = cx - radius; x <= cx + radius; x += 1) {
        if (x < 0 || x >= width) continue;
        const index = (y * width + x) * 4;
        const brightness = (pixels[index] + pixels[index + 1] + pixels[index + 2]) / 3;
        if (brightness < 12 || brightness > 250) continue;
        r += pixels[index];
        g += pixels[index + 1];
        b += pixels[index + 2];
        count += 1;
      }
    }
  }

  if (!count) return { r: 128, g: 128, b: 128 };
  return { r: r / count, g: g / count, b: b / count };
}

// ── показ разбора ───────────────────────────────────────────

async function openAnalysis() {
  if (!state.canvas) return;

  showScreen("analysis");
  el.analysisCards.replaceChildren();
  el.analysisPhoto.replaceChildren(photoPreview());
  el.analysisStatus.className = "status status--wait";
  el.analysisStatus.replaceChildren(spinner(), document.createTextNode("Смотрим черты лица…"));
  renderAnalysisActions();

  const runId = state.runId;

  try {
    const landmarks = await readFace(state.canvas);
    if (runId !== state.runId) return;

    const auto = analyzeFace(state.canvas, landmarks);
    const values = { ...auto };
    for (const field of RAZBOR_FIELDS) {
      if (state.manual[field.key]) values[field.key] = state.manual[field.key];
    }

    state.razbor = { v: 1, values, manual: { ...state.manual } };
    persistRazbor();

    clearStatus(el.analysisStatus);
    renderCards();
    el.analysisNote.textContent = Object.keys(state.manual).length
      ? "Часть пунктов вы поправили сами — дальше опираемся на ваш выбор."
      : "Это версия ассистента, а не приговор. Если не совпадает — поправьте.";
    el.analysisNote.hidden = false;
  } catch (error) {
    if (runId !== state.runId) return;
    clearStatus(el.analysisStatus);
    console.error(error);

    const empty = { shape: null, features: null, temperature: null, contrast: null };
    state.razbor = { v: 1, values: empty, manual: { ...state.manual }, failed: true };
    renderCards();

    el.analysisStatus.className = "status status--bad";
    el.analysisStatus.textContent =
      error instanceof AppError ? error.message : "Не получилось разобрать черты: похоже, нет связи.";
    el.analysisNote.textContent =
      "Значения не определены. Можно выбрать их вручную кнопкой «Поправить» — или попробовать другое фото.";
    el.analysisNote.hidden = false;
    renderAnalysisActions();
  }
}

function photoPreview() {
  if (state.previewUrl && state.canvas) {
    const img = document.createElement("img");
    img.src = state.previewUrl;
    img.alt = "Фото для разбора";
    return img;
  }

  const empty = document.createElement("div");
  empty.className = "analysis-photo__empty";
  const icon = document.createElement("span");
  icon.className = "analysis-photo__lock";
  icon.textContent = "🔒";
  icon.setAttribute("aria-hidden", "true");
  const text = document.createElement("p");
  text.textContent = "Фото мы не храним. Разбор сохранён только на этом устройстве.";
  empty.append(icon, text);
  return empty;
}

function renderCards() {
  el.analysisCards.replaceChildren();
  for (const field of RAZBOR_FIELDS) {
    el.analysisCards.append(buildCard(field));
  }
}

function buildCard(field) {
  const value = state.razbor.values[field.key];
  const manual = Boolean(state.razbor.manual[field.key]);
  const option = field.options.find((item) => item.value === value) || null;

  const card = document.createElement("section");
  card.className = "rcard";
  card.dataset.key = field.key;

  const head = document.createElement("div");
  head.className = "rcard__head";

  const title = document.createElement("h2");
  title.className = "rcard__title";
  title.textContent = field.title;

  const edit = document.createElement("button");
  edit.type = "button";
  edit.className = "rcard__edit";
  edit.textContent = "Поправить";
  edit.setAttribute("aria-expanded", "false");

  head.append(title, edit);

  const valueLine = document.createElement("p");
  valueLine.className = "rcard__value";
  valueLine.textContent = option ? capitalize(option.value) : "Не определено";

  if (manual) {
    const badge = document.createElement("span");
    badge.className = "rcard__badge";
    badge.textContent = "ваша правка";
    valueLine.append(badge);
  }

  const note = document.createElement("p");
  note.className = "rcard__note";
  note.textContent = option
    ? option.note
    : "Выберите значение вручную — на него и будем опираться.";

  const options = document.createElement("div");
  options.className = "rcard__options";
  options.hidden = true;

  for (const item of field.options) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.textContent = capitalize(item.value);
    chip.setAttribute("aria-pressed", String(item.value === value));
    chip.addEventListener("click", () => {
      state.razbor.values[field.key] = item.value;
      state.razbor.manual[field.key] = true;
      state.manual[field.key] = item.value;
      state.razbor.failed = false;
      state.razbor.v = 1;
      persistRazbor();
      renderCards();
      el.analysisNote.textContent = "Часть пунктов вы поправили сами — дальше опираемся на ваш выбор.";
      el.analysisNote.hidden = false;
      const next = el.analysisCards.querySelector(`.rcard[data-key="${field.key}"] .rcard__edit`);
      if (next) next.focus();
    });
    options.append(chip);
  }

  edit.addEventListener("click", () => {
    options.hidden = !options.hidden;
    edit.setAttribute("aria-expanded", String(!options.hidden));
    const checked = options.querySelector('[aria-pressed="true"]');
    if (!options.hidden && checked) checked.focus();
  });

  card.append(head, valueLine, note, options);
  return card;
}

function renderAnalysisActions() {
  el.analysisActions.replaceChildren();

  const another = document.createElement("button");
  another.type = "button";
  another.className = "btn btn--primary";
  another.textContent = "Выбрать другое фото";
  another.addEventListener("click", reset);

  el.analysisActions.append(another);

  const stored = Boolean(loadRazbor());
  if (stored) {
    const clear = document.createElement("button");
    clear.type = "button";
    clear.className = "linkbtn";
    clear.textContent = "Стереть разбор";
    clear.addEventListener("click", () => {
      clearRazbor();
      state.manual = {};
      state.razbor = null;
      reset();
    });
    el.analysisActions.append(clear);
  }
}

// ── сохранение разбора ──────────────────────────────────────

function persistRazbor() {
  if (!state.razbor) return;
  try {
    localStorage.setItem(RAZBOR_KEY, JSON.stringify(state.razbor));
  } catch {
    // хранилище может быть выключено — тогда просто не запоминаем
  }
}

function loadRazbor() {
  try {
    const raw = localStorage.getItem(RAZBOR_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.v !== 1 || !data.values) return null;
    return data;
  } catch {
    return null;
  }
}

function clearRazbor() {
  try {
    localStorage.removeItem(RAZBOR_KEY);
  } catch {
    // ничего страшного
  }
}

// ── итог проверки фото ──────────────────────────────────────

function finish(checks) {
  clearTimeout(slowTimer);
  setBusy(false);
  const failed = checks.filter((item) => item.state === "bad");

  if (failed.length === 0) {
    setStatus("ok", "Фото подходит. Дальше ассистент разберёт типаж и форму лица.");
    renderActions([
      { label: "Дальше: разбор", className: "btn btn--primary", onClick: openAnalysis },
      { label: "Выбрать другое фото", className: "btn btn--ghost", onClick: reset },
    ]);
    return;
  }

  const primary =
    failed.find((item) => item.key === "faces") ||
    failed.find((item) => item.key === "light") ||
    failed[0];

  setStatus("bad", primary.note);
  showRetry();
}

function showRetry() {
  renderActions([
    { label: "Попробовать другое фото", className: "btn btn--primary", onClick: pickFile },
    { label: "Снять на камеру", className: "btn btn--ghost", onClick: takePhoto },
  ]);
}

function reset() {
  state.runId += 1;
  state.busy = false;
  state.canvas = null;
  clearTimeout(slowTimer);
  if (state.previewUrl) {
    URL.revokeObjectURL(state.previewUrl);
    state.previewUrl = null;
  }
  el.preview.removeAttribute("src");
  el.actions.replaceChildren();
  el.checks.replaceChildren();
  el.status.replaceChildren();
  el.status.className = "status";
  el.analysisCards.replaceChildren();
  el.analysisPhoto.replaceChildren();
  el.analysisActions.replaceChildren();
  clearStatus(el.analysisStatus);
  showScreen("start");
}

// ── отрисовка ───────────────────────────────────────────────

const SCREENS = {
  start: { node: () => el.screenStart, step: "Шаг 1 из 3" },
  review: { node: () => el.screenReview, step: "Шаг 1 из 3" },
  analysis: { node: () => el.screenAnalysis, step: "Шаг 2 из 3" },
};

function showScreen(name) {
  for (const key of Object.keys(SCREENS)) {
    SCREENS[key].node().hidden = key !== name;
  }
  el.steps.textContent = SCREENS[name].step;

  if (name === "review") el.titleReview.focus({ preventScroll: true });
  if (name === "analysis") el.titleAnalysis.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function setStatus(kind, text) {
  el.status.className = `status status--${kind}`;
  el.status.replaceChildren();

  if (kind === "wait") {
    el.status.append(spinner());
  }

  el.status.append(document.createTextNode(text));
}

function spinner() {
  const spin = document.createElement("span");
  spin.className = "status__spin";
  spin.setAttribute("aria-hidden", "true");
  return spin;
}

function clearStatus(node) {
  if (!node) return;
  node.className = "status";
  node.replaceChildren();
}

function renderChecks(checks) {
  el.checks.replaceChildren();
  for (const item of checks) {
    el.checks.append(renderCheck(item));
  }
}

function renderCheck(item) {
  const li = document.createElement("li");
  li.className = `check check--${item.state}`;

  const mark = document.createElement("span");
  mark.className = "check__mark";
  mark.setAttribute("aria-hidden", "true");
  mark.textContent =
    item.state === "ok" ? "✓" : item.state === "bad" ? "!" : item.state === "wait" ? "…" : "–";

  const text = document.createElement("span");
  text.className = "check__text";
  text.append(document.createTextNode(item.title));

  if (item.note) {
    const note = document.createElement("span");
    note.className = "check__note";
    note.textContent = item.note;
    text.append(note);
  }

  li.append(mark, text);
  return li;
}

function renderActions(actions) {
  el.actions.replaceChildren();
  for (const action of actions) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = action.className;
    button.textContent = action.label;
    button.addEventListener("click", action.onClick);
    el.actions.append(button);
  }
}

function setBusy(value) {
  state.busy = value;
}

function showNotice(text) {
  let notice = el.notice;
  if (!notice) {
    notice = document.createElement("p");
    notice.id = "notice";
    notice.className = "notice";
    notice.setAttribute("role", "alert");
    el.dropzone.after(notice);
    el.notice = notice;
  }
  notice.textContent = text;
  notice.hidden = false;
}

function clearNotice() {
  if (el.notice) {
    el.notice.hidden = true;
    el.notice.textContent = "";
  }
}

function capitalize(text) {
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}

class AppError extends Error {}

// ── запуск: если разбор уже сохранён, показываем его ────────

(function boot() {
  const saved = loadRazbor();
  if (saved && !(saved.failed && !Object.keys(saved.manual || {}).length)) {
    state.razbor = saved;
    state.manual = { ...(saved.manual || {}) };
    showScreen("analysis");
    renderCards();
    el.analysisPhoto.replaceChildren(photoPreview());
    el.analysisNote.textContent =
      "Разбор сохранён на этом устройстве. Фото мы не храним — загрузите новое, чтобы обновить черты.";
    el.analysisNote.hidden = false;
    renderAnalysisActions();
    return;
  }

  showScreen("start");
})();

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
const PROFILE_KEY = "naryady.profil.v1";
const SETTINGS_KEY = "naryady.nastroyki.v1";

const DEEPSEEK_API = "https://api.deepseek.com";

const AI_MODELS = [
  { value: "deepseek-v4-flash", label: "V4 Flash" },
  { value: "deepseek-v4-pro", label: "V4 Pro" },
];

const GENDERS = [
  { value: "женский", label: "Женский" },
  { value: "мужской", label: "Мужской" },
  { value: "", label: "Не указывать" },
];

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
  startGenderChips: document.getElementById("startGenderChips"),
  analysisGenderChips: document.getElementById("analysisGenderChips"),
  compliment: document.getElementById("compliment"),
  complimentText: document.getElementById("complimentText"),
  complimentHide: document.getElementById("complimentHide"),
  complimentBack: document.getElementById("complimentBack"),
  screenOutfits: document.getElementById("screen-outfits"),
  titleOutfits: document.getElementById("title-outfits"),
  outfitStatus: document.getElementById("outfitStatus"),
  outfitCards: document.getElementById("outfitCards"),
  outfitNote: document.getElementById("outfitNote"),
  outfitWho: document.getElementById("outfitWho"),
  outfitSource: document.getElementById("outfitSource"),
  settingsBtn: document.getElementById("settingsBtn"),
  screenSettings: document.getElementById("screen-settings"),
  titleSettings: document.getElementById("title-settings"),
  keyInput: document.getElementById("keyInput"),
  showKey: document.getElementById("showKey"),
  modelSelect: document.getElementById("modelSelect"),
  settingsStatus: document.getElementById("settingsStatus"),
  saveKey: document.getElementById("saveKey"),
  deleteKey: document.getElementById("deleteKey"),
  backFromSettings: document.getElementById("backFromSettings"),
  outfitActions: document.getElementById("outfitActions"),
};

const state = {
  runId: 0,
  busy: false,
  previewUrl: null,
  canvas: null,
  manual: {},
  razbor: null,
  outfits: null,
  outfitRun: 0,
  outfitAbort: null,
  outfitBackup: null,
  replacing: false,
  lastScreen: "start",
  profile: { gender: "", hideCompliment: false },
  settings: { key: "", model: "deepseek-v4-flash" },
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
    clearOutfits();

    clearStatus(el.analysisStatus);
    renderCards();
    renderAnalysisActions();
    renderCompliment();
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
    clearOutfits();
    renderCards();
    renderCompliment();

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
      // образы собраны по прежним значениям — их больше нельзя показывать
      clearOutfits();
      renderCards();
      renderAnalysisActions();
      renderCompliment();
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

  const hasValues = Boolean(
    state.razbor && RAZBOR_FIELDS.every((field) => state.razbor.values[field.key])
  );

  if (hasValues) {
    const search = document.createElement("button");
    search.type = "button";
    search.className = "btn btn--primary";
    search.textContent = state.outfits ? "Смотреть образы" : "Подобрать образы";
    search.addEventListener("click", () => startOutfits());
    el.analysisActions.append(search);
  }

  const another = document.createElement("button");
  another.type = "button";
  another.className = hasValues ? "btn btn--ghost" : "btn btn--primary";
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
      clearOutfits();
      state.manual = {};
      state.razbor = null;
      reset();
    });
    el.analysisActions.append(clear);
  }
}

// ── пол и добрые слова ──────────────────────────────────────

function persistProfile() {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify({ v: 1, ...state.profile }));
  } catch {
    // хранилище может быть выключено — тогда просто не запоминаем
  }
}

function loadProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.v !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

function renderGenderChips() {
  for (const container of [el.startGenderChips, el.analysisGenderChips]) {
    if (!container) continue;
    container.replaceChildren();
    for (const item of GENDERS) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip chip--gender";
      chip.textContent = item.label;
      chip.setAttribute("aria-pressed", String(state.profile.gender === item.value));
      chip.addEventListener("click", () => setGender(item.value));
      container.append(chip);
    }
  }
}

function setGender(value) {
  if (state.profile.gender === value) return;
  state.profile.gender = value;
  persistProfile();
  renderGenderChips();

  // прежние образы собраны для другого выбора — их больше нельзя показывать
  clearOutfits();
  el.outfitCards.replaceChildren();
  clearStatus(el.outfitStatus);
  renderOutfitWho();

  renderCompliment();
  if (state.razbor) renderAnalysisActions();
}

function renderCompliment() {
  const values = (state.razbor && state.razbor.values) || {};
  const ready = RAZBOR_FIELDS.every((field) => values[field.key]);
  const text = ready ? buildCompliment(values, state.profile.gender) : "";

  if (!text) {
    el.compliment.hidden = true;
    el.complimentBack.hidden = true;
    el.complimentText.textContent = "";
    return;
  }

  el.complimentText.textContent = text;
  const hidden = state.profile.hideCompliment;
  el.compliment.hidden = hidden;
  el.complimentBack.hidden = !hidden;
}

el.complimentHide.addEventListener("click", () => {
  state.profile.hideCompliment = true;
  persistProfile();
  renderCompliment();
  el.complimentBack.focus();
});

el.complimentBack.addEventListener("click", () => {
  state.profile.hideCompliment = false;
  persistProfile();
  renderCompliment();
  el.complimentHide.focus();
});

// ── настройки и ИИ ──────────────────────────────────────────

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.v !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

function persistSettings() {
  try {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ v: 1, key: state.settings.key, model: state.settings.model })
    );
  } catch {
    // хранилище может быть выключено — тогда просто не запоминаем
  }
}

function hasAiKey() {
  return Boolean(state.settings.key);
}

function openSettings() {
  el.keyInput.value = state.settings.key;
  el.keyInput.type = "password";
  el.showKey.textContent = "Показать";
  el.showKey.setAttribute("aria-pressed", "false");
  el.modelSelect.value = state.settings.model;
  clearStatus(el.settingsStatus);
  if (hasAiKey()) setSettingsStatus("ok", "Ключ сохранён на этом устройстве.");
  showScreen("settings");
}

function setSettingsStatus(kind, text) {
  el.settingsStatus.className = `status status--${kind}`;
  el.settingsStatus.replaceChildren();
  if (kind === "wait") el.settingsStatus.append(spinner());
  el.settingsStatus.append(document.createTextNode(text));
}

async function checkKey() {
  const key = state.settings.key;
  if (!key) return { ok: false, message: "Сначала вставьте ключ." };

  try {
    const response = await fetch(`${DEEPSEEK_API}/models`, {
      headers: { Authorization: `Bearer ${key}` },
    });

    if (response.status === 401) {
      return { ok: false, message: "Ключ не подошёл. Проверьте, что скопировали его целиком." };
    }
    if (response.status === 403) {
      return { ok: false, message: "Ключ есть, но доступа к модели нет. Проверьте его в кабинете DeepSeek." };
    }
    if (!response.ok) {
      return { ok: false, message: `DeepSeek ответил ошибкой ${response.status}. Попробуйте позже.` };
    }

    let balance = "";
    try {
      const info = await fetch(`${DEEPSEEK_API}/user/balance`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (info.ok) {
        const data = await info.json();
        const first = (data.balance_infos || [])[0];
        if (first) balance = ` На счету: ${first.total_balance} ${first.currency}.`;
      }
    } catch {
      // баланс — приятный бонус, без него проверка всё равно прошла
    }

    return { ok: true, message: `Ключ работает.${balance}` };
  } catch {
    return { ok: false, message: "Не получилось связаться с DeepSeek. Проверьте интернет." };
  }
}

el.settingsBtn.addEventListener("click", openSettings);

el.backFromSettings.addEventListener("click", () => {
  showScreen(state.lastScreen || "start");
});

el.showKey.addEventListener("click", () => {
  const shown = el.keyInput.type === "text";
  el.keyInput.type = shown ? "password" : "text";
  el.showKey.textContent = shown ? "Показать" : "Скрыть";
  el.showKey.setAttribute("aria-pressed", String(!shown));
});

el.saveKey.addEventListener("click", async () => {
  const key = el.keyInput.value.trim();
  if (!key) {
    setSettingsStatus("bad", "Вставьте ключ — без него модель не сможет работать.");
    el.keyInput.focus();
    return;
  }

  const before = state.settings.key;
  state.settings.key = key;
  state.settings.model = el.modelSelect.value;
  persistSettings();

  setSettingsStatus("wait", "Проверяем ключ…");
  const result = await checkKey();
  setSettingsStatus(result.ok ? "ok" : "bad", result.message);

  if (result.ok) {
    if (before !== key) {
      // образы от правил больше не актуальны — их соберёт модель
      clearOutfits();
      el.outfitCards.replaceChildren();
      clearStatus(el.outfitStatus);
      if (state.razbor) renderAnalysisActions();
    }
    setSettingsStatus(
      "ok",
      `${result.message} Дальше образы будет собирать модель — нажмите «Подобрать образы».`
    );
  }
});

el.deleteKey.addEventListener("click", () => {
  state.settings.key = "";
  persistSettings();
  el.keyInput.value = "";
  clearOutfits();
  el.outfitCards.replaceChildren();
  clearStatus(el.outfitStatus);
  if (state.razbor) renderAnalysisActions();
  setSettingsStatus("ok", "Ключ удалён. Образы снова собираются по правилам.");
});

// ── образы, которые придумывает модель ─────────────────────

class AiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status || 0;
  }
}

function aiErrorText(status) {
  if (status === 401) return "Ключ не подошёл — проверьте его в настройках.";
  if (status === 402) return "Похоже, на ключе закончились деньги. Проверьте баланс в кабинете DeepSeek.";
  if (status === 403) return "DeepSeek не пускает с этим ключом. Проверьте доступ в кабинете.";
  if (status === 429) return "Слишком много запросов подряд. Подождите минуту и попробуйте снова.";
  if (status >= 500) return "DeepSeek сейчас не отвечает. Попробуйте через минуту.";
  return "Не получилось спросить модель. Попробуйте ещё раз.";
}

function buildAiMessages(values, gender, occasionLabels, exclude) {
  const who =
    gender === "женский"
      ? "женщина"
      : gender === "мужской"
        ? "мужчина"
        : "человек, пол не указан";

  const system = [
    "Ты — помощник по подбору одежды. Пишешь по-русски, простыми словами, коротко.",
    "Правила:",
    "- советуешь только одежду, обувь и аксессуары;",
    "- не оцениваешь внешность, лицо и тело человека, не сравниваешь людей;",
    "- не используешь слова «полный», «худой», «некрасиво», «идеально»;",
    "- не придумываешь магазины, товары, цены и ссылки;",
    "- не пишешь, что ты ИИ, и не извиняешься;",
    "- отвечаешь строго одним JSON-объектом, без пояснений и без markdown.",
  ].join("\n");

  const shapeNote = `Форма лица: ${values.shape}. Черты: ${values.features}. Оттенки: ${values.temperature}. Контраст: ${values.contrast}.`;

  const clothesRule =
    gender === "женский"
      ? "Можно предлагать юбки и каблук, если это уместно случаю."
      : "Не предлагай юбки, платья и каблуки — только брюки и обычную обувь.";

  const excludeNote = exclude && exclude.length
    ? `\nНе повторяй эти вещи и цвета: ${exclude.join("; ")}.`
    : "";

  const user = `Человек: ${who}.
${shapeNote}

Собери образы для случаев: ${occasionLabels.join(", ")}.
${clothesRule}${excludeNote}

Верни JSON такой формы:
{"outfits":[{"occasion":"на работу","title":"Спокойный образ на работу","items":[{"label":"Верх","value":"..."},{"label":"Низ","value":"..."},{"label":"Обувь","value":"..."},{"label":"Верхний слой","value":"..."}],"colors":[{"name":"песочный","hex":"#d9bd94"},{"name":"оливковый","hex":"#8b8b5a"}],"why":["причина, связанная с разбором","вторая причина","третья причина"]}]}

Требования: ровно ${occasionLabels.length} образ(ов), в каждом 4 вещи, 2 цвета с настоящими hex-кодами и 3 короткие причины, связанные с разбором.`;

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

function aiColor(raw, fallback) {
  const name = String(raw && raw.name ? raw.name : "").trim();
  const hex = String(raw && raw.hex ? raw.hex : "").trim();
  if (/^#[0-9a-f]{6}$/i.test(hex)) return { name: name || "оттенок", hex };
  if (name) {
    const found = Object.values(PALETTES)
      .flat()
      .find((color) => color.name.toLowerCase() === name.toLowerCase());
    if (found) return found;
  }
  return fallback;
}

function normalizeAiOutfit(raw, index, values) {
  const occasion = OCCASIONS[index] || OCCASIONS[0];
  const title = String(raw && raw.title ? raw.title : "").trim() || occasion.title;
  const label = String(raw && raw.occasion ? raw.occasion : "").trim() || occasion.label;

  const rawItems = Array.isArray(raw && raw.items) ? raw.items : [];
  const items = rawItems
    .map((item) => {
      if (Array.isArray(item)) return [String(item[0] || ""), String(item[1] || "")];
      return [String(item && item.label ? item.label : ""), String(item && item.value ? item.value : "")];
    })
    .filter((pair) => pair[0] && pair[1])
    .slice(0, 5);
  if (items.length < 3) return null;

  const palette = PALETTES[values.temperature] || PALETTES["тёплые"];
  const rawColors = Array.isArray(raw && raw.colors) ? raw.colors : [];
  const colors = rawColors
    .slice(0, 2)
    .map((color, colorIndex) => aiColor(color, palette[colorIndex % palette.length]));
  while (colors.length < 2) colors.push(palette[(index + colors.length) % palette.length]);

  const why = (Array.isArray(raw && raw.why) ? raw.why : [])
    .map((reason) => String(reason).trim())
    .filter(Boolean)
    .slice(0, 3);
  if (!why.length) return null;

  return {
    occasion: occasion.key,
    label,
    title,
    items,
    colors,
    why,
    variant: 0,
    liked: false,
  };
}

async function requestAiOutfits({ values, gender, labels, exclude, signal }) {
  const response = await fetch(`${DEEPSEEK_API}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${state.settings.key}`,
    },
    body: JSON.stringify({
      model: state.settings.model,
      messages: buildAiMessages(values, gender, labels, exclude),
      temperature: 0.8,
      max_tokens: 1800,
      response_format: { type: "json_object" },
      stream: false,
    }),
    signal,
  });

  if (!response.ok) {
    throw new AiError(aiErrorText(response.status), response.status);
  }

  const data = await response.json();
  const text = (data.choices && data.choices[0] && data.choices[0].message
    ? data.choices[0].message.content
    : "") || "";

  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new AiError("Модель ответила не по-нашему. Попробуйте ещё раз.");
  }

  const list = parsed && Array.isArray(parsed.outfits) ? parsed.outfits : [];
  if (!list.length) throw new AiError("Модель не предложила образы. Попробуйте ещё раз.");
  return list;
}

function restoreOutfitBackup() {
  if (state.outfits || !state.outfitBackup) return;
  state.outfits = state.outfitBackup;
  state.outfitBackup = null;
  persistOutfits();

  if (!el.screenAnalysis.hidden) {
    renderAnalysisActions();
  } else if (!el.screenOutfits.hidden) {
    renderOutfitCards();
    renderOutfitSource();
    renderOutfitActions("ready");
  }
}

function showAiError(error) {  setOutfitStatus("bad", error instanceof AiError ? error.message : "Не получилось спросить модель.");
  el.outfitNote.textContent =
    "Можно попробовать снова — или собрать образы по правилам, это бесплатно.";
  el.outfitNote.hidden = false;
  renderOutfitActions("aiFailed");
}

// ── образы под разбор ───────────────────────────────────────

const OUTFITS_KEY = "naryady.obrazy.v1";

// цвета подобраны по температуре: тёплые и холодные оттенки
const PALETTES = {
  "тёплые": [
    { name: "песочный", hex: "#d9bd94" },
    { name: "терракота", hex: "#c2684a" },
    { name: "оливковый", hex: "#8b8b5a" },
    { name: "горчичный", hex: "#c9a227" },
    { name: "кирпичный", hex: "#a44a3f" },
    { name: "тёплый беж", hex: "#ddcdb6" },
    { name: "коралловый", hex: "#cf7a5e" },
    { name: "шоколадный", hex: "#7a5641" },
  ],
  "холодные": [
    { name: "серо-голубой", hex: "#7b93a8" },
    { name: "изумрудный", hex: "#2f6f5e" },
    { name: "винный", hex: "#7b2b3b" },
    { name: "холодный серый", hex: "#9aa0a6" },
    { name: "синий деним", hex: "#4a6b8a" },
    { name: "сливовый", hex: "#5d4667" },
    { name: "лавандовый", hex: "#8b86a8" },
    { name: "стальной", hex: "#6f7c8a" },
  ],
};

// верх подбираем под форму лица: вырез и линия плеч
const SHAPE_TOPS = {
  "овал": [
    "рубашка с обычным воротником",
    "футболка с круглым вырезом",
    "джемпер с мягким воротом",
    "лонгслив с вырезом-лодочкой",
  ],
  "круг": [
    "рубашка, расстёгнутая на две верхние пуговицы",
    "футболка с вырезом уголком",
    "лонгслив с V-вырезом",
    "кардиган нараспашку поверх футболки",
  ],
  "квадрат": [
    "рубашка с мягким воротником",
    "джемпер с округлым вырезом",
    "лонгслив с вырезом-лодочкой",
    "худи с мягким капюшоном",
  ],
  "сердце": [
    "лонгслив с широким круглым вырезом",
    "рубашка с широким воротом",
    "футболка с вырезом-лодочкой",
    "свитер с объёмным воротом",
  ],
  "треугольник": [
    "джемпер с объёмным воротом",
    "рубашка с широкими плечами",
    "худи с капюшоном вокруг шеи",
    "рубашка в крупную клетку",
  ],
  "вытянутое": [
    "футболка с широким круглым вырезом",
    "рубашка с горизонтальной полосой",
    "лонгслив с вырезом-лодочкой",
    "джемпер с широкой полосой у груди",
  ],
};

// низ подбираем под черты и под то, для кого образ
const BOTTOMS = {
  "женский": {
    "мягкие": [
      "прямые брюки или юбка-миди",
      "мягкие брюки на резинке",
      "джинсы прямого кроя",
      "юбка-миди с мягкой складкой",
    ],
    "резкие": [
      "брюки со стрелкой или юбка-карандаш",
      "джинсы с чёткой линией",
      "широкие брюки с чёткой складкой",
      "кожаная юбка-карандаш",
    ],
  },
  "мужской": {
    "мягкие": [
      "прямые брюки из мягкой ткани",
      "прямые брюки из плотной ткани",
      "джинсы прямого кроя",
      "мягкие брюки на резинке",
    ],
    "резкие": [
      "брюки со стрелкой",
      "джинсы с чёткой линией",
      "широкие брюки с чёткой складкой",
      "тёмные прямые брюки",
    ],
  },
  "": {
    "мягкие": [
      "прямые брюки из мягкой ткани",
      "джинсы прямого кроя",
      "мягкие брюки на резинке",
      "прямые брюки",
    ],
    "резкие": [
      "брюки со стрелкой",
      "джинсы с чёткой линией",
      "широкие брюки с чёткой складкой",
      "тёмные прямые брюки",
    ],
  },
};

const OCCASIONS = [
  {
    key: "work",
    label: "на работу",
    title: "Спокойный образ на работу",
    shoes: {
      "женский": ["лоферы", "туфли на небольшом каблуке", "чистые белые кроссовки"],
      default: ["лоферы", "кожаные туфли", "чистые белые кроссовки"],
    },
    outer: {
      "женский": ["пиджак прямого кроя", "кардиган ниже бедра", "тренч"],
      default: ["пиджак прямого кроя", "кардиган", "тренч"],
    },
  },
  {
    key: "walk",
    label: "на прогулку",
    title: "Свободный образ на прогулку",
    shoes: {
      default: ["кеды", "ботинки на плоской подошве", "кроссовки"],
    },
    outer: {
      default: ["джинсовая куртка", "куртка-бомбер", "тренч"],
    },
  },
  {
    key: "date",
    label: "на свидание",
    title: "Собранный образ на свидание",
    shoes: {
      "женский": ["туфли на небольшом каблуке", "лоферы", "аккуратные ботинки"],
      default: ["лоферы", "кожаные туфли", "аккуратные ботинки"],
    },
    outer: {
      default: ["пиджак мягкой посадки", "кардиган", "пальто прямого кроя"],
    },
  },
  {
    key: "cafe",
    label: "в кафе с друзьями",
    title: "Лёгкий образ в кафе с друзьями",
    shoes: {
      default: ["кроссовки", "кеды", "лоферы"],
    },
    outer: {
      default: ["джинсовая куртка", "кардиган", "куртка-бомбер"],
    },
  },
];

function occasionList(occasion, part, gender) {
  return occasion[part][gender] || occasion[part].default;
}

// добрые слова: только про то, что приложение правда измерило
const FEATURES_PRAISE = {
  "женский": {
    "мягкие": "У вас мягкие, плавные черты — очень тёплое, спокойное впечатление.",
    "резкие": "У вас чёткие, выразительные черты — они делают образ ярким.",
  },
  "мужской": {
    "мягкие": "У вас мягкие, спокойные черты — с таким лицом легко выглядеть дружелюбно.",
    "резкие": "У вас чёткая линия челюсти и заметные скулы — это выглядит собранно.",
  },
  "": {
    "мягкие": "У вас мягкие, плавные черты — спокойное и тёплое впечатление.",
    "резкие": "У вас чёткие, выразительные черты — они делают образ заметным.",
  },
};

const COLOR_PRAISE = {
  "тёплые|высокий": {
    "женский": "Тёплые оттенки и заметный контраст — вам очень идут терракота, кирпичный и чистый белый.",
    "мужской": "Тёплые оттенки вам к лицу — особенно терракота, олива и тёплый беж.",
    "": "Тёплые оттенки вам к лицу — особенно терракота, олива и тёплый беж.",
  },
  "тёплые|спокойный": {
    "женский": "Вам идут мягкие тёплые оттенки — песочный, коралловый и олива.",
    "мужской": "Спокойные тёплые оттенки — песочный, олива и тёплый беж — вам к лицу.",
    "": "Спокойные тёплые оттенки — песочный, олива и тёплый беж — вам к лицу.",
  },
  "холодные|высокий": {
    "женский": "Холодные оттенки и заметный контраст — вам идут изумруд, вино и чистый белый.",
    "мужской": "Холодные оттенки вам к лицу — особенно изумруд, серо-голубой и вино.",
    "": "Холодные оттенки вам к лицу — особенно изумруд, серо-голубой и вино.",
  },
  "холодные|спокойный": {
    "женский": "Вам идут спокойные прохладные оттенки — серо-голубой, сливовый и лавандовый.",
    "мужской": "Спокойные прохладные оттенки — серо-голубой, стальной и деним — вам к лицу.",
    "": "Спокойные прохладные оттенки — серо-голубой, стальной и деним — вам к лицу.",
  },
};

function buildCompliment(values, gender) {
  const first = FEATURES_PRAISE[gender]?.[values.features];
  const second = COLOR_PRAISE[`${values.temperature}|${values.contrast}`]?.[gender];
  if (!first || !second) return "";
  return `${first} ${second}`;
}

const SHAPE_WHY = {
  "овал": "Овал: подходит почти любой вырез — выбрали удобный для случая.",
  "круг": "Круг: вырез уголком и вертикальные линии дают лицу больше длины.",
  "квадрат": "Квадрат: мягкая линия у шеи сглаживает углы и не спорит с чёткой челюстью.",
  "сердце": "Сердце: объём и детали ниже лица уравновешивают широкий лоб.",
  "треугольник": "Треугольник: объём сверху и открытая шея переносят внимание выше.",
  "вытянутое": "Вытянутое: широкий вырез и горизонтальные линии добавляют лицу ширины.",
};

const FEATURES_WHY = {
  "мягкие": "Мягкие черты: мягкий трикотаж и спокойные линии — в тон внешности.",
  "резкие": "Резкие черты: плотные ткани и чёткие линии — в тон внешности.",
};

const TEMPERATURE_WHY = {
  "тёплые": "Тёплые оттенки: песочный, терракота и олива рядом с лицом выглядят естественно.",
  "холодные": "Холодные оттенки: серо-голубой, изумруд и вино рядом с лицом выглядят естественно.",
};

const CONTRAST_WHY = {
  "высокий": "Можно соединять светлый верх и тёмный низ.",
  "спокойный": "Мягкие переходы в одной гамме смотрятся цельно.",
};

function buildOutfit(occasion, values, gender, index, variant) {
  const shape = SHAPE_TOPS[values.shape] ? values.shape : "овал";
  const features = values.features === "резкие" ? "резкие" : "мягкие";
  const temperature = PALETTES[values.temperature] ? values.temperature : "тёплые";
  const contrast = CONTRAST_WHY[values.contrast] ? values.contrast : "спокойный";
  const who = BOTTOMS[gender] ? gender : "";

  const tops = SHAPE_TOPS[shape];
  const bottoms = BOTTOMS[who][features];
  const palette = PALETTES[temperature];
  const shoesList = occasionList(occasion, "shoes", who);
  const outerList = occasionList(occasion, "outer", who);

  const top = tops[(index + variant) % tops.length];
  const bottom = bottoms[(index + variant + 1) % bottoms.length];
  const shoes = shoesList[(index + variant) % shoesList.length];
  const outer = outerList[(index + variant + 1) % outerList.length];
  const colors = [
    palette[(index * 2 + variant) % palette.length],
    palette[(index * 2 + 1 + variant) % palette.length],
  ];

  // пункты чередуем, чтобы карточки не выглядели копией друг друга
  const colorsWhy =
    index % 2
      ? `${CONTRAST_WHY[contrast]} ${TEMPERATURE_WHY[temperature]}`
      : `${TEMPERATURE_WHY[temperature]} ${CONTRAST_WHY[contrast]}`;
  const first = index % 2 ? FEATURES_WHY[features] : SHAPE_WHY[shape];
  const second = index % 2 ? SHAPE_WHY[shape] : FEATURES_WHY[features];

  return {
    occasion: occasion.key,
    label: occasion.label,
    title: occasion.title,
    items: [
      ["Верх", top],
      ["Низ", bottom],
      ["Обувь", shoes],
      ["Верхний слой", outer],
    ],
    colors,
    why: [
      first,
      second,
      colorsWhy,
    ],
    variant,
    liked: false,
  };
}

function outfitSignature(outfit) {
  return [
    outfit.title,
    ...outfit.items.map((item) => item[1]),
    outfit.colors.map((color) => color.name).join("/"),
  ].join("|");
}

function generateOutfits(values, gender, round = 0) {
  return OCCASIONS.map((occasion, index) => buildOutfit(occasion, values, gender, index, round));
}

function replaceOutfit(index) {
  if (state.replacing) return;

  const cards = state.outfits.cards;
  const current = cards[index];
  const occasion = OCCASIONS.find((item) => item.key === current.occasion) || OCCASIONS[index];
  const base = OCCASIONS.indexOf(occasion);

  const byRules = () => {
    const previous = outfitSignature(current);
    let variant = (current.variant || 0) + 1;
    let next = buildOutfit(occasion, state.razbor.values, state.profile.gender, base, variant);

    // новый образ не должен повторять ни старый, ни соседние карточки
    for (let step = 0; step < 12; step += 1) {
      const same = outfitSignature(next) === previous || cards.some(
        (card, cardIndex) => cardIndex !== index && outfitSignature(card) === outfitSignature(next)
      );
      if (!same) break;
      variant += 1;
      next = buildOutfit(occasion, state.razbor.values, state.profile.gender, base, variant);
    }

    cards[index] = next;
    persistOutfits();
    renderOutfitCards();
    setOutfitStatus("ok", "Заменили на другой образ.");
    el.outfitCards.children[index]?.querySelector(".outfit__like")?.focus();
  };

  if (state.outfits.source !== "ai" || !hasAiKey()) {
    byRules();
    return;
  }

  const controller = new AbortController();
  state.outfitAbort = controller;
  state.replacing = true;
  setOutfitStatus("wait", "Подбираем другой образ…");

  const exclude = [
    current.title,
    ...current.items.map((item) => item[1]),
    ...current.colors.map((color) => color.name),
  ];

  requestAiOutfits({
    values: state.razbor.values,
    gender: state.profile.gender,
    labels: [occasion.label],
    exclude,
    signal: controller.signal,
  })
    .then((list) => {
      const next = normalizeAiOutfit(list[0], base, state.razbor.values);
      if (!next) throw new AiError("Модель предложила непонятный образ.");
      next.occasion = occasion.key;
      cards[index] = next;
      persistOutfits();
      renderOutfitCards();
      setOutfitStatus("ok", "Заменили на другой образ.");
      el.outfitCards.children[index]?.querySelector(".outfit__like")?.focus();
    })
    .catch((error) => {
      if (error && error.name === "AbortError") return;
      console.error(error);
      byRules();
      setOutfitStatus(
        "bad",
        `${error instanceof AiError ? error.message : "Модель не ответила."} Пока заменили по правилам.`
      );
    })
    .finally(() => {
      state.replacing = false;
      state.outfitAbort = null;
    });
}

const OUTFIT_WHO = {
  "женский": "Образы для женщин",
  "мужской": "Образы для мужчин",
  "": "Универсальные образы",
};

function renderOutfitWho() {
  el.outfitWho.textContent = OUTFIT_WHO[state.profile.gender] || OUTFIT_WHO[""];
}

function setOutfitStatus(kind, text) {
  el.outfitStatus.className = `status status--${kind}`;
  el.outfitStatus.replaceChildren();
  if (kind === "wait") el.outfitStatus.append(spinner());
  el.outfitStatus.append(document.createTextNode(text));
}

function renderOutfitSource() {
  if (!state.outfits) {
    el.outfitSource.textContent = "";
    return;
  }
  if (state.outfits.source === "ai") {
    const model = AI_MODELS.find((item) => item.value === state.outfits.model);
    el.outfitSource.textContent = `Собрано моделью DeepSeek${model ? " · " + model.label : ""}`;
    return;
  }
  el.outfitSource.textContent = "Собрано по правилам";
}

function renderOutfitCards() {
  el.outfitCards.replaceChildren();
  if (!state.outfits) return;
  state.outfits.cards.forEach((outfit, index) => {
    el.outfitCards.append(buildOutfitCard(outfit, index));
  });
}

function buildOutfitCard(outfit, index) {
  const card = document.createElement("section");
  card.className = "outfit";
  if (outfit.liked) card.classList.add("is-liked");

  const head = document.createElement("div");
  head.className = "outfit__head";

  const label = document.createElement("span");
  label.className = "outfit__label";
  label.textContent = outfit.label;

  const likedBadge = document.createElement("span");
  likedBadge.className = "outfit__liked";
  likedBadge.textContent = "♥ нравится";
  likedBadge.hidden = !outfit.liked;

  head.append(label, likedBadge);

  const title = document.createElement("h2");
  title.className = "outfit__title";
  title.textContent = outfit.title;

  const items = document.createElement("dl");
  items.className = "outfit__items";
  for (const [name, value] of outfit.items) {
    const row = document.createElement("div");
    row.className = "outfit__row";
    const term = document.createElement("dt");
    term.className = "outfit__term";
    term.textContent = name;
    const detail = document.createElement("dd");
    detail.className = "outfit__detail";
    detail.textContent = value;
    row.append(term, detail);
    items.append(row);
  }

  const colors = document.createElement("div");
  colors.className = "outfit__colors";
  const colorLabel = document.createElement("span");
  colorLabel.className = "outfit__term";
  colorLabel.textContent = "Цвета";
  const swatches = document.createElement("span");
  swatches.className = "swatches";
  for (const color of outfit.colors) {
    const swatch = document.createElement("span");
    swatch.className = "swatch";
    swatch.style.background = color.hex;
    swatch.setAttribute("aria-hidden", "true");
    const name = document.createElement("span");
    name.className = "swatch__name";
    name.textContent = color.name;
    swatches.append(swatch, name);
  }
  colors.append(colorLabel, swatches);

  const whyTitle = document.createElement("h3");
  whyTitle.className = "outfit__subtitle";
  whyTitle.textContent = "Почему подходит";

  const why = document.createElement("ul");
  why.className = "outfit__why";
  for (const reason of outfit.why) {
    const item = document.createElement("li");
    item.textContent = reason;
    why.append(item);
  }

  const buttons = document.createElement("div");
  buttons.className = "outfit__buttons";

  const like = document.createElement("button");
  like.type = "button";
  like.className = "chip chip--like outfit__like";
  like.textContent = outfit.liked ? "♥ Нравится" : "Нравится";
  like.setAttribute("aria-pressed", String(outfit.liked));
  like.setAttribute("aria-label", `Отметить образ «${outfit.title}»`);
  like.addEventListener("click", () => {
    outfit.liked = !outfit.liked;
    persistOutfits();
    renderOutfitCards();
    setOutfitStatus(
      "ok",
      outfit.liked ? "Отметили образ — он сохранится." : "Сняли отметку с образа."
    );
    el.outfitCards.children[index]?.querySelector(".outfit__like")?.focus();
  });

  const dislike = document.createElement("button");
  dislike.type = "button";
  dislike.className = "chip";
  dislike.textContent = "Не нравится";
  dislike.setAttribute("aria-label", `Заменить образ «${outfit.title}»`);
  dislike.addEventListener("click", () => replaceOutfit(index));

  buttons.append(like, dislike);
  card.append(head, title, items, colors, whyTitle, why, buttons);
  return card;
}

function renderOutfitActions(mode) {
  el.outfitActions.replaceChildren();

  const back = document.createElement("button");
  back.type = "button";
  back.className = "btn btn--ghost";
  back.textContent = "Назад к разбору";
  back.addEventListener("click", () => {
    state.outfitRun += 1;
    if (state.outfitAbort) {
      state.outfitAbort.abort();
      state.outfitAbort = null;
    }
    showScreen("analysis");
    renderAnalysisActions();
  });

  if (mode === "loading") {
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "btn btn--ghost";
    cancel.textContent = "Отменить";
    cancel.addEventListener("click", () => {
      state.outfitRun += 1;
      if (state.outfitAbort) {
        state.outfitAbort.abort();
        state.outfitAbort = null;
      }
      showScreen("analysis");
      renderAnalysisActions();
    });
    el.outfitActions.append(cancel);
    return;
  }

  if (mode === "aiFailed") {
    const retry = document.createElement("button");
    retry.type = "button";
    retry.className = "btn btn--primary";
    retry.textContent = "Попробовать снова";
    retry.addEventListener("click", () => startOutfits());

    const rules = document.createElement("button");
    rules.type = "button";
    rules.className = "btn btn--ghost";
    rules.textContent = "Собрать на правилах";
    rules.addEventListener("click", () => startOutfits(true));

    el.outfitActions.append(retry, rules, back);
    return;
  }

  if (mode === "retry") {
    const retry = document.createElement("button");
    retry.type = "button";
    retry.className = "btn btn--primary";
    retry.textContent = "Попробовать снова";
    retry.addEventListener("click", () => startOutfits());
    el.outfitActions.append(retry, back);
    return;
  }

  if (mode === "missing") {
    const fix = document.createElement("button");
    fix.type = "button";
    fix.className = "btn btn--primary";
    fix.textContent = "Вернуться к разбору";
    fix.addEventListener("click", () => {
      showScreen("analysis");
      renderAnalysisActions();
    });
    el.outfitActions.append(fix);
    return;
  }

  el.outfitActions.append(back);

  if (state.outfits) {
    const again = document.createElement("button");
    again.type = "button";
    again.className = "linkbtn";
    again.textContent = "Подобрать все образы заново";
    again.addEventListener("click", () => {
      if (state.outfits && state.outfits.source === "ai" && hasAiKey()) {
        state.outfitBackup = state.outfits;
        state.outfits = null;
        startOutfits();
        return;
      }
      const round = (state.outfitRound || 0) + 1;
      state.outfitRound = round;
      state.outfits = {
        v: 1,
        source: "rules",
        cards: generateOutfits(state.razbor.values, state.profile.gender, round),
      };
      persistOutfits();
      renderOutfitCards();
      renderOutfitSource();
      setOutfitStatus("ok", "Собрали новый набор.");
    });
    el.outfitActions.append(again);
  }
}

async function startOutfits(forceRules = false) {
  showScreen("outfits");
  renderOutfitWho();
  el.outfitCards.replaceChildren();

  if (state.outfits) {
    clearStatus(el.outfitStatus);
    renderOutfitCards();
    renderOutfitSource();
    el.outfitNote.textContent = "Это идеи, а не правила. Нравится — оставьте, не нравится — замените.";
    el.outfitNote.hidden = false;
    renderOutfitActions("ready");
    return;
  }

  el.outfitNote.hidden = true;
  renderOutfitActions("loading");

  const run = ++state.outfitRun;
  const values = (state.razbor && state.razbor.values) || {};
  const missing = RAZBOR_FIELDS.filter((field) => !values[field.key]);

  if (missing.length) {
    setOutfitStatus("bad", "В разборе не хватает значений — без них образы не собрать.");
    el.outfitNote.textContent =
      "Вернитесь к разбору и выберите значения вручную. Это пара нажатий.";
    el.outfitNote.hidden = false;
    renderOutfitActions("missing");
    return;
  }

  if (!forceRules && hasAiKey()) {
    const controller = new AbortController();
    state.outfitAbort = controller;
    setOutfitStatus("wait", "Спрашиваем модель DeepSeek…");

    try {
      const labels = OCCASIONS.map((occasion) => occasion.label);
      const list = await requestAiOutfits({
        values,
        gender: state.profile.gender,
        labels,
        exclude: [],
        signal: controller.signal,
      });
      if (run !== state.outfitRun) {
        restoreOutfitBackup();
        return;
      }

      const cards = list
        .slice(0, 4)
        .map((raw, index) => normalizeAiOutfit(raw, index, values))
        .filter(Boolean);

      if (cards.length < 3) throw new AiError("Модель не собрала образы. Попробуйте ещё раз.");

      state.outfitRound = 0;
      state.outfits = { v: 1, source: "ai", model: state.settings.model, cards };
      state.outfitBackup = null;
      persistOutfits();
      clearStatus(el.outfitStatus);
      renderOutfitCards();
      renderOutfitSource();
      el.outfitNote.textContent =
        "Образы придумала модель. Если что-то не про вас — нажмите «Не нравится».";
      el.outfitNote.hidden = false;
      renderOutfitActions("ready");
    } catch (error) {
      if (run !== state.outfitRun) {
        restoreOutfitBackup();
        return;
      }
      if (error && error.name === "AbortError") {
        restoreOutfitBackup();
        return;
      }
      console.error(error);
      showAiError(error);
    } finally {
      state.outfitAbort = null;
    }
    return;
  }

  setOutfitStatus("wait", "Подбираем образы под ваш разбор…");
  await new Promise((resolve) => setTimeout(resolve, 650));
  if (run !== state.outfitRun) return;

  try {
    state.outfitRound = 0;
    state.outfits = {
      v: 1,
      source: "rules",
      cards: generateOutfits(values, state.profile.gender),
    };
    state.outfitBackup = null;
    persistOutfits();
    clearStatus(el.outfitStatus);
    renderOutfitCards();
    renderOutfitSource();
    el.outfitNote.textContent = "Это идеи, а не правила. Нравится — оставьте, не нравится — замените.";
    el.outfitNote.hidden = false;
    renderOutfitActions("ready");
  } catch (error) {
    if (run !== state.outfitRun) return;
    console.error(error);
    setOutfitStatus("bad", "Не получилось подобрать образы. Попробуйте ещё раз — это быстро.");
    renderOutfitActions("retry");
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

function persistOutfits() {
  if (!state.outfits) return;
  try {
    localStorage.setItem(OUTFITS_KEY, JSON.stringify(state.outfits));
  } catch {
    // хранилище может быть выключено — тогда просто не запоминаем
  }
}

function loadOutfits() {
  try {
    const raw = localStorage.getItem(OUTFITS_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.v !== 1 || !Array.isArray(data.cards) || !data.cards.length) return null;
    return data;
  } catch {
    return null;
  }
}

function clearOutfits() {
  state.outfits = null;
  state.outfitRound = 0;
  try {
    localStorage.removeItem(OUTFITS_KEY);
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
  el.outfitCards.replaceChildren();
  el.outfitActions.replaceChildren();
  clearStatus(el.outfitStatus);
  clearStatus(el.analysisStatus);
  renderCompliment();
  showScreen("start");
}

// ── отрисовка ───────────────────────────────────────────────

const SCREENS = {
  start: { node: () => el.screenStart, step: "Шаг 1 из 3" },
  review: { node: () => el.screenReview, step: "Шаг 1 из 3" },
  analysis: { node: () => el.screenAnalysis, step: "Шаг 2 из 3" },
  outfits: { node: () => el.screenOutfits, step: "Шаг 3 из 3" },
  settings: { node: () => el.screenSettings, step: "Настройки" },
};

function showScreen(name) {
  for (const key of Object.keys(SCREENS)) {
    SCREENS[key].node().hidden = key !== name;
  }
  if (name !== "settings") state.lastScreen = name;
  el.steps.textContent = SCREENS[name].step;
  el.settingsBtn.hidden = name === "settings";

  if (name === "review") el.titleReview.focus({ preventScroll: true });
  if (name === "analysis") el.titleAnalysis.focus({ preventScroll: true });
  if (name === "outfits") el.titleOutfits.focus({ preventScroll: true });
  if (name === "settings") el.titleSettings.focus({ preventScroll: true });
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
  const savedSettings = loadSettings();
  if (savedSettings) {
    state.settings.key = String(savedSettings.key || "");
    state.settings.model = AI_MODELS.some((item) => item.value === savedSettings.model)
      ? savedSettings.model
      : "deepseek-v4-flash";
  }

  const savedProfile = loadProfile();
  if (savedProfile) {
    state.profile = {
      gender: GENDERS.some((item) => item.value === savedProfile.gender) ? savedProfile.gender : "",
      hideCompliment: Boolean(savedProfile.hideCompliment),
    };
  }
  renderGenderChips();

  const saved = loadRazbor();
  if (saved && !(saved.failed && !Object.keys(saved.manual || {}).length)) {
    state.razbor = saved;
    state.manual = { ...(saved.manual || {}) };

    const savedOutfits = loadOutfits();
    if (savedOutfits) state.outfits = savedOutfits;

    showScreen("analysis");
    renderCards();
    renderAnalysisActions();
    renderCompliment();
    el.analysisPhoto.replaceChildren(photoPreview());
    el.analysisNote.textContent = state.outfits
      ? "Разбор и образы сохранены на этом устройстве. Фото мы не храним — загрузите новое, чтобы обновить черты."
      : "Разбор сохранён на этом устройстве. Фото мы не храним — загрузите новое, чтобы обновить черты.";
    el.analysisNote.hidden = false;
    return;
  }

  showScreen("start");
})();

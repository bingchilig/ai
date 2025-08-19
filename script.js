// === 전역 ===
let model, webcam, labels = [];
const MODEL_URL = "model/model.json";
const META_URL  = "model/metadata.json";

// UI 참조
const resultImg = document.getElementById("result");
const camLabelEl = document.getElementById("cam-label");
const camConfEl  = document.getElementById("cam-conf");
const fileLabelEl = document.getElementById("file-label");
const fileConfEl  = document.getElementById("file-conf");
const upload = document.getElementById("upload");
const analyzeBtn = document.getElementById("analyzeBtn");

// === 라벨→이미지 매핑 ===
// 요구사항: "모델 Class 2 → images/class0.png", "모델 Class 1 → images/class1.png"
function mapLabelToImage(label) {
  const L = (label || "").trim().toLowerCase();
  if (L === "class 2") return "images/class0.png";
  if (L === "class 1") return "images/class1.png";
  // 예외 상황 대비 (metadata 라벨과 안 맞을 때)
  // labels[0]이 Class 1, labels[1]이 Class 2라는 TM 기본 구조를 가정한 백업 로직
  return (labels.indexOf(label) === 1) ? "images/class0.png" : "images/class1.png";
}

// === 모델 로드 ===
async function loadModel() {
  model = await tmImage.load(MODEL_URL, META_URL);
  labels = model.getClassLabels(); // ex: ["Class 1", "Class 2"]
  console.log("Model loaded. labels =", labels);
}

// === 카메라 셋업 ===
async function setupWebcam() {
  const flip = true; // 셀피 모드
  webcam = new tmImage.Webcam(320, 240, flip);
  await webcam.setup({ facingMode: "user" });
  await webcam.play();
  document.getElementById("webcam-container").appendChild(webcam.canvas);
  window.requestAnimationFrame(loop);
}

// === 실시간 루프(모바일 고려: 300ms로 스로틀) ===
let lastT = 0;
async function loop(ts) {
  webcam.update();
  if (!lastT || ts - lastT > 300) { // 약 3fps 추론
    await predictFromSource(webcam.canvas, "cam");
    lastT = ts;
  }
  window.requestAnimationFrame(loop);
}

// === 예측 공통 ===
async function predictFromSource(source, mode) {
  // Teachable Machine은 내부에서 전처리 처리함
  const preds = await model.predict(source, false); // source: canvas/image/video

  // top-1
  let top = preds[0];
  for (const p of preds) if (p.probability > top.probability) top = p;

  const label = top.className; // "Class 1" or "Class 2"
  const conf = Math.round(top.probability * 100);

  // UI 갱신
  if (mode === "cam") {
    camLabelEl.textContent = label;
    camConfEl.textContent = `${conf}%`;
  } else {
    fileLabelEl.textContent = label;
    fileConfEl.textContent = `${conf}%`;
  }

  // 결과 이미지 매핑 (항상 최신 예측만 반영)
  resultImg.src = mapLabelToImage(label);
}

// === 파일 업로드 미리보기 + '적용하기'로 분석 ===
upload.addEventListener("change", () => {
  const f = upload.files?.[0];
  if (!f) return;
  const url = URL.createObjectURL(f);
  const img = document.getElementById("preview");
  img.src = url;
});

analyzeBtn.addEventListener("click", async () => {
  const img = document.getElementById("preview");
  if (!img || !img.src) {
    alert("파일을 먼저 선택하세요.");
    return;
  }
  // 이미지 로딩 완료 보장
  if (!img.complete) {
    await new Promise(r => { img.onload = r; img.onerror = r; });
  }
  await predictFromSource(img, "file");
});

// === 부팅 ===
(async function main() {
  try {
    await loadModel();
    await setupWebcam();
  } catch (e) {
    console.error(e);
    alert("모델 또는 카메라 로드에 실패했습니다. 파일 경로와 권한을 확인하세요.");
  }
})();

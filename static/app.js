async function loadProfiles() {
  const res = await fetch("/api/profiles");
  const profiles = await res.json();

  const list = document.getElementById("profile-list");
  list.innerHTML = "";

  for (const profile of profiles) {
    const li = document.createElement("li");
    li.innerHTML = `
      <img src="/images/${profile.image_path}" alt="${profile.name}">
      <div>${profile.name}</div>
      <button class="delete-btn" data-id="${profile.id}">Delete</button>
    `;
    list.appendChild(li);
  }

  list.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await fetch(`/api/profiles/${btn.dataset.id}`, { method: "DELETE" });
      loadProfiles();
    });
  });
}

function showResult(el, text, cssClass) {
  el.textContent = text;
  el.className = `result ${cssClass}`;
}

const enrollFileInput = document.getElementById("enroll-file-input");
const capturePreview = document.getElementById("capture-preview");
let capturedEnrollBlob = null;

enrollFileInput.addEventListener("change", () => {
  // Choosing a file overrides any previously captured photo.
  capturedEnrollBlob = null;
  capturePreview.classList.add("hidden");
});

document.getElementById("enroll-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const resultEl = document.getElementById("enroll-result");

  const formData = new FormData();
  formData.append("name", form.name.value);
  if (capturedEnrollBlob) {
    formData.append("image", capturedEnrollBlob, "capture.jpg");
  } else if (enrollFileInput.files[0]) {
    formData.append("image", enrollFileInput.files[0]);
  } else {
    showResult(resultEl, "Choose a file or capture a photo first", "no-match");
    return;
  }

  const res = await fetch("/api/profiles", { method: "POST", body: formData });
  const data = await res.json();

  if (res.ok) {
    showResult(resultEl, `Enrolled "${data.name}" (id ${data.id})`, "match");
    form.reset();
    capturedEnrollBlob = null;
    capturePreview.classList.add("hidden");
    loadProfiles();
  } else {
    showResult(resultEl, `Error: ${data.detail}`, "no-match");
  }
});

loadProfiles();

// --- Live webcam scanning ---
// Periodic capture-and-POST against the same /api/recognize endpoint the upload
// form uses. Deliberately NOT setInterval: the next poll is only scheduled once
// the previous request resolves, so a slow CPU inference can never cause
// requests to pile up.
const RECOGNIZE_POLL_DELAY_MS = 800;

const liveVideo = document.getElementById("live-video");
const liveOverlay = document.getElementById("live-overlay");
const liveStatus = document.getElementById("live-status");
const startBtn = document.getElementById("live-start-btn");
const stopBtn = document.getElementById("live-stop-btn");

const captureCanvas = document.createElement("canvas"); // offscreen, never appended
const captureCtx = captureCanvas.getContext("2d");

let liveStream = null;
let livePolling = false;

liveVideo.addEventListener("loadedmetadata", () => {
  liveOverlay.width = liveVideo.videoWidth;
  liveOverlay.height = liveVideo.videoHeight;
});

function setLiveStatus(text) {
  liveStatus.textContent = text;
}

function captureFrameAsBlob() {
  if (!liveVideo.videoWidth) return Promise.resolve(null);
  captureCanvas.width = liveVideo.videoWidth;
  captureCanvas.height = liveVideo.videoHeight;
  captureCtx.drawImage(liveVideo, 0, 0, captureCanvas.width, captureCanvas.height);
  return new Promise((resolve) => captureCanvas.toBlob(resolve, "image/jpeg", 0.8));
}

function renderLiveResult(data) {
  const ctx = liveOverlay.getContext("2d");
  ctx.clearRect(0, 0, liveOverlay.width, liveOverlay.height);

  if (!data.bbox) {
    setLiveStatus(data.reason === "no_face_detected" ? "No face detected" : "Scanning...");
    return;
  }

  const [x1, y1, x2, y2] = data.bbox;
  ctx.lineWidth = 3;
  ctx.strokeStyle = data.match ? "#4caf50" : "#e57373";
  ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

  setLiveStatus(
    data.match
      ? `Match: ${data.match.name} (score ${data.match.score.toFixed(3)})`
      : `No match${data.best_score != null ? ` (best score ${data.best_score.toFixed(3)})` : ""}`
  );
}

async function liveScanLoop() {
  if (!livePolling) return;
  try {
    const blob = await captureFrameAsBlob();
    if (blob) {
      const formData = new FormData();
      formData.append("image", blob, "frame.jpg");
      const res = await fetch("/api/recognize", { method: "POST", body: formData });
      const data = await res.json();
      if (livePolling) renderLiveResult(data);
    }
  } catch (err) {
    if (livePolling) setLiveStatus("Error: " + err.message);
  } finally {
    if (livePolling) setTimeout(liveScanLoop, RECOGNIZE_POLL_DELAY_MS);
  }
}

function stopLiveScan() {
  livePolling = false;
  if (liveStream) {
    liveStream.getTracks().forEach((track) => track.stop());
    liveStream = null;
  }
  liveVideo.srcObject = null;
  liveOverlay.getContext("2d").clearRect(0, 0, liveOverlay.width, liveOverlay.height);
  startBtn.disabled = false;
  stopBtn.disabled = true;
  setLiveStatus("Camera off");
}

async function ensureCameraStarted() {
  if (liveStream) return true;
  try {
    liveStream = await navigator.mediaDevices.getUserMedia({
      video: { width: 1280, height: 720 },
      audio: false,
    });
  } catch (err) {
    setLiveStatus("Camera permission denied or unavailable: " + err.message);
    return false;
  }
  liveVideo.srcObject = liveStream;
  await liveVideo.play();
  livePolling = true;
  startBtn.disabled = true;
  stopBtn.disabled = false;
  setLiveStatus("Scanning...");
  liveScanLoop();
  return true;
}

startBtn.addEventListener("click", ensureCameraStarted);
stopBtn.addEventListener("click", stopLiveScan);
window.addEventListener("pagehide", stopLiveScan);

// --- Capture Photo (Enroll panel) ---
// Reuses the same live camera feed and frame-grab helper as live scanning, so
// there's only ever one camera stream on the page.
document.getElementById("capture-photo-btn").addEventListener("click", async () => {
  const started = await ensureCameraStarted();
  if (!started) return;

  const blob = await captureFrameAsBlob();
  if (!blob) {
    setLiveStatus("Camera not ready yet — try again in a moment");
    return;
  }

  capturedEnrollBlob = blob;
  enrollFileInput.value = ""; // captured photo takes precedence over any chosen file
  capturePreview.src = URL.createObjectURL(blob);
  capturePreview.classList.remove("hidden");
});

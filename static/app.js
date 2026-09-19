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

document.getElementById("enroll-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const resultEl = document.getElementById("enroll-result");

  const res = await fetch("/api/profiles", {
    method: "POST",
    body: new FormData(form),
  });
  const data = await res.json();

  if (res.ok) {
    showResult(resultEl, `Enrolled "${data.name}" (id ${data.id})`, "match");
    form.reset();
    loadProfiles();
  } else {
    showResult(resultEl, `Error: ${data.detail}`, "no-match");
  }
});

document.getElementById("recognize-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const resultEl = document.getElementById("recognize-result");

  const res = await fetch("/api/recognize", {
    method: "POST",
    body: new FormData(form),
  });
  const data = await res.json();

  if (!res.ok) {
    showResult(resultEl, `Error: ${data.detail}`, "no-match");
  } else if (data.match) {
    showResult(
      resultEl,
      `Match: ${data.match.name} (score ${data.match.score.toFixed(3)})`,
      "match"
    );
  } else if (data.reason === "no_face_detected") {
    showResult(resultEl, "No face detected in image", "no-match");
  } else {
    const scoreText =
      data.best_score !== null && data.best_score !== undefined
        ? ` (best score ${data.best_score.toFixed(3)})`
        : "";
    showResult(resultEl, `No match found${scoreText}`, "no-match");
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

startBtn.addEventListener("click", async () => {
  try {
    liveStream = await navigator.mediaDevices.getUserMedia({
      video: { width: 1280, height: 720 },
      audio: false,
    });
  } catch (err) {
    setLiveStatus("Camera permission denied or unavailable: " + err.message);
    return;
  }
  liveVideo.srcObject = liveStream;
  await liveVideo.play();
  livePolling = true;
  startBtn.disabled = true;
  stopBtn.disabled = false;
  setLiveStatus("Scanning...");
  liveScanLoop();
});

stopBtn.addEventListener("click", stopLiveScan);
window.addEventListener("pagehide", stopLiveScan);

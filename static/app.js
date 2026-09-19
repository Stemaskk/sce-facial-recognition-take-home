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

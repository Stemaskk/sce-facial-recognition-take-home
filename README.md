# SCE Facial Recognition Take Home

A face recognition pipeline built for the AI&FPGA Project Take Home: detect a face, generate an
embedding, and match it against enrolled profiles via cosine similarity. Running
locally, with a small web dashboard for enrolling people and viewing recognition
results.

## Description

End-to-end flow: 
1. An image comes in (webcam snapshot or upload) 
2. A face is detected
3. A numeric embedding is generated for that face
4. That embedding is compared against every enrolled profile's embedding using cosine similarity
5. The closest match above a threshold is returned, or "no match" if nothing clears it.

Enrollment is the same first two steps, plus saving the resulting embedding, name, and photo.

Tools used, and why:

- **[InsightFace](https://github.com/deepinsight/insightface)** (`buffalo_l` model
  pack) for both face detection and embedding generation — it bundles a RetinaFace/SCRFD
  detector with an ArcFace recognition model in one library, so there's no need to wire
  together separate detection and recognition models by hand. ArcFace embeddings are
  specifically trained so that cosine similarity can be used for face recognition,
  which is exactly what this pipeline needs.
- **[onnxruntime](https://onnxruntime.ai/)** (CPU) as the inference backend InsightFace
  runs on.
- **[FastAPI](https://fastapi.tiangolo.com/)** for the backend API (enroll, list,
  delete, recognize) — async-friendly, minimal boilerplate, and serves the static
  dashboard directly, so there's a single process to run.
- **SQLite** (via Python's stdlib `sqlite3`) for storing enrolled profiles — one table,
  a handful of queries; a full database server or ORM would be overkill at this scale.
- **Plain HTML/CSS/JS** for the dashboard — no framework or build step, since the goal
  is demonstrating the pipeline, not the frontend.

## Installation

Requires Python 3.10+.

```bash
git clone https://github.com/Stemaskk/sce-facial-recognition-take-home.git
cd sce-facial-recognition-take-home
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Notes:
- Installing `insightface` can take a few minutes (it builds some Cython extensions).
  On macOS, if the build fails, run `xcode-select --install` first.
- The **first time** the app runs, InsightFace downloads its `buffalo_l` model pack
  (~280MB) to `~/.insightface/models/`. This happens automatically but takes a minute
  or two on first startup — it's not a hang.

## Usage

Start the server:

```bash
uvicorn backend.main:app --reload --port 8000
```

Then open **http://localhost:8000** in a browser. This runs entirely on your machine.

- **Enroll a profile**: enter a name, then either choose a photo file or click
  "Capture Photo" (grabs a frame from your webcam), then click Enroll.
- **Live Scan**: click "Start Camera" and allow browser camera access — the page
  continuously scans the feed and draws a box around the best-matching enrolled
  profile (with similarity score), or shows "No match" / "No face detected."
  Click "Stop Camera" when done.
- **Enrolled Profiles**: lists everyone enrolled so far, with a Delete button for each.

## Roadmap

- [x] Detection + embedding pipeline
- [x] Local web dashboard (enroll profiles, run recognition)

## Contributing

Solo take-home project, not open to outside contributions.

## Authors and Acknowledgment

[Aiden Chung](https://github.com/Stemaskk)

## License

[MIT](LICENSE)

## Project Status

Active — core pipeline (detection, embedding, matching, storage, dashboard, live
webcam scanning) is complete. FPGA acceleration remains an open stretch goal.

"""FastAPI app: enroll/list/delete profiles, and run recognition against them."""

import uuid
from contextlib import asynccontextmanager
from pathlib import Path

import cv2
import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile, Form
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles

from backend import face_engine, storage
from backend.config import IMAGES_DIR, MATCH_THRESHOLD, STATIC_DIR, ensure_data_dirs
from backend.matching import find_best_match

# StaticFiles requires its directory to exist at mount time, which happens at
# import time below — before the lifespan startup hook would otherwise run.
ensure_data_dirs()


@asynccontextmanager
async def lifespan(app: FastAPI):
    storage.init_db()
    face_engine.warmup()
    yield


app = FastAPI(lifespan=lifespan)


def _decode_upload(data: bytes) -> np.ndarray:
    image = cv2.imdecode(np.frombuffer(data, dtype=np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(status_code=400, detail="Could not decode image")
    return image


@app.post("/api/profiles", status_code=201)
async def enroll_profile(name: str = Form(...), image: UploadFile = File(...)):
    data = await image.read()
    frame = _decode_upload(data)

    faces = face_engine.detect_and_embed(frame)
    if len(faces) == 0:
        raise HTTPException(status_code=400, detail="No face detected in image")
    if len(faces) > 1:
        raise HTTPException(
            status_code=400, detail=f"Expected exactly one face, found {len(faces)}"
        )

    ext = Path(image.filename or "upload.jpg").suffix or ".jpg"
    filename = f"{uuid.uuid4().hex}{ext}"
    (IMAGES_DIR / filename).write_bytes(data)

    profile_id = storage.insert_profile(name, faces[0].embedding, filename)
    profile = storage.get_profile(profile_id)
    return profile


@app.get("/api/profiles")
async def list_profiles():
    return storage.list_profiles()


@app.delete("/api/profiles/{profile_id}", status_code=204)
async def delete_profile(profile_id: int):
    profile = storage.get_profile(profile_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="Profile not found")

    image_path = IMAGES_DIR / profile["image_path"]
    storage.delete_profile(profile_id)
    image_path.unlink(missing_ok=True)
    return Response(status_code=204)


@app.post("/api/recognize")
async def recognize(image: UploadFile = File(...)):
    data = await image.read()
    frame = _decode_upload(data)

    faces = face_engine.detect_and_embed(frame)
    if len(faces) == 0:
        return {"match": None, "reason": "no_face_detected"}

    primary = max(faces, key=lambda f: f.det_score)
    candidates = storage.all_embeddings()
    best = find_best_match(primary.embedding, candidates)

    if best is None or best[2] < MATCH_THRESHOLD:
        return {
            "match": None,
            "reason": "no_match",
            "best_score": best[2] if best else None,
            "faces_detected": len(faces),
        }

    profile_id, name, score = best
    return {
        "match": {"id": profile_id, "name": name, "score": score},
        "faces_detected": len(faces),
    }


app.mount("/images", StaticFiles(directory=IMAGES_DIR), name="images")
app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")

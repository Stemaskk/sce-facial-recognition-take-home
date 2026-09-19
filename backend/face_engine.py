"""Face detection + embedding, backed by InsightFace's buffalo_l model pack
(SCRFD/RetinaFace detector + ArcFace r100 recognition, 512-d embeddings).

Everything downstream of this module only ever touches ``DetectedFace.embedding``
as a plain float32 vector — that's the deliberate seam for swapping in an
FPGA-accelerated embedding step later without touching storage/matching/API code.
"""

from dataclasses import dataclass

import numpy as np
from insightface.app import FaceAnalysis

from backend.config import FACE_MODEL_PACK


@dataclass
class DetectedFace:
    bbox: tuple[float, float, float, float]
    embedding: np.ndarray  # float32, shape (512,)
    det_score: float


_app: FaceAnalysis | None = None


def _get_app() -> FaceAnalysis:
    global _app
    if _app is None:
        # ctx_id=-1 selects CPU (a non-negative value would pick a GPU device id).
        # CPU-only is the right call here: "on your laptop" shouldn't require CUDA.
        _app = FaceAnalysis(name=FACE_MODEL_PACK, providers=["CPUExecutionProvider"])
        _app.prepare(ctx_id=-1, det_size=(640, 640))
    return _app


def warmup() -> None:
    """Load the model pack eagerly so the first HTTP request isn't the one paying
    for it (first-ever call also triggers InsightFace's one-time model download)."""
    _get_app()


def detect_and_embed(image_bgr: np.ndarray) -> list[DetectedFace]:
    """Run detection + embedding on a BGR image (as returned by cv2.imdecode)."""
    faces = _get_app().get(image_bgr)
    return [
        DetectedFace(
            bbox=tuple(face.bbox.tolist()),
            embedding=face.embedding.astype(np.float32),
            det_score=float(face.det_score),
        )
        for face in faces
    ]

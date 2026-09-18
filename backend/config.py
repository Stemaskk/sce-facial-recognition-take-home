from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT_DIR / "data"
IMAGES_DIR = DATA_DIR / "images"
DB_PATH = DATA_DIR / "faces.db"
STATIC_DIR = ROOT_DIR / "static"

# InsightFace model pack: RetinaFace/SCRFD detector + ArcFace r100 embedding (512-d).
FACE_MODEL_PACK = "buffalo_l"

# Cosine similarity cutoff for a positive match. Starting point for ArcFace embeddings —
# needs empirical tuning against real enrolled faces, hence a single named constant here
# rather than a magic number scattered through the matching/API code.
MATCH_THRESHOLD = 0.45


def ensure_data_dirs() -> None:
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)

"""Manual smoke test for the face engine (and, once storage exists, a DB round-trip).

Usage:
    python scripts/smoke_test.py path/to/image.jpg
"""

import sys
from pathlib import Path

import cv2

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.face_engine import detect_and_embed  # noqa: E402


def main() -> None:
    if len(sys.argv) != 2:
        print("Usage: python scripts/smoke_test.py <image_path>")
        sys.exit(1)

    image_path = sys.argv[1]
    image = cv2.imread(image_path)
    if image is None:
        print(f"Could not read image: {image_path}")
        sys.exit(1)

    faces = detect_and_embed(image)
    print(f"Detected {len(faces)} face(s) in {image_path}")
    for i, face in enumerate(faces):
        print(
            f"  face[{i}]: bbox={face.bbox}, det_score={face.det_score:.3f}, "
            f"embedding_shape={face.embedding.shape}"
        )


if __name__ == "__main__":
    main()

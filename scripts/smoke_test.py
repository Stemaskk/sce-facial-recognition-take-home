"""Manual smoke test for the face engine and (with --storage) a DB round-trip.

Usage:
    python scripts/smoke_test.py path/to/image.jpg [--storage]
"""

import sys
from pathlib import Path

import cv2

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.face_engine import detect_and_embed  # noqa: E402


def check_storage_roundtrip(embedding) -> None:
    from backend import storage

    storage.init_db()
    profile_id = storage.insert_profile("Smoke Test", embedding, "smoke_test.jpg")
    print(f"Inserted profile id={profile_id}")

    profiles = storage.list_profiles()
    assert any(p["id"] == profile_id for p in profiles), "inserted profile missing from list_profiles()"
    print(f"list_profiles() returned {len(profiles)} profile(s), including the one just inserted")

    embeddings = storage.all_embeddings()
    match = next((e for e in embeddings if e[0] == profile_id), None)
    assert match is not None, "inserted profile missing from all_embeddings()"
    assert (match[2] == embedding.astype("float32")).all(), "embedding round-trip mismatch"
    print("Embedding round-trip matches byte-for-byte")

    deleted = storage.delete_profile(profile_id)
    assert deleted, "delete_profile() reported no row deleted"
    assert storage.get_profile(profile_id) is None, "profile still present after delete"
    print("Delete round-trip OK — storage layer verified")


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python scripts/smoke_test.py <image_path> [--storage]")
        sys.exit(1)

    image_path = sys.argv[1]
    run_storage_check = "--storage" in sys.argv[2:]

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

    if run_storage_check:
        if not faces:
            print("Cannot run --storage check: no face detected in image")
            sys.exit(1)
        check_storage_roundtrip(faces[0].embedding)


if __name__ == "__main__":
    main()

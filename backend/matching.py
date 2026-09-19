"""Cosine similarity matching against enrolled profile embeddings."""

import numpy as np


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))


def find_best_match(
    query_embedding: np.ndarray, candidates: list[tuple[int, str, np.ndarray]]
) -> tuple[int, str, float] | None:
    """Returns (id, name, score) for the highest-scoring candidate, or None if
    candidates is empty. Does not apply MATCH_THRESHOLD — callers decide what
    to do with the score (e.g. compare against the threshold, or just log it)."""
    if not candidates:
        return None

    best = max(candidates, key=lambda c: cosine_similarity(query_embedding, c[2]))
    return best[0], best[1], cosine_similarity(query_embedding, best[2])

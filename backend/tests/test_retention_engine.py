from app.services.retention_engine import compute_score


def test_score_expired_nightly_lowest():
    """Expired nightly (priority=1) should have the lowest score."""
    # nightly: priority=1, retention_days=3, age=5 → remaining=-2
    score = compute_score(priority=1, retention_days=3, age_days=5)
    assert score == 1 * 1000 + (-2) * 10  # 980


def test_score_unexpired_nightly():
    """Unexpired nightly should have score > expired nightly."""
    expired = compute_score(priority=1, retention_days=3, age_days=5)
    unexpired = compute_score(priority=1, retention_days=3, age_days=1)
    assert expired < unexpired


def test_score_expired_release_higher_than_nightly():
    """Expired release (priority=3) should score higher than expired nightly (priority=1)."""
    nightly = compute_score(priority=1, retention_days=3, age_days=5)
    release = compute_score(priority=3, retention_days=30, age_days=35)
    assert nightly < release


def test_score_ordering():
    """Full ordering: expired nightly → unexpired nightly → expired release → unexpired release."""
    expired_nightly = compute_score(priority=1, retention_days=3, age_days=5)
    unexpired_nightly = compute_score(priority=1, retention_days=3, age_days=1)
    expired_release = compute_score(priority=3, retention_days=30, age_days=35)
    unexpired_release = compute_score(priority=3, retention_days=30, age_days=10)

    scores = [expired_nightly, unexpired_nightly, expired_release, unexpired_release]
    assert scores == sorted(scores), f"Expected sorted order but got {scores}"


def test_same_type_older_deleted_first():
    """Within same type, older builds (more expired) should have lower scores."""
    old = compute_score(priority=1, retention_days=3, age_days=10)
    new = compute_score(priority=1, retention_days=3, age_days=4)
    assert old < new

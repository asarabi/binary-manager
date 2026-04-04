from app.services.retention_engine import compute_score


def test_score_is_remaining_days():
    """Score should be retention_days - age_days."""
    score = compute_score(retention_days=7, age_days=3)
    assert score == 4.0


def test_expired_build_negative_score():
    """Expired build should have negative score."""
    score = compute_score(retention_days=7, age_days=10)
    assert score == -3.0


def test_older_builds_lower_score():
    """Older builds should have lower scores (deleted first)."""
    old = compute_score(retention_days=7, age_days=10)
    new = compute_score(retention_days=7, age_days=4)
    assert old < new


def test_custom_retention_higher_score():
    """Build with longer retention should have higher score at same age."""
    default = compute_score(retention_days=7, age_days=5)
    custom = compute_score(retention_days=30, age_days=5)
    assert default < custom


def test_ordering_expired_then_unexpired():
    """Expired builds should always be deleted before unexpired builds of same retention."""
    expired = compute_score(retention_days=7, age_days=10)
    unexpired = compute_score(retention_days=7, age_days=3)
    assert expired < unexpired
    assert expired < 0
    assert unexpired > 0

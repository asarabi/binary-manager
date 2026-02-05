---
name: run-tests
description: Run the backend test suite and report results
user-invocable: true
allowed-tools: Bash
---

# Run Tests

Run the project test suite and summarize results.

## Steps

1. Run backend unit tests:
```bash
cd /home/ck21im/dev/binary-manager/backend && python -m pytest tests/ -v --tb=short
```

2. Report results:
   - Total tests run, passed, failed, skipped
   - For any failures: show the test name, file:line, and the assertion error
   - If all pass, confirm with a one-line summary

## Notes

- Tests are in `backend/tests/`
- No frontend tests exist yet; skip frontend testing
- Python 3.10 is available in the local environment
- Do not modify test files unless the user explicitly asks

---
name: review
description: Review current uncommitted changes or a specific file for issues, bugs, and improvements
argument-hint: [file path or blank for all changes]
user-invocable: true
allowed-tools: Bash, Read, Grep, Glob
---

# Code Review

Review code changes and report findings.

## Scope

- If an argument (file path) is provided: review that specific file
- If no argument: review all uncommitted changes (`git diff` + `git diff --cached`)

## Review Checklist

For each changed file, check:

1. **Bugs**: Logic errors, off-by-one, null/undefined access, race conditions
2. **Security**: SQL injection, XSS, command injection, hardcoded secrets, OWASP top 10
3. **Type Safety**: Missing type annotations (TypeScript `any`), Pydantic model mismatches
4. **Error Handling**: Unhandled exceptions, missing try/catch, silent failures
5. **Performance**: N+1 queries, unnecessary re-renders, missing caching
6. **Conventions**: Consistency with project patterns per CLAUDE.md

## Output Format

```
## Review: <file or "All Changes">

### Issues Found
- **[BUG]** file.py:42 - Description of the bug
- **[SECURITY]** file.ts:15 - Description of the vulnerability
- **[PERF]** file.py:88 - Description of the performance issue

### Suggestions
- file.py:30 - Consider using X instead of Y for clarity

### Summary
N issues found (X bugs, Y security, Z other). [Clean / Needs fixes]
```

## Rules

- Be specific: always include file path and line number
- Severity matters: bugs and security issues first, style last
- Do not suggest changes unless there is a concrete problem
- Do not nitpick formatting if it follows project conventions
- Keep suggestions actionable and concise

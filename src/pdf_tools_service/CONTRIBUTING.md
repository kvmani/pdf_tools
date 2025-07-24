# Contributing to PDF Tools Service

Thank you for taking the time to contribute! This guide explains the workflow
used in this repository.

## Coding Style

- Code must be formatted with **black**.
- `flake8` is used for linting. No warnings should be introduced.
- All public classes and functions require docstrings.
- Avoid committing large binary files unless strictly necessary for tests.

## Branching Model

Use feature branches based off `main`. Name branches
`feature/<short-description>` or `bugfix/<short-description>`.

## Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) style
where possible (`feat:`, `fix:`, `docs:` etc.). Keep messages concise and
meaningful.

## Pull Request Process

1. Ensure `pytest` and `flake8` run without errors.
2. Update documentation and tests when adding new features.
3. Open a pull request targeting `main` and describe the change clearly.
4. At least one code review is required before merging.

## Running Tests

The test suite can be executed with:

```bash
export PYTHONPATH=..
pytest
```

Continuous integration will run the same command along with lint checks.

## Binary Files

Avoid adding binary assets to the repository unless they are essential for
unit tests. Large files bloat the repository history and should be stored
externally if possible.

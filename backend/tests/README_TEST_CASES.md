# VyaparAI Backend API Testing Report

This report summarizes the automated API validation for the backend routes documented in swagger_basic.yaml.

## Scope

- Test file: tests/test_api.py
- Total test cases: 26
- Test pattern: success and failure scenarios for each documented operation
- Database mode: isolated in-memory SQLite (sqlite:///:memory:)

## Environment Setup

1. Open a terminal at the project root.
2. Move to backend:

    cd backend

3. Activate virtual environment:

    .\\venv2\\Scripts\\activate.ps1

4. Install test dependency:

    pip install pytest

## Test Execution

Run the full suite with verbose output:

    python -m pytest tests/test_api.py -v

Using python -m ensures local package discovery works correctly for flask_app imports.

## Coverage Summary

The following routes from swagger_basic.yaml are covered with success and failure behavior checks.

### 1. Authentication and Profile

| Endpoint | Scenarios Tested | Notes |
|---|---|---|
| POST /api/auth/signup | Success (201), Duplicate (409) | Valid registration and duplicate user rejection |
| POST /api/auth/signin | Success (200), Wrong password (401) | Token issuance and invalid credential handling |
| GET /api/auth/profile | Success (200), Unauthorized (401) | Protected read of current user profile |
| PUT /api/auth/profile | Success (200), Unauthorized (401) | Protected update of profile fields |

### 2. Cashiers

| Endpoint | Scenarios Tested | Notes |
|---|---|---|
| POST /api/auth/cashiers | Success (200/201), Unauthorized (401) | Create cashier only with valid auth |
| GET /api/auth/cashiers | Success (200), Unauthorized (401) | List cashiers only with valid auth |

### 3. Notes

| Endpoint | Scenarios Tested | Notes |
|---|---|---|
| POST /api/notes | Success (201), Missing data (400/500) | Validation path currently allows mixed behavior |
| GET /api/notes | Success (200), Unauthorized (401) | Protected notes listing |
| DELETE /api/notes/{note_id} | Success (200), Not found (404) | Valid delete and missing resource behavior |

### 4. Todos

| Endpoint | Scenarios Tested | Notes |
|---|---|---|
| POST /api/todos | Success (201), Unauthorized (401) | Protected todo creation |
| GET /api/todos | Success (200), Unauthorized (401) | Protected todo listing |
| PUT /api/todos/{todo_id} | Success (200), Not found (404) | Update behavior for valid and missing IDs |
| DELETE /api/todos/{todo_id} | Success (200), Not found (404) | Delete behavior for valid and missing IDs |

## Test Design Notes

- Fixtures create an isolated app and database per run.
- auth_headers fixture creates a test owner user, signs in, and injects Authorization headers.
- For delete and update success tests, IDs are captured dynamically from create responses to avoid brittle hardcoded IDs.

## Observed Gap

One route currently shows non-deterministic validation behavior:

- POST /api/notes with empty JSON can return 400 or 500 depending on execution path.

Recommendation: standardize this case to always return 400 with a clear error body.

## Current Status

- Automated suite exists and maps to documented CRUD/auth routes.
- Total validated cases: 26.
- Detailed per-case expected vs actual table is maintained separately in tests/TEST_CASES.md.

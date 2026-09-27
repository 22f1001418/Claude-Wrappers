# VyaparAI Full API Testing Report

This report summarizes the full API validation set for routes documented in swagger_full.yaml.

## Scope

- Spec file: backend/swagger_full.yaml
- Detailed case sheet: tests/TEST_CASES_FULL.md
- Total test cases: 70
- Test pattern: one success and one failure scenario per API operation
- Coverage style: Swagger Try it out driven, with expected and actual outputs captured in tabular form

## Environment Setup

1. Open a terminal at the project root.
2. Move to backend:

    cd backend

3. Activate virtual environment:

    .\\venv2\\Scripts\\activate.ps1

4. Ensure backend dependencies are installed:

    pip install -r requirements.txt

## How to Execute and Record Results

1. Start backend server:

    python run.py

2. Open Swagger UI and load swagger_full.yaml.
3. Execute each endpoint from the spec using Try it out.
4. Record expected vs actual outcome for each call in tests/TEST_CASES_FULL.md.

## Coverage Summary

The full suite includes all documented non-YOLO routes currently present in swagger_full.yaml.

### 1. Authentication and User Management

| Endpoint | Scenarios Tested | Notes |
|---|---|---|
| POST /api/auth/signup | Success (201), Duplicate (409) | Registration with required full_name and conflict handling |
| POST /api/auth/signin | Success (200), Invalid credentials (401) | JWT token issuance and auth failure flow |
| POST /api/auth/refresh | Success (200), Invalid/absent refresh token (401) | Refresh-token guard path |
| POST /api/auth/logout | Success (200), Unauthorized (401) | Token-protected logout route |
| GET /api/auth/profile | Success (200), Unauthorized (401) | Protected profile fetch |
| PUT /api/auth/profile | Success (200), Unauthorized (401) | Protected profile update |
| POST /api/auth/change-password | Success (200), Unauthorized (401) | Password rotation guardrails |
| GET /api/auth/users | Success (200), Forbidden (403) | Role-constrained user listing |
| GET /api/auth/verify-token | Success (200), Unauthorized (401) | Token validity checks |
| GET /api/auth/cashiers | Success (200), Unauthorized (401) | Protected cashier listing |
| POST /api/auth/cashiers | Success (201), Forbidden (403) | Owner/admin constrained cashier creation |
| DELETE /api/auth/cashiers/{username} | Success (200), Not found (404) | Cashier removal behavior |

### 2. Inventory and Dashboard

| Endpoint | Scenarios Tested | Notes |
|---|---|---|
| GET /api/inventory/products | Success (200), Unauthorized (401) | Product list by logged-in inventory owner |
| GET /api/inventory/low-stock | Success (200), Unauthorized (401) | Low-stock insights |
| GET /api/inventory/stats | Success (200), Unauthorized (401) | Inventory summary metrics |
| GET /api/inventory/restock-recommendations | Success (200), Unauthorized (401) | Restock recommendation logic |
| GET /api/dashboard/stats | Success (200), Unauthorized (401) | Dashboard KPI endpoint |

### 3. Billing and Credit

| Endpoint | Scenarios Tested | Notes |
|---|---|---|
| GET /api/billing/products | Success (200), Wrong method (405) | Search endpoint and method guard |
| GET /api/billing/check-customer | Success (200), Missing query (400) | Input validation for customer lookup |
| POST /api/billing/create | Success (200), Invalid payload (400) | Billing transaction input validation |
| GET /api/credits/dashboard | Success (200), Wrong method (405) | Credit dashboard retrieval |
| GET /api/credits/search | Success (200), Wrong method (405) | Credit search retrieval |
| PUT /api/credits/clear/{sale_id} | Success (200), Invalid amount (400) | Credit clear/update validation |

### 4. Notes and Todos

| Endpoint | Scenarios Tested | Notes |
|---|---|---|
| GET /api/notes | Success (200), Unauthorized (401) | Protected notes fetch |
| POST /api/notes | Success (201), Missing text (400) | Required text validation |
| DELETE /api/notes/{note_id} | Success (200), Not found (404) | Delete behavior |
| GET /api/todos | Success (200), Unauthorized (401) | Protected todo listing |
| POST /api/todos | Success (201), Missing required fields (400) | Required title/date validation |
| PUT /api/todos/{todo_id} | Success (200), Not found (404) | Update path coverage |
| DELETE /api/todos/{todo_id} | Success (200), Not found (404) | Delete path coverage |
| PATCH /api/todos/{todo_id}/toggle | Success (200), Not found (404) | Toggle behavior coverage |

### 5. Chatbot

| Endpoint | Scenarios Tested | Notes |
|---|---|---|
| POST /api/chatbot/chat | Success (200), Missing question (400) | Public RAG query route |
| POST /api/chatbot/user-chat | Success (200), Unauthorized (401) | JWT-protected personalized chatbot |
| GET /api/chatbot/health | Success (200), Wrong method (405) | Service health status |
| GET /api/chatbot/history | Success (200), Service failure path (500) | Placeholder endpoint with error-path documentation |

## Test Design Notes

- Success and failure case pairs are intentionally mirrored per endpoint for consistency.
- Failure cases include method mismatches, missing parameters, invalid payloads, and auth/permission failures.
- This report is a summary; full per-case Input/Expected/Actual tables are in tests/TEST_CASES_FULL.md.

## Current Status

- Full API documentation and full test-case matrix are synchronized.
- Total documented test cases: 70.
- Primary submission artifacts:
  - backend/swagger_full.yaml
  - tests/TEST_CASES_FULL.md
  - tests/README_TEST_CASES_FULL.md


# VyaparAI

VyaparAI is an AI-enabled retail operations platform for small and medium stores. It unifies billing, inventory, credit tracking, notifications, analytics, exports, and team workflows into a single full-stack system.

The goal is simple: help store owners run faster, smarter, and with fewer manual errors.

## Table of Contents

1. [Project Highlights](#project-highlights)
2. [Why VyaparAI](#why-vyaparai)
3. [Feature Overview](#feature-overview)
4. [System Architecture](#system-architecture)
5. [Repository Layout](#repository-layout)
6. [Tech Stack](#tech-stack)
7. [Prerequisites](#prerequisites)
8. [Environment Configuration](#environment-configuration)
9. [How to Run (4 Terminals)](#how-to-run-4-terminals)
10. [Post-Startup Checklist](#post-startup-checklist)
11. [Default Test Credentials](#default-test-credentials)
12. [Celery Schedules and Jobs](#celery-schedules-and-jobs)
13. [Testing Guide](#testing-guide)
14. [Troubleshooting](#troubleshooting)

## Project Highlights

- AI-assisted billing with live camera detection (YOLO)
- Real-time overlay updates via Socket.IO
- Inventory intelligence with low-stock and stale-stock visibility
- Credit lifecycle tracking with reminders and partial payments
- Role-based access for admin, owner, and cashier
- Async exports and automated business reports using Celery
- Built-in workspace tools (todos, reminders, notes)
- AI chatbot (RAG-backed business assistant)

## Why VyaparAI

Retail operations in small stores often rely on notebooks, memory, and disconnected apps. VyaparAI centralizes critical business workflows so owners can:

- reduce billing and inventory errors
- track dues and payments reliably
- see business performance in real time
- automate repetitive reminders and reports
- operate with role-specific clarity across staff

## Feature Overview

### 1. Smart Billing + Product Detection

- camera-based product recognition
- scan-to-bill flow with persistent bill records
- live bounding boxes and updates over Socket.IO
- optimized model loading for faster startup

### 2. Dashboard and Insights

- revenue and transaction metrics
- monthly and comparative summaries
- payment mode distribution
- trend and top-product visibility

### 3. Inventory Intelligence

- product CRUD and listed-product catalog mapping
- configurable low-stock threshold
- owner alerts for low-stock items
- stale inventory and stock movement visibility

### 4. Credit Management

- customer dues and due-date tracking
- partial payments and balance updates
- overdue visibility and scheduled reminders

### 5. Workspace Productivity

- todo CRUD with completion tracking
- due-today reminders
- notes for operational planning

### 6. Notifications System

- in-app notification center with unread count
- dismiss and dismiss-all actions
- event-driven notifications (cashier actions, exports, inventory events)
- optional email notifications via Celery + SMTP

### 7. Async Export and Reporting

- background export tasks
- export ranges: 1m / 3m / 6m / 12m / all
- daily business report scheduler
- workspace reminder scheduler

### 8. Authentication and Roles

- JWT access and refresh flows
- role-aware experiences (admin, owner, cashier)
- credential login and Google sign-in support

### 9. Integrated Chatbot

- RAG-based assistant for business context Q&A
- authenticated and public usage paths

## System Architecture

1. Next.js frontend sends REST and Socket.IO requests.
2. Flask backend serves APIs for auth, billing, inventory, credit, workspace, and chatbot.
3. Celery worker executes async jobs (emails, exports, reminders).
4. Celery beat triggers scheduled tasks.
5. Redis powers Celery broker/result backend and caching.
6. SQLite stores application data for local development.

## Repository Layout

```text
.
|- backend/
|  |- run.py
|  |- celery_worker.py
|  |- celery_beat.py
|  |- requirements.txt
|  |- flask_app/
|  |  |- __init__.py
|  |  |- celery_app.py
|  |  |- models/
|  |  |- routes/
|  |  |- tasks/
|  |  |- utils/
|  |- chatbot/
|- frontend/
|  |- package.json
|  |- app/
|  |- lib/
|  |- styles/
|- README.md
```

## Tech Stack

### Frontend

- Next.js 16.1.6
- React 19.2.3
- CSS Modules + global theming
- Socket.IO client

### Backend

- Flask
- Flask-JWT-Extended
- Flask-SQLAlchemy
- Flask-SocketIO
- Flask-Caching

### Async + Infra

- Celery
- Redis
- SQLite (`backend/flask_app/grocery_shop.sqlite3`)

### AI/Data

- Ultralytics YOLO
- LangChain ecosystem
- OpenAI/Gemini compatible integrations

## Prerequisites

- Python 3.10+
- Node.js 20+
- npm (or Yarn)
- Redis running locally (expected at `localhost:6380`)
- Webcam (required for live detection page)

## Environment Configuration

### Required root env file (`.env.sample`)

This repository includes a required sample env file at project root: `.env.sample`.

Create `.env` from it before running backend services:

```powershell
Copy-Item .env.sample .env
```

Then replace placeholders in `.env` with real values:

```env
# Google API key
GOOGLE_API_KEY="your_google_api_key_here"

# OpenRouter API key
OPENROUTER_API_KEY="your_openrouter_api_key_here"

# Razorpay credentials
RAZORPAY_KEY_ID="your_razorpay_key_id_here"
RAZORPAY_KEY_SECRET="your_razorpay_key_secret_here"

# Google OAuth credentials
GOOGLE_CLIENT_ID="your_google_client_id_here"
GOOGLE_CLIENT_SECRET="your_google_client_secret_here"
```

### Get API Keys and Credentials

Use the following pages to generate the keys used above:

- Google API key (Gemini): [Google AI Studio](https://aistudio.google.com/app/apikey)
- OpenRouter API key: [OpenRouter Keys](https://openrouter.ai/keys)
- Razorpay key ID/secret: [Razorpay Dashboard](https://dashboard.razorpay.com/app/keys), Make sure you use the test key only.
- Google OAuth client ID/secret: [Google Cloud Console Credentials](https://console.cloud.google.com/apis/credentials)

Steps to create Google OAuth credentials:

1. Open [Google Cloud Console Credentials](https://console.cloud.google.com/apis/credentials) and select your project (or create a new one).
2. Go to APIs and Services.
2. Configure the OAuth consent screen (User Type, app name, support email), then save.
3. Go to **Credentials** -> **Create Credentials** -> **OAuth client ID**.
4. Choose **Web application** as application type.
5. Add Authorized JavaScript origin, e.g. `http://localhost:3000`.
6. Add Authorized redirect URI, e.g. `http://localhost:3000` (or your callback route if configured).
7. Click **Create**, then copy **Client ID** and **Client Secret** into `.env` as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

### Backend env file

Create `backend/.env`:

```env
# Core app
SECRET_KEY=change_me
JWT_SECRET_KEY=change_me
DATABASE_URL=sqlite:///flask_app/grocery_shop.sqlite3

# Celery + Redis
CELERY_BROKER_URL=redis://localhost:6380/0
CELERY_RESULT_BACKEND=redis://localhost:6380/0
CELERY_TIMEZONE=Asia/Kolkata
CELERY_TASK_TRACK_STARTED=true
CELERY_TASK_TIME_LIMIT=1800
CELERY_TASK_ALWAYS_EAGER=false
CELERY_LOW_STOCK_THRESHOLD=10
CELERY_CREDIT_REMINDER_DAYS=2

# Exports
EXPORTS_DIR=exports

# SMTP (email jobs)
MAIL_ENABLED=false
MAIL_HOST=smtp.example.com
MAIL_PORT=587
MAIL_USERNAME=your_username
MAIL_PASSWORD=your_password
MAIL_FROM=no-reply@vyaparai.local
MAIL_USE_TLS=true
MAIL_USE_SSL=false

# Caching
CACHE_ENABLED=true
CACHE_REDIS_URL=redis://localhost:6380/0
CACHE_DEFAULT_TIMEOUT=120
CACHE_KEY_PREFIX=vyaparai:cache:
```

### Frontend env file (optional)

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:5001
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id
```

## How to Run (4 Terminals)

Run all commands from project root:

`x:\SE Project\frontend`

Before starting the 4 terminals, make sure Redis is up.

### Start Redis (required)

If you already have Redis locally on port 6380, keep it running.

Docker option:

```bash
docker run --name vyaparai-redis -p 6380:6379 -d redis:7
```
Local option(if you have redis and WSL installed):

1. Open WSL terminal
2. RUn the below command
```
redis-server --port 6380       
```
3. Check if redis is running (in another WSL terminal):
```
redis-cli -p 6380 ping
```
4. If the response is "PONG" then redis is running.

### Terminal 1: Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev
```

Yarn alternative:

```bash
cd frontend
yarn install
yarn run dev
```

Frontend URL: `http://localhost:3000`

### Terminal 2: Backend API (Flask + Socket.IO)

```bash
cd backend
venv2\Scripts\activate
pip install -r requirements.txt
python run.py
```

Backend URL: `http://127.0.0.1:5001`

### Terminal 3: Celery Worker

```bash
cd backend
venv2\Scripts\activate
python celery_worker.py
```

### Terminal 4: Celery Beat Scheduler

```bash
cd backend
venv2\Scripts\activate
python celery_beat.py
```

## Post-Startup Checklist

After all four terminals are running:

1. Open frontend and log in.
2. Confirm APIs respond from backend.
3. Trigger an action that creates a notification (for example, add inventory).
4. Verify worker logs process queued tasks.
5. Verify beat logs show periodic schedule activity.
6. Open detection page and check camera permissions and overlays.

## Default Test Credentials

Seed users are auto-created in local setup (if not already present):

| Role | Username | Password | Email |
| :--- | :--- | :--- | :--- |
| Admin | admin | Admin@123 | admin@vyaparai.com |
| Owner | rahul_store | Rahul@123 | rahul@grocery.com |
| Cashier | amit_cashier | Amit@123 | amit@cashier.com |
| Cashier | sneha_cashier | Sneha@123 | sneha@cashier.com |

## Celery Schedules and Jobs

Configured in `backend/flask_app/celery_app.py`:

- business report checker: every 30 minutes
- workspace reminder checker: every minute
- low-stock notifications: daily at 10:00
- credit-due notifications: daily at 11:00

Plus event-triggered tasks from API flows (exports, reminders, and notifications).

## Testing Guide

Recommended smoke test flow:

1. Start Redis, frontend, backend, worker, and beat.
2. Log in as owner (`rahul_store`).
3. Create a cashier and verify in-app notification.
4. Add listed product as admin and verify user notification flow.
5. Add inventory and verify toast + notification.
6. Trigger export and verify async completion in worker logs.
7. Verify report/reminder configuration persistence.
8. Open detection page and validate live overlay updates.

For API-level tests, see `backend/tests/`.

## Troubleshooting

* **Frontend 'next is not recognized':** Ensure you have run `npm install` or `yarn install` within the `frontend/` directory before starting the dev server.
* **Backend Missing Packages Error:** Verify that your virtual environment is active before running `pip install -r requirements.txt`.
* **Camera Busy/Not Loading:** Close any other applications using the webcam (e.g., Zoom, Teams, Skype) before navigating to the detection page.

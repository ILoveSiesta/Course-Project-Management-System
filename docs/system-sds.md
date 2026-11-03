# System-Level Software Design Specification (SDS)

| Version | Date | Author(s) | Change |
|---|---|---|---|
| 0.1 | 2026-11-03 | | Document skeleton |

## 1. Architecture and stack

| Layer | Technology | Responsibility |
|---|---|---|
| UI | React 18 + Vite + TypeScript | |
| API / application | Node.js + Express + TypeScript | |
| Database | PostgreSQL + Prisma ORM | |
| Tests | Vitest, Supertest, Testing Library, Playwright | |

<!-- Explain how layers communicate and where business rules are enforced. Add a diagram if it helps. -->

## 2. Data model

<!-- Entities, fields, relationships, constraints, ownership links. ER diagram. -->

### 2.1 Migrations and seed data

## 3. UI structure and conventions

### 3.1 Screens and navigation

### 3.2 Shared UI behavior (validation, loading, empty, error states)

## 4. API conventions

- Base path: `/api`
- Error shape: `{ "error": { "code": "STRING_CODE", "message": "Human readable" } }`
- Status codes:

## 5. Roles and permissions

| Operation | Student | Supervisor | Record scope |
|---|---|---|---|
| | | | |

## 6. Authentication and session lifecycle

<!-- Password hashing, token creation/expiry, current-user retrieval, logout behavior. -->

## 7. Configuration

| Variable | Component | Purpose | Example (non-secret) |
|---|---|---|---|
| `DATABASE_URL` | server | PostgreSQL connection string | `postgresql://cpms:cpms@localhost:5432/cpms?schema=public` |
| `PORT` | server | API port | `3000` |
| `JWT_SECRET` | server | Token signing secret | (never committed) |
| `JWT_EXPIRES_IN` | server | Token lifetime | `2h` |
| `VITE_API_URL` | client | API base URL | `/api` |

## 8. Deployment plan (GCP)

<!-- Planned Docker images, GCP services, durable storage. Implemented in Lab 5. -->

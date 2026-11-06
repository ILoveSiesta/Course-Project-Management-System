# Course Project Management System

CPE334 Software Engineering — Group Project, Theme 6 (Semester 1/2026)

ระบบให้ทีมนักศึกษาส่งงานตาม milestone และให้ supervisor บันทึก feedback

- Requirements: [docs/srs.md](docs/srs.md)
- Features / traceability: [docs/features.md](docs/features.md), [docs/traceability.md](docs/traceability.md)
- Design: [docs/system-sds.md](docs/system-sds.md)
- Sprint plan & contracts: [docs/sprints/](docs/sprints/)

## Tech stack

| Layer | Technology |
|---|---|
| Client | React 18, Vite, TypeScript, React Router |
| Server | Node.js, Express, TypeScript |
| Database | PostgreSQL 16, Prisma ORM |
| Tests | Vitest + Supertest (server), Vitest + Testing Library (client), Playwright (E2E) |

## Project structure

```
client/          React UI (src/, tests/)
server/          Express API (src/, prisma/, tests/)
e2e/             Playwright end-to-end tests
docs/            SRS, features, traceability, SDS, sprint contracts, labs
.github/         Issue and PR templates
docker-compose.yml  Local PostgreSQL for development
```

## Prerequisites

- Node.js 20+ (ทดสอบกับ v24)
- Docker Desktop (สำหรับ PostgreSQL)
- Git

## Local setup

1. ติดตั้ง dependencies
   ```bash
   npm install
   npm install --prefix server
   npm install --prefix client
   npx playwright install chromium
   ```
2. สร้างไฟล์ environment (ห้าม commit `.env`)
   ```bash
   cp server/.env.example server/.env
   cp client/.env.example client/.env
   ```
3. เปิดฐานข้อมูล
   ```bash
   npm run db:up
   ```
4. Migrate และ seed ข้อมูลตัวอย่าง (มี models User, Team, Milestone, Submission, Feedback ครบสำหรับ Sprint 1)
   ```bash
   npm run prisma:migrate --prefix server
   npm run prisma:seed --prefix server
   ```
5. รันระบบ (สองเทอร์มินัล)
   ```bash
   npm run dev --prefix server   # http://localhost:3000/api/health
   npm run dev --prefix client   # http://localhost:5173
   ```

## Build and test

```bash
npm run build      # type-check server, build client
npm test           # server + client unit/API tests
npm run test:e2e   # Playwright (รันกับฐานข้อมูล dev ที่ migrate และ seed แล้วในข้อ 4; starts server and client automatically)
```

## Git workflow

1. สร้าง Issue ที่ผูกกับ feature/contract
2. แตก branch `feature/F-XX-short-name` (หรือ `fix/...`) จาก sprint staging branch (`sprint-1`, `sprint-2`, ...)
3. Commit ตามลำดับนี้ใน branch (เป็นหลักฐาน TDD):
   1. `docs(F-XX): contract` — contract ใน `docs/sprints/sprint-N/` (ใช้ `_contract-template.md`)
   2. `test(F-XX): ...` — test ของพฤติกรรมที่ต้องการ ซึ่งยัง fail (red)
   3. `feat(F-XX): ...` — implement จน test ผ่าน (green) แล้วอัปเดต docs/traceability
4. เปิด PR เข้า sprint staging — เพื่อนในทีมรีวิว (ห้าม approve PR ตัวเอง)
5. รวม feature แล้วรัน integration/acceptance checks บน staging
6. เปิด release PR จาก staging → `main` แล้ว tag (`v0.1.0`, ...)

## Demo accounts

สร้างจาก seed script ในเครื่อง (ข้อมูลสังเคราะห์เท่านั้น) — ดู `server/prisma/seed.ts`
รายชื่อทีมและบัญชีอยู่ใน `docs/system-sds.md` หัวข้อ 2.4 ส่วนรหัสผ่านกำหนดผ่าน `SEED_DEMO_PASSWORD` ใน `server/.env` (ไม่ commit)

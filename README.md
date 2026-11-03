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
4. Migrate และ seed ข้อมูลตัวอย่าง (ใช้ได้เมื่อมี model ใน `schema.prisma` แล้ว — ตอนนี้ยังเป็น skeleton เปล่า)
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
npm run test:e2e   # Playwright (starts server and client automatically)
```

## Git workflow

1. สร้าง Issue ที่ผูกกับ feature/contract
2. แตก branch `feature/F-XX-short-name` (หรือ `fix/...`) จาก sprint staging branch (`sprint-1`, `sprint-2`, ...)
3. เขียน contract/test ก่อน → implement → รัน test → อัปเดต docs
4. เปิด PR เข้า sprint staging — เพื่อนในทีมรีวิว (ห้าม approve PR ตัวเอง)
5. รวม feature แล้วรัน integration/acceptance checks บน staging
6. เปิด release PR จาก staging → `main` แล้ว tag (`v0.1.0`, ...)

## Demo accounts

สร้างจาก seed script ในเครื่อง (ข้อมูลสังเคราะห์เท่านั้น) — ดู `server/prisma/seed.ts`

# Online Code Test

## Live Link
Production: https://cn-22.vercel.app/

Preview: 

## Features
TBD

## Local Setup

This project has:
- Frontend (Next.js): `online_code_test`
- Backend (NestJS + Prisma): `../backend`

### 1) Clone and install

```bash
git clone <your-repo-url>
cd online_code_test
npm install
cd ../backend
npm install
```

### 2) Configure environment variables

#### Backend (`../backend/.env`)

Set your PostgreSQL connection:

```bash
DATABASE_URL="postgresql://<username>:<password>@localhost:5432/postgres?schema=public"
```

#### Frontend (`./.env.local`)

Point frontend to backend:

(omitted)

### 3) Prepare backend database

From `../backend`:

```bash
npx prisma db push
npm run db:seed
```

### 4) Run backend (port 4100)

From `../backend`:

```bash
npm run start:dev
```

Backend API runs at `http://localhost:4100`.

### 5) Run frontend

From `./online_code_test`:

```bash
npm run dev
```

Frontend runs at `http://localhost:3000` (or the next available port if `3000` is occupied).

## Notes

- App data used by the role-based pages (`admin`, `examiner`, `questioner`, candidate pages) is fetched from backend `GET /data`.
- If backend is not running or DB is not seeded, those pages will show loading/errors or empty data.

## Usage
TBD

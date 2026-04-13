# TeacherHub

A full-stack marketplace platform for educators to share, discover, and purchase teaching resources. Built with a React frontend and an Express/Prisma backend.

## Tech Stack

### Frontend
- **React 19** with TypeScript
- **Vite** — build tool & dev server
- **TailwindCSS 4** — utility-first styling
- **React Router v7** — client-side routing
- **Zustand** — state management
- **Lucide React** — icon library
- **Motion** — animations

### Backend
- **Express 5** with TypeScript
- **Prisma ORM** — database access & migrations (MySQL/MariaDB)
- **bcrypt** — password hashing
- **jsonwebtoken** — JWT authentication
- **Zod** — input validation
- **Nodemailer** — email sending
- **Helmet / CORS / Rate Limiting** — security middleware

## Folder Structure

```
TeacherHub/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma       # Database schema
│   │   └── migrations/         # Migration history
│   ├── src/
│   │   ├── config/             # env.ts, prisma.ts
│   │   ├── controllers/        # Thin request handlers
│   │   ├── services/           # Business logic
│   │   ├── validators/         # Zod schemas
│   │   ├── routes/             # Express routers
│   │   ├── middlewares/        # Auth, upload middleware
│   │   ├── utils/              # JWT, mailer, error helpers
│   │   └── server.ts           # App entry point
│   ├── .env                    # Local env (gitignored)
│   └── .env.example            # Env template
├── frontend/
│   ├── src/
│   │   ├── app/                # Providers, router, config, i18n
│   │   ├── pages/              # Page components
│   │   ├── components/         # Shared UI components
│   │   ├── services/           # API service layer
│   │   ├── repositories/       # Data access / API calls
│   │   ├── types/              # TypeScript types & DTOs
│   │   └── utils/              # Helpers, mappers, normalizers
│   ├── .env                    # Frontend env (gitignored)
│   └── .env.example            # Env template
└── README.md
```

## Local Setup

### Prerequisites
- Node.js v18+
- MySQL or MariaDB running locally
- npm

### 1. Clone & Install

```bash
git clone <repo-url>
cd TeacherHub

# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Configure Environment Variables

#### Backend (`backend/.env`)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | MySQL/MariaDB connection string |
| `JWT_SECRET` | ✅ | JWT signing secret (min 32 chars) |
| `FRONTEND_URL` | ✅ | Frontend URL for email links |
| `PORT` | ❌ | Server port (default: 3000) |
| `NODE_ENV` | ❌ | `development` / `test` / `production` |
| `CORS_ALLOWED_ORIGINS` | ✅ (prod) | Comma-separated allowed origins |
| `SMTP_HOST` | ✅ (prod) | SMTP server host |
| `SMTP_PORT` | ❌ | SMTP port (default: 587) |
| `SMTP_USER` | ✅ (prod) | SMTP username |
| `SMTP_PASS` | ✅ (prod) | SMTP password |
| `SMTP_FROM` | ❌ | Sender email address |

> In development, if SMTP is not configured, emails are logged to the console.

#### Frontend (`frontend/.env`)

| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | ✅ | Backend API base URL |

### 3. Database Setup

```bash
cd backend

# Push schema to database (creates tables)
npx prisma db push

# Generate Prisma client
npx prisma generate

# Or use migrations for production
npx prisma migrate dev
```

### 4. Run Development Servers

```bash
# Terminal 1 — Backend (port 3000)
cd backend
npm run dev

# Terminal 2 — Frontend (port 1604)
cd frontend
npm run dev
```

## Auth Flow

TeacherHub uses email-verified JWT authentication:

```
1. User registers with email/password
   └─→ Account created in UNVERIFIED state
   └─→ Verification email sent with tokenized link
   └─→ User sees "check your email" message (no auto-login)

2. User clicks verification link in email
   └─→ GET /api/auth/verify-email?token=...
   └─→ Account marked as verified
   └─→ User can now log in

3. User logs in
   └─→ Backend checks isEmailVerified
   └─→ If unverified → 403 "Please verify your email"
   └─→ If verified → JWT issued

4. Resend verification (if needed)
   └─→ POST /api/auth/resend-verification
   └─→ New token generated, old one invalidated
```

### Auth Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Create unverified account |
| `POST` | `/api/auth/login` | Login (verified users only) |
| `GET` | `/api/auth/verify-email?token=` | Verify email via token |
| `POST` | `/api/auth/resend-verification` | Resend verification email |

### Frontend Routes

| Path | Access | Description |
|---|---|---|
| `/login` | Guest only | Login & Register page |
| `/verify-email?token=` | Public | Email verification page |
| `/dashboard` | Authenticated | User dashboard |

## Development Notes

- **Architecture**: Controllers stay thin, services contain business logic, validators handle input via Zod
- **Password policy**: Minimum 8 characters
- **Email tokens**: Raw tokens are sent in emails; only SHA-256 hashes are stored in the database
- **Token expiry**: Verification tokens expire after 24 hours
- **Account enumeration**: Resend verification returns generic messages regardless of whether the email exists
- **SMTP fallback**: In development without SMTP config, verification emails are printed to the backend console — copy the verification URL from there

# Mock Layer — TeacherHub Frontend

This directory contains the **client-side mock backend** used for features not yet connected to the real API.

## Contents

- `server/database.ts` — In-memory database seeded in `localStorage`. Used by non-auth repositories.
- `data/index.ts` — Static mock datasets (legacy prototype data).
- `contracts/index.ts` — Shared payload types re-exported from root types.

## Important

| Feature Area | Status |
|---|---|
| `authRepository.ts` | ✅ Real API only (`/api/auth/*`) |
| `lessonsRepository.ts` | 🟡 Mock DB (real API partial) |
| `adminRepository.ts` | 🟡 Mock DB |
| `communityRepository.ts` | 🟡 Mock DB |
| `profileRepository.ts` | 🟡 Mock DB |
| `notificationsRepository.ts` | 🟡 Mock DB |

## Rules

1. **Do not use mock data for auth** — auth always calls the real backend.
2. To migrate a feature to real API, remove `getDatabase()` calls and replace with `apiRequest()`.
3. Mock data is stored in `localStorage` under the key `teacherhub-db-v3`.

# Authentication & Authorization Guide — VibeFlow

## 1. Email & Password Authentication Flow

1. **Registration (`POST /api/auth/register`)**:
   - Email is trimmed, lowercased, and checked for uniqueness.
   - Password is validated (8–72 characters, at least 1 letter and 1 number) and hashed with `bcryptjs` (12 salt rounds).
   - Role is hardcoded to `'user'` on the server; client-supplied `role` fields are rejected with `400 VALIDATION_ERROR`.
2. **Login (`POST /api/auth/login`)**:
   - Verifies the submitted password against the stored bcrypt hash.
   - Executes a constant-work dummy bcrypt comparison when the email does not exist to prevent timing-based user enumeration.
   - Returns a generic `401 INVALID_CREDENTIALS` response on failure.
3. **Session Issuance & Verification**:
   - The server signs a JWT containing `{ sub: user._id, role: user.role, tokenVersion: user.tokenVersion }` and sets it in an `HttpOnly` cookie (`vibeflow_session`).
   - Protected routes verify the JWT signature, user active status, and `tokenVersion` against the database on every request.
4. **Logout (`POST /api/auth/logout`)**:
   - Increments `user.tokenVersion` in the database and clears the `vibeflow_session` cookie, ensuring previously issued tokens cannot be replayed after logout.

---

## 2. Initial Administrator Provisioning

Run `npm run admin:bootstrap` with `ADMIN_EMAIL` and `ADMIN_INITIAL_PASSWORD` set in the environment. Public registration never grants administrator privileges automatically.

# Server (Express + MongoDB)

1. `cp .env.example .env` and fill in `MONGODB_URI`, `CLIENT_ORIGIN`, and two 32+ char secrets
   (`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`).
2. `npm install`
3. `npm run admin:init` (reads ADMIN_EMAIL / ADMIN_PASSWORD; refuses if an admin exists; add `-- --reset-password` to rotate). Remove ADMIN_PASSWORD from the environment afterwards.
4. `npm run seed` (safe to repeat).
5. `npm run dev`, then GET `/health`.

Auth: login returns a 15-minute access token (keep in memory, not localStorage). The refresh token is an HttpOnly cookie scoped to `/api/v1/auth`, rotated on each use; reuse of an old token revokes the whole session family. `/refresh` and `/logout` require header `X-Requested-With: fetch`. For a frontend and API on different sites set `COOKIE_SAMESITE=none` (HTTPS only).

Admin project covers accept JPEG, PNG, and WebP files up to 5 MB. Files are stored under `UPLOAD_DIR` (default `uploads`) and served from `/uploads`. Configure a persistent volume for this directory in production; ephemeral server filesystems do not retain uploads across redeploys.

Not yet built: contact, media library, SEO, settings, analytics, chatbot, tests.

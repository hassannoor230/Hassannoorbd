# Server (Express + MongoDB)

1. Copy `.env.example` to `.env` and fill in `MONGODB_URI`, `CLIENT_ORIGIN`, and two 32+ char secrets
   (`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`).
   For contact form email, also set `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, and `CONTACT_OWNER_EMAIL`.
   `SMTP_FROM` is optional (defaults to `SMTP_USER`); use `SMTP_SECURE=true` for port 465.
2. `npm install`
3. `npm run admin:init` (reads ADMIN_EMAIL / ADMIN_PASSWORD; refuses if an admin exists; add `-- --reset-password` to rotate). Remove ADMIN_PASSWORD from the environment afterwards.
4. `npm run seed` (safe to repeat).
5. `npm run dev`, then GET `/health`.

Auth: login returns a 15-minute access token (keep in memory, not localStorage). The refresh token is an HttpOnly cookie scoped to `/api/v1/auth`, rotated on each use; reuse of an old token revokes the whole session family. `/refresh` and `/logout` require header `X-Requested-With: fetch`. For a frontend and API on different sites set `COOKIE_SAMESITE=none` (HTTPS only).

Admin project covers accept JPEG, PNG, and WebP files up to 5 MB. Files are stored under `UPLOAD_DIR` (default `uploads`, `/tmp/uploads` on Vercel) and served from `/uploads`. Configure a persistent volume for this directory in production; serverless filesystems do not retain uploads across cold starts or redeploys, so use an external image host (S3, Cloudinary, Vercel Blob) if images must survive.

## Deploying on Vercel

`vercel.json` builds `src/handler.ts` as the single serverless function and routes every path to it, so `GET /health` should answer `{"ok":true,"db":"connected"}`. Without a reachable database the API answers 500 and the log line `MongoDB connection failed:` names the real cause — a wrong `MONGODB_URI`, or Atlas rejecting Vercel's egress IPs. Vercel does not publish fixed outbound addresses on serverless plans, so either allow `0.0.0.0/0` in Atlas Network Access or front the cluster with Atlas Data API / a fixed-IP gateway.

Not yet built: media library, SEO, settings, analytics, chatbot, tests.

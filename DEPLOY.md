# Putting Sagedew online

Everything below can be done without writing code. Items marked **YOU** need your own accounts or money; the rest is already built and tested (a production build, sign-in and the fair-use limits were checked on a production server).

## 1. Choose where it runs

Recommended: **Vercel** (runs the app) + **Neon** or **Supabase** (managed Postgres database). Both have free starter plans.

- The app needs a database that is always on: use a managed Postgres, not the Docker one on your computer.
- Some requests take a minute or two (building a routine, looking up a new product). The routes ask the host for up to 5 minutes (`maxDuration`); check your Vercel plan allows that, and upgrade if it doesn't.

## 2. Buy the domain  **YOU**

Buy **sagedew.com** (verified unregistered when checked). Optionally also **sagedew.app** to protect the name. Before buying, search the name at the trademark office for the country you'll operate in (a web search found no brand, clinic or app called Sagedew, but that isn't a legal check).

## 3. Settings the app needs (environment variables)

| Name | What to put |
|---|---|
| `DATABASE_URL` | the connection string from Neon/Supabase |
| `AUTH_SECRET` | a new secret: run `openssl rand -base64 32` (do not reuse your local one) |
| `AUTH_URL` | `https://sagedew.com` |
| `ANTHROPIC_API_KEY` | a **new key just for production**, and set a monthly spend limit in the Anthropic console |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | a production Google sign-in client (next section) |

## 4. Google sign-in  **YOU**

In Google Cloud Console, use a client for the production address:

1. Authorized JavaScript origin: `https://sagedew.com`
2. Authorized redirect URI: `https://sagedew.com/api/auth/callback/google`
3. OAuth consent screen: app name **Sagedew**, support email, and links to the Privacy Policy and Terms (see section 6). Switch the app from "Testing" to "In production", or only listed test users can sign in.

## 5. Database

Build command on the host: `npx prisma migrate deploy && npm run build`. The production database starts empty: the sample products you see locally are test data and stay on your computer. The product library fills in as people add products.

## 6. Before real people use it

Not built yet, and needed for a public health-adjacent app:

- **Privacy Policy and Terms pages.** Google also requires them. State plainly: what is stored (account, products, routine, check-ins), that label photos are read and only the ingredient text is kept (the photo itself is not saved), and that the text and photos are processed by Anthropic's API.
- **Delete my account / my data.** Privacy laws (GDPR, PIPEDA, CCPA) and Google expect it.
- **Bot protection on sign-up** (for example Cloudflare Turnstile) and a per-IP rate limit at the host's firewall. Per-account daily limits are built in (routine builds, routine checks, label photos, new products, check-ins; see `src/lib/limits.ts`), but nothing stops someone creating many accounts.
- **Emergency wording.** The app refuses and points to a doctor on red-flag symptoms; have someone you trust read the safety wording once.

## 7. After the first deploy: smoke test

1. Sign up with email, then sign in with Google.
2. Redo the intake with two products; build a routine; approve it.
3. Add a product from the Shelf and approve the change.
4. Tick a step on Today; open Progress.
5. Check the host's logs for errors, and the Anthropic console for usage.

## Database backups

Turn on point-in-time recovery or daily backups in Neon/Supabase before launch.

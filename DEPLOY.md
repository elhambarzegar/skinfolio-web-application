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

Built: **Privacy Policy** (`/privacy`), **Terms of Use** (`/terms`), **download my data** and **delete my account** (Me, then My data and account). Sign-up links to both documents. Still to do:

- **Fill in the facts the documents state**, in `src/lib/brand.ts` (`LEGAL`): the real contact mailbox (`privacy@sagedew.com` must exist before launch), the legal name and country of whoever runs the service, and the "last updated" date whenever you change either document.
- **Have a lawyer read both documents** (the privacy law that applies depends on where you and your users are: for example Canada's PIPEDA, the EU/UK GDPR, California's CCPA). They are written in plain language from what the app actually does, but they are not legal advice, and the Terms deliberately don't name a governing law or court yet.
- **Name your hosting and database providers** in the Privacy Policy once you've chosen them (it currently says "our hosting and database providers").
- **Google sign-in** needs the Privacy Policy and Terms links on its consent screen (section 4).
- **Bot protection on sign-up** (for example Cloudflare Turnstile) and a per-IP rate limit at the host's firewall. Per-account daily limits are built in (`src/lib/limits.ts`), but nothing stops someone creating many accounts.
- **Emergency wording.** The app refuses and points to a doctor on red-flag symptoms; have someone you trust read the safety wording once.

## 7. After the first deploy: smoke test

1. Sign up with email, then sign in with Google.
2. Redo the intake with two products; build a routine; approve it.
3. Add a product from the Shelf and approve the change.
4. Tick a step on Today; open Progress.
5. Me: download your data, then delete the test account.
6. Check the host's logs for errors, and the Anthropic console for usage.

## Database backups

Turn on point-in-time recovery or daily backups in Neon/Supabase before launch.

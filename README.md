# MPR JEWELLERY

Full-stack jewellery store with a customer website and a secure Owner Portal.

- **Frontend:** React 18 + TypeScript + Tailwind CSS + React Router (`client/`)
- **Backend:** Node.js + Express REST API + TypeScript (`server/`)
- **Database:** PostgreSQL / Supabase (`DATABASE_URL`) — or embedded PostgreSQL (PGlite) for zero-setup local development
- **Storage:** Supabase Storage bucket, or local disk (`storage/uploads`) in development
- **Auth:** bcrypt password hashing, JWT, server-side owner route protection, rate-limited login
- **Payments:** UPI (manual owner verification) with a provider interface ready for a real gateway webhook

```
mpr-jewellery/
├── client/src/{components,pages,layouts,hooks,services,context,types,utils}
├── server/src/{controllers,routes,middleware,services,models,database,utils,config,tests}
├── storage/          seed images, local uploads, embedded DB data
├── .env.example
└── README.md
```

---

## 1. Requirements

- Node.js **20+** and npm 10+
- For production: a PostgreSQL 14+ database (Supabase works out of the box) and optionally a Supabase Storage bucket

## 2. Installation

```bash
git clone <your-repo> mpr-jewellery && cd mpr-jewellery
npm run install:all          # installs server/ and client/ dependencies
cp .env.example server/.env  # then edit server/.env
```

## 3. Database setup

**Local (no setup):** leave `DATABASE_URL` empty. The server starts an embedded PostgreSQL (PGlite) stored in `storage/pgdata/`.

**PostgreSQL / Supabase:** set `DATABASE_URL`, e.g.

```
DATABASE_URL=postgresql://postgres:<password>@db.<project>.supabase.co:5432/postgres
```

The schema (`server/src/database/schema.sql`) is applied automatically on every start (idempotent `CREATE TABLE IF NOT EXISTS`). Tables: `owners, products, product_images, product_videos, collections, collection_media, orders, order_items, customers, customer_addresses, payments, payment_audit_log, messages, metal_rates, site_settings, order_counters`.

On an empty database the server seeds: default settings, initial metal rates (labelled *“Initial setup rate — owner to verify”*), and demo products/collections (`SEED_DEMO=false` to skip). You can also run `npm --prefix server run seed`.

## 4. Storage setup

- **Development:** files are saved to `storage/uploads/` and served by the API at `/api/media/...` (with HTTP range support for video).
- **Production (Supabase):** create a **public** bucket (default name `mpr-media`), then set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_BUCKET`. The service-role key is only used by the server — never put it in the frontend.

Uploads accepted: images JPG/JPEG/PNG/WEBP (≤ 15 MB, auto-resized to WEBP + thumbnail), videos MP4/WEBM/MOV (≤ 200 MB). File contents are verified server-side (images are decoded/re-encoded, videos are signature-checked), not just the extension.

## 5. Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL/Supabase connection string (empty = embedded PGlite) |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_BUCKET` | Object storage (empty = local disk) |
| `JWT_SECRET` | Token signing secret — **required in production** |
| `UPI_ID`, `UPI_PHONE` | Initial UPI details (`9030957387@axl`, `9030957387`); editable in Settings |
| `SEED_OWNER_EMAIL`, `SEED_OWNER_PASSWORD` | First owner account (created once, hashed) |
| `PORT`, `NODE_ENV`, `CORS_ORIGINS` | Server options |
| `RATES_API_URL`, `RATES_API_KEY` | Optional live metal-rate provider |
| `PAYMENT_PROVIDER` | `manual_upi` (default) |
| `client/.env`: `VITE_API_URL`, `VITE_ROUTER_MODE` | API base URL if on another domain; `hash` routing for static hosts |

## 6. Running the frontend

```bash
npm run dev:client      # http://localhost:5173  (proxies /api → http://localhost:5000)
```

## 7. Running the backend

```bash
npm run dev:server      # http://localhost:5000  (auto-reload)
```

Production: `npm run build && npm start` — the Express server also serves `client/dist` with SEO meta tags injected per product/collection URL.

## 8. Creating the owner account

The owner is **not** hard-coded in the frontend. On first start, if no owner exists, the server creates one from `SEED_OWNER_EMAIL` / `SEED_OWNER_PASSWORD` and stores only a bcrypt hash.

```
SEED_OWNER_EMAIL=bhavyakthmadanambeti@gmail.com
SEED_OWNER_PASSWORD=<the owner password>
```

Start the server once, then **remove `SEED_OWNER_PASSWORD`** from the environment. Sign in at `/owner/login` and change the password any time in **Owner Portal → Settings → Change password**.

## 9. Uploading products

Owner Portal → **Add Product** → fill name, description, category, metal, purity, weight, SKU, price, availability/stock → **Upload Product Images** (drag & drop on desktop, gallery picker on mobile; previews, reorder, remove before saving) → **Create product**. On the edit page you can add more images/videos with per-file progress, replace, reorder (drag or arrows) and delete. Prices can also be changed inline from the Products list.

## 10. Creating homepage collections

Owner Portal → **Home Collections** → **New Collection** → upload any number of images/videos → set **Published**, **Visible**, **Show on homepage**, and optionally **Use as homepage hero**. Edit the title at any time (e.g. “New Collection” → “Festive Gold Collection”). Collection media is promotional only — no Buy Now button is shown on it. Reorder collections with the arrows; section order on the homepage is in Settings → Homepage.

## 11. Setting the UPI ID

Owner Portal → **Settings → UPI payment**: UPI ID, display name, UPI phone, payment instructions, support message. The checkout builds a `upi://pay` link and QR code using the **server-calculated amount** for that order.

## 12. Testing orders

Manual flow:
1. Open a product → **Buy Now** (or Add to Cart → Checkout).
2. Fill delivery details → **Place order & pay via UPI** → order page with ID `MPR-YYYYMMDD-NNNN`, UPI ID, **PAY USING UPI** and QR.
3. Tap **I HAVE MADE THE PAYMENT** (optionally enter UTR) → status becomes **Payment Pending Verification**.
4. Owner Portal → **Orders** → **Verify Payment** → check your bank/UPI app → **Mark Paid** (or Mark Failed / Cancel). Every change is written to the payment audit record.
5. Update order status: Order Processing → Ready → Dispatched → Delivered. The customer page updates automatically.

Customers can track orders via the secure link, **Track order** (Order ID + mobile), or **My Account → My Orders** when signed in.

Automated API tests (server must be running):

```bash
npm run dev:server   # terminal 1
npm test             # terminal 2 — owner login/invalid login, product CRUD, image & video upload,
                     # collection create/title edit, browsing/search, server-side quote, checkout validation,
                     # order creation & UPI link, payment confirmation, owner verification, status updates,
                     # guest order access, contact messages, rates, secret-field rejection
```

## 13. Deploying the frontend

- **With the backend (simplest):** `npm run build` and deploy the whole repo to a Node host (Render, Railway, Fly.io, a VPS). Express serves `client/dist` and `/api` on one domain.
- **Separately (Vercel/Netlify):** build `client/` with `VITE_API_URL=https://api.yourdomain.com`. Configure SPA rewrites to `index.html`, or build with `VITE_ROUTER_MODE=hash`. Add your frontend origin to `CORS_ORIGINS` on the server.

## 14. Deploying the backend

Any Node 20 host: build command `npm run install:all && npm run build`, start command `npm start`, set `NODE_ENV=production`, `JWT_SECRET`, `DATABASE_URL`, Supabase storage variables, UPI variables. Use HTTPS. Uploads must use Supabase Storage in production (local disk is not persistent on most hosts).

## 15. Deploying the database

Create a Supabase project (or any managed PostgreSQL), copy the connection string into `DATABASE_URL`. The schema is created on first start. Enable automatic backups in your database provider.

## 16. Security notes

- Owner password is stored only as a **bcrypt hash**; it never appears in frontend code or API responses. Login is rate-limited; owner tokens expire (8 h default).
- Every `/api/owner/*` route is protected on the server (`requireOwner` middleware) — hiding UI is not relied on.
- **Prices are never trusted from the browser.** Cart quotes, order totals, UPI amounts, delivery and tax are calculated on the server from database prices inside a transaction (with row locks and stock checks).
- Payments are **never auto-marked successful**. “I have made the payment” only sets *Pending Verification*; the owner verifies against the bank/UPI app. The system never asks for or stores UPI PINs, OTPs or bank passwords (the settings API rejects such fields).
- Guest order pages require a secret access token (in the order link) or the order’s phone number.
- Automatic verification: implement a provider in `server/src/services/payments/` with `verifyWebhook` (signature validation), register it in `payments/index.ts`, and point the gateway to `POST /api/payments/webhook/<provider>`. The webhook also checks the amount matches the server-side order total.
- Helmet security headers, CORS allow-list, upload type/size validation, parameterised SQL everywhere.
- Keep `.env` files out of git (already in `.gitignore`).

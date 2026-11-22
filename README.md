# Room Mockup (prototype-v0)

Upload a photo of your room, mark the floor, search a product catalog, and place items on the photo. The photo stays in your browser. This build has no account or database.

prototype-v0 adds a server search API (Amazon Creators API when keys are set, otherwise the sample catalog), floor-quad perspective scaling, usage pings, and compliance stubs for Wayfair/Walmart. It is an ugly first version: small, readable, working.

## Setup

```bash
git clone https://github.com/kellanmreagan/room-mockup.git
cd room-mockup
cp .env.example .env.local
npm install
npm run dev
```

Open http://localhost:3000.

```bash
npm run lint
npm run build
```

Do not commit `.env.local`. `.env.example` has placeholder names only.

## What you can do

1. **Upload photo** — the file is kept as a local object URL.
2. **Mark floor** — click four floor corners (sorted to back-left, back-right, front-right, front-left) or **Skip / use default**. Drag the handles. **Redo floor** resets. Items on the floor scale by how far back they sit (`lib/floor.ts`).
3. **Search & place** — search `/api/products/search`. Place, drag, resize (resize is a user multiplier on top of perspective). Sample catalog items still work without keys. Add your own product by pasting a page URL and image URL.
4. **Click to shop** — Shop opens `affiliateUrl ?? productUrl` in a new tab (`rel="sponsored noopener noreferrer"`). Sample types still offer store **search** links (not product pages).

Download a PNG of the photo plus overlays. A product image hosted on another site can block the download when it does not allow canvas access. The on-screen mockup still works.

**AI render (coming soon)** stays disabled (`NoopRenderer`, `AI_RENDER_ENABLED=false`). No network calls.

## Env vars (server-only)

Copy `.env.example`. None of these use `NEXT_PUBLIC_`.

| Variable | Purpose |
| --- | --- |
| `AMAZON_CREATORS_CREDENTIAL_ID` | Login with Amazon credential id |
| `AMAZON_CREATORS_CREDENTIAL_SECRET` | Login with Amazon credential secret |
| `AMAZON_CREATORS_CREDENTIAL_VERSION` | `3.1` (NA), `3.2` (EU), `3.3` (FE). Default `3.1` |
| `AMAZON_CREATORS_PARTNER_TAG` | Associates partner tag |
| `AMAZON_CREATORS_MARKETPLACE` | Default `www.amazon.com` |
| `AMAZON_CREATORS_RPS` | Creators API min interval. Default `1` (1 req/sec) |
| `PRODUCT_CACHE_TTL_SECONDS` | In-memory search cache. Default `3600`. Keep short; UI shows "Price as of" |
| `WAYFAIR_CJ_FEED_URL` | Placeholder for the CJ feed |
| `WAYFAIR_FEED_ENABLED` | Default `false` |
| `WALMART_AFFILIATE_PUBLISHER_ID` | Impact publisher id (placeholder) |
| `WALMART_AFFILIATE_CONSUMER_ID` | Impact consumer id (placeholder) |
| `WALMART_AFFILIATE_PRIVATE_KEY_PATH` | Path to Impact private key (placeholder) |
| `WALMART_AFFILIATE_ENABLED` | Default `false` |
| `AI_RENDER_ENABLED` | Default `false`. Ignored until a real renderer exists |

Amazon search is enabled only when id, secret, and partner tag are set.

## What is real vs stubbed

| Piece | Status |
| --- | --- |
| Sample catalog (`lib/catalog.ts`, `SampleCatalogSource`) | Real local data. Generic item types, no prices. Store links are search URLs. |
| Amazon Creators API (`lib/products/sources/amazon-creators.ts`) | Implemented. Needs credentials. OAuth client-credentials token cached in memory. |
| Wayfair CJ feed | Stub. `search()` returns `[]`. |
| Walmart Impact API | Stub. `search()` returns `[]`. |
| Product cache + 1 rps limiter | Real, in-process only. |
| Floor perspective | Real, client-side. |
| PNG export | Real. Remote images may fail CORS. |
| AI render | Stub (`NoopRenderer`). |
| `/api/usage` | Real. One JSON log line, no PII, `204`. |

The browser MVP in `lib/product-source.ts` (`listProducts`) still feeds the sample panel. Server search uses `lib/products/source.ts`.

## Sample data

Built-in items are generic types (sofa, chair, …) with original SVG line art in `public/items/`. Buy / View opens real store search pages:

- Amazon: `https://www.amazon.com/s?k=`
- Wayfair: `https://www.wayfair.com/keyword.php?keyword=`
- IKEA: `https://www.ikea.com/us/en/search/?q=`
- eBay: `https://www.ebay.com/sch/i.html?_nkw=`
- Facebook Marketplace: `https://www.facebook.com/marketplace/search/?query=`

## Compliance

See `docs/retailer-compliance.md` and `lib/compliance/`.

- **Do not crawl Amazon, Wayfair, or Walmart HTML.**
- Amazon: Creators API only.
- Wayfair: CJ Affiliate product feed (not implemented).
- Walmart: Affiliate API via Impact (not implemented).
- robots.txt snapshots (2026-11-22, HTTP 200) live in `docs/robots-snapshots/`. ToS has not been reviewed; `crawlingApproved` is false.

When an Amazon price is shown, the UI prints **Price as of &lt;timestamp&gt;** (`fetchedAt`). Amazon Associates terms limit how long cached prices may be displayed — keep `PRODUCT_CACHE_TTL_SECONDS` short and check the current Operating Agreement.

When any Amazon product is on screen, the footer includes the Associates disclosure.

## Next steps

- Wire the CJ feed parser and Impact `/search` (max 25) behind the existing stubs.
- Confirm Amazon Creators `itemInfo.productInfo` / `classifications` field paths against a live response (marked UNVERIFIED in code).
- Replace `NoopRenderer` when `AI_RENDER_ENABLED` is on and a key is present.
- Persist rooms only if you add accounts; this prototype does not.

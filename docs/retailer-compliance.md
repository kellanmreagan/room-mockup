# Retailer compliance (prototype-v0)

Crawling retailer HTML is **not approved** for this project. Use official affiliate APIs and feeds.

## Checklist (do this before any crawling)

1. Fetch `https://<host>/robots.txt` and save a dated snapshot under `docs/robots-snapshots/`.
2. Record the fetch date, HTTP status, and the User-agent group you will honor (`*` unless you have a registered crawler).
3. Manually review the retailer's Terms of Use. Record date, reviewer, and URL. Leave `tosReviewed: false` until that happens.
4. Prefer official affiliate APIs or product data feeds over HTML.
5. Respect `Crawl-delay` when declared. If none is declared for your user agent, default to **1 request / 5 seconds**.
6. Identify the user agent clearly if you ever crawl.
7. **Never crawl Amazon.** Use the Amazon Creators API only (PA-API 5.0 was retired May 15 2026).
8. Re-check robots.txt, ToS, and this table at least quarterly.

Until `crawlingApproved` **and** `tosReviewed` are true in `lib/compliance/retailers.ts`, `assertCrawlAllowed()` throws.

## Findings (fetched 2026-11-22 00:25 MST, HTTP 200)

| | Wayfair | Walmart |
| --- | --- | --- |
| Host | wayfair.com | walmart.com |
| Snapshot | `docs/robots-snapshots/wayfair.com-2026-11-22.txt` | `docs/robots-snapshots/walmart.com-2026-11-22.txt` |
| `robotsCheckedAt` | 2026-11-22 | 2026-11-22 |
| `tosReviewed` | false | false |
| ToS URL | https://www.wayfair.com/terms | https://www.walmart.com/terms-of-use |
| `crawlingApproved` | false | false |
| `Crawl-delay` for `User-agent: *` | none declared (`null`) | none declared (`null`; `Crawl-delay: 5` is only for **Slurp**) |
| Preferred route | CJ Affiliate product feed | Walmart Affiliate API via Impact |
| Notable `Disallow` | `/shop/` (but `/shop/o/` allowed), `/filters/`, `/ajax/`, `/v/product_image_group/get_images`, `/v/inventory/load`, `/roomplanner/`, `/visual_search/`, `/*?*curpage=*` | `/search`, `/api/`, `/account/`, `/feeds/*`, `/typeahead/`, `/store/electrode/api/search` |

## Conclusion

Crawling is **not approved** for Wayfair or Walmart. Prototype-v0 must not scrape product pages, search HTML, or inventory endpoints.

- **Wayfair:** ingest the CJ Affiliate product data feed (`WAYFAIR_CJ_FEED_URL`) when that integration is built. `WayfairFeedSource` is a disabled stub.
- **Walmart:** call the Walmart Affiliate API via Impact (search max 25 items, needs `publisherId`). `WalmartAffiliateSource` is a disabled stub.
- **Amazon:** Creators API only. No robots crawl, no PA-API 5.0.

Default polite rate if a future approved crawler is ever added: 1 request / 5 seconds unless a `Crawl-delay` says otherwise.

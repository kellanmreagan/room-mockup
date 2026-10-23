# Room Mockup

Upload a photo of your room and mock it up with furniture and decor from many stores
(Amazon, Wayfair, IKEA, eBay, Facebook Marketplace) instead of one retailer's catalog.

The photo stays in your browser. This build has no account, database, or paid API.

## Features

- Upload a room photo. The file is kept as a local object URL.
- Browse a panel of furniture and decor (sofa, accent chair, coffee table, floor lamp, rug, plant, wall art, bookshelf, side table, mirror).
- Place an item on the photo. Drag it, resize it from the corner handle, bring it to the front, or remove it.
- Open **Buy / View** in a new tab. Sample items link to real store search pages. A product you add links to the page you pasted.
- Add your own product with a name, an http(s) product-page URL, and an http(s) image URL.
- Download a PNG of the photo plus overlays. A product image hosted on another site can block the download when it does not allow canvas access. The on-screen mockup still works.
- **AI render (coming soon)** stays disabled until an image-edit API key is set.

## Run locally

```bash
git clone https://github.com/kellanmreagan/room-mockup.git
cd room-mockup
npm install
npm run dev
```

Open http://localhost:3000.

```bash
npm run lint
npm run build
```

## Sample data

The built-in catalog is sample data: generic item types, with no prices and no invented product pages. Each Buy / View link is a real search URL:

- Amazon: `https://www.amazon.com/s?k=`
- Wayfair: `https://www.wayfair.com/keyword.php?keyword=`
- IKEA: `https://www.ikea.com/us/en/search/?q=`
- eBay: `https://www.ebay.com/sch/i.html?_nkw=`
- Facebook Marketplace: `https://www.facebook.com/marketplace/search/?query=`

Pictures in `public/items/` are original SVG line art, not store photos.

To stage a specific product, use **Add your own product** and paste the real listing and image URL.

## Keys for live listings and AI rendering

These keys are optional. The page works without them.

A future `ProductSource` (see `lib/product-source.ts`) can replace `SampleCatalogSource`:

| Source | Access |
| --- | --- |
| Amazon Product Advertising API 5.0 | Access key, secret key, and partner/associate tag |
| Wayfair | No public product API. Affiliate feed via CJ or Impact. |
| IKEA | No official public API. |
| eBay Browse API | OAuth app client id and secret |
| Facebook Marketplace | No public API. |
| SerpApi Google Shopping | `SERPAPI_API_KEY` (cross-store aggregator) |

A future `MockupRenderer` (see `lib/mockup-renderer.ts`) can replace manual overlays. `NoopRenderer` is the current path.

| Renderer | Access |
| --- | --- |
| OpenAI gpt-image-1 image edits | `OPENAI_API_KEY` |
| Replicate SDXL inpainting | `REPLICATE_API_TOKEN` |

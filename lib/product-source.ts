import { SAMPLE_PRODUCTS } from "./catalog";
import type { Product } from "./types";

/**
 * Browser-side list for the MVP product panel (`listProducts`).
 *
 * Server search (Amazon Creators API, Wayfair/Walmart stubs, sample adapter)
 * lives in `lib/products/source.ts` and is used by `/api/products/search`.
 *
 * PA-API 5.0 was retired May 15 2026. Amazon listings use the Creators API
 * (`AMAZON_CREATORS_*` env vars). Wayfair: CJ Affiliate feed. Walmart: Impact.
 */
export interface ProductSource {
  readonly id: string;
  readonly label: string;
  listProducts(): readonly Product[];
}

export class SampleCatalogSource implements ProductSource {
  readonly id = "sample-catalog";
  readonly label = "Sample catalog";

  listProducts(): readonly Product[] {
    return SAMPLE_PRODUCTS;
  }
}

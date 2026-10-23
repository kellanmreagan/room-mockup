import { SAMPLE_PRODUCTS } from "./catalog";
import type { Product } from "./types";

/**
 * A source of products the panel can list.
 *
 * TODO: plug real listings in behind this interface. Required keys / access:
 * - Amazon Product Advertising API 5.0: access key, secret key, partner/associate tag
 * - Wayfair: no public product API (affiliate feed via CJ/Impact)
 * - IKEA: no official public API
 * - eBay Browse API: OAuth app client id and secret
 * - Facebook Marketplace: no public API
 * - SerpApi Google Shopping: SERPAPI_API_KEY (cross-store aggregator)
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

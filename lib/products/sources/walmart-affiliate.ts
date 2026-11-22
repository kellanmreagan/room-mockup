import { RETAILER_COMPLIANCE, assertCrawlAllowed } from "@/lib/compliance/retailers";
import type { ProductSource } from "../source";
import type { CatalogProduct, SearchOptions } from "../types";

/**
 * Sanctioned route is the Walmart Affiliate API via Impact (`/search`, max 25
 * items, needs publisherId). This source does NOT crawl walmart.com
 * (see lib/compliance/retailers.ts and assertCrawlAllowed).
 * WALMART_AFFILIATE_ENABLED defaults to false.
 *
 * Env placeholders: WALMART_AFFILIATE_PUBLISHER_ID,
 * WALMART_AFFILIATE_CONSUMER_ID, WALMART_AFFILIATE_PRIVATE_KEY_PATH.
 *
 * TODO: sign Impact requests and call the affiliate /search endpoint.
 */
export class WalmartAffiliateSource implements ProductSource {
  readonly id = "walmart-affiliate";
  readonly label = "Walmart (Impact API)";

  isEnabled(): boolean {
    return process.env.WALMART_AFFILIATE_ENABLED === "true";
  }

  async search(query: string, opts?: SearchOptions): Promise<CatalogProduct[]> {
    void query;
    void opts;
    const route = RETAILER_COMPLIANCE["walmart.com"].preferredRoute;
    try {
      assertCrawlAllowed("walmart.com", "/search");
    } catch {
      // Crawling is not approved. TODO: call Impact /search (max 25) with publisherId.
      void route;
      return [];
    }
    return [];
  }
}

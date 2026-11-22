import { RETAILER_COMPLIANCE, assertCrawlAllowed } from "@/lib/compliance/retailers";
import type { ProductSource } from "../source";
import type { CatalogProduct, SearchOptions } from "../types";

/**
 * Sanctioned route is the Wayfair affiliate product data feed via CJ Affiliate.
 * This source does NOT crawl wayfair.com (see lib/compliance/retailers.ts and
 * assertCrawlAllowed). WAYFAIR_FEED_ENABLED defaults to false.
 *
 * TODO: download/parse the CJ feed at WAYFAIR_CJ_FEED_URL and filter by query.
 */
export class WayfairFeedSource implements ProductSource {
  readonly id = "wayfair-feed";
  readonly label = "Wayfair (CJ feed)";

  isEnabled(): boolean {
    return process.env.WAYFAIR_FEED_ENABLED === "true";
  }

  async search(query: string, opts?: SearchOptions): Promise<CatalogProduct[]> {
    void query;
    void opts;
    const route = RETAILER_COMPLIANCE["wayfair.com"].preferredRoute;
    try {
      assertCrawlAllowed("wayfair.com", "/");
    } catch {
      // Crawling is not approved. TODO: parse the CJ feed at WAYFAIR_CJ_FEED_URL.
      void route;
      return [];
    }
    return [];
  }
}

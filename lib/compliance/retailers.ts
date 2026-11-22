import { isPathAllowed } from "./robots";

export type RetailerHost = "wayfair.com" | "walmart.com";

export type RetailerCompliance = {
  robotsCheckedAt: string;
  robotsSnapshot: string;
  tosReviewed: boolean;
  tosUrl: string;
  crawlingApproved: boolean;
  crawlDelaySeconds: number | null;
  preferredRoute: string;
  notableDisallows: string[];
};

/**
 * Recorded 2026-11-22 from docs/robots-snapshots/*.txt.
 * crawlingApproved is false: use the affiliate API/feed, do not crawl HTML.
 */
export const RETAILER_COMPLIANCE: Record<RetailerHost, RetailerCompliance> = {
  "wayfair.com": {
    robotsCheckedAt: "2026-11-22",
    robotsSnapshot: "docs/robots-snapshots/wayfair.com-2026-11-22.txt",
    tosReviewed: false,
    tosUrl: "https://www.wayfair.com/terms",
    crawlingApproved: false,
    crawlDelaySeconds: null,
    preferredRoute: "CJ Affiliate product feed",
    notableDisallows: [
      "/shop/ (but /shop/o/ allowed)",
      "/filters/",
      "/ajax/",
      "/v/product_image_group/get_images",
      "/v/inventory/load",
      "/roomplanner/",
      "/visual_search/",
      "/*?*curpage=*",
    ],
  },
  "walmart.com": {
    robotsCheckedAt: "2026-11-22",
    robotsSnapshot: "docs/robots-snapshots/walmart.com-2026-11-22.txt",
    tosReviewed: false,
    tosUrl: "https://www.walmart.com/terms-of-use",
    crawlingApproved: false,
    crawlDelaySeconds: null,
    preferredRoute: "Walmart Affiliate API via Impact",
    notableDisallows: [
      "/search",
      "/api/",
      "/account/",
      "/feeds/*",
      "/typeahead/",
      "/store/electrode/api/search",
    ],
  },
};

export class CrawlNotAllowedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CrawlNotAllowedError";
  }
}

/**
 * Throws unless crawlingApproved && tosReviewed && the path is allowed by the
 * recorded robots snapshot. Call this before any retailer HTTP fetch that is
 * not an official affiliate API. Stub sources must not crawl; they either
 * call this (it will throw today) or point at this module in comments.
 */
export function assertCrawlAllowed(retailer: RetailerHost, path: string, robotsTxt?: string): void {
  const record = RETAILER_COMPLIANCE[retailer];
  if (!record) {
    throw new CrawlNotAllowedError(`Unknown retailer: ${retailer}`);
  }
  if (!record.crawlingApproved || !record.tosReviewed) {
    throw new CrawlNotAllowedError(
      `Crawling is not approved for ${retailer}. Use ${record.preferredRoute}.`,
    );
  }
  if (robotsTxt && !isPathAllowed(robotsTxt, "*", path)) {
    throw new CrawlNotAllowedError(`robots.txt disallows ${path} on ${retailer}.`);
  }
}

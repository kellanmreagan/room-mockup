import type { CatalogProduct, SearchOptions } from "./types";

/**
 * Server-side product catalog source. Implementations must not crawl retailer
 * HTML; use official APIs or affiliate feeds. See lib/compliance/.
 */
export interface ProductSource {
  readonly id: string;
  readonly label: string;
  isEnabled(): boolean;
  search(query: string, opts?: SearchOptions): Promise<CatalogProduct[]>;
}

export class ProductSourceError extends Error {
  readonly status: number;
  readonly sourceId: string;

  constructor(sourceId: string, message: string, status: number) {
    super(message);
    this.name = "ProductSourceError";
    this.sourceId = sourceId;
    this.status = status;
  }
}

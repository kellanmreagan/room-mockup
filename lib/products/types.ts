export type Retailer = "amazon" | "wayfair" | "walmart" | "sample";

export type Availability = "in_stock" | "out_of_stock" | "unknown";

export interface ProductDimensions {
  widthIn?: number;
  depthIn?: number;
  heightIn?: number;
  raw?: string;
}

export interface CatalogProduct {
  id: string;
  retailer: Retailer;
  title: string;
  price: number | null;
  currency: string | null;
  imageUrl: string;
  dimensions?: ProductDimensions;
  category: string | null;
  availability: Availability;
  productUrl: string;
  affiliateUrl: string | null;
  /** ISO-8601 timestamp. UI must show "Price as of ..." when a price is present. */
  fetchedAt: string;
}

export interface SearchOptions {
  category?: string;
  limit?: number;
}

export interface SourceStatus {
  id: string;
  label: string;
  enabled: boolean;
  error?: string;
}

export interface SearchAllResult {
  products: CatalogProduct[];
  sources: SourceStatus[];
  usingSampleFallback: boolean;
}

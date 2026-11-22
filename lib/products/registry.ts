import { cacheGet, cacheKey, cacheSet } from "./cache";
import { ProductSourceError, type ProductSource } from "./source";
import { AmazonCreatorsSource } from "./sources/amazon-creators";
import { SampleCatalogSource } from "./sources/sample";
import { WalmartAffiliateSource } from "./sources/walmart-affiliate";
import { WayfairFeedSource } from "./sources/wayfair-feed";
import type { CatalogProduct, SearchAllResult, SearchOptions, SourceStatus } from "./types";

function allSources(): ProductSource[] {
  return [
    new AmazonCreatorsSource(),
    new WayfairFeedSource(),
    new WalmartAffiliateSource(),
    new SampleCatalogSource(),
  ];
}

function isSample(source: ProductSource): boolean {
  return source.id === "sample-catalog";
}

function isReal(source: ProductSource): boolean {
  return !isSample(source);
}

export function getActiveSources(): ProductSource[] {
  const sources = allSources();
  const enabledReal = sources.filter((source) => isReal(source) && source.isEnabled());
  if (enabledReal.length > 0) return enabledReal;
  return sources.filter(isSample);
}

function sanitizeErrorMessage(error: unknown): string {
  let message = "Product search failed";
  if (error instanceof ProductSourceError) {
    message = error.message;
  } else if (error instanceof Error && error.message) {
    message = error.message;
  }
  return message
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/client_secret":\s*"[^"]*"/gi, 'client_secret":"[redacted]"')
    .replace(/client_id":\s*"[^"]*"/gi, 'client_id":"[redacted]"')
    .replace(/access_token":\s*"[^"]*"/gi, 'access_token":"[redacted]"')
    .slice(0, 240);
}

async function searchSource(
  source: ProductSource,
  query: string,
  opts?: SearchOptions,
): Promise<CatalogProduct[]> {
  const key = cacheKey(source.id, query, opts?.category);
  const cached = cacheGet<CatalogProduct[]>(key);
  if (cached) return cached;
  const products = await source.search(query, opts);
  cacheSet(key, products);
  return products;
}

export async function searchAll(query: string, opts?: SearchOptions): Promise<SearchAllResult> {
  const sources = allSources();
  const active = getActiveSources();
  const statuses: SourceStatus[] = sources.map((source) => ({
    id: source.id,
    label: source.label,
    enabled: active.some((item) => item.id === source.id),
  }));

  const products: CatalogProduct[] = [];
  let amazonFailed = false;

  for (const source of active) {
    const status = statuses.find((item) => item.id === source.id);
    try {
      const found = await searchSource(source, query, opts);
      products.push(...found);
    } catch (error) {
      const message = sanitizeErrorMessage(error);
      if (status) status.error = message;
      if (source.id === "amazon-creators") amazonFailed = true;
    }
  }

  const usingSampleOnly = active.every(isSample);
  let usingSampleFallback = usingSampleOnly;

  if (amazonFailed && !active.some(isSample)) {
    const sample = new SampleCatalogSource();
    const sampleStatus = statuses.find((item) => item.id === sample.id);
    try {
      const fallback = await searchSource(sample, query, opts);
      products.push(...fallback);
      usingSampleFallback = true;
      if (sampleStatus) sampleStatus.enabled = true;
    } catch (error) {
      if (sampleStatus) sampleStatus.error = sanitizeErrorMessage(error);
      usingSampleFallback = true;
    }
  }

  return { products, sources: statuses, usingSampleFallback };
}

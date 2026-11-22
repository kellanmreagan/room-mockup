import { SAMPLE_PRODUCTS } from "@/lib/catalog";
import type { ProductSource } from "../source";
import type { CatalogProduct, SearchOptions } from "../types";

function toCatalogProduct(product: (typeof SAMPLE_PRODUCTS)[number], fetchedAt: string): CatalogProduct {
  const productUrl = product.links[0]?.href ?? "";
  return {
    id: `sample:${product.id}`,
    retailer: "sample",
    title: product.name,
    price: null,
    currency: null,
    imageUrl: product.imageSrc,
    category: null,
    availability: "unknown",
    productUrl,
    affiliateUrl: null,
    fetchedAt,
  };
}

export class SampleCatalogSource implements ProductSource {
  readonly id = "sample-catalog";
  readonly label = "Sample catalog";

  isEnabled(): boolean {
    return true;
  }

  async search(query: string, opts?: SearchOptions): Promise<CatalogProduct[]> {
    const q = query.trim().toLowerCase();
    const fetchedAt = new Date().toISOString();
    const category = opts?.category?.trim().toLowerCase();
    const matched = SAMPLE_PRODUCTS.filter((product) => {
      if (q && !product.name.toLowerCase().includes(q) && !product.id.toLowerCase().includes(q)) {
        return false;
      }
      if (category && !product.name.toLowerCase().includes(category) && !product.id.toLowerCase().includes(category)) {
        return false;
      }
      return true;
    });
    const mapped = matched.map((product) => toCatalogProduct(product, fetchedAt));
    const limit = opts?.limit;
    if (typeof limit === "number" && limit >= 0) return mapped.slice(0, limit);
    return mapped;
  }
}

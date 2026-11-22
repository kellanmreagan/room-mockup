import type { Product } from "@/lib/types";
import type { CatalogProduct } from "./types";

export function toStudioProduct(product: CatalogProduct): Product {
  const href = product.affiliateUrl ?? product.productUrl;
  return {
    id: product.id,
    name: product.title,
    imageSrc: product.imageUrl,
    origin: product.retailer === "sample" ? "sample" : "custom",
    links: href ? [{ store: product.retailer, href }] : [],
    retailer: product.retailer,
    price: product.price,
    currency: product.currency,
    fetchedAt: product.fetchedAt,
    availability: product.availability,
    shopUrl: href || undefined,
  };
}

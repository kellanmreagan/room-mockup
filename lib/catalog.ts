import { StoreSearch } from "./studio";
import type { Product } from "./types";

/**
 * SAMPLE DATA
 * Generic furniture and decor types only. No prices, no invented products,
 * and no product-page URLs. Links are real store search URLs built from a
 * plain query. Artwork is original line art in public/items, not photos.
 */
export const SAMPLE_DATA_NOTE =
  "Sample data: generic item types with no prices. Buy / View opens a store search for that type, not a specific product.";

const SAMPLE_TYPES = [
  { id: "sofa", name: "Sofa", file: "sofa.svg", query: "sofa" },
  { id: "accent-chair", name: "Accent chair", file: "accent-chair.svg", query: "accent chair" },
  { id: "coffee-table", name: "Coffee table", file: "coffee-table.svg", query: "coffee table" },
  { id: "floor-lamp", name: "Floor lamp", file: "floor-lamp.svg", query: "floor lamp" },
  { id: "rug", name: "Rug", file: "rug.svg", query: "area rug" },
  { id: "plant", name: "Plant", file: "plant.svg", query: "potted plant" },
  { id: "wall-art", name: "Wall art", file: "wall-art.svg", query: "wall art" },
  { id: "bookshelf", name: "Bookshelf", file: "bookshelf.svg", query: "bookshelf" },
  { id: "side-table", name: "Side table", file: "side-table.svg", query: "side table" },
  { id: "mirror", name: "Mirror", file: "mirror.svg", query: "wall mirror" },
] as const;

export const SAMPLE_PRODUCTS: readonly Product[] = SAMPLE_TYPES.map((item) => ({
  id: item.id,
  name: item.name,
  imageSrc: `/items/${item.file}`,
  origin: "sample",
  links: StoreSearch.linksFor(item.query),
}));

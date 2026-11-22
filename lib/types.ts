import type { Availability, Retailer } from "./products/types";

export interface StoreLink {
  store: string;
  href: string;
}

export interface Product {
  id: string;
  name: string;
  imageSrc: string;
  links: StoreLink[];
  origin: "sample" | "custom";
  retailer?: Retailer;
  price?: number | null;
  currency?: string | null;
  fetchedAt?: string;
  availability?: Availability;
  shopUrl?: string;
}

export interface Placement {
  instanceId: string;
  productId: string;
  /** Top-left corner, as a percent of the stage. */
  x: number;
  y: number;
  /** Width as a percent of the stage. Height follows the image aspect ratio. */
  width: number;
  z: number;
}

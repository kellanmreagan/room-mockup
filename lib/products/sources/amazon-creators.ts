import { scheduleAmazon } from "../rate-limit";
import { ProductSourceError, type ProductSource } from "../source";
import type { Availability, CatalogProduct, ProductDimensions, SearchOptions } from "../types";

const SEARCH_URL = "https://creatorsapi.amazon/catalog/v1/searchItems";

const TOKEN_ENDPOINTS: Record<string, string> = {
  "3.1": "https://api.amazon.com/auth/o2/token",
  "3.2": "https://api.amazon.co.uk/auth/o2/token",
  "3.3": "https://api.amazon.co.jp/auth/o2/token",
};

type CachedToken = {
  accessToken: string;
  expiresAt: number;
};

let cachedToken: CachedToken | null = null;

type AmazonMoney = {
  amount?: number;
  currency?: string;
  displayAmount?: string;
};

type AmazonDimension = {
  displayValue?: number | string;
  unit?: string;
};

type AmazonItem = {
  asin?: string;
  detailPageURL?: string;
  images?: { primary?: { large?: { url?: string; width?: number; height?: number } } };
  itemInfo?: {
    title?: { displayValue?: string };
    // UNVERIFIED field path: confirm with real keys
    classifications?: { productGroup?: { displayValue?: string } };
    // UNVERIFIED field path: confirm with real keys
    productInfo?: {
      itemDimensions?: {
        width?: AmazonDimension;
        length?: AmazonDimension;
        height?: AmazonDimension;
      };
    };
  };
  offersV2?: {
    listings?: Array<{
      availability?: { type?: string };
      price?: { money?: AmazonMoney };
    }>;
  };
};

type AmazonSearchResponse = {
  searchResult?: {
    items?: AmazonItem[];
    totalResultCount?: number;
    searchURL?: string;
  };
};

function env(name: string): string {
  return process.env[name]?.trim() ?? "";
}

function credentialId(): string {
  return env("AMAZON_CREATORS_CREDENTIAL_ID");
}

function credentialSecret(): string {
  return env("AMAZON_CREATORS_CREDENTIAL_SECRET");
}

function partnerTag(): string {
  return env("AMAZON_CREATORS_PARTNER_TAG");
}

function credentialVersion(): string {
  return env("AMAZON_CREATORS_CREDENTIAL_VERSION") || "3.1";
}

function marketplace(): string {
  return env("AMAZON_CREATORS_MARKETPLACE") || "www.amazon.com";
}

function tokenEndpoint(): string {
  return TOKEN_ENDPOINTS[credentialVersion()] ?? TOKEN_ENDPOINTS["3.1"];
}

function isInches(unit: string | undefined): boolean {
  if (!unit) return false;
  const n = unit.trim().toLowerCase();
  return n === "inches" || n === "inch" || n === "in";
}

function parseDimension(value: number | string | undefined): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number.parseFloat(value);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function mapDimensions(
  dims:
    | {
        width?: AmazonDimension;
        length?: AmazonDimension;
        height?: AmazonDimension;
      }
    | undefined,
): ProductDimensions | undefined {
  if (!dims) return undefined;
  const parts: string[] = [];
  const out: ProductDimensions = {};

  const apply = (label: string, dim: AmazonDimension | undefined, key: keyof ProductDimensions) => {
    if (!dim) return;
    const raw = dim.displayValue;
    const unit = dim.unit;
    if (raw === undefined) return;
    parts.push(`${label}: ${raw}${unit ? ` ${unit}` : ""}`);
    if (isInches(unit)) {
      const n = parseDimension(raw);
      if (n !== undefined && key !== "raw") out[key] = n;
    }
  };

  apply("width", dims.width, "widthIn");
  apply("length", dims.length, "depthIn");
  apply("height", dims.height, "heightIn");
  if (parts.length > 0) out.raw = parts.join("; ");
  return parts.length > 0 ? out : undefined;
}

function mapAvailability(type: string | undefined): Availability {
  if (!type) return "unknown";
  const n = type.toUpperCase();
  if (n === "IN_STOCK") return "in_stock";
  if (n === "OUT_OF_STOCK") return "out_of_stock";
  return "unknown";
}

function mapItem(item: AmazonItem, fetchedAt: string): CatalogProduct | null {
  const asin = item.asin;
  const title = item.itemInfo?.title?.displayValue;
  const imageUrl = item.images?.primary?.large?.url;
  const detailPageURL = item.detailPageURL;
  if (!asin || !title || !imageUrl || !detailPageURL) return null;

  const listing = item.offersV2?.listings?.[0];
  const money = listing?.price?.money;
  const amount = typeof money?.amount === "number" && Number.isFinite(money.amount) ? money.amount : null;

  return {
    id: `amazon:${asin}`,
    retailer: "amazon",
    title,
    price: amount,
    currency: money?.currency ?? null,
    imageUrl,
    dimensions: mapDimensions(item.itemInfo?.productInfo?.itemDimensions),
    category: item.itemInfo?.classifications?.productGroup?.displayValue ?? null,
    availability: mapAvailability(listing?.availability?.type),
    productUrl: detailPageURL,
    affiliateUrl: detailPageURL,
    fetchedAt,
  };
}

async function fetchAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt - 60_000 > now) {
    return cachedToken.accessToken;
  }

  const id = credentialId();
  const secret = credentialSecret();
  const response = await fetch(tokenEndpoint(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: id,
      client_secret: secret,
      scope: "creatorsapi::default",
    }),
  });

  if (!response.ok) {
    cachedToken = null;
    throw new ProductSourceError(
      "amazon-creators",
      `Amazon token request failed (${response.status})`,
      response.status,
    );
  }

  const body = (await response.json()) as {
    access_token?: string;
    token_type?: string;
    expires_in?: number;
  };
  if (!body.access_token) {
    throw new ProductSourceError("amazon-creators", "Amazon token response missing access_token", 502);
  }

  const expiresIn = typeof body.expires_in === "number" && body.expires_in > 0 ? body.expires_in : 3600;
  cachedToken = {
    accessToken: body.access_token,
    expiresAt: Date.now() + expiresIn * 1000,
  };
  return body.access_token;
}

export class AmazonCreatorsSource implements ProductSource {
  readonly id = "amazon-creators";
  readonly label = "Amazon Creators API";

  isEnabled(): boolean {
    return Boolean(credentialId() && credentialSecret() && partnerTag());
  }

  async search(query: string, opts?: SearchOptions): Promise<CatalogProduct[]> {
    if (!this.isEnabled()) {
      throw new ProductSourceError("amazon-creators", "Amazon Creators API is not configured", 503);
    }

    const keywords = query.trim();
    if (!keywords) return [];

    return scheduleAmazon(async () => {
      const token = await fetchAccessToken();
      const itemCount = Math.min(10, Math.max(1, opts?.limit ?? 10));
      const body: Record<string, unknown> = {
        keywords,
        partnerTag: partnerTag(),
        marketplace: marketplace(),
        itemCount,
        resources: [
          "images.primary.large",
          "itemInfo.title",
          "itemInfo.classifications",
          "itemInfo.productInfo",
          "offersV2.listings.price",
          "offersV2.listings.availability",
        ],
      };
      if (opts?.category) {
        body.searchIndex = "HomeAndKitchen";
      }

      const response = await fetch(SEARCH_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "x-marketplace": marketplace(),
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new ProductSourceError(
          "amazon-creators",
          `Amazon Creators API search failed (${response.status})`,
          response.status,
        );
      }

      const payload = (await response.json()) as AmazonSearchResponse;
      const fetchedAt = new Date().toISOString();
      const items = payload.searchResult?.items ?? [];
      const products: CatalogProduct[] = [];
      for (const item of items) {
        const mapped = mapItem(item, fetchedAt);
        if (mapped) products.push(mapped);
      }
      return products;
    });
  }
}

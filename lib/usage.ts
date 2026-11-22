export type UsageEvent =
  | "photo_uploaded"
  | "floor_marked"
  | "search"
  | "item_placed"
  | "product_click"
  | "export";

/**
 * Fire-and-forget usage ping. No PII. Uses sendBeacon, then fetch.
 */
export function trackUsage(event: UsageEvent, meta?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  const payload = JSON.stringify({ event, meta: meta ?? {} });
  const url = "/api/usage";
  try {
    if (typeof navigator.sendBeacon === "function") {
      const blob = new Blob([payload], { type: "application/json" });
      if (navigator.sendBeacon(url, blob)) return;
    }
  } catch {
    // fall through to fetch
  }
  void fetch(url, {
    method: "POST",
    body: payload,
    headers: { "Content-Type": "application/json" },
    keepalive: true,
  }).catch(() => undefined);
}

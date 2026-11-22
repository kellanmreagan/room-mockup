import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EVENTS = new Set([
  "photo_uploaded",
  "floor_marked",
  "search",
  "item_placed",
  "product_click",
  "export",
]);

function scrubMeta(meta: unknown): Record<string, string | number | boolean | null> {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return {};
  const blocked = new Set(["email", "name", "user", "phone", "address"]);
  const out: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(meta as Record<string, unknown>)) {
    if (blocked.has(key.toLowerCase())) continue;
    if (typeof value === "string") out[key] = value.slice(0, 80);
    else if (typeof value === "number" || typeof value === "boolean" || value === null) out[key] = value;
  }
  return out;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const event = typeof record.event === "string" ? record.event : "";
  if (!EVENTS.has(event)) {
    return NextResponse.json({ error: "Unknown event" }, { status: 400 });
  }

  console.log(
    JSON.stringify({
      usage: true,
      event,
      meta: scrubMeta(record.meta),
      at: new Date().toISOString(),
    }),
  );

  return new NextResponse(null, { status: 204 });
}

import { searchAll } from "@/lib/products/registry";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  if (q.length > 100) {
    return NextResponse.json({ error: "Query must be 100 characters or fewer." }, { status: 400 });
  }

  const category = searchParams.get("category") ?? undefined;
  const limitRaw = searchParams.get("limit");
  const parsedLimit = limitRaw ? Number(limitRaw) : undefined;
  const limit =
    parsedLimit !== undefined && Number.isFinite(parsedLimit)
      ? Math.min(25, Math.max(1, Math.round(parsedLimit)))
      : 10;

  const result = await searchAll(q, { category: category || undefined, limit });
  return NextResponse.json(result);
}

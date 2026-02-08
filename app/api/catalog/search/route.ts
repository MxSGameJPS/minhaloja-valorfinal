import { NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/auth";
import { searchCatalogProduct } from "@/lib/mercadolibre";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");

  if (!q) {
    return NextResponse.json(
      { error: "Query (EAN/GTIN) required" },
      { status: 400 },
    );
  }

  const token = await getValidAccessToken();

  if (!token) {
    return NextResponse.json(
      { error: "Unauthorized. Please login with Mercado Livre." },
      { status: 401 },
    );
  }

  try {
    const results = await searchCatalogProduct(q, token);
    return NextResponse.json({ results });
  } catch (error: any) {
    console.error("Search API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

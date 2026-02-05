import { NextResponse } from "next/server";
import { getItemIdBySku, getItemDetails } from "@/lib/mercadolibre";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sku = searchParams.get("sku");

  if (!sku) {
    return NextResponse.json({ error: "SKU is required" }, { status: 400 });
  }

  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("ml_access_token")?.value;
    const userId = cookieStore.get("ml_user_id")?.value;

    if (!accessToken || !userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Search ID
    const itemId = await getItemIdBySku(sku, accessToken, Number(userId));

    if (!itemId) {
      return NextResponse.json(
        { error: "Produto não encontrado." },
        { status: 404 },
      );
    }

    // 2. Search Details
    const item = await getItemDetails(itemId, accessToken);

    // Tentar identificar o custo do frete (se disponível no objeto shipping)
    // O objeto MLItem precisa ser expandido para ver se achamos "flat_rate" ou algo assim
    // Por enquanto vamos retornar o objeto shipping cru para o front decidir ou logar

    return NextResponse.json({
      id: item.id,
      title: item.title,
      price: item.price,
      thumbnail: item.pictures?.[0]?.url || "",
      permalink: item.permalink,
      listing_type_id: item.listing_type_id,
      category_id: item.category_id,
      shipping: item.shipping,
    });
  } catch (error: any) {
    console.error("Link Item Error:", error);
    return NextResponse.json(
      { error: error.message || "Erro ao buscar item" },
      { status: 500 },
    );
  }
}

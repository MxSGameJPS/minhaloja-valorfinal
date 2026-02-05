import { NextResponse } from "next/server";
import {
  getItemIdBySku,
  getItemDetails,
  getSellerShippingCost,
  getCatalogCompetition,
} from "@/lib/mercadolibre";
import { getValidAccessToken } from "@/lib/auth";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sku = searchParams.get("sku");

  if (!sku) {
    return NextResponse.json({ error: "SKU is required" }, { status: 400 });
  }

  try {
    const cookieStore = await cookies();
    // Prioritize configured SELLER_ID (Store Owner) over the logged-in user's ID
    const userId =
      process.env.SELLER_ID || cookieStore.get("ml_user_id")?.value;

    // Use helper to get a valid token (refreshing if necessary)
    const accessToken = await getValidAccessToken();

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

    // 3. Search Details
    const item = await getItemDetails(itemId, accessToken);

    // 4. Calculate Shipping Cost Prediction
    const shippingCostPrediction = await getSellerShippingCost(
      itemId,
      accessToken,
      Number(userId),
    );

    return NextResponse.json({
      id: item.id,
      title: item.title,
      price: item.price,
      thumbnail: item.pictures?.[0]?.url || "",
      permalink: item.permalink,
      listing_type_id: item.listing_type_id,
      category_id: item.category_id,
      shipping: item.shipping,
      shipping_prediction: shippingCostPrediction, // Pass to frontend
      // Diagnostics fields
      status: item.status,
      sub_status: item.sub_status,
      tags: item.tags,
      catalog_listing: item.catalog_listing,
      // Competition Data (if catalog)
      catalog_competition: item.catalog_listing
        ? await getCatalogCompetition(itemId, accessToken)
        : null,
    });
  } catch (error: any) {
    console.error("Link Item Error:", error);
    return NextResponse.json(
      { error: error.message || "Erro ao buscar item" },
      { status: 500 },
    );
  }
}

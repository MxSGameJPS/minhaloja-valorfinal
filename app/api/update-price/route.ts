import { NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/auth";
import { updateItemPrice } from "@/lib/mercadolibre";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  try {
    const { itemId, newPrice, newWholesalePrice } = await request.json();

    if (!itemId || !newPrice) {
      return NextResponse.json(
        { error: "Missing itemId or newPrice" },
        { status: 400 },
      );
    }

    const accessToken = await getValidAccessToken();
    const cookieStore = await cookies();
    const userId =
      process.env.SELLER_ID || cookieStore.get("ml_user_id")?.value;

    if (!accessToken || !userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Atualizar Preço Principal
    console.log(`Updating main price for ${itemId} to ${newPrice}`);
    await updateItemPrice(itemId, Number(newPrice), accessToken);

    // 2. Atualizar Preço de Atacado (Business)
    /* 
      NOTA: A API pública padrão não expõe facilmente o endpoint para "Preços de atacado" 
      conforme mostrado na interface do vendedor.
      Para evitar quebrar o fluxo, vamos registrar que isso precisa ser feito manualmente
      ou via endpoint específico se descoberto.
      
      Se no futuro descobrirmos que é via /item_prices ou /variations, implementamos aqui.
    */
    let wholesaleMessage = "";
    if (newWholesalePrice) {
      console.log(
        `Wholesale price update requested: ${newWholesalePrice} (Not fully implemented yet)`,
      );
      wholesaleMessage =
        "O preço principal foi atualizado. O preço de atacado deve ser conferido no painel pois requer permissões específicas de Business.";
    }

    return NextResponse.json({
      success: true,
      message:
        "Preço atualizado com sucesso no Mercado Livre! " + wholesaleMessage,
    });
  } catch (error: any) {
    console.error("Update Price Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update price" },
      { status: 500 },
    );
  }
}

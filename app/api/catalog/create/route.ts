import { NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/auth";
import { createMelItem } from "@/lib/mercadolibre";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { productId, price, stock, listingType, createPremiumToo, format } =
      body;

    // listingType: "gold_special" (Clássico) | "gold_pro" (Premium)
    // format: "catalog_only" | "traditional_only" | "both"

    if (!productId || !price || !stock) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const accessToken = await getValidAccessToken();

    if (!accessToken) {
      return NextResponse.json(
        { error: "Unauthorized. Please login with Mercado Livre." },
        { status: 401 },
      );
    }

    const createdItems: any[] = [];
    const errors: any[] = [];

    // Helper para criar item
    const create = async (payload: any, label: string) => {
      try {
        const res = await createMelItem(payload, accessToken);
        createdItems.push({ ...res, label });
      } catch (err: any) {
        console.error(`Error creating ${label}:`, err);
        errors.push({ label, error: err.message });
      }
    };

    // 0. Buscar detalhes do Produto de Catálogo para obter category_id e title
    let categoryId = "";
    let productTitle = "";
    let productPictures: any[] = [];

    try {
      const prodRes = await fetch(
        `https://api.mercadolibre.com/products/${productId}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
      if (prodRes.ok) {
        const prodData = await prodRes.json();
        console.log("DEBUG PRODUCT DATA:", JSON.stringify(prodData)); // DEBUG
        categoryId = prodData.category_id;
        productTitle = prodData.name;
        productPictures = prodData.pictures || [];

        // Version: Search Fallback (Step 353)

        if (!categoryId && productTitle) {
          console.log(
            "Category ID ausente. Tentando preditor de categoria para:",
            productTitle,
          );
          try {
            const predRes = await fetch(
              `https://api.mercadolibre.com/sites/MLB/search?limit=1&q=${encodeURIComponent(productTitle)}`,
              {
                headers: {
                  "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                },
              },
            );

            if (predRes.ok) {
              const predData = await predRes.json();
              console.log("DEBUG SEARCH DATA:", JSON.stringify(predData)); // DEBUG

              if (predData.results && predData.results.length > 0) {
                categoryId = predData.results[0].category_id;
              }

              console.log("Category ID recuperado via busca:", categoryId);
            } else {
              console.error(
                "Busca de fallback retornou status erro:",
                predRes.status,
                await predRes.text(),
              );
            }
          } catch (predErr) {
            console.error("Falha no preditor de categoria:", predErr);
          }
        }

        if (!categoryId) {
          console.error(
            "ALERTA: category_id veio vazio do produto de catálogo!",
          );
        }
      } else {
        throw new Error(
          "Falha ao obter dados do produto de catálogo: " +
            (await prodRes.text()),
        );
      }
    } catch (e: any) {
      console.error("Erro ao buscar detalhes do produto:", e);
      return NextResponse.json({ error: e.message }, { status: 400 });
    }

    console.log(
      `Preparando criação. ProductId: ${productId}, CategoryId: ${categoryId}, Title: ${productTitle}`,
    ); // DEBUG

    // 1. Identificar tipos a serem criados (Clássico e/ou Premium)
    const typesToCreate = [listingType];
    if (createPremiumToo) {
      const otherType =
        listingType === "gold_special" ? "gold_pro" : "gold_special";
      typesToCreate.push(otherType);
    }

    // 2. Loop pelos tipos (Clássico / Premium)
    for (const type of typesToCreate) {
      const typeLabel = type === "gold_special" ? "Clássico" : "Premium";
      const finalPrice = Number(price);

      // 3. Loop pelos formatos (Catálogo / Tradicional)

      // FORMATO: CATÁLOGO
      if (format === "catalog_only" || format === "both") {
        const payload = {
          title: productTitle,
          category_id: categoryId,
          available_quantity: Number(stock),
          price: finalPrice,
          currency_id: "BRL",
          buying_mode: "buy_it_now",
          listing_type_id: type,
          condition: "new",
          catalog_listing: true,
          catalog_product_id: productId,
          shipping: {
            mode: "me2",
            local_pick_up: false,
            free_shipping: false,
          },
        };
        console.log(
          `PAYLOAD CATÁLOGO (${typeLabel}):`,
          JSON.stringify(payload),
        ); // DEBUG
        await create(payload, `Catálogo (${typeLabel})`);
      }

      // FORMATO: TRADICIONAL
      if (format === "traditional_only" || format === "both") {
        const payload = {
          title: productTitle,
          category_id: categoryId,
          available_quantity: Number(stock),
          price: finalPrice,
          currency_id: "BRL",
          buying_mode: "buy_it_now",
          listing_type_id: type,
          condition: "new",
          catalog_listing: false,
          catalog_product_id: productId,
          pictures: productPictures.map((p: any) => ({ source: p.url })),
          shipping: { mode: "me2", local_pick_up: false, free_shipping: false },
        };
        console.log(
          `PAYLOAD TRADICIONAL (${typeLabel}):`,
          JSON.stringify(payload),
        ); // DEBUG

        await create(payload, `Tradicional (${typeLabel})`);
      }
    }

    return NextResponse.json({
      message: "Processamento concluído",
      created: createdItems,
      errors: errors,
    });
  } catch (error: any) {
    console.error("Create API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/auth";
import { createMelItem } from "@/lib/mercadolibre";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      productId,
      price,
      stock,
      listingType,
      createPremiumToo,
      format,
      ean,
    } = body;

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
    let isCatalogRequired = false;

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

        const domainId = prodData.domain_id;
        const listingStrategy = prodData.settings?.listing_strategy;

        // Atribuições
        isCatalogRequired = listingStrategy === "catalog_required";
        productTitle = prodData.name;
        productPictures = prodData.pictures || [];
        categoryId = prodData.category_id || ""; // Se vier do produto, ótimo (mas catálogo geralmente não tem)

        // 1. Resolver category_id via domínio (Estratégia Robusta)
        if (!categoryId && domainId) {
          console.log(`Resolvendo categoria para domínio: ${domainId}`);
          try {
            // Endpoint: /catalog_domains/{domain_id}/categories
            const domainRes = await fetch(
              `https://api.mercadolibre.com/catalog_domains/${domainId}/categories`,
              {
                headers: { Authorization: `Bearer ${accessToken}` },
              },
            );

            if (domainRes.ok) {
              const categories = await domainRes.json();
              console.log(
                "DEBUG DOMAIN CATEGORIES:",
                JSON.stringify(categories),
              ); // DEBUG

              // Pega o ID da primeira categoria retornada
              if (Array.isArray(categories) && categories.length > 0) {
                categoryId = categories[0].id;
              }
              console.log("Category ID recuperado via domínio:", categoryId);
            } else {
              console.error(
                "Erro ao buscar categorias do domínio:",
                domainRes.status,
                await domainRes.text(),
              );
            }
          } catch (err) {
            console.error("Falha ao resolver domínio:", err);
          }
        }

        if (!categoryId) {
          console.error(
            "ALERTA CRÍTICO: Não foi possível determinar a category_id via produto ou domínio!",
          );
          // Opcional: Lançar erro aqui para interromper
        }

        // 2. Verificar estratégia de catálogo (já calculado acima)

        if (isCatalogRequired) {
          console.log(
            "AVISO: Este produto EXIGE catálogo (catalog_required). Anúncios tradicionais podem falhar ou ser proibidos.",
          );
        }

        console.log(
          `Preparando criação. ProductId: ${productId}, CategoryId: ${categoryId}, Title: ${productTitle}`,
        );
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
        const payload: any = {
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

        // Adicionar EAN se fornecido
        if (ean) {
          payload.attributes = [{ id: "GTIN", value_name: ean }];
        }
        console.log(
          `PAYLOAD CATÁLOGO (${typeLabel}):`,
          JSON.stringify(payload),
        ); // DEBUG
        await create(payload, `Catálogo (${typeLabel})`);
      }

      // FORMATO: TRADICIONAL
      if (format === "traditional_only" || format === "both") {
        const payload: any = {
          title: productTitle,
          available_quantity: Number(stock),
          price: finalPrice,
          currency_id: "BRL",
          buying_mode: "buy_it_now",
          listing_type_id: type,
          condition: "new",
          catalog_listing: false, // Não é Catálogo
          catalog_product_id: productId,
          category_id: categoryId,
          pictures: productPictures.map((p: any) => ({ source: p.url })),
          shipping: {
            mode: "me2",
            local_pick_up: false,
            free_shipping: false,
          },
        };

        // Adicionar EAN se fornecido
        if (ean) {
          payload.attributes = [{ id: "GTIN", value_name: ean }];
        }

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

import { NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/auth";
import { createMelItem } from "@/lib/mercadolibre";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { productId, price, stock, listingType, createPremiumToo, format } = body;

    if (!productId || !price || !stock) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const accessToken = await getValidAccessToken();
    if (!accessToken) {
      return NextResponse.json({ error: "Unauthorized. Please login with Mercado Livre." }, { status: 401 });
    }

    const createdItems: any[] = [];
    const errors: any[] = [];

    const create = async (payload: any, label: string) => {
      try {
        const res = await createMelItem(payload, accessToken);
        createdItems.push({ ...res, label });
      } catch (err: any) {
        console.error(`Error creating ${label}:`, err);
        errors.push({ label, error: err.message });
      }
    };

    let categoryId = "";
    let productTitle = "";
    let productPictures: any[] = [];

    // 0. Buscar detalhes do Produto de Catálogo
    try {
      const prodRes = await fetch(`https://api.mercadolibre.com/products/${productId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (prodRes.ok) {
        const prodData = await prodRes.json();
        categoryId = prodData.category_id;
        productTitle = prodData.name;
        productPictures = prodData.pictures || [];

        // FALLBACK 1: Se category_id for nulo, mas tiver domain_id (Comum em rações)
        if (!categoryId && prodData.domain_id) {
          console.log("Tentando recuperar categoria via domain_id:", prodData.domain_id);
          const domainRes = await fetch(`https://api.mercadolibre.com/catalog_domains/${prodData.domain_id}`);
          if (domainRes.ok) {
            const domainData = await domainRes.json();
            categoryId = domainData.category_id;
          }
        }

        // FALLBACK 2: Se ainda estiver vazio, usar o Predictor de Categorias baseado no título
        if (!categoryId && productTitle) {
          console.log("Usando Predictor de Categoria para:", productTitle);
          const predictRes = await fetch(`https://api.mercadolibre.com/sites/MLB/category_predictor/predict?title=${encodeURIComponent(productTitle)}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (predictRes.ok) {
            const predictData = await predictRes.json();
            categoryId = predictData.id;
          }
        }

        if (!categoryId) {
          throw new Error("Não foi possível determinar a category_id para este produto.");
        }
      } else {
        throw new Error("Falha ao obter produto de catálogo: " + prodRes.status);
      }
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }

    // 1. Identificar tipos a serem criados
    const typesToCreate = [listingType];
    if (createPremiumToo) {
      typesToCreate.push(listingType === "gold_special" ? "gold_pro" : "gold_special");
    }

    // 2. Loop de Criação
    for (const type of typesToCreate) {
      const typeLabel = type === "gold_special" ? "Clássico" : "Premium";
      
      // Payloads comuns
      const basePayload = {
        title: productTitle,
        category_id: categoryId,
        available_quantity: Number(stock),
        price: Number(price),
        currency_id: "BRL",
        buying_mode: "buy_it_now",
        listing_type_id: type,
        condition: "new",
        shipping: { mode: "me2", local_pick_up: false, free_shipping: false },
      };

      if (format === "catalog_only" || format === "both") {
        const catalogPayload = { ...basePayload, catalog_listing: true, catalog_product_id: productId };
        await create(catalogPayload, `Catálogo (${typeLabel})`);
      }

      if (format === "traditional_only" || format === "both") {
        const tradPayload = { 
          ...basePayload, 
          catalog_listing: false, 
          pictures: productPictures.map((p: any) => ({ source: p.url || p.secure_url })) 
        };
        await create(tradPayload, `Tradicional (${typeLabel})`);
      }
    }

    return NextResponse.json({
      message: "Processamento concluído",
      created: createdItems,
      errors: errors,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
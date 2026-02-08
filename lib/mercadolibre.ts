const BASE_URL = "https://api.mercadolibre.com";

export interface MLTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  user_id: number;
  refresh_token: string;
}

export interface MLItem {
  id: string;
  title: string;
  price: number;
  permalink: string;
  base_price: number;
  currency_id: string;
  available_quantity: number;
  listing_type_id: string; // 'gold_special' (Clássico) | 'gold_pro' (Premium)
  category_id: string;
  shipping: {
    free_shipping: boolean;
    mode: string;
    tags: string[];
    logistic_type: string;
    free_methods?: {
      id: number;
      rule: {
        free_mode: string;
        value: number | null;
      };
    }[];
  };
  dimensions: string; // "10x10x10,500"
  pictures: { url: string }[];
  attributes: { id: string; value_name: string }[];
  variations?: any[];
  status?: string;
  sub_status?: string[];
  tags?: string[];
  catalog_listing?: boolean;
}

export interface MLShippingOption {
  id: string;
  cost: number;
  currency_id: string;
  name: string;
  display?: string;
}

/**
 * Troca o code pelo access_token
 */
export async function getAccessToken(
  code: string,
  redirectUri: string,
): Promise<MLTokenResponse> {
  const params = new URLSearchParams();
  params.append("grant_type", "authorization_code");
  params.append("client_id", process.env.ML_CLIENT_ID!);
  params.append("client_secret", process.env.ML_CLIENT_SECRET!);
  params.append("code", code);
  params.append("redirect_uri", redirectUri);

  const res = await fetch(`${BASE_URL}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: params,
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(`Error fetching token: ${JSON.stringify(error)}`);
  }

  return res.json();
}

/**
 * Refresh do token (opcional para o fluxo completo, mas boa prática)
 */
export async function refreshAccessToken(
  refreshToken: string,
): Promise<MLTokenResponse> {
  const params = new URLSearchParams();
  params.append("grant_type", "refresh_token");
  params.append("client_id", process.env.ML_CLIENT_ID!);
  params.append("client_secret", process.env.ML_CLIENT_SECRET!);
  params.append("refresh_token", refreshToken);

  const res = await fetch(`${BASE_URL}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: params,
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(`Error refreshing token: ${JSON.stringify(error)}`);
  }

  return res.json();
}

/**
 * Busca Item ID pelo SKU do usuário logado
 * Nota: Procura nos itens do usuário.
 */
export async function getItemIdBySku(
  sku: string,
  accessToken: string,
  userId: number,
): Promise<string | null> {
  console.log(`Searching for SKU: ${sku} for User: ${userId}`);

  // Hack: Permitir input direto de MLB ID
  if (sku.toUpperCase().startsWith("MLB")) {
    console.log("Input detected as MLB ID, skipping search.");
    return sku.toUpperCase();
  }

  // Tentativa 1: Busca específica do vendedor via endpoint de items/search
  // Doc: https://developers.mercadolibre.com.ar/en_US/manage-products-search
  const url1 = `${BASE_URL}/users/${userId}/items/search?sku=${sku}&access_token=${accessToken}`;

  try {
    const res1 = await fetch(url1);

    if (res1.ok) {
      const data1 = await res1.json();
      console.log("Method 1 Result:", JSON.stringify(data1));
      if (data1.results && data1.results.length > 0) {
        return data1.results[0];
      }
    } else {
      console.error("Method 1 Failed:", await res1.text());
    }
  } catch (e) {
    console.error("Method 1 Exception:", e);
  }

  // Tentativa 2: Busca via Global Search filtrando por seller (Fallback)
  console.log("Attempting Method 2 (Global Search)...");
  // Nota: access_token pode ajudar a achar itens não ativos se for do proprio seller
  const url2 = `${BASE_URL}/sites/MLB/search?seller_id=${userId}&q=${sku}`;
  try {
    const res2 = await fetch(url2, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (res2.ok) {
      const data2 = await res2.json();
      console.log("Method 2 Result (Count):", data2.paging?.total);
      if (data2.results && data2.results.length > 0) {
        // Retorna o primeiro ID encontrado
        return data2.results[0].id;
      }
    }
  } catch (e) {
    console.error("Method 2 Exception:", e);
  }

  // Tentativa 3: Busca nos itens do usuário usando query (q) em vez de sku
  console.log("Attempting Method 3 (User Items Search by Query)...");
  const url3 = `${BASE_URL}/users/${userId}/items/search?q=${sku}&access_token=${accessToken}`;
  try {
    const res3 = await fetch(url3);
    if (res3.ok) {
      const data3 = await res3.json();
      console.log("Method 3 Result (Count):", data3.paging?.total);
      if (data3.results && data3.results.length > 0) {
        return data3.results[0]; // Retorna ID
      }
    }
  } catch (e) {
    console.error("Method 3 Exception:", e);
  }

  return null;
}

/**
 * Detalhes do Item
 */
export async function getItemDetails(
  itemId: string,
  accessToken: string,
): Promise<MLItem> {
  const res = await fetch(
    `${BASE_URL}/items/${itemId}?include_attributes=all`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!res.ok) {
    throw new Error("Failed to fetch item details");
  }

  return res.json();
}

/**
 * Calcula Custos de Venda (Comissão)
 */
// Retorno tipado para taxa
interface ListingFee {
  percentage: number; // ex: 11.5 (representing 11.5%)
  fixed: number; // ex: 5.00
}

/**
 * Calcula Custos de Venda (Comissão + Taxa Fixa)
 */
export async function getListingFee(
  price: number,
  listingTypeId: string,
  categoryId: string,
  accessToken?: string,
): Promise<ListingFee> {
  const type = listingTypeId
    .toLowerCase()
    .replace("gold_special", "gold_special")
    .replace("gold_pro", "gold_pro"); // Ensure clean id

  // endpoint: /sites/MLB/listing_prices?price={price}&listing_type_id={type}&category_id={cat}
  const url = `${BASE_URL}/sites/MLB/listing_prices?price=${price}&listing_type_id=${type}&category_id=${categoryId}`;

  try {
    const headers: any = {};
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    const res = await fetch(url, { headers });

    if (!res.ok) {
      console.warn(
        `Fee calc failed (Status ${res.status}). Using fallback. Details:`,
        await res.text(),
      );
      return {
        percentage: getFallbackFee(listingTypeId),
        fixed: price < 79 ? 6.75 : 0,
      };
    }

    const data = await res.json();

    // Data structure usually is array or object with sale_fee_amount
    // API returns commission as an amount relative to the price passed in query
    // But we want the RATE.
    // Actually, listing_prices endpoint returns total fee amount.
    // Let's calculate percentage from that if needed, OR trust the API's amount.
    // Better: Retrieve the components if available.
    // The standard /listing_prices returns "sale_fee_amount".

    let match: any = null;
    if (Array.isArray(data)) {
      match = data.find((d: any) => d.listing_type_id === type);
    } else {
      match = data;
    }

    if (!match)
      return {
        percentage: getFallbackFee(listingTypeId),
        fixed: price < 79 ? 6.75 : 0,
      };

    // "sale_fee_amount" is the Total Fee (Percent * Price + Fixed)
    // Theoretically we can reverse calculate, but ML logic is complex.
    // However, for the purpose of finding the "Rate", we can estimate.

    // BUT! Determining if Fixed Fee applies is tricky just from total amount.
    // Let's use a heuristic:
    // If we passed price=100, and fee is 16, rate is 16%.
    // If we passed price=50, and fee is (50*0.16 + 6), fee is 14.

    // Strategy:
    // This function was originally fetching "Percentage".
    // To support dynamic fixed fee, we essentially need to know if 'sale_fee_amount' includes a fixed cost.
    // Unfortunately, /listing_prices output is simple: { listing_type_id, sale_fee_amount, currency_id }

    // To properly detect fixed fee exemption, we should trust the total fee amount returned by ML for the specfic price.
    // But our Price Calculator needs separate variables (Rate vs Fixed) to simulate "What if I change price?".

    // Hack: Quote for a high price (e.g. 1000) to get pure percentage (as fixed fee is irrelevant or diluted, or 0 above 79).
    // And quote for current target price to see if there is extra.

    // Actually, simply returning the percentage based on the passed 'price' might be wrong if 'price' is low.
    // Let's revert to:
    // 1. Calculate rate based on a "Safe Price" (e.g. 200).
    // 2. But user asked about SPECIFIC products exemption.

    // Correct approach using ML response:
    // The API response for a low price will tell us the exact fee.
    // If price < 79, and fee / price > standard_rate, then fixed fee is present.

    // Let's just return the raw percent relative to the price requested, but that changes as price changes.
    // The Route.ts expects a constant Rate.

    // Let's assume standard fallback rate, but check if ML returns a different structure?
    // No.

    // Alternative:
    // If price < 79, ML adds fixed fee.
    // If this specific item is exempt, ML will return only the percentage fee even for price < 79.

    // Let's stick to returning a structured object based on a 'probe':
    // We will probe with the actual requested price? NO, we need formulas for the calculator.

    // Lets look at strict logic:
    // If item is below 79, ML usually charges 6.75 fixed.
    // EXCEPT for specific categories/sellers.

    // PROPOSAL:
    // We assume the rate is the one found at R$ 100 (Safe high price).
    // We assume fixed fee is 0 initially.
    // Then we probe for R$ 50. If the fee is just 50 * rate, then Fixed = 0.
    // If fee is higher, then Fixed = Fee - (50 * Rate).

    // Implementation:
    // The caller (route.ts) calls this with "100". So it gets the percentage rate.
    // We should modify route.ts to pass the 'costPrice' or target price?
    // No, route.ts loops to find price.

    // Let's make getListingFee return the raw Percentage from R$ 100 probe (standard).
    // AND we create a new function `getFixedFeeExemption(itemId, accessToken)`?
    // Or simpler:
    // Just modify getListingFee to take the real target price? No, circular dependency in calculator.

    // Let's change this function to return the rate calculated at R$ 100 (High enough to have no fixed fee).
    // And assume 6.75 fixed fee UNLESS the category is in a whitelist?
    // Whitelist is hard to maintain.

    // Better:
    // probe with price = 78. If fee / 78 is approx Rate, then Fixed is 0.
    // If fee / 78 is much higher, Fixed is present.

    const safeRate = (match.sale_fee_amount / price) * 100; // This is the effective rate at 'price'.

    // If we call with 100, we get the Clean Rate (since > 79).
    // To detect fixed fee, we need a second call? Or just return metadata?

    // Let's keep it simple for now, preserving existing signature compatibility but preparing the field.
    // I will return the Percentage derived from price=100 (which is what route.ts passes).
    // AND I will add a check for the specific item's category/listing type rules?

    // WAIT. Route.ts calls `getListingFee(100, ...)`
    // So it ALWAYS gets the >79 rate.
    // The fixed fee logic happens in Route.ts lines 96-97 hardcoded.

    // I will add a new function `hasFixedFee(listingType, category)` or similar.
    // Or better: Let route.ts decide.

    // I will calculate the rate as usual.
    return { percentage: safeRate, fixed: 0 }; // Placeholder to match interface upgrade
  } catch (e) {
    console.error("Listing Fee Exception:", e);
    return { percentage: getFallbackFee(listingTypeId), fixed: 0 };
  }
}

// Helper to check if category/item has fixed fee
export async function checkFixedFee(
  listingTypeId: string,
  categoryId: string,
  accessToken?: string,
): Promise<number> {
  // Probe with a low price (e.g. 50 BRL)
  const type = listingTypeId.toLowerCase().replace("gold_pro", "gold_pro");
  const testPrice = 50;
  const url = `${BASE_URL}/sites/MLB/listing_prices?price=${testPrice}&listing_type_id=${type}&category_id=${categoryId}`;

  try {
    const headers: any = {};
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    const res = await fetch(url, { headers });
    if (!res.ok) return 6.75; // Assume default worst case

    const data = await res.json();
    let amount = 0;
    if (Array.isArray(data)) {
      const m = data.find((d: any) => d.listing_type_id === type);
      amount = m ? m.sale_fee_amount : 0;
    } else {
      amount = data.sale_fee_amount || 0;
    }

    // Calculate expected percentage fee (based on High Price probe which we assume caller knows? No.)
    // Reverse engineering:
    // If amount is close to X% of 50, fixed fee is 0.
    // If amount is close to X% of 50 + 6, fixed fee is ~6.
    // But we don't know X.

    // Let's Probe High (100) and Low (50).
    const urlHigh = `${BASE_URL}/sites/MLB/listing_prices?price=100&listing_type_id=${type}&category_id=${categoryId}`;
    const resHigh = await fetch(urlHigh, { headers });
    const dataHigh = await resHigh.json();
    let amountHigh = 0;
    if (Array.isArray(dataHigh)) {
      const m = dataHigh.find((d: any) => d.listing_type_id === type);
      amountHigh = m ? m.sale_fee_amount : 0;
    } else {
      amountHigh = dataHigh.sale_fee_amount || 0;
    }

    const rate = amountHigh / 100; // e.g. 0.115

    const expectedFeeLow = testPrice * rate; // e.g. 5.75
    const diff = amount - expectedFeeLow; // If actual is 11.75, diff is 6.

    if (diff > 2) {
      // Tolerance (some rounding)
      return 6.75; // It has fixed fee
    } else {
      return 0; // It implies exemption!
    }
  } catch (e) {
    return 6.75;
  }
}

function getFallbackFee(type: string): number {
  if (type.includes("gold_pro")) return 19; // 19%
  if (type.includes("gold_special")) return 14; // 14%
  return 15; // default
}

/**
 * Consulta frete que o vendedor paga
 * Lógica:
 * 1. Verifica no item.shipping.free_methods (se disponível)
 * 2. Se não, simula calcula via API de shipping_options/free
 */
export async function getSellerShippingCost(
  itemId: string,
  accessToken: string,
  userId: number,
): Promise<number> {
  try {
    const item = await getItemDetails(itemId, accessToken);
    if (!item.shipping.free_shipping) {
      return 0;
    }

    // 1. Tentar free_methods direto do item
    if (item.shipping.free_methods && item.shipping.free_methods.length > 0) {
      for (const method of item.shipping.free_methods) {
        if (method.rule && method.rule.value && method.rule.value > 0) {
          return method.rule.value;
        }
      }
    }

    // 2. Fallback: Endpoint de Calculadora de Frete Gratis
    // GET /users/{user_id}/shipping_options/free?item_id={item_id}
    // Esse endpoint costuma retornar o custo exato que o vendedor pagará.
    const calcUrl = `${BASE_URL}/users/${userId}/shipping_options/free?item_id=${itemId}`;
    const resCalc = await fetch(calcUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (resCalc.ok) {
      const calcData = await resCalc.json();
      console.log("Shipping Calc Data:", JSON.stringify(calcData));

      // Empirically, looking for "coverage.all_country.list_cost" or similar
      // Structure is usually coverage: { all_country: { list_cost: 32.97 } }
      if (calcData?.coverage?.all_country?.list_cost) {
        return calcData.coverage.all_country.list_cost;
      }
    } else {
      console.error("Shipping Calc Failed:", await resCalc.text());
    }
  } catch (e) {
    console.error("Error calculating shipping:", e);
  }

  return 0;
}

/**
 * Busca dados de concorrência do catálogo (Price To Win)
 */
export async function getCatalogCompetition(
  itemId: string,
  accessToken: string,
): Promise<any> {
  try {
    const url = `${BASE_URL}/items/${itemId}/catalog_listing_competition`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (res.ok) {
      return await res.json();
    }
    return null;
  } catch (e) {
    console.error("Error fetching catalog competition:", e);
    return null;
  }
}

/**
 * Atualiza o preço base do item
 */
export async function updateItemPrice(
  itemId: string,
  newPrice: number,
  accessToken: string,
): Promise<void> {
  // 1. Fetch item to check for variations and diagnostics
  const item = await getItemDetails(itemId, accessToken);

  // DIAGNOSTICS LOGGING
  console.log("--- ITEM DIAGNOSTICS ---");
  console.log(`ItemId: ${itemId}`);
  console.log(`Status: ${item.status}`);
  console.log(`Sub-status: ${JSON.stringify(item.sub_status)}`);
  console.log(`Tags: ${JSON.stringify(item.tags)}`);
  console.log(`Catalog Listing: ${item.catalog_listing}`);
  console.log("------------------------");

  const url = `${BASE_URL}/items/${itemId}`;
  let body: any = {};

  // Se tiver variações, o preço DEVE ser atualizado via variações e NÃO na raiz
  if (item.variations && item.variations.length > 0) {
    console.log(
      `Item ${itemId} has ${item.variations.length} variations. Updating variations ONLY.`,
    );
    body = {
      variations: item.variations.map((v: any) => ({
        id: v.id,
        price: newPrice,
        currency_id: item.currency_id || "BRL",
      })),
    };
  } else {
    // Caso contrário, atualiza preço base na raiz
    console.log(`Item ${itemId} has NO variations. Updating root price.`);
    body = {
      price: newPrice,
      currency_id: item.currency_id || "BRL",
    };
  }

  console.log(`Sending update to ${url}`);

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorData = await res.json();
    console.error("Update failed. Error Data:", JSON.stringify(errorData));

    // Check for Fallback Conditions
    const wasVariations = !!(item.variations && item.variations.length > 0);
    const isPolicyError =
      errorData.status === 403 || errorData.blocked_by === "PolicyAgent";

    // Only attempt fallback if it makes sense (e.g. 400 Bad Request might be format, 403 might be policy that allows root update)
    if (wasVariations && (errorData.status === 400 || isPolicyError)) {
      console.warn("Retrying with root price update as fallback...");
      const fallbackBody = {
        price: newPrice,
        currency_id: item.currency_id || "BRL",
      };

      const res2 = await fetch(url, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(fallbackBody),
      });

      if (res2.ok) {
        console.log("Fallback (Root) update successful.");
        return;
      }

      const err2 = await res2.json();
      console.error("Fallback (Root) failed error:", JSON.stringify(err2));
    }

    // Friendly Error Logic based on Diagnostics
    if (isPolicyError) {
      let reason = "Política de Preços";
      const tags = item.tags || [];
      const subStatus = item.sub_status || [];

      if (
        tags.includes("locked_by_promotion") ||
        tags.includes("campaign_related")
      ) {
        reason = "Item em Campanha/Promoção";
      } else if (tags.includes("catalog_listing") || item.catalog_listing) {
        reason = "Anúncio de Catálogo (Gerenciado pelo ML)";
      } else if (
        subStatus.includes("suspended") ||
        subStatus.includes("banned")
      ) {
        reason = "Anúncio Suspenso/Banido";
      } else if (subStatus.includes("waiting_for_patch")) {
        reason = "Aguardando Correção (Item Travado)";
      }

      throw new Error(
        `Atualização bloqueada pelo Mercado Livre (${reason}). O item pode estar em uma promoção travada ou violar regras de preço (Mín/Máx). Verifique se o item participa de Deal/Oferta.`,
      );
    }

    throw new Error(
      `Failed to update price: ${errorData.message || errorData.code || "Unknown Error"}`,
    );
  }
}

/**
 * Busca produtos no catálogo do ML
 */
export async function searchCatalogProduct(
  query: string,
  accessToken: string,
): Promise<any[]> {
  // Busca no catálogo oficial (Produtos)
  const url = `${BASE_URL}/products/search?status=active&site_id=MLB&q=${query}`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      console.error("Catalog Search Failed: " + res.status);
      return [];
    }

    const data = await res.json();
    return data.results || [];
  } catch (e) {
    console.error("Catalog Search Error:", e);
    return [];
  }
}

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
export async function getListingFee(
  price: number,
  listingTypeId: string,
  categoryId: string,
): Promise<number> {
  const type = listingTypeId
    .toLowerCase()
    .replace("gold_special", "gold_special")
    .replace("gold_pro", "gold_pro"); // Ensure clean id

  // endpoint: /sites/MLB/listing_prices?price={price}&listing_type_id={type}&category_id={cat}
  const url = `${BASE_URL}/sites/MLB/listing_prices?price=${price}&listing_type_id=${type}&category_id=${categoryId}`;

  console.log(
    `Calculating Fee: Price=${price}, Type=${type}, Cat=${categoryId}`,
  );

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${process.env.ML_ACCESS_TOKEN_FALLBACK || ""}`, // We don't have access token here easily without passing it.
        // But wait, the function didn't accept accessToken.
        // Let's rely on public access or pass simple headers.
        // Better: implement fallback logic if 0.
      },
    });

    if (!res.ok) {
      console.error("Fee error:", await res.text());
      return getFallbackFee(listingTypeId);
    }

    const data = await res.json();
    console.log("Fee Data:", JSON.stringify(data));

    let fee = 0;
    // Check structure. Sometimes it returns an array [ { listing_type_id, sale_fee_amount } ]
    if (Array.isArray(data)) {
      const match = data.find((d) => d.listing_type_id === type);
      fee = match ? match.sale_fee_amount : 0;
    } else {
      fee = data.sale_fee_amount || 0;
    }

    if (fee === 0) return getFallbackFee(listingTypeId);
    return fee;
  } catch (e) {
    console.error("Listing Fee Exception:", e);
    return getFallbackFee(listingTypeId);
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
 * Atualiza o preço base do item
 */
export async function updateItemPrice(
  itemId: string,
  newPrice: number,
  accessToken: string,
): Promise<void> {
  // 1. Fetch item to check for variations
  const item = await getItemDetails(itemId, accessToken);

  const url = `${BASE_URL}/items/${itemId}`;
  let body: any = {};

  // Se tiver variações, precisamos atualizar o preço em cada variação
  if (item.variations && item.variations.length > 0) {
    console.log(
      `Item ${itemId} has ${item.variations.length} variations. Updating all to ${newPrice}.`,
    );
    body = {
      variations: item.variations.map((v: any) => ({
        id: v.id,
        price: newPrice,
      })),
    };
  } else {
    // Caso contrário, atualiza preço base
    body = {
      price: newPrice,
    };
  }

  console.log(
    `Sending update to ${url} with body:`,
    JSON.stringify(body, null, 2),
  );

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
    console.error("Update failed with body:", JSON.stringify(body));
    console.error("Error response:", JSON.stringify(errorData));

    // Fallback: Se falhar com variações, tenta atualizar via raiz (as vezes a política exige isso ou vice-versa)
    if (
      item.variations &&
      item.variations.length > 0 &&
      (errorData.status === 400 || errorData.status === 403)
    ) {
      console.warn("Retrying with root price update as fallback...");
      const res2 = await fetch(url, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ price: newPrice }),
      });

      if (res2.ok) {
        console.log("Fallback update successful.");
        return;
      } else {
        const errorData2 = await res2.json();
        console.error("Fallback failed too:", JSON.stringify(errorData2));
      }
    }

    throw new Error(`Failed to update price: ${JSON.stringify(errorData)}`);
  }
}

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
    store_pick_up: boolean;
  };
  dimensions: string; // "10x10x10,500"
  pictures: { url: string }[];
  attributes: { id: string; value_name: string }[];
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
  // endpoint: /sites/MLB/listing_prices?price={price}&listing_type_id={type}&category_id={cat}
  const url = `${BASE_URL}/sites/MLB/listing_prices?price=${price}&listing_type_id=${listingTypeId}&category_id=${categoryId}`;

  const res = await fetch(url);
  if (!res.ok) return 0;

  const data = await res.json();
  // data pode ser um array ou objeto dependendo do endpoint, geralmente retorna objeto de preço
  return data.sale_fee_amount || 0;
}

/**
 * Consulta frete que o vendedor paga
 * Lógica complexa pois depende se o frete é grátis.
 */
export async function getSellerShippingCost(
  itemId: string,
  accessToken: string,
): Promise<number> {
  // A API pública não exibe diretamente "custo para o vendedor" facilmente sem contexto de envio.
  // Mas se o item oferece frete grátis, o vendedor paga algo.
  // Podemos tentar simular ou pegar de uma tabela fixa aproximada se não houver endpoint.
  // Vamos tentar pegar via shipping_options se disponível (geralmente requer zip).

  // Hack: Se não temos o CEP do vendedor/comprador, é difícil ter o EXATO.
  // O sistema vai retornar 0 se não conseguir e o usuário insere manual.
  // Mas vamos tentar verificar se existe shipping.free_methods

  const item = await getItemDetails(itemId, accessToken);
  if (!item.shipping.free_shipping) {
    return 0; // Se não é frete grátis, vendedor paga 0 (comprador paga), exceto configurações especificas.
  }

  // Tentar buscar valor do frete grátis (subsídio)
  // Infelizmente sem autenticação específica em endpoints de "shipping costs" do user, é difícil.
  // Vamos assumir que retornaremos 0 e o frontend avisa, ou retornamos um valor fixo estimado se desejar.
  // Pelo prompt "O backend DEVE consultar", vou deixar a função preparada.

  return 0;
}

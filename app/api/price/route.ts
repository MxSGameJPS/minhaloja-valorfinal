import { NextResponse } from "next/server";
import {
  getItemIdBySku,
  getItemDetails,
  getListingFee,
  getSellerShippingCost,
} from "@/lib/mercadolibre";
import { getValidAccessToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { query } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      sku,
      costPrice,
      marginPercent,
      manualShipping,
      taxPercent,
      otherCosts,
    } = body;
    // taxPercent (number), otherCosts (number, R$)

    const cookieStore = await cookies();
    // Prioritize configured SELLER_ID (Store Owner) over the logged-in user's ID
    const userId =
      process.env.SELLER_ID || cookieStore.get("ml_user_id")?.value;

    const accessToken = await getValidAccessToken();

    if (!accessToken || !userId) {
      return NextResponse.json(
        { error: "Unauthorized. Please login with Mercado Livre." },
        { status: 401 },
      );
    }

    // ... (Getting Item Logic)
    // 1. Get Item by SKU
    const itemId = await getItemIdBySku(sku, accessToken, Number(userId));
    if (!itemId) {
      return NextResponse.json(
        { error: "Item not found for this SKU" },
        { status: 404 },
      );
    }

    // 2. Get Details
    const item = await getItemDetails(itemId, accessToken);
    const { listing_type_id, category_id, price: currentPrice } = item;

    // 3. Get Shipping Cost
    let shippingCost = 0;
    if (manualShipping !== undefined && manualShipping !== null) {
      shippingCost = Number(manualShipping);
    } else {
      shippingCost = await getSellerShippingCost(
        itemId,
        accessToken,
        Number(userId),
      );
    }

    // 4. Determine Fee
    const refFee = await getListingFee(
      100,
      listing_type_id,
      category_id,
      accessToken,
    );
    const feeRate = refFee / 100;

    // 5. Calculate Suggested Price
    // Formula: Price = (Cost + Shipping + OtherCosts + FixedFee) / (1 - MLRate - TaxRate - MarginRate)

    const marginRate = marginPercent / 100;
    const taxRate = (taxPercent || 0) / 100;
    const extraCosts = otherCosts || 0;

    const divisor = 1 - feeRate - marginRate - taxRate;

    if (divisor <= 0) {
      return NextResponse.json(
        { error: "Margin + Fee + Tax exceeds 100%" },
        { status: 400 },
      );
    }

    // Scenario A: Price >= 79 (Seller Pays Shipping, No Fixed Fee)
    const suggestedPriceHigh =
      (Number(costPrice) + shippingCost + extraCosts) / divisor;

    // Scenario B: Price < 79 (Seller Pays Fixed Fee 6.75, No Shipping)
    // Shipping becomes 0 for seller (paid by buyer), but Fixed Fee applies.
    const suggestedPriceLow =
      (Number(costPrice) + 0 + extraCosts + 6.75) / divisor;

    let finalOutcome: any = null;

    // Helper for rounding to .99
    const roundTo99 = (val: number) => Math.floor(val) + 0.99;

    if (suggestedPriceHigh >= 79) {
      finalOutcome = {
        price: roundTo99(suggestedPriceHigh),
        scenario: "> 79",
        breakdown: {
          baseCost: Number(costPrice),
          mlFee: suggestedPriceHigh * feeRate,
          shipping: shippingCost,
          fixedFee: 0,
          tax: suggestedPriceHigh * taxRate,
          otherCosts: extraCosts,
          profit: suggestedPriceHigh * marginRate,
        },
      };
    } else {
      const priceLow = roundTo99(suggestedPriceLow);
      finalOutcome = {
        price: priceLow,
        scenario: "< 79",
        breakdown: {
          baseCost: Number(costPrice),
          mlFee: suggestedPriceLow * feeRate,
          shipping: 0,
          fixedFee: 6.75,
          tax: suggestedPriceLow * taxRate,
          otherCosts: extraCosts,
          profit: suggestedPriceLow * marginRate,
        },
      };

      if (priceLow >= 79) {
        // Recalculate based on High scenario if rounding pushed it up or original logic did
        // Actually if original 'suggestedPriceLow' >= 79, we would have problems with logic boundaries.
        // But here we just switch to high scenario if needed.
        const priceHigh = roundTo99(suggestedPriceHigh);
        finalOutcome = {
          price: priceHigh,
          scenario: "> 79 (Forced by Margin)",
          breakdown: {
            baseCost: Number(costPrice),
            mlFee: suggestedPriceHigh * feeRate,
            shipping: shippingCost,
            fixedFee: 0,
            tax: suggestedPriceHigh * taxRate,
            otherCosts: extraCosts,
            profit: suggestedPriceHigh * marginRate,
          },
        };
      }
    }

    // New: Calculate Wholesale Price (5% discount for 2+ units)
    // Assuming this means the unit price becomes 5% less
    // Also rounded to .99
    const wholesalePrice = roundTo99(finalOutcome.price * 0.95);
    finalOutcome.wholesalePrice = wholesalePrice;

    // Save to Database (Supabase)
    try {
      // Ensure column exists (Migration step)
      try {
        await query(`
          ALTER TABLE valorideal 
          ADD COLUMN IF NOT EXISTS preco_atacado DECIMAL(10,2) DEFAULT 0;
        `);
      } catch (colErr) {
        console.warn("Could not ensure preco_atacado column exists:", colErr);
      }

      const shippingType = item.shipping.free_shipping
        ? "Frete Gratis"
        : "Conta Comprador";
      const totalMLFee =
        (finalOutcome.breakdown.mlFee || 0) +
        (finalOutcome.breakdown.fixedFee || 0);

      const sql = `
            INSERT INTO valorideal (
                sku_mlb, 
                valor_atual, 
                tipo_anuncio, 
                tipo_envio, 
                preco_custo, 
                margem_lucro, 
                comissao_ml, 
                valor_frete,
                valor_lucro,
                preco_venda_recomendado,
                taxa_imposto,
                outros_custos,
                preco_atacado
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        `;
      const values = [
        itemId,
        currentPrice,
        listing_type_id,
        shippingType,
        costPrice,
        marginPercent,
        Number(totalMLFee.toFixed(2)),
        Number((finalOutcome.breakdown.shipping || 0).toFixed(2)),
        Number((finalOutcome.breakdown.profit || 0).toFixed(2)),
        Number((finalOutcome.price || 0).toFixed(2)),
        Number(taxPercent || 0),
        Number(extraCosts || 0),
        Number(wholesalePrice.toFixed(2)), // New Column
      ];

      await query(sql, values);
      console.log("Saved calculation to DB");
    } catch (dbError) {
      console.error("Database Save Error:", dbError);
    }

    return NextResponse.json({
      item: {
        id: itemId,
        title: item.title,
        currentPrice: currentPrice,
        thumbnail: item.pictures?.[0]?.url || "", // Need to add pictures to interface if widely used, assume exist
        listingType: listing_type_id,
        shippingMode: item.shipping.mode,
      },
      calculation: finalOutcome,
      rateUsed: feeRate,
    });
  } catch (error: any) {
    console.error("Price Calc Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import {
  getItemIdBySku,
  getItemDetails,
  getListingFee,
  getSellerShippingCost,
} from "@/lib/mercadolibre";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sku, costPrice, marginPercent, manualShipping } = body; // manualShipping optional number

    const cookieStore = await cookies();
    const accessToken = cookieStore.get("ml_access_token")?.value;
    // Prioritize configured SELLER_ID (Store Owner) over the logged-in user's ID
    const userId =
      process.env.SELLER_ID || cookieStore.get("ml_user_id")?.value;

    if (!accessToken || !userId) {
      return NextResponse.json(
        { error: "Unauthorized. Please login with Mercado Livre." },
        { status: 401 },
      );
    }

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

    // 3. Get Shipping Cost (Seller Pays)
    // If manualShipping is provided (user override), use it.
    // Otherwise, fetch from API.
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

    // 4. Determine Fee Percentage (Rate)
    // Check fee for a reference price of 100 BRL
    const refFee = await getListingFee(100, listing_type_id, category_id);
    const feeRate = refFee / 100; // e.g. 0.11 or 0.16

    // 5. Calculate Suggested Price
    // Scenario A: Price >= 79 (Seller Pays Shipping, No Fixed Fee)
    // Price = Cost + (Price * Rate) + Shipping + Profit
    // Profit = Suggestion: User wants Margin % of... Cost? Sale? "Margem de Lucro" defaults to margin on sale often, or markup on cost.
    // Let's assume Margin is % of Sale Price for "Margem de Lucro" in business contexts usually.
    // Price = Cost + Price*Rate + Shipping + Price*(Margin/100)
    // Price (1 - Rate - Margin/100) = Cost + Shipping
    // Price = (Cost + Shipping) / (1 - Rate - Margin/100)

    const marginRate = marginPercent / 100;
    const divisor = 1 - feeRate - marginRate;

    if (divisor <= 0) {
      return NextResponse.json(
        { error: "Margin + Fee exceeds 100%" },
        { status: 400 },
      );
    }

    const suggestedPriceHigh = (Number(costPrice) + shippingCost) / divisor;

    // Scenario B: Price < 79 (Seller Pays Fixed Fee 6.75, No Shipping)
    // Price = Cost + (Price * Rate) + 6.75 + Price*(Margin/100)
    // Price (1 - Rate - Margin/100) = Cost + 6.75
    // Price = (Cost + 6.75) / divisor;

    const suggestedPriceLow = (Number(costPrice) + 6.75) / divisor;

    // Decide which one applies
    // We check if suggestedPriceHigh is actually >= 79.
    // And if suggestedPriceLow is < 79.

    let finalOutcome = null;

    // Logic to select best fit or return both?
    // Usually we want to cover costs.
    // If suggestedPriceHigh >= 79, it's valid.
    // If in the Low scenario, we assume Shipping is 0 (Buyer pays).

    // Let's try to see if High logic holds.
    if (suggestedPriceHigh >= 79) {
      finalOutcome = {
        price: suggestedPriceHigh,
        scenario: "> 79",
        breakdown: {
          baseCost: Number(costPrice),
          mlFee: suggestedPriceHigh * feeRate,
          shipping: shippingCost,
          fixedFee: 0,
          profit: suggestedPriceHigh * marginRate,
        },
      };
    } else {
      // If the calculation for > 79 resulted in < 79 (unlikely if shipping is high, but possible if cost is low)
      // If it falls below 79, then ML rules switch: shipping becomes Buyer's (Cost=0 for seller) but Fixed Fee applies.
      // So we use Low logic.
      finalOutcome = {
        price: suggestedPriceLow,
        scenario: "< 79",
        breakdown: {
          baseCost: Number(costPrice),
          mlFee: suggestedPriceLow * feeRate,
          shipping: 0,
          fixedFee: 6.75,
          profit: suggestedPriceLow * marginRate,
        },
      };

      // Check consistency
      // If suggestedPriceLow comes out >= 79, then we have a "Dead Zone" or we must force it to 79?
      // Usually we just show the calculated value.
      // But if it is >= 79, then actually the fee structure changes to High.
      // This suggests the input parameters force a higher price.
      if (suggestedPriceLow >= 79) {
        // Recalculate as High
        finalOutcome = {
          price: suggestedPriceHigh,
          scenario: "> 79 (Forced by Margin)",
          breakdown: {
            baseCost: Number(costPrice),
            mlFee: suggestedPriceHigh * feeRate,
            shipping: shippingCost,
            fixedFee: 0,
            profit: suggestedPriceHigh * marginRate,
          },
        };
      }
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

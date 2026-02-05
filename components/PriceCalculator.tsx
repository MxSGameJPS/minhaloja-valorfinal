"use client";

import { useState } from "react";
import Image from "next/image";

// Add prop type
export default function PriceCalculator({
  onCalculationComplete,
}: {
  onCalculationComplete?: () => void;
}) {
  // Step 1: SKU Search
  const [sku, setSku] = useState("");
  const [item, setItem] = useState<any>(null);
  const [loadingItem, setLoadingItem] = useState(false);

  // Step 2: Calculation Params
  const [costPrice, setCostPrice] = useState("");
  const [margin, setMargin] = useState("");
  const [tax, setTax] = useState("");
  const [otherCosts, setOtherCosts] = useState("");
  const [manualShippingCost, setManualShippingCost] = useState(""); // If user wants to override

  // Results
  const [loadingCalc, setLoadingCalc] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  // Modal State
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState<string | null>(null);

  const handleUpdatePrice = async () => {
    if (!result || !item) return;

    setIsUpdating(true);
    setUpdateSuccess(null);
    setError("");

    try {
      const res = await fetch("/api/update-price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: item.id,
          newPrice: result.calculation.price,
          newWholesalePrice: result.calculation.wholesalePrice,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erro ao atualizar preço");
      }

      setUpdateSuccess(data.message || "Preço atualizado com sucesso!");
      setTimeout(() => {
        setShowUpdateModal(false);
        setUpdateSuccess(null);
      }, 3000);
    } catch (err: any) {
      setError(err.message);
      setShowUpdateModal(false);
      alert(`Erro: ${err.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(val);
  };

  const handleSearchItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingItem(true);
    setError("");
    setItem(null);
    setResult(null);

    try {
      const res = await fetch(`/api/item?sku=${sku}`);
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Erro ao buscar item");

      setItem(data);
      // Pre-fill shipping cost logic
      if (data.shipping_prediction && data.shipping_prediction > 0) {
        setManualShippingCost(data.shipping_prediction.toString());
      } else if (
        data.shipping?.free_methods &&
        data.shipping.free_methods.length > 0
      ) {
        const method = data.shipping.free_methods.find(
          (m: any) => m.rule && m.rule.value,
        );
        if (method) {
          setManualShippingCost(method.rule.value.toString());
        }
      } else if (data.shipping?.cost) {
        setManualShippingCost(data.shipping.cost.toString());
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingItem(false);
    }
  };

  const handleCalculate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingCalc(true);
    setError("");

    try {
      const res = await fetch("/api/price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sku,
          costPrice: Number(costPrice.replace(",", ".")),
          marginPercent: Number(margin.replace(",", ".")),
          taxPercent: tax ? Number(tax.replace(",", ".")) : 0,
          otherCosts: otherCosts ? Number(otherCosts.replace(",", ".")) : 0,
          manualShipping: manualShippingCost
            ? Number(manualShippingCost.replace(",", "."))
            : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erro ao calcular");
      }

      setResult(data);
      if (onCalculationComplete) onCalculationComplete();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingCalc(false);
    }
  };

  const reset = () => {
    setItem(null);
    setResult(null);
    setSku("");
    setCostPrice("");
    setMargin("");
    setManualShippingCost("");
  };

  return (
    <div className="space-y-8">
      {/* STEP 1: Search */}
      {!item && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 animate-fade-in-up">
          <form onSubmit={handleSearchItem} className="flex flex-col gap-4">
            <label className="text-lg font-semibold text-gray-700">
              Primeiro, encontre o produto
            </label>
            <div className="flex gap-4">
              <input
                type="text"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="Digite o SKU ou MLB..."
                className="flex-1 p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-lg text-black placeholder-gray-500"
                required
              />
              <button
                type="submit"
                disabled={loadingItem}
                className="bg-blue-600 text-white font-bold py-3 px-8 rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50"
              >
                {loadingItem ? "Buscando..." : "Buscar"}
              </button>
            </div>
            <p className="text-sm text-gray-500">
              Dica: Se o SKU não for encontrado, tente usar o código MLB do
              anúncio.
            </p>
          </form>
        </div>
      )}

      {/* STEP 2: Item Preview & Inputs */}
      {item && (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden animate-fade-in">
          <div className="bg-blue-50 p-6 border-b border-blue-100 flex items-start gap-4">
            {item.thumbnail && (
              <div className="relative w-24 h-24 rounded-lg overflow-hidden border bg-white flex-shrink-0">
                <Image
                  src={item.thumbnail}
                  alt={item.title}
                  fill
                  className="object-cover"
                />
              </div>
            )}
            <div className="flex-1">
              <div className="flex justify-between items-start">
                <h3 className="text-xl font-bold text-gray-900 leading-tight">
                  {item.title}
                </h3>
                <button
                  onClick={reset}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Alterar Produto
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-sm">
                <span className="px-2 py-1 bg-white border rounded text-gray-600">
                  MLB: {item.id}
                </span>
                <span
                  className={`px-2 py-1 border rounded font-medium ${item.listing_type_id.includes("gold_pro") ? "bg-yellow-100 text-yellow-800 border-yellow-200" : "bg-gray-100 text-gray-800"}`}
                >
                  {item.listing_type_id === "gold_pro"
                    ? "Premium (Sem Juros)"
                    : "Clássico"}
                </span>
                <span className="px-2 py-1 bg-green-100 text-green-800 border border-green-200 rounded">
                  Preço Atual: {formatCurrency(item.price)}
                </span>
              </div>
              <div className="mt-2 text-sm text-gray-500 flex items-center gap-2">
                <span>
                  Envio:{" "}
                  {item.shipping.free_shipping
                    ? "Frete Grátis"
                    : "Por conta do comprador"}
                </span>
                {item.shipping.mode === "me2" && (
                  <span className="text-xs bg-blue-100 text-blue-800 px-1 rounded">
                    Mercado Envios
                  </span>
                )}
              </div>
              {/* Competition / Catalog Warnings */}
              {item.catalog_listing && (
                <div className="mt-3 bg-blue-50 border border-blue-200 rounded p-2 text-sm flex flex-col gap-1">
                  <span className="font-bold text-blue-800">
                    📦 Anúncio de Catálogo
                  </span>
                  {item.catalog_competition ? (
                    <div className="text-blue-700">
                      Status:{" "}
                      <span className="font-semibold">
                        {item.catalog_competition.status}
                      </span>{" "}
                      <br />
                      {item.catalog_competition.price_to_win && (
                        <>
                          Preço para Ganhar (Buy Box):{" "}
                          <span className="font-bold text-green-700">
                            {formatCurrency(
                              item.catalog_competition.price_to_win,
                            )}
                          </span>
                        </>
                      )}
                    </div>
                  ) : (
                    <span className="text-blue-600 text-xs">
                      Dados de concorrência indisponíveis.
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="p-8 bg-gray-50">
            <h4 className="text-lg font-bold text-gray-800 mb-6">
              Configuração de Preço
            </h4>
            <form
              onSubmit={handleCalculate}
              className="grid grid-cols-1 md:grid-cols-3 gap-6"
            >
              <div className="flex flex-col">
                <label className="text-sm font-semibold text-gray-700 mb-2">
                  Preço de Custo (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={costPrice}
                  onChange={(e) => setCostPrice(e.target.value)}
                  className="p-3 border rounded-lg focus:ring-2 focus:ring-green-500 text-black placeholder-gray-500"
                  placeholder="0.00"
                  required
                />
              </div>
              <div className="flex flex-col">
                <label className="text-sm font-semibold text-gray-700 mb-2">
                  Margem de Lucro (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={margin}
                  onChange={(e) => setMargin(e.target.value)}
                  className="p-3 border rounded-lg focus:ring-2 focus:ring-green-500 text-black placeholder-gray-500"
                  placeholder="Ex: 20"
                  required
                />
              </div>
              <div className="flex flex-col">
                <label className="text-sm font-semibold text-gray-700 mb-2">
                  Imposto (%) (Opcional)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={tax}
                  onChange={(e) => setTax(e.target.value)}
                  className="p-3 border rounded-lg focus:ring-2 focus:ring-green-500 text-black placeholder-gray-500"
                  placeholder="Ex: 6.0"
                />
              </div>

              <div className="flex flex-col">
                <label className="text-sm font-semibold text-gray-700 mb-2">
                  Outros Custos (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={otherCosts}
                  onChange={(e) => setOtherCosts(e.target.value)}
                  className="p-3 border rounded-lg focus:ring-2 focus:ring-green-500 text-black placeholder-gray-500"
                  placeholder="ADS, Embalagem..."
                />
              </div>

              <div className="flex flex-col">
                <label className="text-sm font-semibold text-gray-700 mb-2">
                  Custo Frete (Opcional)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={manualShippingCost}
                  onChange={(e) => setManualShippingCost(e.target.value)}
                  className="p-3 border rounded-lg focus:ring-2 focus:ring-green-500 bg-white text-black placeholder-gray-500"
                  placeholder={
                    item.shipping.free_shipping ? "Insira o Custo" : "0.00"
                  }
                />
                <span className="text-xs text-gray-500 mt-1">
                  Se Frete Grátis, insira o custo que você paga.
                </span>
              </div>

              <div className="md:col-span-3 mt-4">
                <button
                  type="submit"
                  disabled={loadingCalc}
                  className={`w-full py-4 rounded-xl text-white font-bold text-lg shadow-md transition-all ${loadingCalc ? "bg-gray-400" : "bg-green-600 hover:bg-green-700"}`}
                >
                  {loadingCalc ? "Calculando..." : "Calcular Preço Ideal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700 font-medium rounded animate-fade-in">
          {error}
        </div>
      )}

      {result && (
        <div className="bg-white border rounded-xl p-8 shadow-lg animate-fade-in-up">
          <div className="text-center mb-8">
            <p className="text-gray-500 uppercase tracking-widest font-semibold text-sm">
              Preço de Venda Recomendado
            </p>
            <h2 className="text-6xl font-black text-green-600 mt-2">
              {formatCurrency(result.calculation.price)}
            </h2>

            {result.calculation.wholesalePrice && (
              <div className="mt-4 bg-purple-50 p-4 rounded-xl inline-block border border-purple-100 shadow-sm animate-fade-in">
                <p className="text-purple-700 text-xs font-bold uppercase tracking-wider mb-1">
                  Preço de Atacado (2+ un)
                </p>
                <div className="flex items-baseline justify-center gap-2">
                  <p className="text-3xl font-bold text-purple-800">
                    {formatCurrency(result.calculation.wholesalePrice)}
                  </p>
                  <span className="bg-purple-200 text-purple-800 text-xs font-bold px-2 py-0.5 rounded-full">
                    -5% OFF
                  </span>
                </div>
              </div>
            )}

            <p className="text-gray-400 mt-4 text-sm">
              Baseado no cenário: {result.calculation.scenario}
            </p>
          </div>

          <div className="overflow-hidden border rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Componente
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Valor
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    %
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200 text-sm">
                <tr>
                  <td className="px-6 py-4 font-medium text-gray-900">
                    Custo do Produto
                  </td>
                  <td className="px-6 py-4 text-right text-gray-800">
                    {formatCurrency(result.calculation.breakdown.baseCost)}
                  </td>
                  <td className="px-6 py-4 text-right text-gray-500">
                    {(
                      (result.calculation.breakdown.baseCost /
                        result.calculation.price) *
                      100
                    ).toFixed(1)}
                    %
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 font-medium text-gray-900">
                    Comissão ML ({(result.rateUsed * 100).toFixed(1)}%)
                  </td>
                  <td className="px-6 py-4 text-right text-red-600">
                    - {formatCurrency(result.calculation.breakdown.mlFee)}
                  </td>
                  <td className="px-6 py-4 text-right text-gray-500">
                    {(result.rateUsed * 100).toFixed(1)}%
                  </td>
                </tr>
                {result.calculation.breakdown.fixedFee > 0 && (
                  <tr>
                    <td className="px-6 py-4 font-medium text-gray-900">
                      Taxa Fixa
                    </td>
                    <td className="px-6 py-4 text-right text-red-600">
                      - {formatCurrency(result.calculation.breakdown.fixedFee)}
                    </td>
                    <td className="px-6 py-4 text-right text-gray-500">
                      {(
                        (result.calculation.breakdown.fixedFee /
                          result.calculation.price) *
                        100
                      ).toFixed(1)}
                      %
                    </td>
                  </tr>
                )}
                {result.calculation.breakdown.tax > 0 && (
                  <tr>
                    <td className="px-6 py-4 font-medium text-gray-900">
                      Imposto (
                      {(
                        (result.calculation.breakdown.tax /
                          result.calculation.price) *
                        100
                      ).toFixed(1)}
                      %)
                    </td>
                    <td className="px-6 py-4 text-right text-red-600">
                      - {formatCurrency(result.calculation.breakdown.tax)}
                    </td>
                    <td className="px-6 py-4 text-right text-gray-500">
                      {(
                        (result.calculation.breakdown.tax /
                          result.calculation.price) *
                        100
                      ).toFixed(1)}
                      %
                    </td>
                  </tr>
                )}
                {result.calculation.breakdown.otherCosts > 0 && (
                  <tr>
                    <td className="px-6 py-4 font-medium text-gray-900">
                      Outros Custos
                    </td>
                    <td className="px-6 py-4 text-right text-red-600">
                      -{" "}
                      {formatCurrency(result.calculation.breakdown.otherCosts)}
                    </td>
                    <td className="px-6 py-4 text-right text-gray-500">
                      {(
                        (result.calculation.breakdown.otherCosts /
                          result.calculation.price) *
                        100
                      ).toFixed(1)}
                      %
                    </td>
                  </tr>
                )}
                <tr>
                  <td className="px-6 py-4 font-medium text-gray-900">
                    Frete (Pago pelo Vendedor)
                  </td>
                  <td className="px-6 py-4 text-right text-red-600">
                    - {formatCurrency(result.calculation.breakdown.shipping)}
                  </td>
                  <td className="px-6 py-4 text-right text-gray-500">
                    {(
                      (result.calculation.breakdown.shipping /
                        result.calculation.price) *
                      100
                    ).toFixed(1)}
                    %
                  </td>
                </tr>
                <tr className="bg-green-50">
                  <td className="px-6 py-4 font-bold text-green-900">
                    Margem de Lucro (Líquido)
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-green-700">
                    + {formatCurrency(result.calculation.breakdown.profit)}
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-green-700">
                    {(
                      (result.calculation.breakdown.profit /
                        result.calculation.price) *
                      100
                    ).toFixed(1)}
                    %
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-8 flex flex-col items-center">
            {/* Logic to check for blocks */}
            {(() => {
              const subStatus = item.sub_status || [];
              const tags = item.tags || [];
              const isCatalog = item.catalog_listing;

              let blockReason = "";
              if (
                tags.includes("locked_by_promotion") ||
                tags.includes("campaign_related")
              )
                blockReason = "Item em promoção/campanha (Travado)";
              if (tags.includes("catalog_listing") || isCatalog)
                blockReason = "Anúncio de Catálogo (Gerenciado pelo ML)";
              if (
                subStatus.includes("suspended") ||
                subStatus.includes("banned")
              )
                blockReason = "Anúncio suspenso/banido";
              if (subStatus.includes("waiting_for_patch"))
                blockReason = "Aguardando correção (Travado)";
              if (item.status === "paused")
                blockReason = "Anúncio pausado (Pode atualizar, mas verifique)";

              // Allow paused, but warn? No, usually allows update.

              // Strict blocks: promotion.
              // Catalog items: Warn but allow try (because of fallback).
              const isBlocked =
                tags.includes("locked_by_promotion") ||
                tags.includes("campaign_related") ||
                subStatus.includes("waiting_for_patch");

              const isCatalogWarning =
                tags.includes("catalog_listing") || isCatalog;

              return (
                <>
                  {isBlocked && (
                    <div className="mb-4 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm max-w-md text-center">
                      <strong>Bloqueado:</strong> {blockReason} <br />O Mercado
                      Livre não permite edição manual neste estado.
                    </div>
                  )}

                  {!isBlocked && isCatalogWarning && (
                    <div className="mb-4 bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg text-sm max-w-md text-center">
                      <strong>Item de Catálogo:</strong> <br />A atualização
                      pode falhar se houver "Automatização de Preços" ativa ou
                      travas de concorrência.
                    </div>
                  )}

                  <button
                    onClick={() => setShowUpdateModal(true)}
                    disabled={isBlocked}
                    className={`bg-purple-600 text-white font-bold py-3 px-8 rounded-xl shadow-md flex items-center gap-2 ${isBlocked ? "opacity-50 cursor-not-allowed bg-gray-400" : "hover:bg-purple-700 transition-all"}`}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                    {isBlocked
                      ? "Atualização Bloqueada"
                      : "Atualizar Preço no Mercado Livre"}
                  </button>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Modal Overlay Update */}
      {showUpdateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-scale-in">
            {updateSuccess ? (
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                  <svg
                    className="h-6 w-6 text-green-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  Sucesso!
                </h3>
                <p className="text-gray-500 mb-6">{updateSuccess}</p>
              </div>
            ) : (
              <div className="text-center">
                <h3 className="text-xl font-bold text-gray-900 mb-4">
                  Confirmar Atualização?
                </h3>
                <p className="text-gray-500 mb-6 text-left text-sm">
                  Isso alterará o preço no Mercado Livre para:
                  <br />
                  <span className="font-bold text-black block mt-1">
                    Preço Principal:{" "}
                    {formatCurrency(result?.calculation.price || 0)}
                  </span>
                  {result?.calculation.wholesalePrice && (
                    <span className="font-bold text-purple-700 block mt-1">
                      Ap. Atacado (2un):{" "}
                      {formatCurrency(result.calculation.wholesalePrice)}
                    </span>
                  )}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowUpdateModal(false)}
                    disabled={isUpdating}
                    className="flex-1 bg-gray-100 text-gray-700 font-bold py-3 px-4 rounded-xl hover:bg-gray-200 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleUpdatePrice}
                    disabled={isUpdating}
                    className="flex-1 bg-green-600 text-white font-bold py-3 px-4 rounded-xl hover:bg-green-700 transition-all flex justify-center items-center gap-2"
                  >
                    {isUpdating ? "Atualizando..." : "Confirmar"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

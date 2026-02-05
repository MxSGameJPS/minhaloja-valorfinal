"use client";

import { useState } from "react";
import Image from "next/image";

export default function PriceCalculator() {
  // Step 1: SKU Search
  const [sku, setSku] = useState("");
  const [item, setItem] = useState<any>(null);
  const [loadingItem, setLoadingItem] = useState(false);

  // Step 2: Calculation Params
  const [costPrice, setCostPrice] = useState("");
  const [margin, setMargin] = useState("");
  const [manualShippingCost, setManualShippingCost] = useState(""); // If user wants to override

  // Results
  const [loadingCalc, setLoadingCalc] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

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
      // Pre-fill shipping cost if strictly zero? No, user enters.
      // But maybe we detected something?
      if (data.shipping?.cost) {
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
          sku, // Still need SKU for backend double-check or logging? Yes.
          costPrice: Number(costPrice.replace(",", ".")),
          marginPercent: Number(margin.replace(",", ".")),
          // Optional: Pass overrides if we want backend to rely on frontend (risky but requested flow)
          // For now, let's keep backend logic but maybe hinting.
          // Actually, if we want "What if" analysis, we should pass parameters.
          // Let's stick to the prompt: backend fetches.
          // BUT, if user saw shipping and wants to edit?
          // Let's pass 'manualShipping' to endpoint effectively.
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
                className="flex-1 p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-lg"
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
                  className="p-3 border rounded-lg focus:ring-2 focus:ring-green-500"
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
                  className="p-3 border rounded-lg focus:ring-2 focus:ring-green-500"
                  placeholder="Ex: 20"
                  required
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
                  className="p-3 border rounded-lg focus:ring-2 focus:ring-green-500 bg-white"
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
            <p className="text-gray-400 mt-2 text-sm">
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
        </div>
      )}
    </div>
  );
}

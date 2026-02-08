"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";

export default function NewListing() {
  // Passos: 1 = Busca, 2 = Configuração, 3 = Sucesso
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");

  // Dados do Produto Encontrado (Mock inicial)
  const [product, setProduct] = useState<any>(null);

  // Formulário
  const [formData, setFormData] = useState({
    price: "",
    stock: "1",
    listingType: "gold_special", // gold_special (Clássico) ou gold_pro (Premium)
    createPremiumToo: false, // Criar também o Premium?
    format: "both", // catalog_only, traditional_only, both
    warrantyType: "id_2230280", // Garantia do vendedor
    warrantyTime: "90",
    warrantyUnit: "dias",
  });

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    setProduct(null);

    try {
      const res = await fetch(`/api/catalog/search?q=${query}`);
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Erro ao buscar produto");

      if (data.results && data.results.length > 0) {
        // Pega o primeiro resultado (mais relevante) do catálogo
        const found = data.results[0];

        setProduct({
          id: found.id,
          title: found.name, // Catalog API usa 'name', Item API usa 'title'
          thumbnail: found.pictures?.[0]?.url || "",
          domain_id: found.domain_id,
          attributes: found.attributes || [],
        });
        setStep(2);
      } else {
        alert("Nenhum produto encontrado com este código no catálogo.");
      }
    } catch (err: any) {
      console.error(err);
      alert("Erro na busca: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!product) return;
    setLoading(true);

    try {
      const res = await fetch("/api/catalog/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          price: formData.price,
          stock: formData.stock,
          listingType: formData.listingType,
          createPremiumToo: formData.createPremiumToo,
          format: formData.format,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erro ao criar anúncio");
      }

      setStep(3);
    } catch (err: any) {
      console.error(err);
      alert("Erro ao criar anúncio: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-800">Novo Anúncio</h1>
        <Link href="/" className="text-blue-600 hover:underline">
          &larr; Voltar ao Dashboard
        </Link>
      </div>

      {/* Progress Bar */}
      <div className="flex items-center justify-center space-x-4 mb-8">
        <div
          className={`h-2 w-1/3 rounded-full ${step >= 1 ? "bg-blue-600" : "bg-gray-200"}`}
        ></div>
        <div
          className={`h-2 w-1/3 rounded-full ${step >= 2 ? "bg-blue-600" : "bg-gray-200"}`}
        ></div>
        <div
          className={`h-2 w-1/3 rounded-full ${step >= 3 ? "bg-green-500" : "bg-gray-200"}`}
        ></div>
      </div>

      {/* STEP 1: BUSCA */}
      {step === 1 && (
        <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100 animate-fade-in-up">
          <h2 className="text-xl font-bold text-gray-800 mb-4">
            O que você quer vender?
          </h2>
          <form onSubmit={handleSearch} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Código Universal (EAN / GTIN / ISBN)
              </label>
              <div className="flex gap-4">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ex: 7891234567890"
                  className="flex-1 p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-lg"
                  required
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-blue-600 text-white font-bold py-3 px-8 rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50"
                >
                  {loading ? "Buscando..." : "Buscar"}
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                Buscaremos no catálogo do Mercado Livre para preencher as
                informações automaticamente.
              </p>
            </div>
          </form>
        </div>
      )}

      {/* STEP 2: CONFIGURAÇÃO */}
      {step === 2 && product && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 animate-fade-in">
          {/* Coluna Esquerda: Produto Encontrado */}
          <div className="md:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 text-center">
              <h3 className="font-bold text-gray-500 text-sm uppercase mb-4">
                Produto Identificado
              </h3>
              <div className="relative w-40 h-40 mx-auto mb-4">
                <Image
                  src={product.thumbnail}
                  alt={product.title}
                  fill
                  className="object-contain"
                />
              </div>
              <h4 className="font-bold text-gray-900 leading-snug">
                {product.title}
              </h4>
              <div className="text-left mt-6 space-y-2 text-sm text-gray-600 border-t pt-4">
                {product.attributes.map((attr: any, idx: number) => (
                  <div key={idx} className="flex justify-between">
                    <span>{attr.name}:</span>
                    <span className="font-medium text-gray-900">
                      {attr.value_name}
                    </span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setStep(1)}
                className="mt-6 text-red-500 text-sm font-medium hover:underline"
              >
                Não é este produto? Buscar outro
              </button>
            </div>
          </div>

          {/* Coluna Direita: Configuração do Anúncio */}
          <div className="md:col-span-2 space-y-6">
            <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100">
              <h2 className="text-xl font-bold text-gray-800 mb-6">
                Configurar Anúncio
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Preço (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) =>
                      setFormData({ ...formData, price: e.target.value })
                    }
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-green-500"
                    placeholder="0,00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Estoque
                  </label>
                  <input
                    type="number"
                    value={formData.stock}
                    onChange={(e) =>
                      setFormData({ ...formData, stock: e.target.value })
                    }
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* TIPO DE PUBLICAÇÃO (Radio) */}
              <div className="mb-6 bg-gray-50 p-4 rounded-xl border border-gray-200">
                <label className="block text-sm font-bold text-gray-800 mb-3">
                  Onde anunciar?
                </label>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="format"
                      value="catalog_only"
                      checked={formData.format === "catalog_only"}
                      onChange={(e) =>
                        setFormData({ ...formData, format: e.target.value })
                      }
                      className="w-5 h-5 text-blue-600"
                    />
                    <div>
                      <span className="font-medium text-gray-900">
                        Apenas Catálogo
                      </span>
                      <p className="text-xs text-gray-500">
                        Concorre diretamente na página principal do produto (Buy
                        Box).
                      </p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="format"
                      value="traditional_only"
                      checked={formData.format === "traditional_only"}
                      onChange={(e) =>
                        setFormData({ ...formData, format: e.target.value })
                      }
                      className="w-5 h-5 text-blue-600"
                    />
                    <div>
                      <span className="font-medium text-gray-900">
                        Apenas Tradicional (Lista)
                      </span>
                      <p className="text-xs text-gray-500">
                        Cria um anúncio avulso nas buscas gerais. Melhor para
                        personalizar fotos/títulos.
                      </p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer bg-blue-50 p-2 rounded-lg -ml-2 pl-4 border border-blue-100">
                    <input
                      type="radio"
                      name="format"
                      value="both"
                      checked={formData.format === "both"}
                      onChange={(e) =>
                        setFormData({ ...formData, format: e.target.value })
                      }
                      className="w-5 h-5 text-blue-600"
                    />
                    <div>
                      <span className="font-bold text-blue-800">
                        Ambos (Recomendado)
                      </span>
                      <p className="text-xs text-blue-600">
                        Cria os dois formatos para máxima visibilidade.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* TIPO DE ANÚNCIO (Select + Checkbox) */}
              <div className="mb-8">
                <label className="block text-sm font-bold text-gray-800 mb-3">
                  Tipo de Anúncio
                </label>
                <div className="flex gap-4 mb-4">
                  <button
                    onClick={() =>
                      setFormData({ ...formData, listingType: "gold_special" })
                    }
                    className={`flex-1 p-4 rounded-xl border-2 transition-all text-center ${formData.listingType === "gold_special" ? "border-blue-500 bg-blue-50 text-blue-700 font-bold" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}
                  >
                    Clássico
                    <span className="block text-xs font-normal mt-1">
                      Exposição Alta
                    </span>
                  </button>
                  <button
                    onClick={() =>
                      setFormData({ ...formData, listingType: "gold_pro" })
                    }
                    className={`flex-1 p-4 rounded-xl border-2 transition-all text-center ${formData.listingType === "gold_pro" ? "border-yellow-500 bg-yellow-50 text-yellow-700 font-bold" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}
                  >
                    Premium
                    <span className="block text-xs font-normal mt-1">
                      Parcelamento s/ juros
                    </span>
                  </button>
                </div>

                <div className="flex items-center gap-3 p-4 bg-purple-50 rounded-xl border border-purple-100">
                  <input
                    type="checkbox"
                    id="createPremium"
                    checked={formData.createPremiumToo}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        createPremiumToo: e.target.checked,
                      })
                    }
                    className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
                  />
                  <label htmlFor="createPremium" className="cursor-pointer">
                    <span className="block font-bold text-purple-800">
                      Duplicar Anúncio?
                    </span>
                    <span className="text-sm text-purple-600">
                      Criar automaticamente a versão
                      <strong>
                        {" "}
                        {formData.listingType === "gold_special"
                          ? "Premium"
                          : "Clássica"}{" "}
                      </strong>
                      também.
                    </span>
                  </label>
                </div>
              </div>

              <button
                onClick={handleCreate}
                disabled={loading}
                className="w-full bg-green-600 text-white font-bold py-4 rounded-xl hover:bg-green-700 transition-all shadow-lg text-lg"
              >
                {loading ? "Processando..." : "Criar Anúncio(s)"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: SUCESSO */}
      {step === 3 && (
        <div className="bg-white p-12 rounded-2xl shadow-xl text-center max-w-2xl mx-auto animate-scale-in">
          <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg
              className="w-10 h-10"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Anúncio Criado com Sucesso!
          </h2>
          <p className="text-gray-600 text-lg mb-8">
            Seu produto já está sendo processado pelo Mercado Livre.
            {formData.createPremiumToo && (
              <>
                <br />
                <span className="text-purple-600 font-semibold">
                  Os dois anúncios (Clássico e Premium) foram gerados.
                </span>
              </>
            )}
            {formData.format === "both" && (
              <>
                <br />
                <span className="text-blue-600 font-semibold">
                  Formatos de Catálogo e Tradicional criados.
                </span>
              </>
            )}
          </p>
          <div className="flex justify-center gap-4">
            <button
              onClick={() => {
                setStep(1);
                setQuery("");
                setProduct(null);
              }}
              className="bg-gray-100 text-gray-700 font-bold py-3 px-8 rounded-xl hover:bg-gray-200 transition-all"
            >
              Cadastrar Outro
            </button>
            <Link
              href="/"
              className="bg-blue-600 text-white font-bold py-3 px-8 rounded-xl hover:bg-blue-700 transition-all"
            >
              Ver no Dashboard
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

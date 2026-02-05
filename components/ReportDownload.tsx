"use client";

import { useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

export default function ReportDownload() {
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    const res = await fetch("/api/history");
    if (!res.ok) throw new Error("Erro ao buscar dados");
    return res.json();
  };

  const formatCurrency = (val: any) => {
    if (typeof val !== "number") return val;
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(val);
  };

  const handleDownloadPDF = async () => {
    setLoading(true);
    try {
      const data = await fetchData();
      // Orientation: "l" for landscape
      const doc = new jsPDF("l");

      doc.text("Relatório de Cálculos - ValorFinal", 14, 15);

      const tableColumn = [
        "Data/Hora",
        "SKU/MLB",
        "V. Atual",
        "Tipo",
        "Envio",
        "Custo",
        "Margem",
        "Comissão",
        "Frete",
        "Lucro",
        "Preço Rec.",
      ];

      const tableRows = data.map((item: any) => [
        new Date(item.created_at).toLocaleDateString("pt-BR") +
          " " +
          new Date(item.created_at).toLocaleTimeString("pt-BR").slice(0, 5),
        item.sku_mlb,
        formatCurrency(item.valor_atual),
        item.tipo_anuncio,
        item.tipo_envio, // Added
        formatCurrency(item.preco_custo),
        item.margem_lucro + "%",
        formatCurrency(item.comissao_ml),
        formatCurrency(item.valor_frete),
        formatCurrency(item.valor_lucro || 0),
        formatCurrency(item.preco_venda_recomendado || 0),
      ]);

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 20,
        theme: "grid",
        styles: { fontSize: 8, cellPadding: 2 }, // Compact styles
        headStyles: { fillColor: [22, 163, 74] },
      });

      doc.save("relatorio_valorideal.pdf");
    } catch (error) {
      console.error(error);
      alert("Erro ao gerar PDF");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadExcel = async () => {
    setLoading(true);
    try {
      const data = await fetchData();

      const worksheet = XLSX.utils.json_to_sheet(
        data.map((item: any) => ({
          Data:
            new Date(item.created_at).toLocaleDateString("pt-BR") +
            " " +
            new Date(item.created_at).toLocaleTimeString("pt-BR"),
          "SKU/MLB": item.sku_mlb,
          "Valor Atual (R$)": item.valor_atual,
          "Tipo Anuncio": item.tipo_anuncio,
          "Tipo Envio": item.tipo_envio,
          "Preço Custo (R$)": item.preco_custo,
          "Margem Lucro (%)": item.margem_lucro,
          "Comissão ML (R$)": item.comissao_ml,
          "Valor Frete (R$)": item.valor_frete,
          "Lucro Estimado (R$)": item.valor_lucro,
          "Preço Recomendado (R$)": item.preco_venda_recomendado,
        })),
      );

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Calculos");
      XLSX.writeFile(workbook, "relatorio_valorideal.xlsx");
    } catch (error) {
      console.error(error);
      alert("Erro ao gerar Excel");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row gap-4 justify-center mt-12 mb-8">
      <button
        onClick={handleDownloadPDF}
        disabled={loading}
        className="flex items-center justify-center gap-2 px-6 py-3 bg-red-600 text-white font-bold rounded-lg shadow-md hover:bg-red-700 transition disabled:opacity-50"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
          />
        </svg>
        {loading ? "Gerando..." : "Baixar Relatório PDF"}
      </button>

      <button
        onClick={handleDownloadExcel}
        disabled={loading}
        className="flex items-center justify-center gap-2 px-6 py-3 bg-green-700 text-white font-bold rounded-lg shadow-md hover:bg-green-800 transition disabled:opacity-50"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        {loading ? "Gerando..." : "Baixar Relatório Excel"}
      </button>
    </div>
  );
}

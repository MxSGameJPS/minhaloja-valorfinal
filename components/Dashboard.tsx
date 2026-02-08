"use client";

import { useState } from "react";
import PriceCalculator from "./PriceCalculator";
import ReportDownload from "./ReportDownload";

export default function Dashboard() {
  const [refreshReport, setRefreshReport] = useState(0);

  const handleCalculationComplete = () => {
    // Increment to trigger reload
    setRefreshReport((prev) => prev + 1);
  };

  return (
    <div className="bg-white p-8 rounded-2xl shadow-xl">
      <div className="flex justify-between items-center mb-6 border-b pb-4">
        <h2 className="text-2xl font-bold text-gray-800">
          Calculadora de Preço
        </h2>
        <div className="flex items-center gap-4">
          <a
            href="/novo-anuncio"
            className="text-sm bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 transition"
          >
            + Novo Anúncio
          </a>
          <div className="text-sm text-green-600 font-medium flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>{" "}
            Conectado
          </div>
        </div>
      </div>
      <PriceCalculator onCalculationComplete={handleCalculationComplete} />
      <div className="mt-8 pt-8 border-t border-gray-100">
        <h3 className="text-xl font-bold text-gray-800 mb-4 text-center">
          Relatórios
        </h3>
        <ReportDownload refreshTrigger={refreshReport} />
      </div>
    </div>
  );
}

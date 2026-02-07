import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS valorideal (
        id SERIAL PRIMARY KEY,
        sku_mlb TEXT NOT NULL,
        valor_atual NUMERIC(10,2),
        tipo_anuncio TEXT,
        tipo_envio TEXT,
        preco_custo NUMERIC(10,2),
        margem_lucro NUMERIC(10,2),
        comissao_ml NUMERIC(10,2),
        valor_frete NUMERIC(10,2),
        valor_lucro NUMERIC(10,2),
        preco_venda_recomendado NUMERIC(10,2),
        taxa_imposto NUMERIC(10,2) DEFAULT 0,
        outros_custos NUMERIC(10,2) DEFAULT 0,
        preco_atacado NUMERIC(10,2) DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    return NextResponse.json({
      message: "Tabela 'valorideal' criada com sucesso!",
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

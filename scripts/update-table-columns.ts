import { query } from "../lib/db";

async function alterTable() {
  const alterQuery = `
    ALTER TABLE valorideal 
    ADD COLUMN IF NOT EXISTS valor_lucro NUMERIC,
    ADD COLUMN IF NOT EXISTS preco_venda_recomendado NUMERIC;
  `;

  try {
    await query(alterQuery);
    console.log(
      "Table 'valorideal' altered successfully. Added 'valor_lucro' and 'preco_venda_recomendado'.",
    );
  } catch (err) {
    console.error("Error altering table:", err);
  } finally {
    process.exit();
  }
}

alterTable();

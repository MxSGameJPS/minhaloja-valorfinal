import { query } from "../lib/db";

async function addTaxColumns() {
  const alterQuery = `
    ALTER TABLE valorideal 
    ADD COLUMN IF NOT EXISTS taxa_imposto NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS outros_custos NUMERIC DEFAULT 0;
  `;

  try {
    await query(alterQuery);
    console.log(
      "Table 'valorideal' altered successfully. Added 'taxa_imposto' and 'outros_custos'.",
    );
  } catch (err) {
    console.error("Error altering table:", err);
  } finally {
    process.exit();
  }
}

addTaxColumns();

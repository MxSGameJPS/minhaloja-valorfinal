const { Pool } = require("pg");

const databaseUrl =
  "postgresql://postgres.hdgiehdogybqmpmpugfy:valorfinalminhaloja@aws-0-us-west-2.pooler.supabase.com:6543/postgres";

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: {
    rejectUnauthorized: false,
  },
});

const query = `
      CREATE TABLE IF NOT EXISTS valorideal (
        id SERIAL PRIMARY KEY,
        sku_mlb TEXT NOT NULL,
        valor_atual DECIMAL(10,2),
        tipo_anuncio TEXT,
        tipo_envio TEXT,
        preco_custo DECIMAL(10,2),
        margem_lucro DECIMAL(10,2),
        comissao_ml DECIMAL(10,2),
        valor_frete DECIMAL(10,2),
        valor_lucro DECIMAL(10,2),
        preco_venda_recomendado DECIMAL(10,2),
        taxa_imposto DECIMAL(10,2) DEFAULT 0,
        outros_custos DECIMAL(10,2) DEFAULT 0,
        preco_atacado DECIMAL(10,2) DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
`;

pool
  .query(query)
  .then(() => {
    console.log("Tabela 'valorideal' criada com sucesso!");
    pool.end();
  })
  .catch((err) => {
    console.error("Erro ao criar tabela:", err);
    pool.end();
  });

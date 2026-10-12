import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import fs from 'fs';
import path from 'path';

neonConfig.webSocketConstructor = ws;

function resolveDatabaseUrl(): string {
  const envUrl = process.env.DATABASE_URL ? process.env.DATABASE_URL.trim() : '';
  if (envUrl.startsWith('postgresql://') || envUrl.startsWith('postgres://')) {
    return envUrl;
  }
  return "postgresql://neondb_owner:npg_XkdQsc1AEv7D@ep-icy-dust-b5hjov6u-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
}

const pool = new Pool({
  connectionString: resolveDatabaseUrl(),
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log("Conectando ao banco de dados Neon PostgreSQL via WebSockets...");
  const client = await pool.connect();
  try {
    const sqlPath = path.join(process.cwd(), 'database.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    console.log("Executando criação de tabelas e aplicação das políticas de RLS...");
    await client.query(sqlContent);
    console.log("Tabelas, índices e políticas de RLS aplicadas com sucesso no PostgreSQL!");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error("Erro na execução do script de banco de dados:", err);
  process.exit(1);
});

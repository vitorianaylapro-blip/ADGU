import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import fs from 'fs';

neonConfig.webSocketConstructor = ws;

const url = "postgresql://neondb_owner:npg_XkdQsc1AEv7D@ep-icy-dust-b5hjov6u-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

async function dump() {
  const settings = await pool.query("SELECT * FROM settings");
  const users = await pool.query("SELECT * FROM users ORDER BY createdat ASC");
  const reports = await pool.query("SELECT * FROM reports ORDER BY date DESC");
  const txs = await pool.query("SELECT * FROM transactions ORDER BY date DESC");
  const receipts = await pool.query("SELECT * FROM receipts ORDER BY date DESC");

  console.log(`Exportando: ${settings.rows.length} settings, ${users.rows.length} usuários, ${reports.rows.length} relatórios, ${txs.rows.length} lançamentos, ${receipts.rows.length} recibos.`);

  let sql = `-- ==============================================================================
-- SISTEMA DE GESTÃO FINANCEIRA ECLESIÁSTICA - ADGU
-- DUMP COMPLETO DA ESTRUTURA E DADOS PARA NEON POSTGRESQL
-- Banco: ep-icy-dust-b5hjov6u-pooler.c-7.us-east-2.aws.neon.tech/neondb
-- ==============================================================================

-- 1. EXTENSÕES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. TABELAS
CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    institutionname TEXT DEFAULT 'Assembleia de Deus Geração Unida',
    cnpj TEXT DEFAULT '49.386.673/0001-10',
    address TEXT DEFAULT 'Rua Doze de Outubro 779, Parque Tijuca, Maracanaú - CE',
    email TEXT DEFAULT 'ADGUgeracaounida@gmail.com',
    president TEXT DEFAULT 'Pr. Antônio Chaves Crus',
    treasurername TEXT DEFAULT 'Tesoureiro Local',
    treasurerrole TEXT DEFAULT 'Tesoureiro Responsável',
    pastorname TEXT DEFAULT 'Pr. Antônio Chaves Crus',
    pastorrole TEXT DEFAULT 'Pastor Presidente / Dirigente',
    logo TEXT DEFAULT '',
    closingday INTEGER DEFAULT 1,
    CONSTRAINT single_row CHECK (id = 1)
);

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    photo TEXT,
    role TEXT NOT NULL DEFAULT 'USER',
    institution TEXT NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    nodiscount BOOLEAN DEFAULT FALSE,
    createdat TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    institutionname TEXT NOT NULL,
    reportername TEXT NOT NULL,
    userid TEXT NOT NULL,
    locked BOOLEAN DEFAULT FALSE,
    offers NUMERIC DEFAULT 0,
    specialoffers NUMERIC DEFAULT 0,
    tithes NUMERIC DEFAULT 0,
    financialrevenue NUMERIC DEFAULT 0,
    interestrevenue NUMERIC DEFAULT 0,
    rentrevenue NUMERIC DEFAULT 0,
    otherrevenues JSONB DEFAULT '[]',
    energy NUMERIC DEFAULT 0,
    water NUMERIC DEFAULT 0,
    rent NUMERIC DEFAULT 0,
    internet NUMERIC DEFAULT 0,
    cleaning NUMERIC DEFAULT 0,
    maintenance NUMERIC DEFAULT 0,
    missions NUMERIC DEFAULT 0,
    social NUMERIC DEFAULT 0,
    otherexpenses JSONB DEFAULT '[]',
    totalrevenue NUMERIC DEFAULT 0,
    totalfixedexpenses NUMERIC DEFAULT 0,
    sedeexpense NUMERIC DEFAULT 0,
    prebendaexpense NUMERIC DEFAULT 0,
    totalexpenses NUMERIC DEFAULT 0,
    saldogu NUMERIC DEFAULT 0,
    currentbalance NUMERIC DEFAULT 0,
    previousbalance NUMERIC DEFAULT 0,
    cashbalance NUMERIC DEFAULT 0,
    pixbalance NUMERIC DEFAULT 0,
    attachments JSONB DEFAULT '[]',
    createdat TIMESTAMPTZ DEFAULT NOW(),
    archived BOOLEAN DEFAULT FALSE,
    archivemonth TEXT,
    deletedat TIMESTAMPTZ,
    deletedby TEXT,
    approvalstatus TEXT DEFAULT 'PENDENTE',
    approvedby TEXT,
    approvedat TIMESTAMPTZ,
    rejectionreason TEXT,
    emailsenttoadmin BOOLEAN DEFAULT FALSE,
    emailsentat TIMESTAMPTZ,
    nodiscount BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type TEXT NOT NULL,
    date DATE NOT NULL,
    status TEXT NOT NULL,
    value NUMERIC NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    paymentmethod TEXT NOT NULL DEFAULT 'DINHEIRO',
    institutionname TEXT NOT NULL,
    userid TEXT NOT NULL,
    tithername TEXT,
    createdat TIMESTAMPTZ DEFAULT NOW(),
    deletedat TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS receipts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    number TEXT NOT NULL,
    type TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    personname TEXT NOT NULL,
    docnumber TEXT,
    description TEXT NOT NULL,
    date DATE NOT NULL,
    city TEXT NOT NULL,
    treasurername TEXT NOT NULL,
    treasurerrole TEXT,
    pastorname TEXT NOT NULL,
    pastorrole TEXT,
    institutionname TEXT NOT NULL,
    tithes NUMERIC DEFAULT 0,
    offerings NUMERIC DEFAULT 0,
    specialofferings NUMERIC DEFAULT 0,
    createdat TIMESTAMPTZ DEFAULT NOW()
);

-- 3. ÍNDICES
CREATE INDEX IF NOT EXISTS idx_reports_date ON reports (date DESC);
CREATE INDEX IF NOT EXISTS idx_reports_institution ON reports (institutionname);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions (date DESC);
CREATE INDEX IF NOT EXISTS idx_receipts_date ON receipts (date DESC);
CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);

-- 4. POLÍTICAS DE ACESSO (RLS)
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Settings Select Policy" ON settings;
DROP POLICY IF EXISTS "Settings Manage Policy" ON settings;
DROP POLICY IF EXISTS "Users Select Policy" ON users;
DROP POLICY IF EXISTS "Users Manage Policy" ON users;
DROP POLICY IF EXISTS "Reports Select Policy" ON reports;
DROP POLICY IF EXISTS "Reports Manage Policy" ON reports;
DROP POLICY IF EXISTS "Transactions Select Policy" ON transactions;
DROP POLICY IF EXISTS "Transactions Manage Policy" ON transactions;
DROP POLICY IF EXISTS "Receipts Select Policy" ON receipts;
DROP POLICY IF EXISTS "Receipts Manage Policy" ON receipts;

CREATE POLICY "Settings Select Policy" ON settings FOR SELECT USING (true);
CREATE POLICY "Settings Manage Policy" ON settings FOR ALL USING (true);
CREATE POLICY "Users Select Policy" ON users FOR SELECT USING (active = true);
CREATE POLICY "Users Manage Policy" ON users FOR ALL USING (true);
CREATE POLICY "Reports Select Policy" ON reports FOR SELECT USING (true);
CREATE POLICY "Reports Manage Policy" ON reports FOR ALL USING (true);
CREATE POLICY "Transactions Select Policy" ON transactions FOR SELECT USING (true);
CREATE POLICY "Transactions Manage Policy" ON transactions FOR ALL USING (true);
CREATE POLICY "Receipts Select Policy" ON receipts FOR SELECT USING (true);
CREATE POLICY "Receipts Manage Policy" ON receipts FOR ALL USING (true);

-- 5. DADOS: CONFIGURAÇÕES INSTITUCIONAIS
`;

  for (const s of settings.rows) {
    sql += `INSERT INTO settings (id, institutionname, cnpj, address, email, president, treasurername, treasurerrole, pastorname, pastorrole, closingday)
VALUES (${s.id}, ${JSON.stringify(s.institutionname)}, ${JSON.stringify(s.cnpj)}, ${JSON.stringify(s.address)}, ${JSON.stringify(s.email)}, ${JSON.stringify(s.president)}, ${JSON.stringify(s.treasurername)}, ${JSON.stringify(s.treasurerrole)}, ${JSON.stringify(s.pastorname)}, ${JSON.stringify(s.pastorrole)}, ${s.closingday})
ON CONFLICT (id) DO UPDATE SET institutionname = EXCLUDED.institutionname;\n\n`;
  }

  sql += `-- 6. DADOS: USUÁRIOS E PERMISSÕES\n`;
  for (const u of users.rows) {
    sql += `INSERT INTO users (id, username, password, name, email, phone, role, institution, active, nodiscount)
VALUES ('${u.id}', ${JSON.stringify(u.username)}, ${JSON.stringify(u.password)}, ${JSON.stringify(u.name)}, ${JSON.stringify(u.email)}, ${JSON.stringify(u.phone)}, ${JSON.stringify(u.role)}, ${JSON.stringify(u.institution)}, ${u.active}, ${u.nodiscount})
ON CONFLICT (username) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, institution = EXCLUDED.institution, nodiscount = EXCLUDED.nodiscount;\n`;
  }

  sql += `\n-- 7. DADOS: RELATÓRIOS FINANCEIROS\n`;
  for (const r of reports.rows) {
    const dStr = typeof r.date === 'string' ? r.date.split('T')[0] : (r.date ? new Date(r.date).toISOString().split('T')[0] : '2026-10-12');
    sql += `INSERT INTO reports (id, date, institutionname, reportername, userid, locked, tithes, offers, specialoffers, financialrevenue, totalrevenue, energy, water, rent, internet, cleaning, maintenance, missions, social, totalfixedexpenses, sedeexpense, prebendaexpense, totalexpenses, saldogu, currentbalance, previousbalance, cashbalance, pixbalance, approvalstatus, approvedby, nodiscount)
VALUES ('${r.id}', '${dStr}', ${JSON.stringify(r.institutionname)}, ${JSON.stringify(r.reportername)}, '${r.userid}', ${r.locked}, ${r.tithes}, ${r.offers}, ${r.specialoffers}, ${r.financialrevenue}, ${r.totalrevenue}, ${r.energy}, ${r.water}, ${r.rent}, ${r.internet}, ${r.cleaning}, ${r.maintenance}, ${r.missions}, ${r.social}, ${r.totalfixedexpenses}, ${r.sedeexpense}, ${r.prebendaexpense}, ${r.totalexpenses}, ${r.saldogu}, ${r.currentbalance}, ${r.previousbalance}, ${r.cashbalance}, ${r.pixbalance}, ${JSON.stringify(r.approvalstatus)}, ${JSON.stringify(r.approvedby)}, ${r.nodiscount})
ON CONFLICT (id) DO NOTHING;\n`;
  }

  sql += `\n-- 8. DADOS: LANÇAMENTOS DIÁRIOS\n`;
  for (const tx of txs.rows) {
    const dStr = typeof tx.date === 'string' ? tx.date.split('T')[0] : (tx.date ? new Date(tx.date).toISOString().split('T')[0] : '2026-10-12');
    sql += `INSERT INTO transactions (id, type, date, status, value, description, category, paymentmethod, institutionname, userid, tithername)
VALUES ('${tx.id}', ${JSON.stringify(tx.type)}, '${dStr}', ${JSON.stringify(tx.status)}, ${tx.value}, ${JSON.stringify(tx.description)}, ${JSON.stringify(tx.category)}, ${JSON.stringify(tx.paymentmethod)}, ${JSON.stringify(tx.institutionname)}, '${tx.userid}', ${JSON.stringify(tx.tithername)})
ON CONFLICT (id) DO NOTHING;\n`;
  }

  sql += `\n-- 9. DADOS: RECIBOS ECLESIÁSTICOS\n`;
  for (const rc of receipts.rows) {
    const dStr = typeof rc.date === 'string' ? rc.date.split('T')[0] : (rc.date ? new Date(rc.date).toISOString().split('T')[0] : '2026-10-12');
    sql += `INSERT INTO receipts (id, number, type, amount, personname, docnumber, description, date, city, treasurername, treasurerrole, pastorname, pastorrole, institutionname, tithes, offerings, specialofferings)
VALUES ('${rc.id}', ${JSON.stringify(rc.number)}, ${JSON.stringify(rc.type)}, ${rc.amount}, ${JSON.stringify(rc.personname)}, ${JSON.stringify(rc.docnumber)}, ${JSON.stringify(rc.description)}, '${dStr}', ${JSON.stringify(rc.city)}, ${JSON.stringify(rc.treasurername)}, ${JSON.stringify(rc.treasurerrole)}, ${JSON.stringify(rc.pastorname)}, ${JSON.stringify(rc.pastorrole)}, ${JSON.stringify(rc.institutionname)}, ${rc.tithes}, ${rc.offerings}, ${rc.specialofferings})
ON CONFLICT (id) DO NOTHING;\n`;
  }

  fs.writeFileSync("database.sql", sql, "utf8");
  fs.writeFileSync("complete_database_dump.sql", sql, "utf8");
  console.log("Arquivos database.sql e complete_database_dump.sql atualizados com sucesso!");
  await pool.end();
}

dump().catch(console.error);

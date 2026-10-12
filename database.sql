-- ==============================================================================
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
INSERT INTO settings (id, institutionname, cnpj, address, email, president, treasurername, treasurerrole, pastorname, pastorrole, closingday)
VALUES (1, 'Assembleia de Deus Geração Unida', '49.386.673/0001-10', 'Rua Doze de Outubro 779, Parque Tijuca, Maracanaú - CE', 'ADGUgeracaounida@gmail.com', 'Pr. Antônio Chaves Crus', 'Tesoureiro Local', 'Tesoureiro Responsável', 'Pr. Antônio Chaves Crus', 'Pastor Presidente / Dirigente', 1)
ON CONFLICT (id) DO UPDATE SET institutionname = EXCLUDED.institutionname;

-- 6. DADOS: USUÁRIOS E PERMISSÕES
INSERT INTO users (id, username, password, name, email, phone, role, institution, active, nodiscount)
VALUES ('e8c75dd0-0000-4000-a000-000000000000', 'adm', 'adm', 'Administrador Geral', 'ADGUgeracaounida@gmail.com', '(85) 92000-3598', 'ADMIN', 'Sede Administrativa', true, false)
ON CONFLICT (username) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, institution = EXCLUDED.institution, nodiscount = EXCLUDED.nodiscount;
INSERT INTO users (id, username, password, name, email, phone, role, institution, active, nodiscount)
VALUES ('6bf18117-2b1b-492a-af1f-fd67404c836b', '123', '123', 'cc', '', '', 'USER', '11', true, false)
ON CONFLICT (username) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, institution = EXCLUDED.institution, nodiscount = EXCLUDED.nodiscount;
INSERT INTO users (id, username, password, name, email, phone, role, institution, active, nodiscount)
VALUES ('a1b2c3d4-0001-4000-a000-000000000001', 'tesouraria', '123', 'Tesoureiro Geral ADGU', 'tesouraria.adgu@gmail.com', '(85) 99999-1001', 'USER', 'Sede Administrativa', true, false)
ON CONFLICT (username) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, institution = EXCLUDED.institution, nodiscount = EXCLUDED.nodiscount;
INSERT INTO users (id, username, password, name, email, phone, role, institution, active, nodiscount)
VALUES ('a1b2c3d4-0002-4000-a000-000000000002', 'umec', '123', 'Tesouraria de Jovens (UMEC)', 'jovens.adgu@gmail.com', '(85) 99999-1002', 'DEPT_TREASURER', 'Departamento Jovem', true, true)
ON CONFLICT (username) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, institution = EXCLUDED.institution, nodiscount = EXCLUDED.nodiscount;
INSERT INTO users (id, username, password, name, email, phone, role, institution, active, nodiscount)
VALUES ('a1b2c3d4-0003-4000-a000-000000000003', 'infantil', '123', 'Tesouraria Departamento Infantil', 'infantil.adgu@gmail.com', '(85) 99999-1003', 'DEPT_TREASURER', 'Departamento Infantil', true, true)
ON CONFLICT (username) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, institution = EXCLUDED.institution, nodiscount = EXCLUDED.nodiscount;
INSERT INTO users (id, username, password, name, email, phone, role, institution, active, nodiscount)
VALUES ('a1b2c3d4-0004-4000-a000-000000000004', 'senhoras', '123', 'Tesouraria de Senhoras', 'senhoras.adgu@gmail.com', '(85) 99999-1004', 'DEPT_TREASURER', 'Departamento de Senhoras', true, true)
ON CONFLICT (username) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, institution = EXCLUDED.institution, nodiscount = EXCLUDED.nodiscount;
INSERT INTO users (id, username, password, name, email, phone, role, institution, active, nodiscount)
VALUES ('a1b2c3d4-0005-4000-a000-000000000005', 'missoes', '123', 'Secretaria de Missões ADGU', 'missoes.adgu@gmail.com', '(85) 99999-1005', 'DEPT_TREASURER', 'Secretaria de Missões', true, true)
ON CONFLICT (username) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, institution = EXCLUDED.institution, nodiscount = EXCLUDED.nodiscount;

-- 7. DADOS: RELATÓRIOS FINANCEIROS
INSERT INTO reports (id, date, institutionname, reportername, userid, locked, tithes, offers, specialoffers, financialrevenue, totalrevenue, energy, water, rent, internet, cleaning, maintenance, missions, social, totalfixedexpenses, sedeexpense, prebendaexpense, totalexpenses, saldogu, currentbalance, previousbalance, cashbalance, pixbalance, approvalstatus, approvedby, nodiscount)
VALUES ('e8c75dd0-0000-4000-b000-000000000001', '2026-10-12', 'Sede Administrativa', 'Pr. Antônio Chaves Crus', 'e8c75dd0-0000-4000-a000-000000000000', true, 3200.00, 1400.00, 600.00, 150.00, 5350.00, 420.00, 95.00, 0, 110.00, 160.00, 0, 300.00, 0, 1085.00, 1070.00, 1070.00, 3225.00, 2125.00, 3625.00, 1500.00, 1225.00, 2400.00, 'APROVADO', 'Administrador Geral', false)
ON CONFLICT (id) DO NOTHING;
INSERT INTO reports (id, date, institutionname, reportername, userid, locked, tithes, offers, specialoffers, financialrevenue, totalrevenue, energy, water, rent, internet, cleaning, maintenance, missions, social, totalfixedexpenses, sedeexpense, prebendaexpense, totalexpenses, saldogu, currentbalance, previousbalance, cashbalance, pixbalance, approvalstatus, approvedby, nodiscount)
VALUES ('e8c75dd0-0000-4000-b000-000000000002', '2026-10-12', 'Departamento Jovem', 'Tesouraria de Jovens (UMEC)', 'a1b2c3d4-0002-4000-a000-000000000002', true, 0, 1150.00, 450.00, 0, 1600.00, 0, 0, 0, 0, 80.00, 0, 250.00, 0, 330.00, 0, 0, 330.00, 1270.00, 1870.00, 600.00, 570.00, 1300.00, 'APROVADO', 'Administrador Geral', true)
ON CONFLICT (id) DO NOTHING;
INSERT INTO reports (id, date, institutionname, reportername, userid, locked, tithes, offers, specialoffers, financialrevenue, totalrevenue, energy, water, rent, internet, cleaning, maintenance, missions, social, totalfixedexpenses, sedeexpense, prebendaexpense, totalexpenses, saldogu, currentbalance, previousbalance, cashbalance, pixbalance, approvalstatus, approvedby, nodiscount)
VALUES ('8f3ff9fc-690b-4ada-a994-90535b1f4739', '2026-09-12', 'Sede Administrativa', 'Tesoureiro Local', 'e8c75dd0-0000-4000-a000-000000000000', true, 2850.00, 1200.00, 450.00, 0, 4500.00, 350.00, 80.00, 0, 0, 120.00, 0, 0, 0, 550.00, 900.00, 1350.00, 2800.00, 1700.00, 1700.00, 0, 800.00, 900.00, 'APROVADO', null, false)
ON CONFLICT (id) DO NOTHING;

-- 8. DADOS: LANÇAMENTOS DIÁRIOS
INSERT INTO transactions (id, type, date, status, value, description, category, paymentmethod, institutionname, userid, tithername)
VALUES ('88c759bb-3783-4e6d-916c-8777addf8d30', 'RECEITA', '2026-10-12', 'CONCLUIDO', 500.00, 'Dízimo - Culto de Domingo', 'Dízimos', 'PIX', 'Sede Administrativa', 'e8c75dd0-0000-4000-a000-000000000000', 'Irmão Carlos Silva')
ON CONFLICT (id) DO NOTHING;
INSERT INTO transactions (id, type, date, status, value, description, category, paymentmethod, institutionname, userid, tithername)
VALUES ('a024199c-08c0-48b1-b90e-5fcd423548a1', 'RECEITA', '2026-10-12', 'CONCLUIDO', 250.00, 'Ofertas Gerais - Culto da Família', 'Ofertas', 'DINHEIRO', 'Sede Administrativa', 'e8c75dd0-0000-4000-a000-000000000000', null)
ON CONFLICT (id) DO NOTHING;
INSERT INTO transactions (id, type, date, status, value, description, category, paymentmethod, institutionname, userid, tithername)
VALUES ('a87b4050-05e6-46e4-8f5d-dfcbc543112a', 'DESPESA', '2026-10-12', 'CONCLUIDO', 120.00, 'Material de Limpeza e Higiene', 'Limpeza', 'PIX', 'Sede Administrativa', 'e8c75dd0-0000-4000-a000-000000000000', null)
ON CONFLICT (id) DO NOTHING;
INSERT INTO transactions (id, type, date, status, value, description, category, paymentmethod, institutionname, userid, tithername)
VALUES ('0c5eef36-4c76-42c1-a990-1caa17dddc7b', 'RECEITA', '2026-10-12', 'CONCLUIDO', 1200, 'Dízimo - Culto de Doutrina e Ensino', 'Dízimos', 'PIX', 'Sede Administrativa', 'e8c75dd0-0000-4000-a000-000000000000', 'Pr. Antônio Chaves Crus')
ON CONFLICT (id) DO NOTHING;
INSERT INTO transactions (id, type, date, status, value, description, category, paymentmethod, institutionname, userid, tithername)
VALUES ('bab4100c-93d8-406d-bcc1-01871d8653ba', 'RECEITA', '2026-10-12', 'CONCLUIDO', 750, 'Dízimo - Culto de Celebração', 'Dízimos', 'DINHEIRO', 'Sede Administrativa', 'e8c75dd0-0000-4000-a000-000000000000', 'Irmão Carlos Eduardo')
ON CONFLICT (id) DO NOTHING;
INSERT INTO transactions (id, type, date, status, value, description, category, paymentmethod, institutionname, userid, tithername)
VALUES ('62b2114c-d502-4e08-8162-020d81751f3e', 'RECEITA', '2026-10-12', 'CONCLUIDO', 450, 'Ofertas Gerais - Culto da Família', 'Ofertas', 'DINHEIRO', 'Sede Administrativa', 'e8c75dd0-0000-4000-a000-000000000000', null)
ON CONFLICT (id) DO NOTHING;
INSERT INTO transactions (id, type, date, status, value, description, category, paymentmethod, institutionname, userid, tithername)
VALUES ('93521bd8-1d79-43df-8982-7dcc6448a655', 'RECEITA', '2026-10-12', 'CONCLUIDO', 300, 'Oferta Especial para Missões', 'Ofertas Especiais', 'PIX', 'Sede Administrativa', 'e8c75dd0-0000-4000-a000-000000000000', 'Irmã Maria de Fátima')
ON CONFLICT (id) DO NOTHING;
INSERT INTO transactions (id, type, date, status, value, description, category, paymentmethod, institutionname, userid, tithername)
VALUES ('fdfe4aa5-9924-4f4e-bfb6-30cf1b18925d', 'RECEITA', '2026-10-12', 'CONCLUIDO', 650, 'Arrecadação - Culto Jovem UMEC', 'Ofertas', 'PIX', 'Departamento Jovem', 'e8c75dd0-0000-4000-a000-000000000000', null)
ON CONFLICT (id) DO NOTHING;
INSERT INTO transactions (id, type, date, status, value, description, category, paymentmethod, institutionname, userid, tithername)
VALUES ('50fcec1a-b865-40a6-a294-d4eb5f697d26', 'DESPESA', '2026-10-12', 'CONCLUIDO', 380, 'Energia Elétrica - Templo Sede', 'Energia', 'PIX', 'Sede Administrativa', 'e8c75dd0-0000-4000-a000-000000000000', null)
ON CONFLICT (id) DO NOTHING;
INSERT INTO transactions (id, type, date, status, value, description, category, paymentmethod, institutionname, userid, tithername)
VALUES ('737f900d-8185-44a8-b4c0-bdeff42eaa4e', 'DESPESA', '2026-10-12', 'CONCLUIDO', 85, 'Conta de Água (CAGECE) - Templo Sede', 'Água', 'PIX', 'Sede Administrativa', 'e8c75dd0-0000-4000-a000-000000000000', null)
ON CONFLICT (id) DO NOTHING;
INSERT INTO transactions (id, type, date, status, value, description, category, paymentmethod, institutionname, userid, tithername)
VALUES ('cd4c1583-2e9b-4a8f-bd66-b3b8f4c1ecd3', 'DESPESA', '2026-10-12', 'CONCLUIDO', 120, 'Material de Limpeza e Higiene', 'Limpeza', 'DINHEIRO', 'Sede Administrativa', 'e8c75dd0-0000-4000-a000-000000000000', null)
ON CONFLICT (id) DO NOTHING;
INSERT INTO transactions (id, type, date, status, value, description, category, paymentmethod, institutionname, userid, tithername)
VALUES ('900f06e6-5d99-4fb7-b997-eb3f891684ea', 'DESPESA', '2026-10-12', 'CONCLUIDO', 150, 'Ajuda de Custo - Missionário no Campo', 'Missões', 'PIX', 'Sede Administrativa', 'e8c75dd0-0000-4000-a000-000000000000', null)
ON CONFLICT (id) DO NOTHING;

-- 9. DADOS: RECIBOS ECLESIÁSTICOS
INSERT INTO receipts (id, number, type, amount, personname, docnumber, description, date, city, treasurername, treasurerrole, pastorname, pastorrole, institutionname, tithes, offerings, specialofferings)
VALUES ('423cd3ff-ce29-4b5a-aa4a-1c2f0f97990f', 'REC-2026-0001', 'MEMBRO', 1200, 'Pr. Antônio Chaves Crus', '111.222.333-44', 'Dízimo referente ao mês em curso - ADGU Sede', '2026-10-12', 'Maracanaú', 'Tesoureiro Local', 'Tesoureiro Responsável', 'Pr. Antônio Chaves Crus', 'Pastor Presidente', 'Assembleia de Deus Geração Unida', 1200, 0, 0)
ON CONFLICT (id) DO NOTHING;
INSERT INTO receipts (id, number, type, amount, personname, docnumber, description, date, city, treasurername, treasurerrole, pastorname, pastorrole, institutionname, tithes, offerings, specialofferings)
VALUES ('53b0232a-30af-4151-820d-579af349569a', 'REC-2026-0002', 'MEMBRO', 750, 'Irmão Carlos Eduardo', '222.333.444-55', 'Dízimo e oferta para o sustento da obra ministerial', '2026-10-12', 'Maracanaú', 'Tesoureiro Local', 'Tesoureiro Responsável', 'Pr. Antônio Chaves Crus', 'Pastor Presidente', 'Assembleia de Deus Geração Unida', 600, 150, 0)
ON CONFLICT (id) DO NOTHING;
INSERT INTO receipts (id, number, type, amount, personname, docnumber, description, date, city, treasurername, treasurerrole, pastorname, pastorrole, institutionname, tithes, offerings, specialofferings)
VALUES ('73fa8f87-c2bd-4338-b963-7e69a2096311', 'REC-2026-0003', 'RECEITA', 650, 'Departamento Jovem UMEC', null, 'Repasse de ofertas arrecadadas no Congresso de Jovens', '2026-10-12', 'Maracanaú', 'Tesoureiro Local', 'Tesoureiro Responsável', 'Pr. Antônio Chaves Crus', 'Pastor Presidente', 'Assembleia de Deus Geração Unida', 0, 650, 0)
ON CONFLICT (id) DO NOTHING;


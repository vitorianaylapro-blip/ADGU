-- ==============================================================================
-- SISTEMA DE GESTÃO FINANCEIRA ECLESIÁSTICA - ADGU
-- SCHEMA COMPLETO POSTGRESQL COM ROW LEVEL SECURITY (RLS)
-- ==============================================================================

-- 1. HABILITAR EXTENSÕES ESSENCIAIS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. TABELAS DO SISTEMA
-- ==============================================================================

-- TABELA: settings (Configurações Gerais da Instituição)
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

-- TABELA: users (Usuários e Gestão de Contas)
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

ALTER TABLE users ADD COLUMN IF NOT EXISTS nodiscount BOOLEAN DEFAULT FALSE;

-- TABELA: reports (Relatórios Financeiros Consolidados)
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

ALTER TABLE reports ADD COLUMN IF NOT EXISTS nodiscount BOOLEAN DEFAULT FALSE;

-- TABELA: transactions (Lançamentos Diários e Entradas/Saídas)
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

-- TABELA: receipts (Recibos de Receitas e Despesas Eclesiásticas)
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

-- ==============================================================================
-- 3. ÍNDICES DE ALTA PERFORMANCE
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_reports_date ON reports (date DESC);
CREATE INDEX IF NOT EXISTS idx_reports_institution ON reports (institutionname);
CREATE INDEX IF NOT EXISTS idx_reports_deletedat ON reports (deletedat);

CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions (date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_institution ON transactions (institutionname);
CREATE INDEX IF NOT EXISTS idx_transactions_deletedat ON transactions (deletedat);

CREATE INDEX IF NOT EXISTS idx_receipts_date ON receipts (date DESC);
CREATE INDEX IF NOT EXISTS idx_receipts_institution ON receipts (institutionname);

CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);
CREATE INDEX IF NOT EXISTS idx_users_institution ON users (institution);

-- ==============================================================================
-- 4. ROW LEVEL SECURITY (RLS) E POLÍTICAS DE ACESSO
-- ==============================================================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;

-- Limpar políticas antigas se existirem
DROP POLICY IF EXISTS "Settings Select Policy" ON settings;
DROP POLICY IF EXISTS "Settings Insert Policy" ON settings;
DROP POLICY IF EXISTS "Settings Update Policy" ON settings;
DROP POLICY IF EXISTS "Settings Delete Policy" ON settings;

DROP POLICY IF EXISTS "Users Select Policy" ON users;
DROP POLICY IF EXISTS "Users Insert Policy" ON users;
DROP POLICY IF EXISTS "Users Update Policy" ON users;
DROP POLICY IF EXISTS "Users Delete Policy" ON users;

DROP POLICY IF EXISTS "Reports Select Policy" ON reports;
DROP POLICY IF EXISTS "Reports Insert Policy" ON reports;
DROP POLICY IF EXISTS "Reports Update Policy" ON reports;
DROP POLICY IF EXISTS "Reports Delete Policy" ON reports;

DROP POLICY IF EXISTS "Transactions Select Policy" ON transactions;
DROP POLICY IF EXISTS "Transactions Insert Policy" ON transactions;
DROP POLICY IF EXISTS "Transactions Update Policy" ON transactions;
DROP POLICY IF EXISTS "Transactions Delete Policy" ON transactions;

DROP POLICY IF EXISTS "Receipts Select Policy" ON receipts;
DROP POLICY IF EXISTS "Receipts Insert Policy" ON receipts;
DROP POLICY IF EXISTS "Receipts Update Policy" ON receipts;
DROP POLICY IF EXISTS "Receipts Delete Policy" ON receipts;

-- POLÍTICAS: settings
CREATE POLICY "Settings Select Policy" ON settings FOR SELECT USING (true);
CREATE POLICY "Settings Insert Policy" ON settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Settings Update Policy" ON settings FOR UPDATE USING (true);
CREATE POLICY "Settings Delete Policy" ON settings FOR DELETE USING (true);

-- POLÍTICAS: users
CREATE POLICY "Users Select Policy" ON users FOR SELECT USING (active = true);
CREATE POLICY "Users Insert Policy" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "Users Update Policy" ON users FOR UPDATE USING (true);
CREATE POLICY "Users Delete Policy" ON users FOR DELETE USING (true);

-- POLÍTICAS: reports
CREATE POLICY "Reports Select Policy" ON reports FOR SELECT USING (true);
CREATE POLICY "Reports Insert Policy" ON reports FOR INSERT WITH CHECK (true);
CREATE POLICY "Reports Update Policy" ON reports FOR UPDATE USING (true);
CREATE POLICY "Reports Delete Policy" ON reports FOR DELETE USING (true);

-- POLÍTICAS: transactions
CREATE POLICY "Transactions Select Policy" ON transactions FOR SELECT USING (true);
CREATE POLICY "Transactions Insert Policy" ON transactions FOR INSERT WITH CHECK (true);
CREATE POLICY "Transactions Update Policy" ON transactions FOR UPDATE USING (true);
CREATE POLICY "Transactions Delete Policy" ON transactions FOR DELETE USING (true);

-- POLÍTICAS: receipts
CREATE POLICY "Receipts Select Policy" ON receipts FOR SELECT USING (true);
CREATE POLICY "Receipts Insert Policy" ON receipts FOR INSERT WITH CHECK (true);
CREATE POLICY "Receipts Update Policy" ON receipts FOR UPDATE USING (true);
CREATE POLICY "Receipts Delete Policy" ON receipts FOR DELETE USING (true);

-- ==============================================================================
-- 5. FUNÇÕES E TRIGGERS ÚTEIS
-- ==============================================================================

-- Função para autenticação de login segura via RPC
CREATE OR REPLACE FUNCTION check_user_login(p_username TEXT, p_password TEXT)
RETURNS TABLE (
    id UUID,
    username TEXT,
    name TEXT,
    role TEXT,
    institution TEXT,
    active BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT u.id, u.username, u.name, u.role, u.institution, u.active
    FROM users u
    WHERE LOWER(u.username) = LOWER(p_username)
      AND u.password = p_password
      AND u.active = TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- 6. DADOS INICIAIS OBRIGATÓRIOS (SEEDS)
-- ==============================================================================
INSERT INTO settings (id, institutionname, cnpj, address, email, president, treasurername, treasurerrole, pastorname, pastorrole, closingday)
VALUES (
    1,
    'Assembleia de Deus Geração Unida',
    '49.386.673/0001-10',
    'Rua Doze de Outubro 779, Parque Tijuca, Maracanaú - CE',
    'ADGUgeracaounida@gmail.com',
    'Pr. Antônio Chaves Crus',
    'Tesoureiro Local',
    'Tesoureiro Responsável',
    'Pr. Antônio Chaves Crus',
    'Pastor Presidente / Dirigente',
    1
)
ON CONFLICT (id) DO UPDATE SET institutionname = EXCLUDED.institutionname;

INSERT INTO users (id, username, password, name, email, role, institution, active)
VALUES (
    'e8c75dd0-0000-4000-a000-000000000000',
    'adm',
    'adm',
    'Administrador Geral',
    'ADGUgeracaounida@gmail.com',
    'ADMIN',
    'Sede Administrativa',
    true
)
ON CONFLICT (username) DO NOTHING;

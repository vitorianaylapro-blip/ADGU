-- Schema inicial do sistema de gestão financeira

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
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- Índices
CREATE INDEX IF NOT EXISTS idx_reports_date ON reports (date DESC);
CREATE INDEX IF NOT EXISTS idx_reports_institution ON reports (institutionname);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions (date DESC);
CREATE INDEX IF NOT EXISTS idx_receipts_date ON receipts (date DESC);

-- Dados iniciais
INSERT INTO settings (id, institutionname, cnpj, address, email, president)
VALUES (1, 'Assembleia de Deus Geração Unida', '49.386.673/0001-10', 'Rua Doze de Outubro 779, Parque Tijuca, Maracanaú - CE', 'ADGUgeracaounida@gmail.com', 'Pr. Antônio Chaves Crus')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, username, password, name, email, role, institution, active)
VALUES ('e8c75dd0-0000-4000-a000-000000000000', 'adm', 'adm', 'Administrador Geral', 'ADGUgeracaounida@gmail.com', 'ADMIN', 'Sede Administrativa', true)
ON CONFLICT (username) DO NOTHING;

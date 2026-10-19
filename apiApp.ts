import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

// Configure Neon serverless driver to use WebSockets over HTTPS (port 443)
neonConfig.webSocketConstructor = ws;

export const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// CORS & Preflight handling for Netlify and cross-origin environments
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Path normalization: handle Netlify Functions rewrite prefixes seamlessly
app.use((req, res, next) => {
  if (req.url.startsWith('/.netlify/functions/api')) {
    req.url = req.url.substring('/.netlify/functions/api'.length) || '/';
    if (!req.url.startsWith('/')) req.url = '/' + req.url;
  }
  next();
});

export function resolveDatabaseUrl(): string {
  const envUrl = process.env.DATABASE_URL ? process.env.DATABASE_URL.trim() : '';
  if (envUrl.startsWith('postgresql://') || envUrl.startsWith('postgres://')) {
    return envUrl;
  }
  // Verified ADGU Neon PostgreSQL Database Connection
  return "postgresql://neondb_owner:npg_XkdQsc1AEv7D@ep-icy-dust-b5hjov6u-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
}

export const DATABASE_URL = resolveDatabaseUrl();

export const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle Neon database client:', err.message);
});

export const ADMIN_MASTER_UUID = 'e8c75dd0-0000-4000-a000-000000000000';

export async function initDb() {
  try {
    const client = await pool.connect();
    try {
      await client.query(`
        CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
        CREATE EXTENSION IF NOT EXISTS "pgcrypto";

        CREATE TABLE IF NOT EXISTS settings (
            id INTEGER PRIMARY KEY DEFAULT 1,
            institutionname TEXT DEFAULT 'Assembleia de Deus Geração Unida',
            cnpj TEXT DEFAULT '49.386.673/0001-10',
            address TEXT DEFAULT 'Rua Doze de Outubro 779, Parque Tijuca, Maracanaú - CE',
            email TEXT DEFAULT 'ADGUgeracaounida@gmail.com',
            president TEXT DEFAULT 'Pr. Antônio Chaves Crus',
            treasurername TEXT DEFAULT 'Tesoureiro Local',
            treasurerrole TEXT DEFAULT 'Tesoureiro Responsável',
            treasurersignature TEXT DEFAULT '',
            pastorname TEXT DEFAULT 'Pr. Antônio Chaves Crus',
            pastorrole TEXT DEFAULT 'Pastor Presidente / Dirigente',
            logo TEXT DEFAULT '',
            closingday INTEGER DEFAULT 1,
            CONSTRAINT single_row CHECK (id = 1)
        );

        ALTER TABLE settings ADD COLUMN IF NOT EXISTS treasurersignature TEXT;

        CREATE TABLE IF NOT EXISTS users (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            name TEXT NOT NULL,
            email TEXT,
            phone TEXT,
            photo TEXT,
            signature TEXT,
            signature_type TEXT DEFAULT 'UPLOADED',
            role TEXT NOT NULL DEFAULT 'USER',
            institution TEXT NOT NULL,
            active BOOLEAN DEFAULT TRUE,
            nodiscount BOOLEAN DEFAULT FALSE,
            createdat TIMESTAMPTZ DEFAULT NOW()
        );

        ALTER TABLE users ADD COLUMN IF NOT EXISTS nodiscount BOOLEAN DEFAULT FALSE;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS signature TEXT;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS signature_type TEXT DEFAULT 'UPLOADED';

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
            treasurersignature TEXT,
            treasurersignature_type TEXT DEFAULT 'UPLOADED',
            pastorname TEXT NOT NULL,
            pastorrole TEXT,
            institutionname TEXT NOT NULL,
            tithes NUMERIC DEFAULT 0,
            offerings NUMERIC DEFAULT 0,
            specialofferings NUMERIC DEFAULT 0,
            createdat TIMESTAMPTZ DEFAULT NOW()
        );

        ALTER TABLE receipts ADD COLUMN IF NOT EXISTS treasurersignature TEXT;
        ALTER TABLE receipts ADD COLUMN IF NOT EXISTS treasurersignature_type TEXT DEFAULT 'UPLOADED';

        -- Índices
        CREATE INDEX IF NOT EXISTS idx_reports_date ON reports (date DESC);
        CREATE INDEX IF NOT EXISTS idx_reports_institution ON reports (institutionname);
        CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions (date DESC);
        CREATE INDEX IF NOT EXISTS idx_receipts_date ON receipts (date DESC);

        -- Row Level Security (RLS)
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

        INSERT INTO settings (id, institutionname, cnpj, address, email, president) 
        VALUES (1, 'Assembleia de Deus Geração Unida', '49.386.673/0001-10', 'Rua Doze de Outubro 779, Parque Tijuca, Maracanaú - CE', 'ADGUgeracaounida@gmail.com', 'Pr. Antônio Chaves Crus') 
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO users (id, username, password, name, email, role, institution, active)
        VALUES ('e8c75dd0-0000-4000-a000-000000000000', 'adm', 'adm', 'Administrador Geral', 'ADGUgeracaounida@gmail.com', 'ADMIN', 'Sede Administrativa', true)
        ON CONFLICT (username) DO NOTHING;
      `);
      console.log('PostgreSQL Neon database initialized successfully.');
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error during database initialization:', error);
  }
}

let dbInitPromise: Promise<void> | null = null;
export async function ensureDbInitialized() {
  if (!dbInitPromise) {
    dbInitPromise = initDb().catch((err) => {
      console.error('Database initialization background error:', err);
      dbInitPromise = null;
    });
  }
  return dbInitPromise;
}

// ---------------- ROUTER ----------------
export const apiRouter = express.Router();

apiRouter.get('/health', async (req, res) => {
  try {
    const dbRes = await pool.query('SELECT NOW()');
    res.json({ status: 'ok', db: 'connected', time: dbRes.rows[0].now });
  } catch (err: any) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

apiRouter.get('/db/status', async (req, res) => {
  try {
    const reportsCount = await pool.query('SELECT count(*) FROM reports');
    const txCount = await pool.query('SELECT count(*) FROM transactions');
    const usersCount = await pool.query('SELECT count(*) FROM users');
    const receiptsCount = await pool.query('SELECT count(*) FROM receipts');
    res.json({
      status: 'connected',
      provider: 'Neon PostgreSQL',
      counts: {
        reports: parseInt(reportsCount.rows[0].count),
        transactions: parseInt(txCount.rows[0].count),
        users: parseInt(usersCount.rows[0].count),
        receipts: parseInt(receiptsCount.rows[0].count),
      }
    });
  } catch (err: any) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

apiRouter.get('/db/dump', (req, res) => {
  const filePath = path.join(process.cwd(), 'complete_database_dump.sql');
  if (fs.existsSync(filePath)) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="adgu_complete_database_dump.sql"');
    res.sendFile(filePath);
  } else {
    res.status(404).send('Dump not found');
  }
});

// SYNC ALL CLIENT DATA TO DATABASE
apiRouter.post('/db/sync-all', async (req, res) => {
  try {
    const { users = [], reports = [], transactions = [], receipts = [], settings } = req.body;
    let syncedUsers = 0;
    let syncedReports = 0;
    let syncedTransactions = 0;
    let syncedReceipts = 0;

    // Sync settings if provided
    if (settings && settings.institutionName) {
      await pool.query(
        `INSERT INTO settings (id, institutionname, cnpj, address, email, president, treasurername, treasurerrole, pastorname, pastorrole, closingday, logo)
         VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (id) DO UPDATE SET
           institutionname = EXCLUDED.institutionname,
           cnpj = EXCLUDED.cnpj,
           address = EXCLUDED.address,
           email = EXCLUDED.email,
           president = EXCLUDED.president,
           treasurername = EXCLUDED.treasurername,
           treasurerrole = EXCLUDED.treasurerrole,
           pastorname = EXCLUDED.pastorname,
           pastorrole = EXCLUDED.pastorrole,
           closingday = EXCLUDED.closingday,
           logo = EXCLUDED.logo`,
        [
          settings.institutionName, settings.cnpj || '', settings.address || '',
          settings.email || '', settings.president || '', settings.treasurerName || '',
          settings.treasurerRole || '', settings.pastorName || '', settings.pastorRole || '',
          settings.closingDay || 1, settings.logo || ''
        ]
      );
    }

    // Sync Users
    for (const u of users) {
      if (!u.username || u.username === 'adm') continue;
      const id = u.id || crypto.randomUUID();
      const isDept = !!(u.noDiscount || u.role === 'DEPT_TREASURER');
      const finalRole = u.role === 'ADMIN' ? 'ADMIN' : (isDept ? 'DEPT_TREASURER' : (u.role || 'USER'));
      await pool.query(
        `INSERT INTO users (id, username, password, name, email, phone, photo, signature, signature_type, role, institution, active, nodiscount)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT (username) DO UPDATE SET
           name = EXCLUDED.name, email = EXCLUDED.email, phone = EXCLUDED.phone,
           signature = EXCLUDED.signature, signature_type = EXCLUDED.signature_type,
           role = EXCLUDED.role, institution = EXCLUDED.institution, active = EXCLUDED.active,
           nodiscount = EXCLUDED.nodiscount`,
        [id, u.username, u.password || '123456', u.name, u.email || '', u.phone || '', u.photo || '', u.signature || '', u.signatureType || 'UPLOADED', finalRole, u.institution || '', u.active ?? true, isDept]
      );
      syncedUsers++;
    }

    // Sync Reports
    for (const r of reports) {
      if (!r.institutionName) continue;
      const id = r.id || crypto.randomUUID();
      const isNoDiscount = !!(r.noDiscount || (Number(r.totalRevenue) > 0 && Number(r.sedeExpense) === 0 && Number(r.prebendaExpense) === 0));
      await pool.query(
        `INSERT INTO reports (
          id, date, institutionname, reportername, userid, locked,
          offers, specialoffers, tithes, financialrevenue, interestrevenue, rentrevenue, otherrevenues,
          energy, water, rent, internet, cleaning, maintenance, missions, social, otherexpenses,
          totalrevenue, totalfixedexpenses, sedeexpense, prebendaexpense, totalexpenses,
          saldogu, currentbalance, previousbalance, cashbalance, pixbalance, attachments,
          archived, archivemonth, deletedat, deletedby, approvalstatus, approvedby, approvedat, rejectionreason, emailsenttoadmin, emailsentat, nodiscount
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11, $12, $13,
          $14, $15, $16, $17, $18, $19, $20, $21, $22,
          $23, $24, $25, $26, $27,
          $28, $29, $30, $31, $32, $33,
          $34, $35, $36, $37, $38, $39, $40, $41, $42, $43, $44
        )
        ON CONFLICT (id) DO NOTHING`,
        [
          id, r.date || new Date().toISOString().split('T')[0], r.institutionName, r.reporterName || 'Tesoureiro',
          r.userId || ADMIN_MASTER_UUID, !!r.locked, Number(r.offers) || 0, Number(r.specialOffers) || 0,
          Number(r.tithes) || 0, Number(r.financialRevenue) || 0, Number(r.interestRevenue) || 0,
          Number(r.rentRevenue) || 0, JSON.stringify(r.otherRevenues || []), Number(r.energy) || 0,
          Number(r.water) || 0, Number(r.rent) || 0, Number(r.internet) || 0, Number(r.cleaning) || 0,
          Number(r.maintenance) || 0, Number(r.missions) || 0, Number(r.social) || 0,
          JSON.stringify(r.otherExpenses || []), Number(r.totalRevenue) || 0, Number(r.totalFixedExpenses) || 0,
          Number(r.sedeExpense) || 0, Number(r.prebendaExpense) || 0, Number(r.totalExpenses) || 0,
          Number(r.saldoGU) || 0, Number(r.currentBalance) || 0, Number(r.previousBalance) || 0,
          Number(r.cashBalance) || 0, Number(r.pixBalance) || 0, JSON.stringify(r.attachments || []),
          !!r.archived, r.archiveMonth || null, r.deletedAt ? new Date(r.deletedAt) : null,
          r.deletedBy || null, r.approvalStatus || 'PENDENTE', r.approvedBy || null,
          r.approvedAt ? new Date(r.approvedAt) : null, r.rejectionReason || null,
          !!r.emailSentToAdmin, r.emailSentAt ? new Date(r.emailSentAt) : null, isNoDiscount
        ]
      );
      syncedReports++;
    }

    // Sync Transactions
    for (const tx of transactions) {
      if (!tx.type) continue;
      const id = tx.id || crypto.randomUUID();
      await pool.query(
        `INSERT INTO transactions (id, type, date, status, value, description, category, paymentmethod, institutionname, userid, tithername)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (id) DO NOTHING`,
        [
          id, tx.type, tx.date || new Date().toISOString().split('T')[0], tx.status || 'CONCLUIDO',
          Number(tx.value) || 0, tx.description || 'Lançamento', tx.category || 'Geral',
          tx.paymentMethod || 'DINHEIRO', tx.institutionName || 'Sede Administrativa',
          tx.userId || ADMIN_MASTER_UUID, tx.titherName || null
        ]
      );
      syncedTransactions++;
    }

    // Sync Receipts
    for (const rc of receipts) {
      if (!rc.number) continue;
      const id = rc.id || crypto.randomUUID();
      await pool.query(
        `INSERT INTO receipts (
          id, number, type, amount, personname, docnumber, description, date, city,
          treasurername, treasurerrole, treasurersignature, treasurersignature_type, pastorname, pastorrole, institutionname, tithes, offerings, specialofferings
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        ON CONFLICT (id) DO UPDATE SET
          treasurersignature = EXCLUDED.treasurersignature,
          treasurersignature_type = EXCLUDED.treasurersignature_type`,
        [
          id, rc.number, rc.type, Number(rc.amount) || 0, rc.personName || 'Membro',
          rc.docNumber || null, rc.description || '', rc.date || new Date().toISOString().split('T')[0],
          rc.city || 'Maracanaú', rc.treasurerName || 'Tesoureiro Local', rc.treasurerRole || null,
          rc.treasurerSignature || null, rc.treasurerSignatureType || 'UPLOADED',
          rc.pastorName || 'Pr. Antônio Chaves Crus', rc.pastorRole || null,
          rc.institutionName || 'Assembleia de Deus Geração Unida',
          Number(rc.tithes) || 0, Number(rc.offerings) || 0, Number(rc.specialOfferings) || 0
        ]
      );
      syncedReceipts++;
    }

    res.json({
      success: true,
      synced: { users: syncedUsers, reports: syncedReports, transactions: syncedTransactions, receipts: syncedReceipts }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// SEED SAMPLE CHURCH DATA
apiRouter.post('/db/seed-sample', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const prevMonthDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const sampleReportId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO reports (
        id, date, institutionname, reportername, userid, locked,
        tithes, offers, specialoffers, financialrevenue, totalrevenue,
        energy, water, cleaning, totalfixedexpenses,
        sedeexpense, prebendaexpense, totalexpenses, saldogu,
        currentbalance, previousbalance, cashbalance, pixbalance, approvalstatus
      ) VALUES (
        $1, $2, 'Sede Administrativa', 'Tesoureiro Local', $3, true,
        2850.00, 1200.00, 450.00, 0, 4500.00,
        350.00, 80.00, 120.00, 550.00,
        900.00, 1350.00, 2800.00, 1700.00,
        1700.00, 0, 800.00, 900.00, 'APROVADO'
      ) ON CONFLICT (id) DO NOTHING`,
      [sampleReportId, prevMonthDate, ADMIN_MASTER_UUID]
    );

    await pool.query(
      `INSERT INTO transactions (id, type, date, status, value, description, category, paymentmethod, institutionname, userid, tithername)
       VALUES
       ($1, 'RECEITA', $2, 'CONCLUIDO', 500.00, 'Dízimo - Culto de Domingo', 'Dízimos', 'PIX', 'Sede Administrativa', $3, 'Irmão Carlos Silva'),
       ($4, 'RECEITA', $2, 'CONCLUIDO', 250.00, 'Ofertas Gerais - Culto da Família', 'Ofertas', 'DINHEIRO', 'Sede Administrativa', $3, NULL),
       ($5, 'DESPESA', $2, 'CONCLUIDO', 120.00, 'Material de Limpeza e Higiene', 'Limpeza', 'PIX', 'Sede Administrativa', $3, NULL)
       ON CONFLICT (id) DO NOTHING`,
      [crypto.randomUUID(), today, ADMIN_MASTER_UUID, crypto.randomUUID(), crypto.randomUUID()]
    );

    res.json({ success: true, message: 'Dados eclesiásticos de demonstração carregados com sucesso!' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// SETTINGS
apiRouter.get('/settings', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM settings WHERE id = 1');
    if (result.rows.length === 0) {
      return res.json({
        institutionName: 'Assembleia de Deus Geração Unida',
        cnpj: '49.386.673/0001-10',
        address: 'Rua Doze de Outubro 779, Parque Tijuca, Maracanaú - CE',
        email: 'ADGUgeracaounida@gmail.com',
        president: 'Pr. Antônio Chaves Crus',
        treasurerName: 'Tesoureiro Local',
        treasurerRole: 'Tesoureiro Responsável',
        pastorName: 'Pr. Antônio Chaves Crus',
        pastorRole: 'Pastor Presidente / Dirigente',
        closingDay: 1,
        logo: ''
      });
    }
    const r = result.rows[0];
    res.json({
      institutionName: r.institutionname || 'Assembleia de Deus Geração Unida',
      cnpj: r.cnpj || '49.386.673/0001-10',
      address: r.address || '',
      email: r.email || 'ADGUgeracaounida@gmail.com',
      president: r.president || 'Pr. Antônio Chaves Crus',
      treasurerName: r.treasurername || 'Tesoureiro Local',
      treasurerRole: r.treasurerrole || 'Tesoureiro Responsável',
      treasurerSignature: r.treasurersignature || '',
      pastorName: r.pastorname || 'Pr. Antônio Chaves Crus',
      pastorRole: r.pastorrole || 'Pastor Presidente / Dirigente',
      closingDay: Number(r.closingday) || 1,
      logo: r.logo || ''
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/settings', async (req, res) => {
  try {
    const s = req.body;
    await pool.query(
      `INSERT INTO settings (id, institutionname, cnpj, address, email, president, treasurername, treasurerrole, treasurersignature, pastorname, pastorrole, closingday, logo)
       VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (id) DO UPDATE SET
         institutionname = EXCLUDED.institutionname,
         cnpj = EXCLUDED.cnpj,
         address = EXCLUDED.address,
         email = EXCLUDED.email,
         president = EXCLUDED.president,
         treasurername = EXCLUDED.treasurername,
         treasurerrole = EXCLUDED.treasurerrole,
         treasurersignature = EXCLUDED.treasurersignature,
         pastorname = EXCLUDED.pastorname,
         pastorrole = EXCLUDED.pastorrole,
         closingday = EXCLUDED.closingday,
         logo = EXCLUDED.logo`,
      [
        s.institutionName,
        s.cnpj,
        s.address,
        s.email,
        s.president,
        s.treasurerName,
        s.treasurerRole,
        s.treasurerSignature || '',
        s.pastorName,
        s.pastorRole,
        s.closingDay || 1,
        s.logo || ''
      ]
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// USERS & AUTH
apiRouter.get('/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users ORDER BY name ASC');
    res.json(result.rows.map((u) => ({
      id: u.id,
      username: u.username,
      password: u.password,
      name: u.name,
      email: u.email || '',
      phone: u.phone || '',
      photo: u.photo || '',
      signature: u.signature || '',
      signatureType: u.signature_type || 'UPLOADED',
      role: u.role,
      institution: u.institution,
      active: !!u.active,
      noDiscount: !!(u.nodiscount || u.role === 'DEPT_TREASURER')
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/users', async (req, res) => {
  try {
    const user = req.body;
    const id = user.id || crypto.randomUUID();
    const existing = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    const isDeptTreasurer = !!(user.noDiscount || user.role === 'DEPT_TREASURER');
    const finalRole = user.role === 'ADMIN' ? 'ADMIN' : (isDeptTreasurer ? 'DEPT_TREASURER' : (user.role || 'USER'));

    if (existing.rows.length > 0) {
      const current = existing.rows[0];
      const password = user.password ? user.password : current.password;
      await pool.query(
        `UPDATE users SET username = $1, password = $2, name = $3, email = $4, phone = $5, photo = $6, signature = $7, signature_type = $8, role = $9, institution = $10, active = $11, nodiscount = $12
         WHERE id = $13`,
        [user.username, password, user.name, user.email, user.phone, user.photo, user.signature || '', user.signatureType || 'UPLOADED', finalRole, user.institution, user.active ?? true, isDeptTreasurer, id]
      );
    } else {
      await pool.query(
        `INSERT INTO users (id, username, password, name, email, phone, photo, signature, signature_type, role, institution, active, nodiscount)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [id, user.username, user.password || '123456', user.name, user.email || '', user.phone || '', user.photo || '', user.signature || '', user.signatureType || 'UPLOADED', finalRole, user.institution || '', user.active ?? true, isDeptTreasurer]
      );
    }
    res.json({ success: true, id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.put('/users/:id/status', async (req, res) => {
  try {
    const { active } = req.body;
    await pool.query('UPDATE users SET active = $1 WHERE id = $2', [active, req.params.id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.delete('/users/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const cleanUser = (username || '').toLowerCase().trim();
    const result = await pool.query(
      'SELECT * FROM users WHERE LOWER(username) = $1 AND active = TRUE',
      [cleanUser]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Usuário não encontrado ou inativo' });
    }

    const u = result.rows[0];
    if (u.password === password) {
      return res.json({
        id: u.id,
        username: u.username,
        name: u.name,
        email: u.email || '',
        phone: u.phone || '',
        photo: u.photo || '',
        role: u.role,
        institution: u.institution,
        active: u.active,
        noDiscount: !!(u.nodiscount || u.role === 'DEPT_TREASURER')
      });
    }

    res.status(401).json({ error: 'Senha incorreta' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/auth/user/:username', async (req, res) => {
  try {
    const cleanUser = req.params.username.toLowerCase().trim();
    const result = await pool.query(
      'SELECT * FROM users WHERE LOWER(username) = $1 AND active = TRUE',
      [cleanUser]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    const u = result.rows[0];
    res.json({
      id: u.id,
      username: u.username,
      name: u.name,
      email: u.email || '',
      phone: u.phone || '',
      photo: u.photo || '',
      role: u.role,
      institution: u.institution,
      active: u.active,
      noDiscount: !!(u.nodiscount || u.role === 'DEPT_TREASURER')
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// REPORTS
function mapReportFromDb(r: any) {
  const totalRev = Number(r.totalrevenue) || 0;
  const sedeExp = Number(r.sedeexpense) || 0;
  const prebendaExp = Number(r.prebendaexpense) || 0;
  const inferredNoDiscount = !!(r.nodiscount || (totalRev > 0 && sedeExp === 0 && prebendaExp === 0));
  return {
    id: r.id,
    date: typeof r.date === 'string' ? r.date.split('T')[0] : (r.date ? new Date(r.date).toISOString().split('T')[0] : ''),
    institutionName: r.institutionname,
    reporterName: r.reportername,
    userId: r.userid,
    locked: !!r.locked,
    offers: Number(r.offers) || 0,
    specialOffers: Number(r.specialoffers) || 0,
    tithes: Number(r.tithes) || 0,
    financialRevenue: Number(r.financialrevenue) || 0,
    interestRevenue: Number(r.interestrevenue) || 0,
    rentRevenue: Number(r.rentrevenue) || 0,
    otherRevenues: typeof r.otherrevenues === 'string' ? JSON.parse(r.otherrevenues) : (r.otherrevenues || []),
    energy: Number(r.energy) || 0,
    water: Number(r.water) || 0,
    rent: Number(r.rent) || 0,
    internet: Number(r.internet) || 0,
    cleaning: Number(r.cleaning) || 0,
    maintenance: Number(r.maintenance) || 0,
    missions: Number(r.missions) || 0,
    social: Number(r.social) || 0,
    otherExpenses: typeof r.otherexpenses === 'string' ? JSON.parse(r.otherexpenses) : (r.otherexpenses || []),
    totalRevenue: totalRev,
    totalFixedExpenses: Number(r.totalfixedexpenses) || 0,
    sedeExpense: sedeExp,
    prebendaExpense: prebendaExp,
    totalExpenses: Number(r.totalexpenses) || 0,
    saldoGU: Number(r.saldogu) || 0,
    currentBalance: Number(r.currentbalance) || 0,
    previousBalance: Number(r.previousbalance) || 0,
    cashBalance: Number(r.cashbalance) || 0,
    pixBalance: Number(r.pixbalance) || 0,
    attachments: typeof r.attachments === 'string' ? JSON.parse(r.attachments) : (r.attachments || []),
    createdAt: r.createdat ? new Date(r.createdat).toISOString() : new Date().toISOString(),
    archived: !!r.archived,
    archiveMonth: r.archivemonth || undefined,
    deletedAt: r.deletedat ? new Date(r.deletedat).toISOString() : undefined,
    deletedBy: r.deletedby || undefined,
    approvalStatus: r.approvalstatus || 'PENDENTE',
    approvedBy: r.approvedby || undefined,
    approvedAt: r.approvedat ? new Date(r.approvedat).toISOString() : undefined,
    rejectionReason: r.rejectionreason || undefined,
    emailSentToAdmin: !!r.emailsenttoadmin,
    emailSentAt: r.emailsentat ? new Date(r.emailsentat).toISOString() : undefined,
    noDiscount: inferredNoDiscount
  };
}

apiRouter.get('/reports', async (req, res) => {
  try {
    const { institution, includeDeleted } = req.query;
    let query = 'SELECT * FROM reports WHERE 1=1';
    const params: any[] = [];

    if (includeDeleted === 'true') {
      query += ' AND deletedat IS NOT NULL';
    } else {
      query += ' AND deletedat IS NULL';
    }

    if (institution && institution !== 'ALL') {
      params.push(institution);
      query += ` AND institutionname = $${params.length}`;
    }

    query += ' ORDER BY date DESC, createdat DESC';
    const result = await pool.query(query, params);
    res.json(result.rows.map(mapReportFromDb));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/reports', async (req, res) => {
  try {
    const r = req.body;
    const id = r.id || crypto.randomUUID();
    const isNoDiscount = !!(r.noDiscount || (Number(r.totalRevenue) > 0 && Number(r.sedeExpense) === 0 && Number(r.prebendaExpense) === 0));
    await pool.query(
      `INSERT INTO reports (
        id, date, institutionname, reportername, userid, locked,
        offers, specialoffers, tithes, financialrevenue, interestrevenue, rentrevenue, otherrevenues,
        energy, water, rent, internet, cleaning, maintenance, missions, social, otherexpenses,
        totalrevenue, totalfixedexpenses, sedeexpense, prebendaexpense, totalexpenses,
        saldogu, currentbalance, previousbalance, cashbalance, pixbalance, attachments,
        archived, archivemonth, deletedat, deletedby, approvalstatus, approvedby, approvedat, rejectionreason, emailsenttoadmin, emailsentat, nodiscount
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12, $13,
        $14, $15, $16, $17, $18, $19, $20, $21, $22,
        $23, $24, $25, $26, $27,
        $28, $29, $30, $31, $32, $33,
        $34, $35, $36, $37, $38, $39, $40, $41, $42, $43, $44
      )
      ON CONFLICT (id) DO UPDATE SET
        date = EXCLUDED.date,
        institutionname = EXCLUDED.institutionname,
        reportername = EXCLUDED.reportername,
        userid = EXCLUDED.userid,
        locked = EXCLUDED.locked,
        offers = EXCLUDED.offers,
        specialoffers = EXCLUDED.specialoffers,
        tithes = EXCLUDED.tithes,
        financialrevenue = EXCLUDED.financialrevenue,
        interestrevenue = EXCLUDED.interestrevenue,
        rentrevenue = EXCLUDED.rentrevenue,
        otherrevenues = EXCLUDED.otherrevenues,
        energy = EXCLUDED.energy,
        water = EXCLUDED.water,
        rent = EXCLUDED.rent,
        internet = EXCLUDED.internet,
        cleaning = EXCLUDED.cleaning,
        maintenance = EXCLUDED.maintenance,
        missions = EXCLUDED.missions,
        social = EXCLUDED.social,
        otherexpenses = EXCLUDED.otherexpenses,
        totalrevenue = EXCLUDED.totalrevenue,
        totalfixedexpenses = EXCLUDED.totalfixedexpenses,
        sedeexpense = EXCLUDED.sedeexpense,
        prebendaexpense = EXCLUDED.prebendaexpense,
        totalexpenses = EXCLUDED.totalexpenses,
        saldogu = EXCLUDED.saldogu,
        currentbalance = EXCLUDED.currentbalance,
        previousbalance = EXCLUDED.previousbalance,
        cashbalance = EXCLUDED.cashbalance,
        pixbalance = EXCLUDED.pixbalance,
        attachments = EXCLUDED.attachments,
        archived = EXCLUDED.archived,
        archivemonth = EXCLUDED.archivemonth,
        deletedat = EXCLUDED.deletedat,
        deletedby = EXCLUDED.deletedby,
        approvalstatus = EXCLUDED.approvalstatus,
        approvedby = EXCLUDED.approvedby,
        approvedat = EXCLUDED.approvedat,
        rejectionreason = EXCLUDED.rejectionreason,
        emailsenttoadmin = EXCLUDED.emailsenttoadmin,
        emailsentat = EXCLUDED.emailsentat,
        nodiscount = EXCLUDED.nodiscount`,
      [
        id,
        r.date,
        r.institutionName,
        r.reporterName,
        r.userId || ADMIN_MASTER_UUID,
        !!r.locked,
        Number(r.offers) || 0,
        Number(r.specialOffers) || 0,
        Number(r.tithes) || 0,
        Number(r.financialRevenue) || 0,
        Number(r.interestRevenue) || 0,
        Number(r.rentRevenue) || 0,
        JSON.stringify(r.otherRevenues || []),
        Number(r.energy) || 0,
        Number(r.water) || 0,
        Number(r.rent) || 0,
        Number(r.internet) || 0,
        Number(r.cleaning) || 0,
        Number(r.maintenance) || 0,
        Number(r.missions) || 0,
        Number(r.social) || 0,
        JSON.stringify(r.otherExpenses || []),
        Number(r.totalRevenue) || 0,
        Number(r.totalFixedExpenses) || 0,
        Number(r.sedeExpense) || 0,
        Number(r.prebendaExpense) || 0,
        Number(r.totalExpenses) || 0,
        Number(r.saldoGU) || 0,
        Number(r.currentBalance) || 0,
        Number(r.previousBalance) || 0,
        Number(r.cashBalance) || 0,
        Number(r.pixBalance) || 0,
        JSON.stringify(r.attachments || []),
        !!r.archived,
        r.archiveMonth || null,
        r.deletedAt ? new Date(r.deletedAt) : null,
        r.deletedBy || null,
        r.approvalStatus || 'PENDENTE',
        r.approvedBy || null,
        r.approvedAt ? new Date(r.approvedAt) : null,
        r.rejectionReason || null,
        !!r.emailSentToAdmin,
        r.emailSentAt ? new Date(r.emailSentAt) : null,
        isNoDiscount
      ]
    );
    res.json({ success: true, id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.put('/reports/:id/lock', async (req, res) => {
  try {
    const { locked } = req.body;
    await pool.query('UPDATE reports SET locked = $1 WHERE id = $2', [locked, req.params.id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.put('/reports/:id/approval', async (req, res) => {
  try {
    const { status, approvedBy, rejectionReason } = req.body;
    if (status === 'APROVADO') {
      await pool.query(
        'UPDATE reports SET approvalstatus = $1, locked = TRUE, approvedby = $2, approvedat = NOW(), rejectionreason = NULL WHERE id = $3',
        [status, approvedBy || 'ADMIN', req.params.id]
      );
    } else if (status === 'REJEITADO') {
      await pool.query(
        'UPDATE reports SET approvalstatus = $1, locked = FALSE, rejectionreason = $2 WHERE id = $3',
        [status, rejectionReason || 'Solicitado ajustes pelo ADM', req.params.id]
      );
    } else {
      await pool.query('UPDATE reports SET approvalstatus = $1, locked = FALSE WHERE id = $2', [status, req.params.id]);
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.delete('/reports/:id', async (req, res) => {
  try {
    const { userId } = req.query;
    await pool.query('UPDATE reports SET deletedat = NOW(), deletedby = $1 WHERE id = $2', [userId || 'ADMIN', req.params.id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/reports/:id/restore', async (req, res) => {
  try {
    await pool.query('UPDATE reports SET deletedat = NULL, deletedby = NULL WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.delete('/reports/:id/permanent', async (req, res) => {
  try {
    await pool.query('DELETE FROM reports WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/reports/archive', async (req, res) => {
  try {
    const { month, year, institutionName } = req.body;
    const archiveLabel = `${month}/${year}`;
    let query = `UPDATE reports SET archived = TRUE, archivemonth = $1, locked = TRUE 
                 WHERE deletedat IS NULL AND EXTRACT(MONTH FROM date) = $2 AND EXTRACT(YEAR FROM date) = $3`;
    const params: any[] = [archiveLabel, parseInt(month), parseInt(year)];

    if (institutionName && institutionName !== 'ALL') {
      params.push(institutionName);
      query += ` AND institutionname = $${params.length}`;
    }

    await pool.query(query, params);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// EMAIL DISPATCH PROXY
apiRouter.post('/email/send', async (req, res) => {
  try {
    const { recipients, subject, html, reportId, apiKey } = req.body;
    const resendKey = process.env.RESEND_API_KEY || process.env.VITE_RESEND_API_KEY || apiKey;
    const emailList: string[] = Array.isArray(recipients) ? recipients.filter(Boolean) : [];

    if (emailList.length === 0) {
      return res.json({ success: true, simulated: true, message: 'No recipients configured' });
    }

    let sentViaResend = false;

    if (resendKey) {
      for (const email of emailList) {
        try {
          const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${resendKey}`
            },
            body: JSON.stringify({
              from: 'ADGU Portal <onboarding@resend.dev>',
              to: email,
              subject: subject || 'Notificação Financeira ADGU',
              html: html || ''
            })
          });
          if (response.ok) {
            sentViaResend = true;
          } else {
            const errBody = await response.text();
            console.warn(`Resend API notice for ${email}: ${response.status} - ${errBody}`);
          }
        } catch (fetchErr: any) {
          console.warn(`Server email dispatch notice for ${email}:`, fetchErr?.message || fetchErr);
        }
      }
    }

    if (reportId) {
      try {
        await pool.query(
          'UPDATE reports SET emailsenttoadmin = TRUE, emailsentat = NOW() WHERE id = $1',
          [reportId]
        );
      } catch (dbErr) {
        console.warn('Could not update report email status:', dbErr);
      }
    }

    res.json({ success: true, sentViaResend });
  } catch (err: any) {
    console.warn('Email route warning:', err?.message || err);
    res.json({ success: true, simulated: true });
  }
});

// TRANSACTIONS
function mapTransactionFromDb(t: any) {
  return {
    id: t.id,
    type: t.type,
    date: typeof t.date === 'string' ? t.date.split('T')[0] : (t.date ? new Date(t.date).toISOString().split('T')[0] : ''),
    status: t.status,
    value: Number(t.value) || 0,
    description: t.description,
    category: t.category,
    paymentMethod: t.paymentmethod || 'DINHEIRO',
    institutionName: t.institutionname,
    userId: t.userid || ADMIN_MASTER_UUID,
    titherName: t.tithername || undefined,
    createdAt: t.createdat ? new Date(t.createdat).toISOString() : new Date().toISOString(),
    deletedAt: t.deletedat ? new Date(t.deletedat).toISOString() : undefined
  };
}

apiRouter.get('/transactions', async (req, res) => {
  try {
    const { institution } = req.query;
    let query = 'SELECT * FROM transactions WHERE deletedat IS NULL';
    const params: any[] = [];

    if (institution && institution !== 'ALL') {
      params.push(institution);
      query += ` AND institutionname = $${params.length}`;
    }

    query += ' ORDER BY date DESC, createdat DESC';
    const result = await pool.query(query, params);
    res.json(result.rows.map(mapTransactionFromDb));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/transactions/deleted', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM transactions WHERE deletedat IS NOT NULL ORDER BY date DESC');
    res.json(result.rows.map(mapTransactionFromDb));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/transactions', async (req, res) => {
  try {
    const tx = req.body;
    const id = tx.id || crypto.randomUUID();
    await pool.query(
      `INSERT INTO transactions (id, type, date, status, value, description, category, paymentmethod, institutionname, userid, tithername)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (id) DO UPDATE SET
         type = EXCLUDED.type,
         date = EXCLUDED.date,
         status = EXCLUDED.status,
         value = EXCLUDED.value,
         description = EXCLUDED.description,
         category = EXCLUDED.category,
         paymentmethod = EXCLUDED.paymentmethod,
         institutionname = EXCLUDED.institutionname,
         userid = EXCLUDED.userid,
         tithername = EXCLUDED.tithername`,
      [
        id,
        tx.type,
        tx.date,
        tx.status,
        Number(tx.value) || 0,
        tx.description,
        tx.category,
        tx.paymentMethod || 'DINHEIRO',
        tx.institutionName,
        tx.userId || ADMIN_MASTER_UUID,
        tx.titherName || null
      ]
    );
    res.json({ success: true, id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.delete('/transactions/:id', async (req, res) => {
  try {
    await pool.query('UPDATE transactions SET deletedat = NOW() WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/transactions/:id/restore', async (req, res) => {
  try {
    await pool.query('UPDATE transactions SET deletedat = NULL WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.delete('/transactions/:id/permanent', async (req, res) => {
  try {
    await pool.query('DELETE FROM transactions WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// RECEIPTS
function mapReceiptFromDb(r: any) {
  return {
    id: r.id,
    number: r.number,
    type: r.type,
    amount: Number(r.amount) || 0,
    personName: r.personname,
    docNumber: r.docnumber || undefined,
    description: r.description,
    date: typeof r.date === 'string' ? r.date.split('T')[0] : (r.date ? new Date(r.date).toISOString().split('T')[0] : ''),
    city: r.city,
    treasurerName: r.treasurername,
    treasurerRole: r.treasurerrole || undefined,
    treasurerSignature: r.treasurersignature || undefined,
    treasurerSignatureType: r.treasurersignature_type || 'UPLOADED',
    pastorName: r.pastorname,
    pastorRole: r.pastorrole || undefined,
    institutionName: r.institutionname,
    tithes: Number(r.tithes) || 0,
    offerings: Number(r.offerings) || 0,
    specialOfferings: Number(r.specialofferings) || 0,
    createdAt: r.createdat ? new Date(r.createdat).toISOString() : new Date().toISOString()
  };
}

apiRouter.get('/receipts', async (req, res) => {
  try {
    const { institution } = req.query;
    let query = 'SELECT * FROM receipts';
    const params: any[] = [];

    if (institution && institution !== 'ALL') {
      params.push(institution);
      query += ' WHERE institutionname = $1';
    }

    query += ' ORDER BY createdat DESC';
    const result = await pool.query(query, params);
    res.json(result.rows.map(mapReceiptFromDb));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/receipts', async (req, res) => {
  try {
    const r = req.body;
    const id = r.id || crypto.randomUUID();
    await pool.query(
      `INSERT INTO receipts (
        id, number, type, amount, personname, docnumber, description, date, city,
        treasurername, treasurerrole, treasurersignature, treasurersignature_type, pastorname, pastorrole, institutionname, tithes, offerings, specialofferings
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      ON CONFLICT (id) DO UPDATE SET
        number = EXCLUDED.number,
        type = EXCLUDED.type,
        amount = EXCLUDED.amount,
        personname = EXCLUDED.personname,
        docnumber = EXCLUDED.docnumber,
        description = EXCLUDED.description,
        date = EXCLUDED.date,
        city = EXCLUDED.city,
        treasurername = EXCLUDED.treasurername,
        treasurerrole = EXCLUDED.treasurerrole,
        treasurersignature = EXCLUDED.treasurersignature,
        treasurersignature_type = EXCLUDED.treasurersignature_type,
        pastorname = EXCLUDED.pastorname,
        pastorrole = EXCLUDED.pastorrole,
        institutionname = EXCLUDED.institutionname,
        tithes = EXCLUDED.tithes,
        offerings = EXCLUDED.offerings,
        specialofferings = EXCLUDED.specialofferings`,
      [
        id,
        r.number,
        r.type,
        Number(r.amount) || 0,
        r.personName,
        r.docNumber || null,
        r.description,
        r.date,
        r.city,
        r.treasurerName,
        r.treasurerRole || null,
        r.treasurerSignature || null,
        r.treasurerSignatureType || 'UPLOADED',
        r.pastorName,
        r.pastorRole || null,
        r.institutionName,
        Number(r.tithes) || 0,
        Number(r.offerings) || 0,
        Number(r.specialOfferings) || 0
      ]
    );
    res.json({ success: true, id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.delete('/receipts/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM receipts WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Mount the API Router on both /api and root /
app.use('/api', apiRouter);
app.use('/', apiRouter);

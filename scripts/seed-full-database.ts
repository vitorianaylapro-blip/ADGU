import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import fs from 'fs';
import path from 'path';

neonConfig.webSocketConstructor = ws;

const DATABASE_URL = "postgresql://neondb_owner:npg_XkdQsc1AEv7D@ep-icy-dust-b5hjov6u-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const ADMIN_MASTER_UUID = 'e8c75dd0-0000-4000-a000-000000000000';

async function main() {
  console.log("==================================================================");
  console.log("INICIANDO CARGA TOTAL DA ESTRUTURA E DADOS NO NEON POSTGRESQL");
  console.log("Host: ep-icy-dust-b5hjov6u-pooler.c-7.us-east-2.aws.neon.tech");
  console.log("==================================================================");

  const client = await pool.connect();
  try {
    // 1. Executar database.sql completo (DDL, tabelas, índices e RLS)
    console.log("1. Aplicando DDL completo (tabelas, índices, RLS)...");
    const sqlPath = path.join(process.cwd(), 'database.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    await client.query(sqlContent);
    console.log("   -> Estrutura base de tabelas, índices e RLS aplicada com sucesso!");

    // 2. Garantir colunas adicionais essenciais em reports e users
    console.log("2. Verificando e garantindo todas as colunas necessárias...");
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS nodiscount BOOLEAN DEFAULT FALSE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS photo TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;

      ALTER TABLE reports ADD COLUMN IF NOT EXISTS nodiscount BOOLEAN DEFAULT FALSE;
      ALTER TABLE reports ADD COLUMN IF NOT EXISTS interestrevenue NUMERIC DEFAULT 0;
      ALTER TABLE reports ADD COLUMN IF NOT EXISTS rentrevenue NUMERIC DEFAULT 0;
      ALTER TABLE reports ADD COLUMN IF NOT EXISTS internet NUMERIC DEFAULT 0;
      ALTER TABLE reports ADD COLUMN IF NOT EXISTS cleaning NUMERIC DEFAULT 0;
      ALTER TABLE reports ADD COLUMN IF NOT EXISTS maintenance NUMERIC DEFAULT 0;
      ALTER TABLE reports ADD COLUMN IF NOT EXISTS missions NUMERIC DEFAULT 0;
      ALTER TABLE reports ADD COLUMN IF NOT EXISTS social NUMERIC DEFAULT 0;
      ALTER TABLE reports ADD COLUMN IF NOT EXISTS approvalstatus TEXT DEFAULT 'PENDENTE';
      ALTER TABLE reports ADD COLUMN IF NOT EXISTS approvedby TEXT;
      ALTER TABLE reports ADD COLUMN IF NOT EXISTS approvedat TIMESTAMPTZ;
      ALTER TABLE reports ADD COLUMN IF NOT EXISTS rejectionreason TEXT;
      ALTER TABLE reports ADD COLUMN IF NOT EXISTS emailsenttoadmin BOOLEAN DEFAULT FALSE;
      ALTER TABLE reports ADD COLUMN IF NOT EXISTS emailsentat TIMESTAMPTZ;
      ALTER TABLE reports ADD COLUMN IF NOT EXISTS cashbalance NUMERIC DEFAULT 0;
      ALTER TABLE reports ADD COLUMN IF NOT EXISTS pixbalance NUMERIC DEFAULT 0;
    `);
    console.log("   -> Todas as colunas validadas com sucesso!");

    // 3. Atualizar configurações oficiais da ADGU
    console.log("3. Carregando configurações oficiais da instituição...");
    await client.query(`
      INSERT INTO settings (
        id, institutionname, cnpj, address, email, president,
        treasurername, treasurerrole, pastorname, pastorrole, closingday
      ) VALUES (
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
      ON CONFLICT (id) DO UPDATE SET
        institutionname = EXCLUDED.institutionname,
        cnpj = EXCLUDED.cnpj,
        address = EXCLUDED.address,
        email = EXCLUDED.email,
        president = EXCLUDED.president,
        pastorname = EXCLUDED.pastorname,
        pastorrole = EXCLUDED.pastorrole;
    `);
    console.log("   -> Configurações institucionais carregadas!");

    // 4. Carregar Usuários de Equipe e Departamentos
    console.log("4. Carregando equipe ministerial e contas de acesso...");
    const initialUsers = [
      {
        id: ADMIN_MASTER_UUID,
        username: 'adm',
        password: 'adm',
        name: 'Administrador Geral',
        email: 'ADGUgeracaounida@gmail.com',
        phone: '(85) 92000-3598',
        role: 'ADMIN',
        institution: 'Sede Administrativa',
        noDiscount: false
      },
      {
        id: 'a1b2c3d4-0001-4000-a000-000000000001',
        username: 'tesouraria',
        password: '123',
        name: 'Tesoureiro Geral ADGU',
        email: 'tesouraria.adgu@gmail.com',
        phone: '(85) 99999-1001',
        role: 'USER',
        institution: 'Sede Administrativa',
        noDiscount: false
      },
      {
        id: 'a1b2c3d4-0002-4000-a000-000000000002',
        username: 'umec',
        password: '123',
        name: 'Tesouraria de Jovens (UMEC)',
        email: 'jovens.adgu@gmail.com',
        phone: '(85) 99999-1002',
        role: 'DEPT_TREASURER',
        institution: 'Departamento Jovem',
        noDiscount: true
      },
      {
        id: 'a1b2c3d4-0003-4000-a000-000000000003',
        username: 'infantil',
        password: '123',
        name: 'Tesouraria Departamento Infantil',
        email: 'infantil.adgu@gmail.com',
        phone: '(85) 99999-1003',
        role: 'DEPT_TREASURER',
        institution: 'Departamento Infantil',
        noDiscount: true
      },
      {
        id: 'a1b2c3d4-0004-4000-a000-000000000004',
        username: 'senhoras',
        password: '123',
        name: 'Tesouraria de Senhoras',
        email: 'senhoras.adgu@gmail.com',
        phone: '(85) 99999-1004',
        role: 'DEPT_TREASURER',
        institution: 'Departamento de Senhoras',
        noDiscount: true
      },
      {
        id: 'a1b2c3d4-0005-4000-a000-000000000005',
        username: 'missoes',
        password: '123',
        name: 'Secretaria de Missões ADGU',
        email: 'missoes.adgu@gmail.com',
        phone: '(85) 99999-1005',
        role: 'DEPT_TREASURER',
        institution: 'Secretaria de Missões',
        noDiscount: true
      }
    ];

    for (const u of initialUsers) {
      await client.query(`
        INSERT INTO users (id, username, password, name, email, phone, role, institution, active, nodiscount)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, $9)
        ON CONFLICT (username) DO UPDATE SET
          name = EXCLUDED.name,
          phone = EXCLUDED.phone,
          institution = EXCLUDED.institution,
          role = EXCLUDED.role,
          nodiscount = EXCLUDED.nodiscount;
      `, [u.id, u.username, u.password, u.name, u.email, u.phone, u.role, u.institution, u.noDiscount]);
    }
    console.log(`   -> ${initialUsers.length} usuários ministeriais cadastrados e atualizados!`);

    // 5. Carregar Lançamentos Diários (Receitas e Despesas)
    console.log("5. Carregando lançamentos diários eclesiásticos...");
    const today = new Date().toISOString().split('T')[0];
    const txList = [
      {
        type: 'RECEITA',
        date: today,
        status: 'CONCLUIDO',
        value: 1200.00,
        description: 'Dízimo - Culto de Doutrina e Ensino',
        category: 'Dízimos',
        paymentMethod: 'PIX',
        institutionName: 'Sede Administrativa',
        titherName: 'Pr. Antônio Chaves Crus'
      },
      {
        type: 'RECEITA',
        date: today,
        status: 'CONCLUIDO',
        value: 750.00,
        description: 'Dízimo - Culto de Celebração',
        category: 'Dízimos',
        paymentMethod: 'DINHEIRO',
        institutionName: 'Sede Administrativa',
        titherName: 'Irmão Carlos Eduardo'
      },
      {
        type: 'RECEITA',
        date: today,
        status: 'CONCLUIDO',
        value: 450.00,
        description: 'Ofertas Gerais - Culto da Família',
        category: 'Ofertas',
        paymentMethod: 'DINHEIRO',
        institutionName: 'Sede Administrativa',
        titherName: null
      },
      {
        type: 'RECEITA',
        date: today,
        status: 'CONCLUIDO',
        value: 300.00,
        description: 'Oferta Especial para Missões',
        category: 'Ofertas Especiais',
        paymentMethod: 'PIX',
        institutionName: 'Sede Administrativa',
        titherName: 'Irmã Maria de Fátima'
      },
      {
        type: 'RECEITA',
        date: today,
        status: 'CONCLUIDO',
        value: 650.00,
        description: 'Arrecadação - Culto Jovem UMEC',
        category: 'Ofertas',
        paymentMethod: 'PIX',
        institutionName: 'Departamento Jovem',
        titherName: null
      },
      {
        type: 'DESPESA',
        date: today,
        status: 'CONCLUIDO',
        value: 380.00,
        description: 'Energia Elétrica - Templo Sede',
        category: 'Energia',
        paymentMethod: 'PIX',
        institutionName: 'Sede Administrativa',
        titherName: null
      },
      {
        type: 'DESPESA',
        date: today,
        status: 'CONCLUIDO',
        value: 85.00,
        description: 'Conta de Água (CAGECE) - Templo Sede',
        category: 'Água',
        paymentMethod: 'PIX',
        institutionName: 'Sede Administrativa',
        titherName: null
      },
      {
        type: 'DESPESA',
        date: today,
        status: 'CONCLUIDO',
        value: 120.00,
        description: 'Material de Limpeza e Higiene',
        category: 'Limpeza',
        paymentMethod: 'DINHEIRO',
        institutionName: 'Sede Administrativa',
        titherName: null
      },
      {
        type: 'DESPESA',
        date: today,
        status: 'CONCLUIDO',
        value: 150.00,
        description: 'Ajuda de Custo - Missionário no Campo',
        category: 'Missões',
        paymentMethod: 'PIX',
        institutionName: 'Sede Administrativa',
        titherName: null
      }
    ];

    for (const tx of txList) {
      await client.query(`
        INSERT INTO transactions (id, type, date, status, value, description, category, paymentmethod, institutionname, userid, tithername)
        VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT DO NOTHING;
      `, [tx.type, tx.date, tx.status, tx.value, tx.description, tx.category, tx.paymentMethod, tx.institutionName, ADMIN_MASTER_UUID, tx.titherName]);
    }
    console.log(`   -> ${txList.length} lançamentos de receitas e despesas inseridos!`);

    // 6. Carregar Relatórios Financeiros Oficiais Consolidados
    console.log("6. Carregando relatórios financeiros eclesiásticos...");
    const reportSedeId = 'e8c75dd0-0000-4000-b000-000000000001';
    const reportDeptId = 'e8c75dd0-0000-4000-b000-000000000002';

    // Relatório 1: Sede Administrativa (com retenção 20% Sede, 20% Prebenda, 60% GU)
    // Receitas: Dízimos (3200) + Ofertas (1400) + Especiais (600) + Financeira (150) = 5350.00
    // Repasse Sede (20%): 1070.00
    // Prebenda (20%): 1070.00
    // Disponível GU (60%): 3210.00
    // Despesas Operacionais: Energia (420) + Água (95) + Limpeza (160) + Internet (110) + Missões (300) = 1085.00
    // Total Despesas: 1070 + 1070 + 1085 = 3225.00
    // Saldo GU: 3210 - 1085 = 2125.00
    // Saldo Final: Anterior (1500) + Saldo GU (2125) = 3625.00
    await client.query(`
      INSERT INTO reports (
        id, date, institutionname, reportername, userid, locked,
        tithes, offers, specialoffers, financialrevenue, interestrevenue, rentrevenue, otherrevenues,
        energy, water, rent, internet, cleaning, maintenance, missions, social, otherexpenses,
        totalrevenue, totalfixedexpenses, sedeexpense, prebendaexpense, totalexpenses,
        saldogu, currentbalance, previousbalance, cashbalance, pixbalance,
        approvalstatus, approvedby, approvedat, nodiscount
      ) VALUES (
        $1, $2, 'Sede Administrativa', 'Pr. Antônio Chaves Crus', $3, true,
        3200.00, 1400.00, 600.00, 150.00, 150.00, 0, '[]',
        420.00, 95.00, 0, 110.00, 160.00, 0, 300.00, 0, '[]',
        5350.00, 1085.00, 1070.00, 1070.00, 3225.00,
        2125.00, 3625.00, 1500.00, 1225.00, 2400.00,
        'APROVADO', 'Administrador Geral', NOW(), false
      )
      ON CONFLICT (id) DO UPDATE SET
        institutionname = EXCLUDED.institutionname,
        totalrevenue = EXCLUDED.totalrevenue,
        currentbalance = EXCLUDED.currentbalance,
        approvalstatus = EXCLUDED.approvalstatus;
    `, [reportSedeId, today, ADMIN_MASTER_UUID]);

    // Relatório 2: Departamento Jovem (sem desconto dos 20%/20%, 100% retido no departamento)
    await client.query(`
      INSERT INTO reports (
        id, date, institutionname, reportername, userid, locked,
        tithes, offers, specialoffers, financialrevenue, otherrevenues,
        energy, water, rent, internet, cleaning, maintenance, missions, social, otherexpenses,
        totalrevenue, totalfixedexpenses, sedeexpense, prebendaexpense, totalexpenses,
        saldogu, currentbalance, previousbalance, cashbalance, pixbalance,
        approvalstatus, approvedby, approvedat, nodiscount
      ) VALUES (
        $1, $2, 'Departamento Jovem', 'Tesouraria de Jovens (UMEC)', $3, true,
        0, 1150.00, 450.00, 0, '[]',
        0, 0, 0, 0, 80.00, 0, 250.00, 0, '[]',
        1600.00, 330.00, 0, 0, 330.00,
        1270.00, 1870.00, 600.00, 570.00, 1300.00,
        'APROVADO', 'Administrador Geral', NOW(), true
      )
      ON CONFLICT (id) DO UPDATE SET
        institutionname = EXCLUDED.institutionname,
        totalrevenue = EXCLUDED.totalrevenue,
        currentbalance = EXCLUDED.currentbalance,
        approvalstatus = EXCLUDED.approvalstatus;
    `, [reportDeptId, today, 'a1b2c3d4-0002-4000-a000-000000000002']);

    console.log("   -> Relatórios financeiros consolidados registrados com sucesso!");

    // 7. Carregar Recibos Eclesiásticos Oficiais
    console.log("7. Carregando recibos emitidos...");
    const receiptsList = [
      {
        number: 'REC-2026-0001',
        type: 'MEMBRO',
        amount: 1200.00,
        personName: 'Pr. Antônio Chaves Crus',
        docNumber: '111.222.333-44',
        description: 'Dízimo referente ao mês em curso - ADGU Sede',
        date: today,
        city: 'Maracanaú',
        treasurerName: 'Tesoureiro Local',
        treasurerRole: 'Tesoureiro Responsável',
        pastorName: 'Pr. Antônio Chaves Crus',
        pastorRole: 'Pastor Presidente',
        institutionName: 'Assembleia de Deus Geração Unida',
        tithes: 1200.00,
        offerings: 0,
        specialOfferings: 0
      },
      {
        number: 'REC-2026-0002',
        type: 'MEMBRO',
        amount: 750.00,
        personName: 'Irmão Carlos Eduardo',
        docNumber: '222.333.444-55',
        description: 'Dízimo e oferta para o sustento da obra ministerial',
        date: today,
        city: 'Maracanaú',
        treasurerName: 'Tesoureiro Local',
        treasurerRole: 'Tesoureiro Responsável',
        pastorName: 'Pr. Antônio Chaves Crus',
        pastorRole: 'Pastor Presidente',
        institutionName: 'Assembleia de Deus Geração Unida',
        tithes: 600.00,
        offerings: 150.00,
        specialOfferings: 0
      },
      {
        number: 'REC-2026-0003',
        type: 'RECEITA',
        amount: 650.00,
        personName: 'Departamento Jovem UMEC',
        docNumber: null,
        description: 'Repasse de ofertas arrecadadas no Congresso de Jovens',
        date: today,
        city: 'Maracanaú',
        treasurerName: 'Tesoureiro Local',
        treasurerRole: 'Tesoureiro Responsável',
        pastorName: 'Pr. Antônio Chaves Crus',
        pastorRole: 'Pastor Presidente',
        institutionName: 'Assembleia de Deus Geração Unida',
        tithes: 0,
        offerings: 650.00,
        specialOfferings: 0
      }
    ];

    for (const rc of receiptsList) {
      await client.query(`
        INSERT INTO receipts (
          id, number, type, amount, personname, docnumber, description, date, city,
          treasurername, treasurerrole, pastorname, pastorrole, institutionname, tithes, offerings, specialofferings
        ) VALUES (
          uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
        )
        ON CONFLICT DO NOTHING;
      `, [
        rc.number, rc.type, rc.amount, rc.personName, rc.docNumber, rc.description,
        rc.date, rc.city, rc.treasurerName, rc.treasurerRole, rc.pastorName, rc.pastorRole,
        rc.institutionName, rc.tithes, rc.offerings, rc.specialOfferings
      ]);
    }
    console.log(`   -> ${receiptsList.length} recibos eclesiásticos registrados!`);

    // 8. Resumo final
    console.log("==================================================================");
    const usersCount = await client.query('SELECT count(*) FROM users');
    const reportsCount = await client.query('SELECT count(*) FROM reports');
    const txCount = await client.query('SELECT count(*) FROM transactions');
    const receiptsCount = await client.query('SELECT count(*) FROM receipts');
    const settingsCount = await client.query('SELECT count(*) FROM settings');

    console.log("ESTRUTURA E DADOS CONSOLIDADOS NO NEON POSTGRESQL:");
    console.log(`- Configurações (settings): ${settingsCount.rows[0].count} registro`);
    console.log(`- Usuários cadastrados (users): ${usersCount.rows[0].count} registros`);
    console.log(`- Relatórios financeiros (reports): ${reportsCount.rows[0].count} registros`);
    console.log(`- Lançamentos diários (transactions): ${txCount.rows[0].count} registros`);
    console.log(`- Recibos emitidos (receipts): ${receiptsCount.rows[0].count} registros`);
    console.log("==================================================================");
    console.log("BANCO DE DADOS 100% CARREGADO E SINCRONIZADO COM SUCESSO!");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error("ERRO DURANTE A CARGA DO BANCO DE DADOS:", err);
  process.exit(1);
});

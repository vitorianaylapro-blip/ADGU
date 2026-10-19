import { FinancialReport, UserAccount, DailyTransaction, ReceiptRecord } from '../types';
import { sql } from './neonClient';

export interface SystemSettings {
  logo?: string;
  institutionName: string;
  cnpj: string;
  address: string;
  email: string;
  president: string;
  treasurerName?: string;
  treasurerRole?: string;
  treasurerCpf?: string;
  treasurerSignature?: string; // Base64 transparent PNG
  pastorName?: string;
  pastorRole?: string;
  pastorCpf?: string;
  pastorSignature?: string; // Base64 transparent PNG
  closingDay: number;
}

const notifyUpdate = (event: string) => {
  window.dispatchEvent(new Event(event));
};

const safeNum = (val: any): number => {
  const n = Number(val);
  return isNaN(n) ? 0 : n;
};

// LocalStorage Keys for caching & offline fallback
const STORAGE_KEYS = {
  SETTINGS: 'adgu_settings',
  USERS: 'adgu_users',
  REPORTS: 'adgu_reports',
  TRANSACTIONS: 'adgu_transactions',
  RECEIPTS: 'adgu_receipts',
};

const ADMIN_MASTER_UUID = 'e8c75dd0-0000-4000-a000-000000000000';

// API request helper with automatic JSON handling and HTML rejection (Netlify SPA fallback guard)
async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {})
    }
  });
  const contentType = res.headers.get('content-type') || '';
  if (!res.ok || contentType.includes('text/html')) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `API request to ${url} failed with status ${res.status}`);
  }
  return await res.json();
}

function mapReportFromDb(r: any): FinancialReport {
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

function mapTransactionFromDb(t: any): DailyTransaction {
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
    createdAt: t.createdat ? new Date(t.createdat).toISOString() : new Date().toISOString()
  };
}

function mapReceiptFromDb(r: any): ReceiptRecord {
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
    treasurerCpf: r.treasurercpf || undefined,
    treasurerSignature: r.treasurersignature || undefined,
    pastorName: r.pastorname,
    pastorRole: r.pastorrole || undefined,
    pastorCpf: r.pastorcpf || undefined,
    pastorSignature: r.pastorsignature || undefined,
    institutionName: r.institutionname,
    tithes: Number(r.tithes) || 0,
    offerings: Number(r.offerings) || 0,
    specialOfferings: Number(r.specialofferings) || 0,
    createdAt: r.createdat ? new Date(r.createdat).toISOString() : new Date().toISOString()
  };
}

function mapUserFromDb(u: any): UserAccount {
  return {
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
  };
}

// ---------------- DATABASE STATUS ----------------
export const getDatabaseStatus = async () => {
  // 1. Tentar via endpoint de API Express / Netlify Function
  try {
    const data = await apiFetch<{ status: string; provider: string; counts: any }>('/api/db/status');
    if (data && data.status === 'connected') return data;
  } catch (err) {
    // API endpoint indisponível (ex.: Netlify estático)
  }

  // 2. Fallback direto ao Neon PostgreSQL via HTTP (funciona 100% no Netlify sem backend)
  try {
    const [u, r, t, rc] = await Promise.all([
      sql`SELECT count(*) FROM users`,
      sql`SELECT count(*) FROM reports`,
      sql`SELECT count(*) FROM transactions`,
      sql`SELECT count(*) FROM receipts`
    ]);
    return {
      status: 'connected',
      provider: 'Neon PostgreSQL Cloud',
      counts: {
        users: parseInt(u[0].count),
        reports: parseInt(r[0].count),
        transactions: parseInt(t[0].count),
        receipts: parseInt(rc[0].count)
      }
    };
  } catch (directErr) {
    console.warn("Direct Neon status error:", directErr);
    return { status: 'offline', provider: 'Local Storage', counts: {} };
  }
};

// ---------------- LOCAL STORAGE UTILS ----------------
const getLocalUsers = (): UserAccount[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.USERS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

const saveLocalUsers = (users: UserAccount[]) => {
  try {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  } catch (e) {
    console.error("Erro ao salvar usuários locais:", e);
  }
};

const getLocalReports = (): FinancialReport[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.REPORTS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

const saveLocalReports = (reports: FinancialReport[]) => {
  try {
    localStorage.setItem(STORAGE_KEYS.REPORTS, JSON.stringify(reports));
  } catch (e) {
    console.error("Erro ao salvar relatórios locais:", e);
  }
};

const getLocalTransactions = (): DailyTransaction[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

const saveLocalTransactions = (txs: DailyTransaction[]) => {
  try {
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(txs));
  } catch (e) {
    console.error("Erro ao salvar transações locais:", e);
  }
};

export const ensureAdminMasterInDb = async () => {
  const users = getLocalUsers();
  const hasAdmin = users.some(u => u.username === 'adm' || u.id === ADMIN_MASTER_UUID);
  if (!hasAdmin) {
    users.push({
      id: ADMIN_MASTER_UUID,
      username: 'adm',
      password: 'adm',
      name: 'Administrador Geral',
      email: 'ADGUgeracaounida@gmail.com',
      phone: '',
      photo: '',
      role: 'ADMIN',
      institution: 'Sede Administrativa',
      active: true
    });
    saveLocalUsers(users);
  }
};

// ---------------- AUTHENTICATION & USERS ----------------
export const loginUser = async (username: string, password: string): Promise<UserAccount | null> => {
  const cleanUser = username.toLowerCase().trim();

  // Try remote PostgreSQL API first
  try {
    const apiRes = await apiFetch<UserAccount>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: cleanUser, password })
    });
    if (apiRes && apiRes.id) return apiRes;
  } catch (err: any) {
    if (err.message && err.message.includes('401')) {
      return null;
    }
  }

  // Direct Neon query fallback (Netlify / static hosting)
  try {
    const rows = await sql`SELECT * FROM users WHERE LOWER(username) = LOWER(${cleanUser}) AND active = TRUE`;
    if (rows && rows.length > 0) {
      const u = rows[0];
      if (u.password === password) {
        return mapUserFromDb(u);
      }
      return null;
    }
  } catch (directErr) {
    console.warn("Direct Neon login error:", directErr);
  }

  // Fallback to local storage
  await ensureAdminMasterInDb();
  const users = getLocalUsers();
  const found = users.find(u => u.username.toLowerCase().trim() === cleanUser && u.active);
  if (found && found.password === password) {
    return { ...found, password: '' };
  }

  return null;
};

export const getUserByUsername = async (username: string): Promise<UserAccount | null> => {
  const cleanUser = username.toLowerCase().trim();
  try {
    const apiRes = await apiFetch<UserAccount>(`/api/auth/user/${encodeURIComponent(cleanUser)}`);
    if (apiRes && apiRes.id) {
      return apiRes;
    }
  } catch (err) {}

  try {
    const rows = await sql`SELECT * FROM users WHERE LOWER(username) = LOWER(${cleanUser}) AND active = TRUE`;
    if (rows && rows.length > 0) {
      return mapUserFromDb(rows[0]);
    }
  } catch (directErr) {}

  await ensureAdminMasterInDb();
  const users = getLocalUsers();
  const found = users.find(u => u.username.toLowerCase().trim() === cleanUser && u.active);
  if (found) {
    return { ...found, password: '' };
  }
  return null;
};

export const getUsers = async (): Promise<UserAccount[]> => {
  try {
    const apiRes = await apiFetch<UserAccount[]>('/api/users');
    if (apiRes && Array.isArray(apiRes)) {
      saveLocalUsers(apiRes);
      return apiRes;
    }
  } catch (err) {}

  // Direct Neon query fallback
  try {
    const rows = await sql`SELECT * FROM users ORDER BY name ASC`;
    if (rows && Array.isArray(rows)) {
      const list = rows.map(mapUserFromDb);
      saveLocalUsers(list);
      return list;
    }
  } catch (directErr) {
    console.warn("Direct Neon getUsers error:", directErr);
  }

  await ensureAdminMasterInDb();
  const users = getLocalUsers();
  return users.sort((a, b) => a.name.localeCompare(b.name));
};

export const saveUser = async (user: Partial<UserAccount>) => {
  const id = user.id || crypto.randomUUID();
  const isDeptTreasurer = !!(user.noDiscount || user.role === 'DEPT_TREASURER');
  const finalRole = user.role === 'ADMIN' ? 'ADMIN' : (isDeptTreasurer ? 'DEPT_TREASURER' : (user.role || 'USER'));
  const payload = { ...user, id, role: finalRole, noDiscount: isDeptTreasurer };

  let savedRemotely = false;
  // Try remote PostgreSQL API
  try {
    await apiFetch('/api/users', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    savedRemotely = true;
  } catch (err) {}

  // Direct Neon fallback (Netlify)
  if (!savedRemotely) {
    try {
      const pwd = user.password || '123456';
      await sql`
        INSERT INTO users (id, username, password, name, email, phone, photo, signature, signature_type, role, institution, active, nodiscount)
        VALUES (${id}, ${user.username || ''}, ${pwd}, ${user.name || ''}, ${user.email || ''}, ${user.phone || ''}, ${user.photo || ''}, ${user.signature || ''}, ${user.signatureType || 'UPLOADED'}, ${finalRole}, ${user.institution || ''}, ${user.active ?? true}, ${isDeptTreasurer})
        ON CONFLICT (username) DO UPDATE SET
          name = EXCLUDED.name, email = EXCLUDED.email, phone = EXCLUDED.phone,
          photo = EXCLUDED.photo, signature = EXCLUDED.signature, signature_type = EXCLUDED.signature_type, role = EXCLUDED.role, institution = EXCLUDED.institution,
          active = EXCLUDED.active, nodiscount = EXCLUDED.nodiscount
      `;
    } catch (directErr) {
      console.warn("Direct Neon saveUser error:", directErr);
    }
  }

  // Also update local cache
  await ensureAdminMasterInDb();
  const users = getLocalUsers();
  const idx = users.findIndex(u => u.id === id);

  const newUser: UserAccount = {
    id,
    username: user.username || '',
    password: user.password || '123456',
    name: user.name || '',
    email: user.email || '',
    phone: user.phone || '',
    photo: user.photo || '',
    signature: user.signature || '',
    signatureType: user.signatureType || 'UPLOADED',
    role: finalRole,
    institution: user.institution || '',
    active: user.active ?? true,
    noDiscount: isDeptTreasurer
  };

  if (idx > -1) {
    if (!user.password) newUser.password = users[idx].password;
    users[idx] = newUser;
  } else {
    users.push(newUser);
  }

  saveLocalUsers(users);
  notifyUpdate('users-updated');
};

export const updateUserStatus = async (id: string, active: boolean) => {
  try {
    await apiFetch(`/api/users/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ active })
    });
  } catch (err) {
    try {
      await sql`UPDATE users SET active = ${active} WHERE id = ${id}`;
    } catch (directErr) {}
  }

  const users = getLocalUsers();
  const idx = users.findIndex(u => u.id === id);
  if (idx > -1) {
    users[idx].active = active;
    saveLocalUsers(users);
  }
  notifyUpdate('users-updated');
};

export const deleteUser = async (id: string) => {
  try {
    await apiFetch(`/api/users/${id}`, {
      method: 'DELETE'
    });
  } catch (err) {
    try {
      await sql`DELETE FROM users WHERE id = ${id}`;
    } catch (directErr) {}
  }

  const users = getLocalUsers().filter(u => u.id !== id);
  saveLocalUsers(users);
  notifyUpdate('users-updated');
};

// ---------------- SETTINGS ----------------
export const getSettings = async (): Promise<SystemSettings> => {
  try {
    const apiRes = await apiFetch<SystemSettings>('/api/settings');
    if (apiRes && apiRes.institutionName) {
      try {
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(apiRes));
      } catch {}
      return apiRes;
    }
  } catch (err) {}

  // Direct Neon query fallback (Netlify)
  try {
    const rows = await sql`SELECT * FROM settings WHERE id = 1`;
    if (rows && rows.length > 0) {
      const r = rows[0];
      const sData: SystemSettings = {
        institutionName: r.institutionname || 'Assembleia de Deus Geração Unida',
        cnpj: r.cnpj || '49.386.673/0001-10',
        address: r.address || '',
        email: r.email || 'ADGUgeracaounida@gmail.com',
        president: r.president || 'Pr. Antônio Chaves Crus',
        treasurerName: r.treasurername || 'Tesoureiro Local',
        treasurerRole: r.treasurerrole || 'Tesoureiro Responsável',
        treasurerCpf: r.treasurercpf || '',
        treasurerSignature: r.treasurersignature || '',
        pastorName: r.pastorname || 'Pr. Antônio Chaves Crus',
        pastorRole: r.pastorrole || 'Pastor Presidente / Dirigente',
        pastorCpf: r.pastorcpf || '',
        pastorSignature: r.pastorsignature || '',
        closingDay: Number(r.closingday) || 1,
        logo: r.logo || ''
      };
      try {
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(sData));
      } catch {}
      return sData;
    }
  } catch (directErr) {}

  try {
    const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (data) {
      const parsed = JSON.parse(data);
      return {
        institutionName: 'Assembleia de Deus Geração Unida',
        cnpj: '49.386.673/0001-10',
        address: 'Rua Doze de Outubro 779, Parque Tijuca, Maracanaú - CE',
        email: 'ADGUgeracaounida@gmail.com',
        president: 'Pr. Antônio Chaves Crus',
        treasurerName: 'Tesoureiro Local',
        treasurerRole: 'Tesoureiro Responsável',
        treasurerCpf: '',
        treasurerSignature: '',
        pastorName: 'Pr. Antônio Chaves Crus',
        pastorRole: 'Pastor Presidente / Dirigente',
        pastorCpf: '',
        pastorSignature: '',
        closingDay: 1,
        ...parsed
      };
    }
  } catch {}

  return {
    institutionName: 'Assembleia de Deus Geração Unida',
    cnpj: '49.386.673/0001-10',
    address: 'Rua Doze de Outubro 779, Parque Tijuca, Maracanaú - CE',
    email: 'ADGUgeracaounida@gmail.com',
    president: 'Pr. Antônio Chaves Crus',
    treasurerName: 'Tesoureiro Local',
    treasurerRole: 'Tesoureiro Responsável',
    treasurerCpf: '',
    treasurerSignature: '',
    pastorName: 'Pr. Antônio Chaves Crus',
    pastorRole: 'Pastor Presidente / Dirigente',
    pastorCpf: '',
    pastorSignature: '',
    closingDay: 1
  };
};

export const saveSettings = async (settings: SystemSettings) => {
  let savedRemotely = false;
  try {
    await apiFetch('/api/settings', {
      method: 'POST',
      body: JSON.stringify(settings)
    });
    savedRemotely = true;
  } catch (err) {}

  if (!savedRemotely) {
    try {
      await sql`
        INSERT INTO settings (id, institutionname, cnpj, address, email, president, treasurername, treasurerrole, pastorname, pastorrole, closingday, logo)
        VALUES (1, ${settings.institutionName}, ${settings.cnpj}, ${settings.address}, ${settings.email}, ${settings.president}, ${settings.treasurerName || ''}, ${settings.treasurerRole || ''}, ${settings.pastorName || ''}, ${settings.pastorRole || ''}, ${settings.closingDay || 1}, ${settings.logo || ''})
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
          logo = EXCLUDED.logo
      `;
    } catch (directErr) {
      console.warn("Direct Neon saveSettings error:", directErr);
    }
  }

  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    notifyUpdate('settings-updated');
  } catch (e) {
    console.error("Erro ao salvar configurações:", e);
    throw e;
  }
};

// ---------------- REPORTS ----------------
export const getReports = async (institution?: string, includeDeleted = false): Promise<FinancialReport[]> => {
  const query = new URLSearchParams();
  if (institution) query.append('institution', institution);
  if (includeDeleted) query.append('includeDeleted', 'true');

  try {
    const apiRes = await apiFetch<FinancialReport[]>(`/api/reports?${query.toString()}`);
    if (apiRes && Array.isArray(apiRes)) {
      if (!institution || institution === 'ALL') {
        saveLocalReports(apiRes);
      }
      return apiRes;
    }
  } catch (err) {}

  // Direct Neon query fallback (Netlify / static hosting)
  try {
    let rows: any[];
    if (includeDeleted) {
      if (institution && institution !== 'ALL') {
        rows = await sql`SELECT * FROM reports WHERE deletedat IS NOT NULL AND institutionname = ${institution} ORDER BY date DESC, createdat DESC`;
      } else {
        rows = await sql`SELECT * FROM reports WHERE deletedat IS NOT NULL ORDER BY date DESC, createdat DESC`;
      }
    } else {
      if (institution && institution !== 'ALL') {
        rows = await sql`SELECT * FROM reports WHERE deletedat IS NULL AND institutionname = ${institution} ORDER BY date DESC, createdat DESC`;
      } else {
        rows = await sql`SELECT * FROM reports WHERE deletedat IS NULL ORDER BY date DESC, createdat DESC`;
      }
    }
    if (rows && Array.isArray(rows)) {
      const list = rows.map(mapReportFromDb);
      if (!institution || institution === 'ALL') {
        saveLocalReports(list);
      }
      return list;
    }
  } catch (directErr) {
    console.warn("Direct Neon getReports error:", directErr);
  }

  await ensureAdminMasterInDb();
  let list = getLocalReports();

  if (institution && institution !== 'ALL') {
    list = list.filter(r => r.institutionName === institution);
  }

  if (includeDeleted) {
    list = list.filter(r => r.deletedAt !== null && r.deletedAt !== undefined);
  } else {
    list = list.filter(r => r.deletedAt === null || r.deletedAt === undefined);
  }

  return list.sort((a, b) => b.date.localeCompare(a.date));
};

export const saveReport = async (report: FinancialReport) => {
  await ensureAdminMasterInDb();

  const reportToSave: FinancialReport = {
    id: report.id,
    date: report.date,
    institutionName: report.institutionName,
    reporterName: report.reporterName,
    userId: report.userId || ADMIN_MASTER_UUID,
    locked: !!report.locked,
    offers: safeNum(report.offers),
    specialOffers: safeNum(report.specialOffers),
    tithes: safeNum(report.tithes),
    financialRevenue: safeNum(report.financialRevenue),
    interestRevenue: safeNum(report.interestRevenue),
    rentRevenue: safeNum(report.rentRevenue),
    otherRevenues: report.otherRevenues || [],
    energy: safeNum(report.energy),
    water: safeNum(report.water),
    rent: safeNum(report.rent),
    internet: safeNum(report.internet),
    cleaning: safeNum(report.cleaning),
    maintenance: safeNum(report.maintenance),
    missions: safeNum(report.missions),
    social: safeNum(report.social),
    otherExpenses: report.otherExpenses || [],
    totalRevenue: safeNum(report.totalRevenue),
    totalFixedExpenses: safeNum(report.totalFixedExpenses),
    sedeExpense: safeNum(report.sedeExpense),
    prebendaExpense: safeNum(report.prebendaExpense),
    totalExpenses: safeNum(report.totalExpenses),
    saldoGU: safeNum(report.saldoGU),
    currentBalance: safeNum(report.currentBalance),
    previousBalance: safeNum(report.previousBalance),
    cashBalance: safeNum(report.cashBalance),
    pixBalance: safeNum(report.pixBalance),
    attachments: report.attachments || [],
    createdAt: report.createdAt || new Date().toISOString(),
    archived: !!report.archived,
    archiveMonth: report.archiveMonth,
    deletedAt: report.deletedAt,
    deletedBy: report.deletedBy,
    approvalStatus: report.approvalStatus || 'PENDENTE',
    approvedBy: report.approvedBy,
    approvedAt: report.approvedAt,
    rejectionReason: report.rejectionReason,
    emailSentToAdmin: report.emailSentToAdmin,
    emailSentAt: report.emailSentAt,
    noDiscount: !!report.noDiscount
  };

  let savedRemotely = false;
  // Remote DB save via API
  try {
    await apiFetch('/api/reports', {
      method: 'POST',
      body: JSON.stringify(reportToSave)
    });
    savedRemotely = true;
  } catch (err) {}

  // Direct Neon query fallback (Netlify)
  if (!savedRemotely) {
    try {
      await sql`
        INSERT INTO reports (
          id, date, institutionname, reportername, userid, locked,
          offers, specialoffers, tithes, financialrevenue, interestrevenue, rentrevenue, otherrevenues,
          energy, water, rent, internet, cleaning, maintenance, missions, social, otherexpenses,
          totalrevenue, totalfixedexpenses, sedeexpense, prebendaexpense, totalexpenses,
          saldogu, currentbalance, previousbalance, cashbalance, pixbalance, attachments,
          archived, archivemonth, deletedat, deletedby, approvalstatus, approvedby, approvedat, rejectionreason, emailsenttoadmin, emailsentat, nodiscount
        ) VALUES (
          ${reportToSave.id}, ${reportToSave.date}, ${reportToSave.institutionName}, ${reportToSave.reporterName}, ${reportToSave.userId}, ${reportToSave.locked},
          ${reportToSave.offers}, ${reportToSave.specialOffers}, ${reportToSave.tithes}, ${reportToSave.financialRevenue}, ${reportToSave.interestRevenue}, ${reportToSave.rentRevenue}, ${JSON.stringify(reportToSave.otherRevenues)},
          ${reportToSave.energy}, ${reportToSave.water}, ${reportToSave.rent}, ${reportToSave.internet}, ${reportToSave.cleaning}, ${reportToSave.maintenance}, ${reportToSave.missions}, ${reportToSave.social}, ${JSON.stringify(reportToSave.otherExpenses)},
          ${reportToSave.totalRevenue}, ${reportToSave.totalFixedExpenses}, ${reportToSave.sedeExpense}, ${reportToSave.prebendaExpense}, ${reportToSave.totalExpenses},
          ${reportToSave.saldoGU}, ${reportToSave.currentBalance}, ${reportToSave.previousBalance}, ${reportToSave.cashBalance}, ${reportToSave.pixBalance}, ${JSON.stringify(reportToSave.attachments)},
          ${reportToSave.archived ?? false}, ${reportToSave.archiveMonth || null}, ${reportToSave.deletedAt ? new Date(reportToSave.deletedAt).toISOString() : null}, ${reportToSave.deletedBy || null},
          ${reportToSave.approvalStatus || 'PENDENTE'}, ${reportToSave.approvedBy || null}, ${reportToSave.approvedAt ? new Date(reportToSave.approvedAt).toISOString() : null}, ${reportToSave.rejectionReason || null},
          ${reportToSave.emailSentToAdmin ?? false}, ${reportToSave.emailSentAt ? new Date(reportToSave.emailSentAt).toISOString() : null}, ${reportToSave.noDiscount ?? false}
        )
        ON CONFLICT (id) DO UPDATE SET
          date = EXCLUDED.date, institutionname = EXCLUDED.institutionname, reportername = EXCLUDED.reportername,
          locked = EXCLUDED.locked, offers = EXCLUDED.offers, specialoffers = EXCLUDED.specialoffers,
          tithes = EXCLUDED.tithes, financialrevenue = EXCLUDED.financialrevenue, interestrevenue = EXCLUDED.interestrevenue,
          rentrevenue = EXCLUDED.rentrevenue, otherrevenues = EXCLUDED.otherrevenues, energy = EXCLUDED.energy,
          water = EXCLUDED.water, rent = EXCLUDED.rent, internet = EXCLUDED.internet, cleaning = EXCLUDED.cleaning,
          maintenance = EXCLUDED.maintenance, missions = EXCLUDED.missions, social = EXCLUDED.social,
          otherexpenses = EXCLUDED.otherexpenses, totalrevenue = EXCLUDED.totalrevenue, totalfixedexpenses = EXCLUDED.totalfixedexpenses,
          sedeexpense = EXCLUDED.sedeexpense, prebendaexpense = EXCLUDED.prebendaexpense, totalexpenses = EXCLUDED.totalexpenses,
          saldogu = EXCLUDED.saldogu, currentbalance = EXCLUDED.currentbalance, previousbalance = EXCLUDED.previousbalance,
          cashbalance = EXCLUDED.cashbalance, pixbalance = EXCLUDED.pixbalance, attachments = EXCLUDED.attachments,
          approvalstatus = EXCLUDED.approvalstatus, nodiscount = EXCLUDED.nodiscount
      `;
    } catch (directErr) {
      console.warn("Direct Neon saveReport error:", directErr);
    }
  }

  // Local cache update
  const reports = getLocalReports();
  const idx = reports.findIndex(r => r.id === report.id);
  if (idx > -1) {
    reports[idx] = reportToSave;
  } else {
    reports.push(reportToSave);
  }

  saveLocalReports(reports);
  notifyUpdate('reports-updated');
};

export const updateReportLockStatus = async (id: string, locked: boolean) => {
  await apiFetch(`/api/reports/${id}/lock`, {
    method: 'PUT',
    body: JSON.stringify({ locked })
  });

  const reports = getLocalReports();
  const idx = reports.findIndex(r => r.id === id);
  if (idx > -1) {
    reports[idx].locked = locked;
    saveLocalReports(reports);
  }
  notifyUpdate('reports-updated');
};

export const updateReportApprovalStatus = async (
  id: string,
  status: 'APROVADO' | 'REJEITADO' | 'PENDENTE',
  approvedBy?: string,
  rejectionReason?: string
) => {
  await apiFetch(`/api/reports/${id}/approval`, {
    method: 'PUT',
    body: JSON.stringify({ status, approvedBy, rejectionReason })
  });

  const reports = getLocalReports();
  const idx = reports.findIndex(r => r.id === id);
  if (idx > -1) {
    reports[idx].approvalStatus = status;
    if (status === 'APROVADO') {
      reports[idx].locked = true;
      reports[idx].approvedBy = approvedBy || 'ADMIN';
      reports[idx].approvedAt = new Date().toISOString();
      reports[idx].rejectionReason = undefined;
    } else if (status === 'REJEITADO') {
      reports[idx].locked = false;
      reports[idx].rejectionReason = rejectionReason || 'Solicitado ajustes pelo ADM';
    } else {
      reports[idx].locked = false;
    }
    saveLocalReports(reports);
  }
  notifyUpdate('reports-updated');
};

export const deleteReport = async (id: string, userId: string) => {
  await apiFetch(`/api/reports/${id}?userId=${encodeURIComponent(userId)}`, {
    method: 'DELETE'
  });

  const reports = getLocalReports();
  const idx = reports.findIndex(r => r.id === id);
  if (idx > -1) {
    reports[idx].deletedAt = new Date().toISOString();
    reports[idx].deletedBy = userId;
    saveLocalReports(reports);
  }
  notifyUpdate('reports-updated');
};

export const restoreReport = async (id: string) => {
  await apiFetch(`/api/reports/${id}/restore`, {
    method: 'POST'
  });

  const reports = getLocalReports();
  const idx = reports.findIndex(r => r.id === id);
  if (idx > -1) {
    reports[idx].deletedAt = undefined;
    reports[idx].deletedBy = undefined;
    saveLocalReports(reports);
  }
  notifyUpdate('reports-updated');
};

export const deleteReportPermanently = async (id: string) => {
  await apiFetch(`/api/reports/${id}/permanent`, {
    method: 'DELETE'
  });

  let reports = getLocalReports();
  reports = reports.filter(r => r.id !== id);
  saveLocalReports(reports);
  notifyUpdate('reports-updated');
};

export const archiveReportsByMonth = async (month: string, year: string, institutionName?: string) => {
  await apiFetch('/api/reports/archive', {
    method: 'POST',
    body: JSON.stringify({ month, year, institutionName })
  });

  const archiveLabel = `${month}/${year}`;
  const reports = getLocalReports();

  reports.forEach(r => {
    if (r.date && !r.deletedAt) {
      const parts = r.date.split('-');
      const rYear = parts[0];
      const rMonth = parts[1];

      if (rYear === year && rMonth === month) {
        if (!institutionName || institutionName === 'ALL' || r.institutionName === institutionName) {
          r.archived = true;
          r.archiveMonth = archiveLabel;
          r.locked = true;
        }
      }
    }
  });

  saveLocalReports(reports);
  notifyUpdate('reports-updated');
};

// ---------------- TRANSACTIONS ----------------
export const getTransactions = async (institution?: string): Promise<DailyTransaction[]> => {
  const query = institution ? `?institution=${encodeURIComponent(institution)}` : '';
  try {
    const apiRes = await apiFetch<DailyTransaction[]>(`/api/transactions${query}`);
    if (apiRes && Array.isArray(apiRes)) {
      if (!institution || institution === 'ALL') {
        saveLocalTransactions(apiRes);
      }
      return apiRes;
    }
  } catch (err) {
    console.warn("API getTransactions fallback:", err);
  }

  await ensureAdminMasterInDb();
  let list = getLocalTransactions();

  if (institution && institution !== 'ALL') {
    list = list.filter(t => t.institutionName === institution);
  }

  list = list.filter(t => !(t as any).deletedAt);
  return list.sort((a, b) => b.date.localeCompare(a.date));
};

export const saveTransaction = async (tx: DailyTransaction) => {
  await ensureAdminMasterInDb();

  const txToSave: DailyTransaction = {
    id: tx.id,
    type: tx.type,
    date: tx.date,
    status: tx.status,
    value: safeNum(tx.value),
    description: tx.description,
    category: tx.category,
    paymentMethod: tx.paymentMethod || 'DINHEIRO',
    institutionName: tx.institutionName,
    userId: tx.userId || ADMIN_MASTER_UUID,
    titherName: tx.titherName,
    createdAt: tx.createdAt || new Date().toISOString()
  };

  await apiFetch('/api/transactions', {
    method: 'POST',
    body: JSON.stringify(txToSave)
  });

  const txs = getLocalTransactions();
  const idx = txs.findIndex(t => t.id === tx.id);
  if (idx > -1) {
    txs[idx] = txToSave;
  } else {
    txs.push(txToSave);
  }

  saveLocalTransactions(txs);
  notifyUpdate('transactions-updated');
};

export const deleteTransaction = async (id: string) => {
  await apiFetch(`/api/transactions/${id}`, {
    method: 'DELETE'
  });

  const txs = getLocalTransactions();
  const idx = txs.findIndex(t => t.id === id);
  if (idx > -1) {
    (txs[idx] as any).deletedAt = new Date().toISOString();
    saveLocalTransactions(txs);
  }
  notifyUpdate('transactions-updated');
};

export const getDeletedTransactions = async (): Promise<DailyTransaction[]> => {
  try {
    const apiRes = await apiFetch<DailyTransaction[]>('/api/transactions/deleted');
    if (apiRes && Array.isArray(apiRes)) {
      return apiRes;
    }
  } catch (err) {
    console.warn("API getDeletedTransactions fallback:", err);
  }

  const txs = getLocalTransactions();
  const deleted = txs.filter(t => !!(t as any).deletedAt);
  return deleted.sort((a, b) => b.date.localeCompare(a.date));
};

export const restoreTransaction = async (id: string) => {
  await apiFetch(`/api/transactions/${id}/restore`, {
    method: 'POST'
  });

  const txs = getLocalTransactions();
  const idx = txs.findIndex(t => t.id === id);
  if (idx > -1) {
    delete (txs[idx] as any).deletedAt;
    saveLocalTransactions(txs);
  }
  notifyUpdate('transactions-updated');
};

export const deleteTransactionPermanently = async (id: string) => {
  await apiFetch(`/api/transactions/${id}/permanent`, {
    method: 'DELETE'
  });

  let txs = getLocalTransactions();
  txs = txs.filter(t => t.id !== id);
  saveLocalTransactions(txs);
  notifyUpdate('transactions-updated');
};

export const isCompetenceLocked = (_reportDate: string, _closingDay: number): boolean => {
  return false;
};

// ---------------- RECEIPTS ----------------
export const getReceipts = async (institutionName?: string): Promise<ReceiptRecord[]> => {
  const query = institutionName ? `?institution=${encodeURIComponent(institutionName)}` : '';
  try {
    const apiRes = await apiFetch<ReceiptRecord[]>(`/api/receipts${query}`);
    if (apiRes && Array.isArray(apiRes)) {
      try {
        localStorage.setItem(STORAGE_KEYS.RECEIPTS, JSON.stringify(apiRes));
      } catch {}
      return apiRes;
    }
  } catch (err) {
    console.warn("API getReceipts fallback:", err);
  }

  try {
    const data = localStorage.getItem(STORAGE_KEYS.RECEIPTS);
    let list: ReceiptRecord[] = data ? JSON.parse(data) : [];
    if (institutionName && institutionName !== 'ALL') {
      list = list.filter(r => r.institutionName === institutionName);
    }
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch (e) {
    console.error("Erro ao carregar recibos:", e);
    return [];
  }
};

export const saveReceipt = async (receipt: ReceiptRecord) => {
  await apiFetch('/api/receipts', {
    method: 'POST',
    body: JSON.stringify(receipt)
  });

  try {
    const list = await getReceipts();
    const idx = list.findIndex(r => r.id === receipt.id);
    if (idx > -1) {
      list[idx] = receipt;
    } else {
      list.unshift(receipt);
    }
    localStorage.setItem(STORAGE_KEYS.RECEIPTS, JSON.stringify(list));
    notifyUpdate('receipts-updated');
  } catch (e) {
    console.error("Erro ao salvar recibo:", e);
    throw e;
  }
};

export const deleteReceipt = async (id: string) => {
  await apiFetch(`/api/receipts/${id}`, {
    method: 'DELETE'
  });

  try {
    const list = await getReceipts();
    const filtered = list.filter(r => r.id !== id);
    localStorage.setItem(STORAGE_KEYS.RECEIPTS, JSON.stringify(filtered));
    notifyUpdate('receipts-updated');
  } catch (e) {
    console.error("Erro ao excluir recibo:", e);
  }
};

// ---------------- DATABASE SYNC & SEED UTILS ----------------
export const syncAllLocalDataToDatabase = async () => {
  const users = getLocalUsers();
  const reports = getLocalReports();
  const transactions = getLocalTransactions();
  let receipts: ReceiptRecord[] = [];
  try {
    const recData = localStorage.getItem(STORAGE_KEYS.RECEIPTS);
    if (recData) receipts = JSON.parse(recData);
  } catch {}
  let settings: any = null;
  try {
    const sData = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (sData) settings = JSON.parse(sData);
  } catch {}

  const result = await apiFetch<{ success: boolean; synced: any }>('/api/db/sync-all', {
    method: 'POST',
    body: JSON.stringify({ users, reports, transactions, receipts, settings })
  });

  notifyUpdate('reports-updated');
  notifyUpdate('users-updated');
  notifyUpdate('transactions-updated');
  notifyUpdate('receipts-updated');
  notifyUpdate('settings-updated');

  return result;
};

export const seedSampleDataToDatabase = async () => {
  const result = await apiFetch<{ success: boolean; message: string }>('/api/db/seed-sample', {
    method: 'POST'
  });

  notifyUpdate('reports-updated');
  notifyUpdate('transactions-updated');

  return result;
};

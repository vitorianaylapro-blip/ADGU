import { FinancialReport, UserAccount, DailyTransaction, ReceiptRecord } from '../types';

export interface SystemSettings {
  logo?: string;
  institutionName: string;
  cnpj: string;
  address: string;
  email: string;
  president: string;
  treasurerName?: string;
  treasurerRole?: string;
  pastorName?: string;
  pastorRole?: string;
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

// API request helper with automatic JSON handling
async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {})
    }
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `API request to ${url} failed with status ${res.status}`);
  }
  return await res.json();
}

// ---------------- DATABASE STATUS ----------------
export const getDatabaseStatus = async () => {
  try {
    const data = await apiFetch<{ status: string; provider: string; counts: any }>('/api/db/status');
    return data || { status: 'offline', provider: 'Local Storage', counts: {} };
  } catch (err) {
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
  // Try remote PostgreSQL API first
  try {
    const apiRes = await apiFetch<UserAccount>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    return apiRes;
  } catch (err: any) {
    console.warn("API Login failed, trying local fallback:", err.message);
    // If it's a 401, the user is wrong, not the database.
    if (err.message.includes('401')) {
      return null;
    }
  }

  // Fallback to local storage
  await ensureAdminMasterInDb();
  const users = getLocalUsers();
  const userClean = username.toLowerCase().trim();
  const found = users.find(u => u.username.toLowerCase().trim() === userClean && u.active);
  if (found && found.password === password) {
    return { ...found, password: '' };
  }

  return null;
};

export const getUserByUsername = async (username: string): Promise<UserAccount | null> => {
  const apiRes = await apiFetch<UserAccount>(`/api/auth/user/${encodeURIComponent(username)}`);
  if (apiRes && apiRes.id) {
    return apiRes;
  }

  await ensureAdminMasterInDb();
  const users = getLocalUsers();
  const userClean = username.toLowerCase().trim();
  const found = users.find(u => u.username.toLowerCase().trim() === userClean && u.active);
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
  } catch (err) {
    console.warn("API getUsers fallback:", err);
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

  // Save to PostgreSQL via API
  await apiFetch('/api/users', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

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
  await apiFetch(`/api/users/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ active })
  });

  const users = getLocalUsers();
  const idx = users.findIndex(u => u.id === id);
  if (idx > -1) {
    users[idx].active = active;
    saveLocalUsers(users);
  }
  notifyUpdate('users-updated');
};

export const deleteUser = async (id: string) => {
  await apiFetch(`/api/users/${id}`, {
    method: 'DELETE'
  });

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
  } catch (err) {
    console.warn("API getSettings fallback:", err);
  }

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
        pastorName: 'Pr. Antônio Chaves Crus',
        pastorRole: 'Pastor Presidente / Dirigente',
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
    pastorName: 'Pr. Antônio Chaves Crus',
    pastorRole: 'Pastor Presidente / Dirigente',
    closingDay: 1
  };
};

export const saveSettings = async (settings: SystemSettings) => {
  await apiFetch('/api/settings', {
    method: 'POST',
    body: JSON.stringify(settings)
  });

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
  } catch (err) {
    console.warn("API getReports fallback:", err);
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

  // Remote DB save
  await apiFetch('/api/reports', {
    method: 'POST',
    body: JSON.stringify(reportToSave)
  });

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

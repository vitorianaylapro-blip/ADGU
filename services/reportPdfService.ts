import { jsPDF } from 'jspdf';
import { DailyTransaction, FinancialReport, MiscItem, UserAccount } from '../types';

export interface SystemSettings {
  institutionName?: string;
  cnpj?: string;
  address?: string;
  email?: string;
  logo?: string;
  treasurerName?: string;
  treasurerRole?: string;
  treasurerSignature?: string;
  treasurerSignatureType?: 'UPLOADED' | 'GOV_BR';
  pastorName?: string;
  pastorRole?: string;
  president?: string;
  [key: string]: any;
}

export interface ConsolidatedLineItem {
  label: string;
  value: number;
}

export interface ConsolidatedReportResult {
  institutionTitle: string;
  cnpj: string;
  president: string;
  competence: string;
  revenueItems: ConsolidatedLineItem[];
  expenseItems: ConsolidatedLineItem[];
  totalRevenue: number;
  totalExpense: number;
  surplusOrDeficit: number;
  isMathVerified: boolean;
}

export interface OfficialReportPDFData {
  institutionName: string;
  dateLabel: string;
  reportDate?: string; // Exact weekly date YYYY-MM-DD or DD/MM/AAAA
  reporterName: string;
  tithes: number;
  offers: number;
  specialOffers: number;
  financialRevenue: number;
  interestRevenue?: number;
  rentRevenue?: number;
  otherRevenues?: MiscItem[];
  totalRevenue: number;
  sedeExpense: number;
  prebendaExpense: number;
  rent: number;
  energy: number;
  water: number;
  internet: number;
  cleaning: number;
  maintenance: number;
  missions: number;
  social: number;
  otherExpenses?: MiscItem[];
  totalFixedExpenses: number;
  previousBalance: number;
  saldoGU: number;
  currentBalance: number;
  cashBalance?: number;
  pixBalance?: number;
  isCamposBelos?: boolean;
  noDiscount?: boolean;
  consolidatedData?: ConsolidatedReportResult;
}

export const formatDateBR = (val?: string): string => {
  if (!val) return '';
  const clean = val.trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(clean)) return clean;
  if (/^\d{4}-\d{2}-\d{2}/.test(clean)) {
    const parts = clean.slice(0, 10).split('-');
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return clean;
};

export const getCompetenceFromDate = (val?: string): string => {
  if (!val) return '';
  const clean = val.trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(clean)) {
    const parts = clean.split('/');
    return `${parts[1]}/${parts[2]}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(clean)) {
    const parts = clean.slice(0, 10).split('-');
    return `${parts[1]}/${parts[0]}`;
  }
  return clean;
};

export const formatBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    Math.abs(v) < 0.005 ? 0 : v
  );

export const roundCents = (v: number): number => {
  const n = Number(v);
  if (isNaN(n) || !isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
};

export const normalizeCategoryText = (s: string): string =>
  (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();

export const BASE_REVENUE_CATEGORIES = [
  'RECEITA',
  'DÍZIMOS',
  'OFERTAS',
  'OFERTAS ESPECIAIS',
] as const;

export const BASE_EXPENSE_CATEGORIES = [
  'REPASSE SEDE (20%)',
  'PREBENDA MINISTERIAL (20%)',
  'AJUDA MISSIONÁRIA',
  'ALUGUEL',
  'ÁGUA',
  'ENERGIA',
  'ÁGUA E COPOS',
  'MATERIAL DE LIMPEZA',
  'SANTA CEIA',
  'GASOLINA',
  'MATERIAL SECRETARIA/TESOURARIA',
  'OUTRAS DESPESAS MINISTERIAIS',
] as const;

/**
 * Verifica se uma receita corresponde a Repasse Sede recebido da Sede Administrativa.
 * Regra: Quando incluir nova categoria de receita com nome "REPASSE SEDE",
 * NÃO é tirado porcentagem desse valor (0% de Repasse Sede e 0% de Prebenda Ministerial).
 */
export function isSedeTransferRevenue(categoryOrDesc: string): boolean {
  const norm = normalizeCategoryText(categoryOrDesc);
  if (!norm) return false;
  return (
    norm === 'REPASSE SEDE' ||
    norm === 'REPASSE DA SEDE' ||
    norm === 'REPASSE DE SEDE' ||
    norm === 'CREDITO SEDE' ||
    norm === 'CREDITO DA SEDE' ||
    norm === 'TRANSFERENCIA SEDE' ||
    norm === 'TRANSFERENCIA DA SEDE' ||
    norm === 'REPASSE SEDE ADMINISTRATIVA' ||
    norm === 'REPASSE ADMINISTRATIVO' ||
    norm.includes('REPASSE SEDE') ||
    norm.includes('REPASSE DA SEDE') ||
    norm.includes('CREDITO SEDE') ||
    norm.includes('TRANSFERENCIA SEDE')
  );
}

export function classifyRevenueCategory(rawCategoryOrDesc: string): string {
  if (isSedeTransferRevenue(rawCategoryOrDesc)) {
    return 'REPASSE SEDE';
  }
  const norm = normalizeCategoryText(rawCategoryOrDesc);
  if (
    !norm ||
    norm === 'RECEITA' ||
    norm === 'GERAL' ||
    norm === 'RECEITA FINANCEIRA' ||
    norm === 'RECEITAS FINANCEIRAS' ||
    norm === 'RENDIMENTOS' ||
    norm === 'RENDIMENTOS BANCARIOS' ||
    norm === 'ALUGUEIS' ||
    norm === 'ALUGUEIS / CESSAO' ||
    norm === 'OUTRA RECEITA' ||
    norm === 'OUTRAS RECEITAS' ||
    norm === 'OUTRAS ENTRADAS'
  ) {
    return 'RECEITA';
  }
  if (norm === 'DIZIMO' || norm === 'DIZIMOS') {
    return 'DÍZIMOS';
  }
  if (norm === 'OFERTA' || norm === 'OFERTAS' || norm === 'OFERTAS GERAIS' || norm === 'OFERTA GERAL') {
    return 'OFERTAS';
  }
  if (
    norm === 'OFERTA ESPECIAL' ||
    norm === 'OFERTAS ESPECIAIS' ||
    norm === 'OFERTA DE MISSOES'
  ) {
    return 'OFERTAS ESPECIAIS';
  }
  return rawCategoryOrDesc.trim().toUpperCase();
}

export function classifyExpenseCategory(rawCategoryOrDesc: string): string {
  const norm = normalizeCategoryText(rawCategoryOrDesc);
  if (
    norm === 'REPASSE SEDE (20%)' ||
    norm === 'REPASSE SEDE' ||
    norm === 'SEDE' ||
    norm === 'SEDE ADMINISTRATIVA' ||
    norm === 'SEDE (20%)'
  ) {
    return 'REPASSE SEDE (20%)';
  }
  if (
    norm === 'PREBENDA MINISTERIAL (20%)' ||
    norm === 'PREBENDA MINISTERIAL' ||
    norm === 'PREBENDA PASTORAL' ||
    norm === 'PREBENDA' ||
    norm === 'PREBENDA (20%)'
  ) {
    return 'PREBENDA MINISTERIAL (20%)';
  }
  if (
    norm === 'AJUDA MISSIONARIA' ||
    norm === 'MISSOES' ||
    norm === 'MISSAO' ||
    norm === 'OFERTA MISSOES' ||
    norm === 'OFERTA DE MISSOES'
  ) {
    return 'AJUDA MISSIONÁRIA';
  }
  if (norm === 'ALUGUEL' || norm === 'ALUGUEL DO PREDIO') {
    return 'ALUGUEL';
  }
  if (
    norm === 'AGUA E COPOS' ||
    norm === 'AGUA MINERAL' ||
    norm === 'COPOS' ||
    norm === 'COPOS DESCARTAVEIS' ||
    norm === 'GARRAFAO' ||
    norm === 'GARRAFAO DE AGUA'
  ) {
    return 'ÁGUA E COPOS';
  }
  if (norm === 'AGUA' || norm === 'AGUA E ESGOTO' || norm === 'CAGECE' || norm === 'SANEAMENTO') {
    return 'ÁGUA';
  }
  if (
    norm === 'ENERGIA' ||
    norm === 'ENERGIA ELETRICA' ||
    norm === 'LUZ' ||
    norm === 'ENEL' ||
    norm === 'FORCA'
  ) {
    return 'ENERGIA';
  }
  if (
    norm === 'MATERIAL DE LIMPEZA' ||
    norm === 'LIMPEZA' ||
    norm === 'PRODUTOS DE LIMPEZA'
  ) {
    return 'MATERIAL DE LIMPEZA';
  }
  if (norm === 'SANTA CEIA' || norm === 'CEIA' || norm === 'ELEMENTOS SANTA CEIA') {
    return 'SANTA CEIA';
  }
  if (norm === 'GASOLINA' || norm === 'COMBUSTIVEL') {
    return 'GASOLINA';
  }
  if (
    norm === 'MATERIAL SECRETARIA/TESOURARIA' ||
    norm === 'MATERIAL DE SECRETARIA' ||
    norm === 'MATERIAL DE TESOURARIA' ||
    norm === 'SECRETARIA' ||
    norm === 'TESOURARIA' ||
    norm === 'EXPEDIENTE' ||
    norm === 'MATERIAL DE EXPEDIENTE'
  ) {
    return 'MATERIAL SECRETARIA/TESOURARIA';
  }
  if (
    norm === 'OUTRAS DESPESAS MINISTERIAIS' ||
    norm === 'DESPESAS MINISTERIAIS' ||
    norm === 'OUTRAS DESPESAS' ||
    norm === 'DIVERSOS'
  ) {
    return 'OUTRAS DESPESAS MINISTERIAIS';
  }
  if (norm === 'INTERNET' || norm === 'WIFI' || norm === 'TELEFONIA') {
    return 'INTERNET';
  }
  if (norm === 'MANUTENCAO' || norm === 'REFORMAS' || norm === 'CONSERTOS') {
    return 'MANUTENÇÃO';
  }
  if (norm === 'ASSISTENCIA SOCIAL' || norm === 'SOCIAL' || norm === 'CESTA BASICA') {
    return 'ASSISTÊNCIA SOCIAL';
  }
  return rawCategoryOrDesc.trim().toUpperCase();
}

export function isReportExemptFromDiscount(report: FinancialReport, users?: UserAccount[]): boolean {
  if (report.noDiscount) return true;
  const unit = normalizeCategoryText(report.institutionName || '');
  if (unit.includes('CAMPOS BELOS') || unit.includes('CAMPOSBELOS')) return true;
  if (users && report.userId) {
    const user = users.find((u) => u.id === report.userId);
    if (user && (user.role === 'DEPT_TREASURER' || user.noDiscount)) return true;
  }
  return false;
}

/**
 * Motor de Consolidação Financeira Geral (EXCLUSIVO DO ADMINISTRADOR).
 * Agrupa todos os relatórios e transações da competência em APENAS UM
 * Relatório Financeiro Geral Consolidado com RECEITA, DESPESAS e SUPERÁVIT OU DÉFICIT.
 */
export function consolidateFinancialData(params: {
  reports: FinancialReport[];
  transactions: DailyTransaction[];
  competenceLabel?: string;
  settings?: Partial<SystemSettings> | null;
  users?: UserAccount[];
}): ConsolidatedReportResult {
  const { reports, transactions, competenceLabel, settings, users } = params;

  const revenueMap = new Map<string, number>();
  const expenseMap = new Map<string, number>();

  for (const cat of BASE_REVENUE_CATEGORIES) {
    revenueMap.set(cat, 0);
  }
  for (const cat of BASE_EXPENSE_CATEGORIES) {
    expenseMap.set(cat, 0);
  }

  const addRevenue = (catName: string, amount: number) => {
    const val = roundCents(amount);
    if (val <= 0) return;
    const key = classifyRevenueCategory(catName);
    revenueMap.set(key, roundCents((revenueMap.get(key) || 0) + val));
  };

  const addExpense = (catName: string, amount: number) => {
    const val = roundCents(amount);
    if (val <= 0) return;
    const key = classifyExpenseCategory(catName);
    expenseMap.set(key, roundCents((expenseMap.get(key) || 0) + val));
  };

  const embeddedTxIds = new Set<string>();
  const seenReportIds = new Set<string>();
  const uniqueReports: FinancialReport[] = [];

  for (const r of reports) {
    if (!r || r.deletedAt) continue;
    if (seenReportIds.has(r.id)) continue;
    seenReportIds.add(r.id);
    uniqueReports.push(r);
  }

  const reportedUnitMonths = new Map<
    string,
    {
      hasTithes: boolean;
      hasOffers: boolean;
      hasSpecialOffers: boolean;
      hasFinRev: boolean;
      hasRent: boolean;
      hasWater: boolean;
      hasEnergy: boolean;
      hasCleaning: boolean;
      hasMissions: boolean;
      hasInternet: boolean;
      hasMaintenance: boolean;
      hasSocial: boolean;
    }
  >();

  for (const r of uniqueReports) {
    const unitKey = `${normalizeCategoryText(r.institutionName || '')}__${(r.date || '').slice(0, 7)}`;
    const prev = reportedUnitMonths.get(unitKey) || {
      hasTithes: false,
      hasOffers: false,
      hasSpecialOffers: false,
      hasFinRev: false,
      hasRent: false,
      hasWater: false,
      hasEnergy: false,
      hasCleaning: false,
      hasMissions: false,
      hasInternet: false,
      hasMaintenance: false,
      hasSocial: false,
    };

    const tithesVal = roundCents(r.tithes);
    const offersVal = roundCents(r.offers);
    const specialVal = roundCents(r.specialOffers);
    const finRevVal =
      roundCents(r.financialRevenue) ||
      roundCents((Number(r.interestRevenue) || 0) + (Number(r.rentRevenue) || 0));

    addRevenue('DÍZIMOS', tithesVal);
    addRevenue('OFERTAS', offersVal);
    addRevenue('OFERTAS ESPECIAIS', specialVal);
    addRevenue('RECEITA', finRevVal);

    if (tithesVal > 0) prev.hasTithes = true;
    if (offersVal > 0) prev.hasOffers = true;
    if (specialVal > 0) prev.hasSpecialOffers = true;
    if (finRevVal > 0) prev.hasFinRev = true;

    for (const item of r.otherRevenues || []) {
      if (!item) continue;
      if (item.id) embeddedTxIds.add(item.id);
      addRevenue(item.description || 'RECEITA', item.value);
    }

    const noDisc = isReportExemptFromDiscount(r, users);
    if (!noDisc) {
      // Repasse Sede revenue is EXEMPT from 20% Sede and 20% Prebenda deduction!
      const sedeTransferInReport = (r.otherRevenues || [])
        .filter((it) => isSedeTransferRevenue(it.description || ''))
        .reduce((sum, it) => sum + (Number(it.value) || 0), 0);

      let effectiveSedeExpense = roundCents(r.sedeExpense);
      let effectivePrebendaExpense = roundCents(r.prebendaExpense);

      if (sedeTransferInReport > 0) {
        const discountableRev = Math.max(0, (Number(r.totalRevenue) || 0) - sedeTransferInReport);
        const maxAllowedExpense = roundCents(discountableRev * 0.2);
        if (effectiveSedeExpense > maxAllowedExpense) {
          effectiveSedeExpense = maxAllowedExpense;
        }
        if (effectivePrebendaExpense > maxAllowedExpense) {
          effectivePrebendaExpense = maxAllowedExpense;
        }
      }

      addExpense('REPASSE SEDE (20%)', effectiveSedeExpense);
      addExpense('PREBENDA MINISTERIAL (20%)', effectivePrebendaExpense);
    }

    const missionsVal = roundCents(r.missions);
    const rentVal = roundCents(r.rent);
    const waterVal = roundCents(r.water);
    const energyVal = roundCents(r.energy);
    const cleaningVal = roundCents(r.cleaning);
    const internetVal = roundCents(r.internet);
    const maintenanceVal = roundCents(r.maintenance);
    const socialVal = roundCents(r.social);

    addExpense('AJUDA MISSIONÁRIA', missionsVal);
    addExpense('ALUGUEL', rentVal);
    addExpense('ÁGUA', waterVal);
    addExpense('ENERGIA', energyVal);
    addExpense('MATERIAL DE LIMPEZA', cleaningVal);

    if (internetVal > 0) addExpense('INTERNET', internetVal);
    if (maintenanceVal > 0) addExpense('MANUTENÇÃO', maintenanceVal);
    if (socialVal > 0) addExpense('ASSISTÊNCIA SOCIAL', socialVal);

    if (missionsVal > 0) prev.hasMissions = true;
    if (rentVal > 0) prev.hasRent = true;
    if (waterVal > 0) prev.hasWater = true;
    if (energyVal > 0) prev.hasEnergy = true;
    if (cleaningVal > 0) prev.hasCleaning = true;
    if (internetVal > 0) prev.hasInternet = true;
    if (maintenanceVal > 0) prev.hasMaintenance = true;
    if (socialVal > 0) prev.hasSocial = true;

    for (const item of r.otherExpenses || []) {
      if (!item) continue;
      if (item.id) embeddedTxIds.add(item.id);
      addExpense(item.description || 'OUTRAS DESPESAS MINISTERIAIS', item.value);
    }

    reportedUnitMonths.set(unitKey, prev);
  }

  // Process standalone transactions not embedded in reports
  const seenTxIds = new Set<string>();
  for (const tx of transactions) {
    if (!tx || (tx as any).deletedAt || tx.status === 'AGENDADO') continue;
    if (seenTxIds.has(tx.id) || embeddedTxIds.has(tx.id)) continue;
    seenTxIds.add(tx.id);

    const txMonth = (tx.date || '').slice(0, 7);
    const unitKey = `${normalizeCategoryText(tx.institutionName || '')}__${txMonth}`;
    const unitReportState = reportedUnitMonths.get(unitKey);

    const rawCat = tx.category || tx.description || '';
    const canonical = tx.type === 'RECEITA' ? classifyRevenueCategory(rawCat) : classifyExpenseCategory(rawCat);

    if (tx.type === 'RECEITA') {
      if (unitReportState) {
        if (canonical === 'DÍZIMOS' && unitReportState.hasTithes) continue;
        if (canonical === 'OFERTAS' && unitReportState.hasOffers) continue;
        if (canonical === 'OFERTAS ESPECIAIS' && unitReportState.hasSpecialOffers) continue;
        if (canonical === 'RECEITA' && unitReportState.hasFinRev) continue;
      }
      addRevenue(rawCat, tx.value);
    } else {
      if (unitReportState) {
        if (canonical === 'AJUDA MISSIONÁRIA' && unitReportState.hasMissions) continue;
        if (canonical === 'ALUGUEL' && unitReportState.hasRent) continue;
        if (canonical === 'ÁGUA' && unitReportState.hasWater) continue;
        if (canonical === 'ENERGIA' && unitReportState.hasEnergy) continue;
        if (canonical === 'MATERIAL DE LIMPEZA' && unitReportState.hasCleaning) continue;
        if (canonical === 'INTERNET' && unitReportState.hasInternet) continue;
        if (canonical === 'MANUTENÇÃO' && unitReportState.hasMaintenance) continue;
        if (canonical === 'ASSISTÊNCIA SOCIAL' && unitReportState.hasSocial) continue;
      }
      addExpense(rawCat, tx.value);
    }
  }

  const revenueItems: ConsolidatedLineItem[] = Array.from(revenueMap.entries()).map(
    ([label, value]) => ({
      label,
      value: roundCents(value),
    })
  );

  const expenseItems: ConsolidatedLineItem[] = Array.from(expenseMap.entries()).map(
    ([label, value]) => ({
      label,
      value: roundCents(value),
    })
  );

  const totalRevenue = roundCents(
    revenueItems.reduce((sum, item) => roundCents(sum + item.value), 0)
  );
  const totalExpense = roundCents(
    expenseItems.reduce((sum, item) => roundCents(sum + item.value), 0)
  );
  const surplusOrDeficit = roundCents(totalRevenue - totalExpense);

  const recomputedRev = roundCents(revenueItems.reduce((s, i) => s + i.value, 0));
  const recomputedExp = roundCents(expenseItems.reduce((s, i) => s + i.value, 0));
  const isMathVerified =
    Math.abs(recomputedRev - totalRevenue) < 0.001 &&
    Math.abs(recomputedExp - totalExpense) < 0.001 &&
    Math.abs(roundCents(recomputedRev - recomputedExp) - surplusOrDeficit) < 0.001;

  return {
    institutionTitle: (
      settings?.institutionName || 'ASSEMBLEIA DE DEUS GERAÇÃO UNIDA'
    ).toUpperCase(),
    cnpj: settings?.cnpj || '49.386.673/0001-10',
    president: settings?.president || settings?.pastorName || 'Pr. Antônio Chaves Crus',
    competence: competenceLabel || 'GERAL',
    revenueItems,
    expenseItems,
    totalRevenue,
    totalExpense,
    surplusOrDeficit,
    isMathVerified,
  };
}

export function convertLegacyReportToConsolidated(
  report: OfficialReportPDFData,
  settings?: Partial<SystemSettings> | null
): ConsolidatedReportResult {
  if (report.consolidatedData) {
    return {
      ...report.consolidatedData,
      institutionTitle: (
        settings?.institutionName ||
        report.consolidatedData.institutionTitle ||
        'ASSEMBLEIA DE DEUS GERAÇÃO UNIDA'
      ).toUpperCase(),
      cnpj: settings?.cnpj || report.consolidatedData.cnpj || '49.386.673/0001-10',
      president:
        settings?.president ||
        settings?.pastorName ||
        report.consolidatedData.president ||
        'Pr. Antônio Chaves Crus',
    };
  }

  const pseudoReport: FinancialReport = {
    id: 'single-or-consolidated',
    date: report.dateLabel || '',
    institutionName: report.institutionName || 'CONSOLIDADO GERAL',
    reporterName: report.reporterName || '',
    userId: '',
    locked: false,
    tithes: report.tithes || 0,
    offers: report.offers || 0,
    specialOffers: report.specialOffers || 0,
    financialRevenue: report.financialRevenue || 0,
    interestRevenue: 0,
    rentRevenue: 0,
    otherRevenues: report.otherRevenues || [],
    rent: report.rent || 0,
    energy: report.energy || 0,
    water: report.water || 0,
    internet: report.internet || 0,
    cleaning: report.cleaning || 0,
    maintenance: report.maintenance || 0,
    missions: report.missions || 0,
    social: report.social || 0,
    otherExpenses: report.otherExpenses || [],
    totalRevenue: report.totalRevenue || 0,
    totalFixedExpenses: report.totalFixedExpenses || 0,
    sedeExpense: report.sedeExpense || 0,
    prebendaExpense: report.prebendaExpense || 0,
    totalExpenses: (report.sedeExpense || 0) + (report.prebendaExpense || 0) + (report.totalFixedExpenses || 0),
    saldoGU: report.saldoGU || 0,
    currentBalance: report.currentBalance || 0,
    previousBalance: report.previousBalance || 0,
    cashBalance: 0,
    pixBalance: 0,
    attachments: [],
    createdAt: new Date().toISOString(),
    noDiscount: !!(report.noDiscount || report.isCamposBelos),
  };

  return consolidateFinancialData({
    reports: [pseudoReport],
    transactions: [],
    competenceLabel: report.dateLabel || 'GERAL',
    settings,
  });
}

export function formatConsolidatedReportText(data: ConsolidatedReportResult): string {
  const padDots = (label: string, valStr: string, totalWidth = 42) => {
    const cleanLabel = label.toUpperCase().trim();
    const dotsCount = Math.max(4, totalWidth - cleanLabel.length);
    const dots = '.'.repeat(dotsCount);
    return `${cleanLabel} ${dots} ${valStr}`;
  };

  const lines: string[] = [
    data.institutionTitle.toUpperCase(),
    '',
    `CNPJ: ${data.cnpj}`,
    `PR. PRESIDENTE: ${data.president}`,
    `COMPETÊNCIA: ${data.competence}`,
    '',
    'RECEITA',
    '',
    ...data.revenueItems.map((item) => padDots(item.label, formatBRL(item.value))),
    '',
    'DESPESAS',
    '',
    ...data.expenseItems.map((item) => padDots(item.label, formatBRL(item.value))),
    '',
    'RESUMO',
    '',
    padDots('RECEITA', formatBRL(data.totalRevenue)),
    padDots('DESPESA', formatBRL(data.totalExpense)),
    padDots('SUPERÁVIT OU DÉFICIT', formatBRL(data.surplusOrDeficit)),
  ];

  return lines.join('\n');
}

export function formatNormalReportText(
  data: OfficialReportPDFData,
  settings?: Partial<SystemSettings> | null
): string {
  const padDots = (label: string, valStr: string, totalWidth = 44) => {
    const cleanLabel = label.toUpperCase().trim();
    const dotsCount = Math.max(4, totalWidth - cleanLabel.length);
    const dots = '.'.repeat(dotsCount);
    return `${cleanLabel} ${dots} ${valStr}`;
  };

  const instTitle = (settings?.institutionName || 'ASSEMBLEIA DE DEUS GERAÇÃO UNIDA').toUpperCase();
  const president = settings?.president || settings?.pastorName || 'Pr. Antônio Chaves Crus';
  const cnpj = settings?.cnpj || '49.386.673/0001-10';

  const rawDate = data.reportDate || data.dateLabel || '';
  const dateFormatted = formatDateBR(rawDate) || 'N/D';
  const compFormatted = getCompetenceFromDate(rawDate) || data.dateLabel || 'GERAL';

  const isMonthly = isReportExemptFromDiscount(data as any) || data.noDiscount;
  const lines: string[] = [
    instTitle,
    isMonthly ? 'RELATÓRIO FINANCEIRO MENSAL' : 'RELATÓRIO FINANCEIRO SEMANAL',
    `CONGREGAÇÃO / UNIDADE: ${data.institutionName.toUpperCase()}`,
    `CNPJ: ${cnpj}`,
    `PR. PRESIDENTE: ${president}`,
    `TESOUREIRO / RESPONSÁVEL: ${data.reporterName.toUpperCase()}`,
    isMonthly ? `DATA DO RELATÓRIO (MENSAL): ${dateFormatted}` : `DATA DO RELATÓRIO (SEMANAL): ${dateFormatted}`,
    `COMPETÊNCIA: ${compFormatted}`,
    '',
    'ENTRADAS / RECEITAS',
    '',
    padDots('DÍZIMOS', formatBRL(data.tithes || 0)),
    padDots('OFERTAS', formatBRL(data.offers || 0)),
    padDots('OFERTAS ESPECIAIS', formatBRL(data.specialOffers || 0)),
  ];

  if ((data.financialRevenue || 0) > 0) {
    lines.push(padDots('RECEITA FINANCEIRA', formatBRL(data.financialRevenue)));
  }

  for (const item of data.otherRevenues || []) {
    if (!item || !item.value) continue;
    const isSede = isSedeTransferRevenue(item.description || '');
    const label = isSede ? `${item.description} (100% LÍQUIDO)` : item.description;
    lines.push(padDots(label, formatBRL(item.value)));
  }

  lines.push('');
  lines.push(padDots('TOTAL DE ENTRADAS', formatBRL(data.totalRevenue || 0)));
  lines.push('');
  lines.push('SAÍDAS / DESPESAS');
  lines.push('');

  if (!data.noDiscount && !data.isCamposBelos) {
    lines.push(padDots('REPASSE SEDE (20%)', formatBRL(data.sedeExpense || 0)));
    lines.push(padDots('PREBENDA MINISTERIAL (20%)', formatBRL(data.prebendaExpense || 0)));
  }
  if ((data.missions || 0) > 0) lines.push(padDots('AJUDA MISSIONÁRIA', formatBRL(data.missions)));
  if ((data.rent || 0) > 0) lines.push(padDots('ALUGUEL', formatBRL(data.rent)));
  if ((data.water || 0) > 0) lines.push(padDots('ÁGUA', formatBRL(data.water)));
  if ((data.energy || 0) > 0) lines.push(padDots('ENERGIA', formatBRL(data.energy)));
  if ((data.internet || 0) > 0) lines.push(padDots('INTERNET', formatBRL(data.internet)));
  if ((data.cleaning || 0) > 0) lines.push(padDots('MATERIAL DE LIMPEZA', formatBRL(data.cleaning)));
  if ((data.maintenance || 0) > 0) lines.push(padDots('MANUTENÇÃO', formatBRL(data.maintenance)));
  if ((data.social || 0) > 0) lines.push(padDots('ASSISTÊNCIA SOCIAL', formatBRL(data.social)));

  for (const item of data.otherExpenses || []) {
    if (!item || !item.value) continue;
    lines.push(padDots(item.description, formatBRL(item.value)));
  }

  const totalSaidas =
    (data.sedeExpense || 0) + (data.prebendaExpense || 0) + (data.totalFixedExpenses || 0);
  lines.push('');
  lines.push(padDots('TOTAL DE SAÍDAS', formatBRL(totalSaidas)));
  lines.push('');
  lines.push('RESUMO FINANCEIRO');
  lines.push('');
  lines.push(padDots('SALDO ANTERIOR', formatBRL(data.previousBalance || 0)));
  lines.push(padDots('TOTAL DE ENTRADAS', formatBRL(data.totalRevenue || 0)));
  lines.push(padDots('TOTAL DE SAÍDAS', formatBRL(totalSaidas)));
  lines.push(padDots('SALDO GU (RESULTADO DO MÊS)', formatBRL(data.saldoGU || 0)));
  lines.push(padDots('SALDO ATUAL / SOBRA DE CAIXA', formatBRL(data.currentBalance || 0)));

  return lines.join('\n');
}

const OFFICIAL_LOGO_SVG = `<svg viewBox="0 0 400 400" width="240" height="240" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <path id="textCurve" d="M 60,200 A 140,140 0 0,1 340,200" />
  </defs>
  <circle cx="200" cy="200" r="105" fill="#2D7FF9" />
  <path d="M150 140c10 5 30 0 40 20s-10 40 10 50 30-10 40 10" stroke="#4ADE80" stroke-width="25" stroke-linecap="round" opacity="0.7" />
  <path d="M220 250c-20 5-40 20-30 40s30 10 20 30" stroke="#4ADE80" stroke-width="15" stroke-linecap="round" opacity="0.6" />
  <path d="M110 280c5-10 15-30 40-30s35 20 40 30" stroke="#C68642" stroke-width="12" stroke-linecap="round" />
  <path d="M290 280c-5-10-15-30-40-30s-35 20-40 30" stroke="#8D5524" stroke-width="12" stroke-linecap="round" />
  <path d="M150 310c5-12 15-35 40-35s35 20 40 35" stroke="#E0AC69" stroke-width="10" stroke-linecap="round" />
  <path d="M250 310c-5-12 15-35-40-35s-35 20-40 35" stroke="#F1C27D" stroke-width="10" stroke-linecap="round" />
  <text style="font-family: Arial, sans-serif; font-size: 34px; font-weight: 900; fill: #E11D48; letter-spacing: 1px;">
    <textPath href="#textCurve" startOffset="50%" text-anchor="middle">ASSEMBLEIA DE DEUS</textPath>
  </text>
  <text x="200" y="380" text-anchor="middle" style="font-family: Arial, sans-serif; font-size: 42px; font-weight: 900; fill: #E11D48;">GERAÇÃO UNIDA</text>
</svg>`;

let cachedDefaultLogoDataUrl: string | null = null;

export const getDefaultLogoDataUrl = (): Promise<string> => {
  if (cachedDefaultLogoDataUrl) return Promise.resolve(cachedDefaultLogoDataUrl);
  return new Promise((resolve) => {
    try {
      const img = new Image();
      const svgBlob = new Blob([OFFICIAL_LOGO_SVG], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 240;
        canvas.height = 240;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, 240, 240);
          cachedDefaultLogoDataUrl = canvas.toDataURL('image/png');
          URL.revokeObjectURL(url);
          resolve(cachedDefaultLogoDataUrl);
        } else {
          URL.revokeObjectURL(url);
          resolve('');
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve('');
      };
      img.src = url;
    } catch {
      resolve('');
    }
  });
};

if (typeof window !== 'undefined') {
  getDefaultLogoDataUrl();
}

/**
 * PDF Oficial do Relatório Geral Consolidado (EXCLUSIVO DO ADMINISTRADOR).
 * Contém o modelo consolidado com RECEITA, DESPESAS e RESUMO: SUPERÁVIT OU DÉFICIT.
 */
export const buildConsolidatedReportPDF = (
  data: ConsolidatedReportResult,
  settings: Partial<SystemSettings>
) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as any;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const leftMargin = 18;
  const rightMargin = 18;
  const contentWidth = pageWidth - leftMargin - rightMargin;

  // Header Box
  doc.setFillColor(248, 250, 252);
  doc.rect(0, 0, pageWidth, 38, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.line(0, 38, pageWidth, 38);

  const logoToUse = settings?.logo || cachedDefaultLogoDataUrl;
  if (logoToUse) {
    try {
      doc.addImage(logoToUse, 'PNG', leftMargin, 7, 22, 22);
    } catch (e) {
      console.warn('Logo image warning:', e);
    }
  }

  const textStartX = logoToUse ? leftMargin + 26 : leftMargin;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text(data.institutionTitle.toUpperCase(), textStartX, 13);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  doc.text(`CNPJ: ${data.cnpj}`, textStartX, 20);
  doc.text(`PR. PRESIDENTE: ${data.president.toUpperCase()}`, textStartX, 26);
  doc.setTextColor(29, 78, 216);
  doc.text(`COMPETÊNCIA: ${data.competence.toUpperCase()} (RELATÓRIO GERAL CONSOLIDADO)`, textStartX, 32);

  let y = 48;
  const totalLines = data.revenueItems.length + data.expenseItems.length + 3;
  const isCompact = totalLines > 22;
  const lineSpacing = isCompact ? 6.2 : 7.5;
  const fontSize = isCompact ? 9 : 10;

  const drawSectionHeader = (title: string) => {
    if (y > pageHeight - 30) {
      doc.addPage();
      y = 20;
    }
    doc.setFillColor(29, 78, 216);
    doc.roundedRect(leftMargin, y - 4.5, contentWidth, 7.5, 1.2, 1.2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text(title, leftMargin + 3, y + 0.8);
    y += lineSpacing + 2;
  };

  const drawDottedRow = (
    label: string,
    valueStr: string,
    bold = false,
    highlightColor?: [number, number, number]
  ) => {
    if (y > pageHeight - 20) {
      doc.addPage();
      y = 20;
    }
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(fontSize);

    if (highlightColor) {
      doc.setTextColor(highlightColor[0], highlightColor[1], highlightColor[2]);
    } else {
      doc.setTextColor(15, 23, 42);
    }

    const cleanLabel = label.toUpperCase();
    doc.text(cleanLabel, leftMargin + 2, y);
    doc.text(valueStr, pageWidth - rightMargin - 2, y, { align: 'right' });

    const labelW = doc.getTextWidth(cleanLabel);
    const valW = doc.getTextWidth(valueStr);
    const dotStartX = leftMargin + 2 + labelW + 2.5;
    const dotEndX = pageWidth - rightMargin - 2 - valW - 2.5;

    if (dotEndX > dotStartX) {
      doc.setDrawColor(148, 163, 184);
      doc.setLineWidth(0.25);
      doc.setLineDashPattern([0.6, 1.2], 0);
      doc.line(dotStartX, y - 0.8, dotEndX, y - 0.8);
      doc.setLineDashPattern([], 0);
    }

    y += lineSpacing;
  };

  // RECEITA
  drawSectionHeader('RECEITA');
  for (const item of data.revenueItems) {
    drawDottedRow(item.label, formatBRL(item.value));
  }

  y += 3;

  // DESPESAS
  drawSectionHeader('DESPESAS');
  for (const item of data.expenseItems) {
    drawDottedRow(item.label, formatBRL(item.value));
  }

  y += 3;

  // RESUMO
  drawSectionHeader('RESUMO');
  drawDottedRow('RECEITA', formatBRL(data.totalRevenue), true, [29, 78, 216]);
  drawDottedRow('DESPESA', formatBRL(data.totalExpense), true, [30, 41, 59]);
  drawDottedRow(
    'SUPERÁVIT OU DÉFICIT',
    formatBRL(data.surplusOrDeficit),
    true,
    data.surplusOrDeficit < 0 ? [185, 28, 28] : [29, 78, 216]
  );

  // Signature Block
  const signatureY = Math.min(pageHeight - 22, Math.max(y + 16, pageHeight - 28));
  if (y + 22 <= pageHeight - 10) {
    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.25);

    const tName = settings?.treasurerName || 'TESOUREIRO RESPONSÁVEL';
    const tRole = settings?.treasurerRole || 'Tesouraria Geral';
    doc.line(leftMargin + 5, signatureY, leftMargin + 75, signatureY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(tName.toUpperCase(), leftMargin + 40, signatureY + 4.2, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(tRole, leftMargin + 40, signatureY + 7.8, { align: 'center' });

    const pName = data.president || 'PR. ANTÔNIO CHAVES CRUS';
    const pRole = settings?.pastorRole || 'Pastor Presidente';
    doc.line(pageWidth - rightMargin - 75, signatureY, pageWidth - rightMargin - 5, signatureY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(pName.toUpperCase(), pageWidth - rightMargin - 40, signatureY + 4.2, {
      align: 'center',
    });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(pRole, pageWidth - rightMargin - 40, signatureY + 7.8, { align: 'center' });
  }

  return doc;
};

/**
 * PDF Oficial do Relatório Normal (INDIVIDUAL DAS CONGREGAÇÕES / DEPARTAMENTOS).
 * Contém o modelo tradicional com Entradas, Saídas, Saldo Anterior, Saldo GU e Saldo Atual.
 */
export const buildNormalReportPDF = (
  report: OfficialReportPDFData,
  settings: Partial<SystemSettings>
) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as any;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const leftMargin = 18;
  const rightMargin = 18;
  const contentWidth = pageWidth - leftMargin - rightMargin;

  // Header Box
  doc.setFillColor(248, 250, 252);
  doc.rect(0, 0, pageWidth, 42, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.line(0, 42, pageWidth, 42);

  const logoToUse = settings?.logo || cachedDefaultLogoDataUrl;
  if (logoToUse) {
    try {
      doc.addImage(logoToUse, 'PNG', leftMargin, 8, 24, 24);
    } catch (e) {
      console.warn('Logo image warning:', e);
    }
  }

  const textStartX = logoToUse ? leftMargin + 28 : leftMargin;
  const instTitle = (settings?.institutionName || 'ASSEMBLEIA DE DEUS GERAÇÃO UNIDA').toUpperCase();
  const cnpj = settings?.cnpj || '49.386.673/0001-10';
  const president = settings?.president || settings?.pastorName || 'Pr. Antônio Chaves Crus';

  const rawDate = report.reportDate || report.dateLabel || '';
  const dateFormatted = formatDateBR(rawDate) || 'N/D';
  const compFormatted = getCompetenceFromDate(rawDate) || report.dateLabel || 'GERAL';

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.setTextColor(15, 23, 42);
  doc.text(instTitle, textStartX, 12);

  doc.setFontSize(9.5);
  doc.setTextColor(29, 78, 216);
  const isMonthlyPdf = isReportExemptFromDiscount(report as any) || report.noDiscount;
  doc.text(`${isMonthlyPdf ? 'RELATÓRIO FINANCEIRO MENSAL' : 'RELATÓRIO FINANCEIRO SEMANAL'} - ${(report.institutionName || 'SEDE').toUpperCase()}`, textStartX, 18);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`CNPJ: ${cnpj}  |  PR. PRESIDENTE: ${president.toUpperCase()}`, textStartX, 24);
  doc.setTextColor(29, 78, 216);
  doc.text(
    `DATA DO RELATÓRIO: ${dateFormatted}  |  COMPETÊNCIA: ${compFormatted}`,
    textStartX,
    29.5
  );
  doc.setTextColor(71, 85, 105);
  doc.text(
    `TESOUREIRO: ${(report.reporterName || '').toUpperCase()}`,
    textStartX,
    35
  );

  let y = 50;
  const fontSize = 9;
  const lineSpacing = 6.4;

  const drawSectionHeader = (title: string) => {
    if (y > pageHeight - 30) {
      doc.addPage();
      y = 20;
    }
    doc.setFillColor(29, 78, 216);
    doc.roundedRect(leftMargin, y - 4.5, contentWidth, 7.2, 1.2, 1.2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(255, 255, 255);
    doc.text(title, leftMargin + 3, y + 0.8);
    y += lineSpacing + 2;
  };

  const drawDottedRow = (
    label: string,
    valueStr: string,
    bold = false,
    highlightColor?: [number, number, number]
  ) => {
    if (y > pageHeight - 20) {
      doc.addPage();
      y = 20;
    }
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(fontSize);

    if (highlightColor) {
      doc.setTextColor(highlightColor[0], highlightColor[1], highlightColor[2]);
    } else {
      doc.setTextColor(15, 23, 42);
    }

    const cleanLabel = label.toUpperCase();
    doc.text(cleanLabel, leftMargin + 2, y);
    doc.text(valueStr, pageWidth - rightMargin - 2, y, { align: 'right' });

    const labelW = doc.getTextWidth(cleanLabel);
    const valW = doc.getTextWidth(valueStr);
    const dotStartX = leftMargin + 2 + labelW + 2.5;
    const dotEndX = pageWidth - rightMargin - 2 - valW - 2.5;

    if (dotEndX > dotStartX) {
      doc.setDrawColor(148, 163, 184);
      doc.setLineWidth(0.25);
      doc.setLineDashPattern([0.6, 1.2], 0);
      doc.line(dotStartX, y - 0.8, dotEndX, y - 0.8);
      doc.setLineDashPattern([], 0);
    }

    y += lineSpacing;
  };

  // ENTRADAS
  drawSectionHeader('ENTRADAS / RECEITAS');
  drawDottedRow('DÍZIMOS', formatBRL(report.tithes || 0));
  drawDottedRow('OFERTAS', formatBRL(report.offers || 0));
  drawDottedRow('OFERTAS ESPECIAIS', formatBRL(report.specialOffers || 0));

  if ((report.financialRevenue || 0) > 0) {
    drawDottedRow('RECEITA FINANCEIRA', formatBRL(report.financialRevenue));
  }

  for (const item of report.otherRevenues || []) {
    if (!item || !item.value) continue;
    const isSede = isSedeTransferRevenue(item.description || '');
    const label = isSede ? `${item.description} (100% LÍQUIDO)` : item.description;
    drawDottedRow(label, formatBRL(item.value));
  }

  drawDottedRow('TOTAL DE ENTRADAS', formatBRL(report.totalRevenue || 0), true, [29, 78, 216]);

  y += 2.5;

  // SAÍDAS
  drawSectionHeader('SAÍDAS / DESPESAS');
  if (!report.noDiscount && !report.isCamposBelos) {
    drawDottedRow('REPASSE SEDE (20%)', formatBRL(report.sedeExpense || 0));
    drawDottedRow('PREBENDA MINISTERIAL (20%)', formatBRL(report.prebendaExpense || 0));
  }
  if ((report.missions || 0) > 0) drawDottedRow('AJUDA MISSIONÁRIA', formatBRL(report.missions));
  if ((report.rent || 0) > 0) drawDottedRow('ALUGUEL', formatBRL(report.rent));
  if ((report.water || 0) > 0) drawDottedRow('ÁGUA', formatBRL(report.water));
  if ((report.energy || 0) > 0) drawDottedRow('ENERGIA', formatBRL(report.energy));
  if ((report.internet || 0) > 0) drawDottedRow('INTERNET', formatBRL(report.internet));
  if ((report.cleaning || 0) > 0) drawDottedRow('MATERIAL DE LIMPEZA', formatBRL(report.cleaning));
  if ((report.maintenance || 0) > 0) drawDottedRow('MANUTENÇÃO', formatBRL(report.maintenance));
  if ((report.social || 0) > 0) drawDottedRow('ASSISTÊNCIA SOCIAL', formatBRL(report.social));

  for (const item of report.otherExpenses || []) {
    if (!item || !item.value) continue;
    drawDottedRow(item.description, formatBRL(item.value));
  }

  const totalSaidas =
    (report.sedeExpense || 0) + (report.prebendaExpense || 0) + (report.totalFixedExpenses || 0);
  drawDottedRow('TOTAL DE SAÍDAS', formatBRL(totalSaidas), true, [185, 28, 28]);

  y += 2.5;

  // RESUMO NORMAL
  drawSectionHeader('RESUMO FINANCEIRO');
  drawDottedRow('SALDO ANTERIOR', formatBRL(report.previousBalance || 0), true);
  drawDottedRow('TOTAL DE ENTRADAS', formatBRL(report.totalRevenue || 0), true, [29, 78, 216]);
  drawDottedRow('TOTAL DE SAÍDAS', formatBRL(totalSaidas), true, [185, 28, 28]);
  drawDottedRow('SALDO GU (RESULTADO DO MÊS)', formatBRL(report.saldoGU || 0), true);
  drawDottedRow(
    'SALDO ATUAL (SOBRA PARA O PRÓXIMO MÊS)',
    formatBRL(report.currentBalance || 0),
    true,
    report.currentBalance < 0 ? [185, 28, 28] : [29, 78, 216]
  );

  if ((report.cashBalance || 0) > 0 || (report.pixBalance || 0) > 0) {
    drawDottedRow(
      'CONFERÊNCIA DE CAIXA',
      `Dinheiro: ${formatBRL(report.cashBalance || 0)} | PIX: ${formatBRL(report.pixBalance || 0)}`,
      false,
      [71, 85, 105]
    );
  }

  // Signature Block
  const signatureY = Math.min(pageHeight - 20, Math.max(y + 14, pageHeight - 26));
  if (y + 18 <= pageHeight - 8) {
    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.25);

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(`Data de Fechamento do Relatório Semanal: ${dateFormatted}`, pageWidth / 2, signatureY - 3, { align: 'center' });

    const tName = report.reporterName || settings?.treasurerName || 'TESOUREIRO RESPONSÁVEL';
    const tRole = settings?.treasurerRole || 'Tesoureiro Local';
    doc.line(leftMargin + 5, signatureY, leftMargin + 75, signatureY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(tName.toUpperCase(), leftMargin + 40, signatureY + 4.2, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(tRole, leftMargin + 40, signatureY + 7.8, { align: 'center' });

    const pName = president;
    const pRole = settings?.pastorRole || 'Pastor Dirigente / Presidente';
    doc.line(pageWidth - rightMargin - 75, signatureY, pageWidth - rightMargin - 5, signatureY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(pName.toUpperCase(), pageWidth - rightMargin - 40, signatureY + 4.2, {
      align: 'center',
    });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(pRole, pageWidth - rightMargin - 40, signatureY + 7.8, { align: 'center' });
  }

  return doc;
};

/**
 * Função inteligente de despacho de PDF:
 * Se for o Relatório Geral Consolidado (do ADM, com surplusOrDeficit e revenueItems), gera o Consolidado.
 * Se for um relatório individual normal, gera o PDF NORMAL.
 */
export const buildOfficialReportPDF = (
  reportInput: OfficialReportPDFData | ConsolidatedReportResult,
  settings: Partial<SystemSettings>
) => {
  if ('surplusOrDeficit' in reportInput && 'revenueItems' in reportInput) {
    return buildConsolidatedReportPDF(reportInput as ConsolidatedReportResult, settings);
  }
  return buildNormalReportPDF(reportInput as OfficialReportPDFData, settings);
};

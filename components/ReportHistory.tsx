import React, { useState, useEffect, useMemo } from 'react';
import { DailyTransaction, FinancialReport, UserAccount, UserSession } from '../types';
import {
  deleteReport,
  getReports,
  getSettings,
  getTransactions,
  getUsers,
  updateReportApprovalStatus,
  updateReportLockStatus,
} from '../services/storageService';
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  CheckCircle,
  Copy,
  Edit3,
  Eye,
  FileDown,
  FilePlus,
  FileText,
  Filter,
  FolderKanban,
  Lock,
  Printer,
  RefreshCw,
  Search,
  Trash2,
  Unlock,
  X,
} from 'lucide-react';
import {
  buildConsolidatedReportPDF,
  buildNormalReportPDF,
  consolidateFinancialData,
  formatBRL,
  formatConsolidatedReportText,
  formatNormalReportText,
  getDefaultLogoDataUrl,
  OfficialReportPDFData,
} from '../services/reportPdfService';
import { PrintableReportView } from './PrintableReportView';

interface ReportHistoryProps {
  session: UserSession;
  onBack: () => void;
  onEdit?: (report: FinancialReport, readOnly?: boolean) => void;
  onGoToTrash?: () => void;
  showArchivedOnly?: boolean;
}

const MONTHS_LIST = [
  { value: '01', label: '01 - Janeiro' },
  { value: '02', label: '02 - Fevereiro' },
  { value: '03', label: '03 - Março' },
  { value: '04', label: '04 - Abril' },
  { value: '05', label: '05 - Maio' },
  { value: '06', label: '06 - Junho' },
  { value: '07', label: '07 - Julho' },
  { value: '08', label: '08 - Agosto' },
  { value: '09', label: '09 - Setembro' },
  { value: '10', label: '10 - Outubro' },
  { value: '11', label: '11 - Novembro' },
  { value: '12', label: '12 - Dezembro' },
];

export const ReportHistory: React.FC<ReportHistoryProps> = ({
  session,
  onEdit,
  onGoToTrash,
}) => {
  const now = new Date();
  const [reports, setReports] = useState<FinancialReport[]>([]);
  const [transactions, setTransactions] = useState<DailyTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [churchSettings, setChurchSettings] = useState<any>(null);
  const [usersList, setUsersList] = useState<UserAccount[]>([]);

  // Navigation mode for Admin: Normal reports vs Consolidated General Report
  const [activeTab, setActiveTab] = useState<'NORMAL' | 'CONSOLIDATED_ADM'>('NORMAL');

  // Filters
  const [filterMonth, setFilterMonth] = useState<string>(
    String(now.getMonth() + 1).padStart(2, '0')
  );
  const [filterYear, setFilterYear] = useState<string>(String(now.getFullYear()));
  const [allCompetences, setAllCompetences] = useState<boolean>(false);
  const [selectedInstitution, setSelectedInstitution] = useState<string>(
    session.role === 'ADMIN' ? 'ALL' : session.institution
  );
  const [filterStatus, setFilterStatus] = useState<'TODOS' | 'APROVADO' | 'PENDENTE' | 'REJEITADO'>('TODOS');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Selected report for viewing in modal / printing
  const [viewingReport, setViewingReport] = useState<FinancialReport | null>(null);

  // Status message & dialogs
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [copiedNotice, setCopiedNotice] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
  } | null>(null);
  const [rejectDialog, setRejectDialog] = useState<{
    report: FinancialReport;
    reason: string;
  } | null>(null);

  useEffect(() => {
    if (statusMessage) {
      const timer = setTimeout(() => setStatusMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [statusMessage]);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      const [allReports, allTxs, settingsData, usersData] = await Promise.all([
        getReports(),
        getTransactions(),
        getSettings(),
        getUsers(),
      ]);

      setReports(allReports || []);
      setTransactions(allTxs || []);
      setChurchSettings(settingsData || null);
      setUsersList(usersData || []);
    } catch (err) {
      console.error('Erro ao buscar relatórios:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
    const handleUpdate = () => fetchAllData();
    window.addEventListener('reports-updated', handleUpdate);
    window.addEventListener('transactions-updated', handleUpdate);
    window.addEventListener('settings-updated', handleUpdate);
    return () => {
      window.removeEventListener('reports-updated', handleUpdate);
      window.removeEventListener('transactions-updated', handleUpdate);
      window.removeEventListener('settings-updated', handleUpdate);
    };
  }, []);

  const availableYears = useMemo(() => {
    const yrs = new Set<string>([String(now.getFullYear()), filterYear]);
    reports.forEach((r) => {
      if (r.date) yrs.add(r.date.slice(0, 4));
    });
    return Array.from(yrs).filter(Boolean).sort().reverse();
  }, [reports, filterYear]);

  const availableInstitutions = useMemo(() => {
    const setInst = new Set<string>();
    reports.forEach((r) => {
      if (r.institutionName && !r.deletedAt) setInst.add(r.institutionName.trim());
    });
    return Array.from(setInst).sort();
  }, [reports]);

  const competenceLabel = useMemo(() => {
    if (allCompetences) return 'TODAS AS COMPETÊNCIAS';
    return `${filterMonth}/${filterYear}`;
  }, [allCompetences, filterMonth, filterYear]);

  // Filtered reports for Normal List
  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      if (r.deletedAt) return false;

      // Permission filter
      if (session.role !== 'ADMIN') {
        const userInst = (session.institution || '').trim().toLowerCase();
        const repInst = (r.institutionName || '').trim().toLowerCase();
        if (repInst !== userInst && r.userId !== session.id) return false;
      } else if (selectedInstitution !== 'ALL') {
        const filterInst = selectedInstitution.trim().toLowerCase();
        const repInst = (r.institutionName || '').trim().toLowerCase();
        if (repInst !== filterInst) return false;
      }

      // Competence filter
      if (!allCompetences) {
        const targetPrefix = `${filterYear}-${filterMonth}`;
        if (!r.date || !r.date.startsWith(targetPrefix)) return false;
      }

      // Status filter
      if (filterStatus !== 'TODOS') {
        const st = r.approvalStatus || 'PENDENTE';
        if (st !== filterStatus) return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchInst = (r.institutionName || '').toLowerCase().includes(term);
        const matchRep = (r.reporterName || '').toLowerCase().includes(term);
        const matchDate = (r.date || '').toLowerCase().includes(term);
        if (!matchInst && !matchRep && !matchDate) return false;
      }

      return true;
    });
  }, [
    reports,
    session,
    selectedInstitution,
    allCompetences,
    filterYear,
    filterMonth,
    filterStatus,
    searchTerm,
  ]);

  // Consolidated General Report data (for Admin view)
  const competenceReports = useMemo(() => {
    if (allCompetences) return reports.filter((r) => !r.deletedAt);
    const targetPrefix = `${filterYear}-${filterMonth}`;
    return reports.filter((r) => !r.deletedAt && (r.date || '').startsWith(targetPrefix));
  }, [reports, allCompetences, filterMonth, filterYear]);

  const competenceTransactions = useMemo(() => {
    if (allCompetences) {
      return transactions.filter((t) => !(t as any).deletedAt && t.status !== 'AGENDADO');
    }
    const targetPrefix = `${filterYear}-${filterMonth}`;
    return transactions.filter(
      (t) =>
        !(t as any).deletedAt &&
        t.status !== 'AGENDADO' &&
        (t.date || '').startsWith(targetPrefix)
    );
  }, [transactions, allCompetences, filterMonth, filterYear]);

  const consolidatedReport = useMemo(() => {
    return consolidateFinancialData({
      reports: competenceReports,
      transactions: competenceTransactions,
      competenceLabel,
      settings: churchSettings,
      users: usersList,
    });
  }, [competenceReports, competenceTransactions, competenceLabel, churchSettings, usersList]);

  // Actions
  const handleDeleteReport = async (id: string) => {
    setConfirmDialog({
      title: 'Excluir Relatório',
      message: 'Deseja realmente mover este relatório para a lixeira?',
      onConfirm: async () => {
        try {
          await deleteReport(id, session.name);
          setReports((prev) => prev.filter((r) => r.id !== id));
          setStatusMessage({ type: 'success', text: 'Relatório movido para a lixeira.' });
          setConfirmDialog(null);
          fetchAllData();
        } catch (err) {
          setStatusMessage({
            type: 'error',
            text: 'Erro ao excluir relatório.',
          });
          setConfirmDialog(null);
        }
      },
      onCancel: () => setConfirmDialog(null),
    });
  };

  const handleToggleLock = async (report: FinancialReport) => {
    if (session.role !== 'ADMIN') return;
    const newStatus = !report.locked;

    setConfirmDialog({
      title: newStatus ? 'Bloquear Período' : 'Desbloquear Período',
      message: `Deseja ${newStatus ? 'BLOQUEAR' : 'DESBLOQUEAR'} este período para edições?`,
      onConfirm: async () => {
        try {
          await updateReportLockStatus(report.id, newStatus);
          setReports((prev) =>
            prev.map((r) => (r.id === report.id ? { ...r, locked: newStatus } : r))
          );
          setStatusMessage({
            type: 'success',
            text: `Período ${newStatus ? 'bloqueado' : 'desbloqueado'} com sucesso.`,
          });
          setConfirmDialog(null);
          fetchAllData();
        } catch (err) {
          setStatusMessage({ type: 'error', text: 'Erro ao alterar bloqueio.' });
          setConfirmDialog(null);
        }
      },
      onCancel: () => setConfirmDialog(null),
    });
  };

  const handleApproveReport = async (report: FinancialReport) => {
    setConfirmDialog({
      title: 'Aprovar Relatório Financeiro',
      message: `Deseja APROVAR o fechamento de "${report.institutionName}" (${report.date
        .split('-')
        .reverse()
        .join('/')})?`,
      onConfirm: async () => {
        try {
          await updateReportApprovalStatus(report.id, 'APROVADO', session.name);
          setStatusMessage({
            type: 'success',
            text: 'Relatório aprovado com sucesso!',
          });
          setConfirmDialog(null);
          fetchAllData();
        } catch (err) {
          setStatusMessage({ type: 'error', text: 'Erro ao aprovar relatório.' });
          setConfirmDialog(null);
        }
      },
      onCancel: () => setConfirmDialog(null),
    });
  };

  const confirmRejectReport = async () => {
    if (!rejectDialog) return;
    try {
      await updateReportApprovalStatus(
        rejectDialog.report.id,
        'REJEITADO',
        session.name,
        rejectDialog.reason.trim() || 'Solicitado ajustes pelo ADM'
      );
      setStatusMessage({ type: 'success', text: 'Relatório devolvido para ajustes.' });
      setRejectDialog(null);
      fetchAllData();
    } catch (err) {
      setStatusMessage({ type: 'error', text: 'Erro ao rejeitar relatório.' });
      setRejectDialog(null);
    }
  };

  // Convert FinancialReport to OfficialReportPDFData for Normal View/PDF
  const mapToNormalReportData = (r: FinancialReport): OfficialReportPDFData => {
    const rawDate = r.date || '';
    const competence = rawDate ? `${rawDate.slice(5, 7)}/${rawDate.slice(0, 4)}` : 'GERAL';
    return {
      institutionName: r.institutionName || 'CONGREGAÇÃO LOCAL',
      dateLabel: competence,
      reportDate: rawDate,
      reporterName: r.reporterName || 'Tesoureiro Local',
      tithes: r.tithes || 0,
      offers: r.offers || 0,
      specialOffers: r.specialOffers || 0,
      financialRevenue:
        r.financialRevenue || (Number(r.interestRevenue) || 0) + (Number(r.rentRevenue) || 0),
      otherRevenues: r.otherRevenues || [],
      totalRevenue: r.totalRevenue || 0,
      sedeExpense: r.sedeExpense || 0,
      prebendaExpense: r.prebendaExpense || 0,
      rent: r.rent || 0,
      energy: r.energy || 0,
      water: r.water || 0,
      internet: r.internet || 0,
      cleaning: r.cleaning || 0,
      maintenance: r.maintenance || 0,
      missions: r.missions || 0,
      social: r.social || 0,
      otherExpenses: r.otherExpenses || [],
      totalFixedExpenses: r.totalFixedExpenses || 0,
      previousBalance: r.previousBalance || 0,
      saldoGU: r.saldoGU || 0,
      currentBalance: r.currentBalance || 0,
      cashBalance: r.cashBalance || 0,
      pixBalance: r.pixBalance || 0,
      noDiscount: r.noDiscount,
    };
  };

  const handleDownloadNormalPDF = async (r: FinancialReport) => {
    const normalData = mapToNormalReportData(r);
    const settings = churchSettings || (await getSettings());
    await getDefaultLogoDataUrl();
    const doc = buildNormalReportPDF(normalData, settings);
    const safeName = (r.institutionName || 'Congregacao').replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeDate = (r.date || 'Data').replace(/[^a-zA-Z0-9_-]/g, '_');
    doc.save(`ADGU_Relatorio_Semanal_${safeName}_${safeDate}.pdf`);
  };

  const handleDownloadConsolidatedPDF = async () => {
    const settings = churchSettings || (await getSettings());
    await getDefaultLogoDataUrl();
    const doc = buildConsolidatedReportPDF(consolidatedReport, settings);
    const safeComp = competenceLabel.replace(/[^a-zA-Z0-9_-]/g, '_');
    doc.save(`ADGU_Relatorio_Geral_Consolidado_${safeComp}.pdf`);
  };

  const handleCopyNormalText = async (r: FinancialReport) => {
    try {
      const normalData = mapToNormalReportData(r);
      const text = formatNormalReportText(normalData, churchSettings);
      await navigator.clipboard.writeText(text);
      setCopiedNotice(true);
      setTimeout(() => setCopiedNotice(false), 3000);
    } catch (e) {
      console.error('Erro ao copiar texto:', e);
    }
  };

  const handleCopyConsolidatedText = async () => {
    try {
      const text = formatConsolidatedReportText(consolidatedReport);
      await navigator.clipboard.writeText(text);
      setCopiedNotice(true);
      setTimeout(() => setCopiedNotice(false), 3000);
    } catch (e) {
      console.error('Erro ao copiar texto:', e);
    }
  };

  const canManage = (report: FinancialReport) => {
    if (session.role === 'ADMIN') return true;
    const isSameUnit =
      report.userId === session.id ||
      (report.institutionName || '').trim().toLowerCase() ===
        (session.institution || '').trim().toLowerCase();
    return isSameUnit && !report.locked;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10 print:space-y-0 print:pb-0">
      {/* Notificação Temporária */}
      {statusMessage && (
        <div
          className={`p-4 rounded-2xl flex items-center gap-3 text-xs font-black uppercase tracking-wider print:hidden ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle size={18} className="text-emerald-600" />
          ) : (
            <AlertCircle size={18} className="text-rose-600" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Cabeçalho Principal e Ações Rápidas */}
      <div className="bg-white p-5 sm:p-6 rounded-[2rem] border border-slate-200/80 shadow-sm flex flex-col gap-5 print:hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-[#1d4ed8] rounded-2xl text-white shadow-md shadow-blue-100">
              <FileText size={22} />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 uppercase tracking-tight">
                {activeTab === 'CONSOLIDATED_ADM'
                  ? 'Relatório Financeiro Geral Consolidado (ADM)'
                  : 'Relatórios Financeiros das Congregações'}
              </h2>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
                {activeTab === 'CONSOLIDATED_ADM'
                  ? 'Visão consolidada do Administrador com Superávit ou Déficit'
                  : 'Relatórios mensais de fechamento com Entradas, Saídas e Saldos de Caixa'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Alternador exclusivo para o ADMIN */}
            {session.role === 'ADMIN' && (
              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setActiveTab('NORMAL')}
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                    activeTab === 'NORMAL'
                      ? 'bg-white text-[#1d4ed8] shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  📋 Relatórios Normais
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('CONSOLIDATED_ADM')}
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                    activeTab === 'CONSOLIDATED_ADM'
                      ? 'bg-[#1d4ed8] text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  🏛️ Consolidado Geral (ADM)
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                window.dispatchEvent(new CustomEvent('change-view', { detail: 'REPORT_NEW' }));
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#1d4ed8] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-800 transition-all shadow-sm"
            >
              <FilePlus size={15} /> Novo Relatório
            </button>

            {onGoToTrash && session.role === 'ADMIN' && (
              <button
                type="button"
                onClick={onGoToTrash}
                className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-50 text-slate-600 border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:text-rose-600 hover:border-rose-200 transition-all"
                title="Lixeira"
              >
                <Trash2 size={15} /> Lixeira
              </button>
            )}
          </div>
        </div>

        {/* Barra de Filtros */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Seletor de Competência */}
            <div className="flex items-center gap-2 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200">
              <Calendar size={15} className="text-[#1d4ed8]" />
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                Competência:
              </span>
              <select
                value={allCompetences ? 'ALL' : filterMonth}
                onChange={(e) => {
                  if (e.target.value === 'ALL') {
                    setAllCompetences(true);
                  } else {
                    setAllCompetences(false);
                    setFilterMonth(e.target.value);
                  }
                }}
                className="bg-transparent text-[11px] font-black uppercase text-slate-900 outline-none cursor-pointer"
              >
                {MONTHS_LIST.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
                <option value="ALL">Todas as Competências</option>
              </select>

              {!allCompetences && (
                <>
                  <span className="text-slate-300 font-bold">/</span>
                  <select
                    value={filterYear}
                    onChange={(e) => setFilterYear(e.target.value)}
                    className="bg-transparent text-[11px] font-black uppercase text-slate-900 outline-none cursor-pointer"
                  >
                    {availableYears.map((yr) => (
                      <option key={yr} value={yr}>
                        {yr}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </div>

            {/* Filtro de Congregação (para ADMIN) */}
            {session.role === 'ADMIN' && activeTab === 'NORMAL' && (
              <div className="flex items-center gap-2 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200">
                <Filter size={14} className="text-slate-500" />
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                  Congregação:
                </span>
                <select
                  value={selectedInstitution}
                  onChange={(e) => setSelectedInstitution(e.target.value)}
                  className="bg-transparent text-[10px] font-black uppercase text-slate-900 outline-none cursor-pointer max-w-[180px] truncate"
                >
                  <option value="ALL">Todas as Congregações</option>
                  {availableInstitutions.map((inst) => (
                    <option key={inst} value={inst}>
                      {inst}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Filtro de Status */}
            {activeTab === 'NORMAL' && (
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="bg-slate-50 border border-slate-200 text-[10px] font-black uppercase text-slate-700 px-3 py-2 rounded-xl outline-none cursor-pointer"
              >
                <option value="TODOS">Todos os Status</option>
                <option value="APROVADO">Aprovados</option>
                <option value="PENDENTE">Pendentes</option>
                <option value="REJEITADO">Rejeitados</option>
              </select>
            )}

            {/* Busca textual */}
            {activeTab === 'NORMAL' && (
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar relatório..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold text-slate-900 outline-none focus:border-[#1d4ed8] w-40 sm:w-56"
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchAllData}
              className="p-2.5 bg-slate-50 text-slate-600 border border-slate-200 rounded-xl hover:bg-blue-50 hover:text-[#1d4ed8] transition-all"
              title="Atualizar dados"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin text-[#1d4ed8]' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* ABA 1: LISTA DE RELATÓRIOS NORMAIS (CONGREGAÇÕES)              */}
      {/* ============================================================== */}
      {activeTab === 'NORMAL' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Exibindo {filteredReports.length} {filteredReports.length === 1 ? 'relatório' : 'relatórios'}
            </span>
          </div>

          {filteredReports.length === 0 ? (
            <div className="bg-white rounded-3xl border border-dashed border-slate-200 p-12 text-center space-y-3">
              <FileText size={36} className="mx-auto text-slate-300" />
              <h3 className="text-sm font-black text-slate-700 uppercase tracking-wide">
                Nenhum relatório encontrado
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Não há relatórios correspondentes aos filtros selecionados para a competência {competenceLabel}.
              </p>
              <button
                type="button"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('change-view', { detail: 'REPORT_NEW' }));
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#1d4ed8] text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-blue-800 transition-all"
              >
                <FilePlus size={14} /> Criar Novo Relatório
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredReports.map((report) => {
                const totalSaidas =
                  (report.sedeExpense || 0) +
                  (report.prebendaExpense || 0) +
                  (report.totalFixedExpenses || 0);
                const approvalStatus = report.approvalStatus || 'PENDENTE';
                const dateFormatted = report.date
                  ? `${report.date.slice(8, 10)}/${report.date.slice(5, 7)}/${report.date.slice(0, 4)}`
                  : 'N/D';
                const compFormatted = report.date
                  ? `${report.date.slice(5, 7)}/${report.date.slice(0, 4)}`
                  : 'N/D';

                return (
                  <div
                    key={report.id}
                    className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-4"
                  >
                    {/* Header do Card */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-blue-100 text-[#1d4ed8] border border-blue-200 flex items-center gap-1 shadow-2xs">
                            <Calendar size={12} /> {dateFormatted}
                          </span>
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                            Semanal ({compFormatted})
                          </span>
                          {report.locked && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                              <Lock size={10} /> Fechado
                            </span>
                          )}
                          <span
                            className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                              approvalStatus === 'APROVADO'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : approvalStatus === 'REJEITADO'
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {approvalStatus}
                          </span>
                        </div>
                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                          {report.institutionName}
                        </h3>
                        <div className="flex flex-wrap items-center gap-x-2 text-[10px] font-bold text-slate-500 uppercase">
                          <span>Data: <strong className="text-slate-800">{dateFormatted}</strong></span>
                          <span>•</span>
                          <span>Tesoureiro: <strong className="text-slate-800">{report.reporterName}</strong></span>
                        </div>
                      </div>
                    </div>

                    {/* Valores Resumidos */}
                    <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-100 text-center">
                      <div>
                        <span className="text-[8px] font-black uppercase tracking-wider text-slate-400 block">
                          Entradas
                        </span>
                        <span className="text-xs font-black text-emerald-600 tabular-nums">
                          {formatBRL(report.totalRevenue || 0)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[8px] font-black uppercase tracking-wider text-slate-400 block">
                          Saídas
                        </span>
                        <span className="text-xs font-black text-rose-600 tabular-nums">
                          {formatBRL(totalSaidas)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[8px] font-black uppercase tracking-wider text-slate-400 block">
                          Saldo Atual
                        </span>
                        <span
                          className={`text-xs font-black tabular-nums ${
                            (report.currentBalance || 0) < 0 ? 'text-rose-600' : 'text-[#1d4ed8]'
                          }`}
                        >
                          {formatBRL(report.currentBalance || 0)}
                        </span>
                      </div>
                    </div>

                    {/* Botões de Ação */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setViewingReport(report)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-[#1d4ed8] border border-blue-200 rounded-xl text-[9px] font-black uppercase tracking-wider hover:bg-[#1d4ed8] hover:text-white transition-all"
                          title="Visualizar e Imprimir Relatório Normal"
                        >
                          <Eye size={13} /> Visualizar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadNormalPDF(report)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-xl text-[9px] font-black uppercase tracking-wider hover:bg-slate-200 transition-all"
                          title="Baixar PDF do Relatório Normal"
                        >
                          <FileDown size={13} /> PDF
                        </button>
                        {canManage(report) && onEdit && (
                          <button
                            type="button"
                            onClick={() => onEdit(report, report.locked && session.role !== 'ADMIN')}
                            className="p-1.5 bg-slate-50 text-slate-600 hover:text-[#1d4ed8] hover:bg-blue-50 rounded-xl border border-slate-200 transition-all"
                            title="Editar Relatório"
                          >
                            <Edit3 size={13} />
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {session.role === 'ADMIN' && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleToggleLock(report)}
                              className={`p-1.5 rounded-xl border transition-all ${
                                report.locked
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : 'bg-slate-50 text-slate-500 border-slate-200 hover:text-amber-600'
                              }`}
                              title={report.locked ? 'Desbloquear edição' : 'Bloquear período'}
                            >
                              {report.locked ? <Lock size={13} /> : <Unlock size={13} />}
                            </button>

                            {approvalStatus !== 'APROVADO' && (
                              <button
                                type="button"
                                onClick={() => handleApproveReport(report)}
                                className="px-2.5 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-[9px] font-black uppercase tracking-wider hover:bg-emerald-600 hover:text-white transition-all"
                                title="Aprovar fechamento"
                              >
                                Aprovar
                              </button>
                            )}

                            {approvalStatus !== 'REJEITADO' && (
                              <button
                                type="button"
                                onClick={() => setRejectDialog({ report, reason: '' })}
                                className="px-2.5 py-1.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-[9px] font-black uppercase tracking-wider hover:bg-rose-600 hover:text-white transition-all"
                                title="Solicitar ajustes"
                              >
                                Devolver
                              </button>
                            )}
                          </>
                        )}

                        {canManage(report) && (
                          <button
                            type="button"
                            onClick={() => handleDeleteReport(report.id)}
                            className="p-1.5 bg-slate-50 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl border border-slate-200 transition-all"
                            title="Excluir Relatório (Mover para Lixeira)"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* ABA 2: RELATÓRIO GERAL CONSOLIDADO (EXCLUSIVO DO ADMINISTRADOR)*/}
      {/* ============================================================== */}
      {activeTab === 'CONSOLIDATED_ADM' && session.role === 'ADMIN' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider">
              Consolidação Geral da Competência: <span className="text-[#1d4ed8]">{competenceLabel}</span>
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyConsolidatedText}
                className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 text-[#1d4ed8] border border-blue-200 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-blue-100 transition-all"
              >
                {copiedNotice ? <CheckCircle size={13} /> : <Copy size={13} />}
                {copiedNotice ? 'Copiado!' : 'Copiar Texto'}
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-sm"
              >
                <Printer size={13} /> Imprimir
              </button>

              <button
                type="button"
                onClick={handleDownloadConsolidatedPDF}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#1d4ed8] text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-blue-800 transition-all shadow-sm"
              >
                <FileDown size={13} /> Baixar PDF Consolidado
              </button>
            </div>
          </div>

          {/* Renderização do Relatório Geral Consolidado */}
          <PrintableReportView
            report={consolidatedReport}
            settings={churchSettings}
            forceMode="CONSOLIDATED"
          />
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL DE VISUALIZAÇÃO DO RELATÓRIO NORMAL                      */}
      {/* ============================================================== */}
      {viewingReport && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95">
            {/* Topo do Modal */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded-full bg-blue-100 text-[#1d4ed8] text-[9px] font-black uppercase tracking-wider">
                    Relatório Semanal
                  </span>
                  <span className="text-[10px] font-black text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                    Data: {viewingReport.date ? viewingReport.date.split('-').reverse().join('/') : 'N/D'}
                  </span>
                </div>
                <h3 className="text-sm font-black text-slate-900 uppercase">
                  {viewingReport.institutionName}
                </h3>
                <p className="text-[10px] font-bold text-slate-500 uppercase">
                  Data: <strong className="text-slate-800">{viewingReport.date ? viewingReport.date.split('-').reverse().join('/') : 'N/D'}</strong> • Competência {viewingReport.date ? `${viewingReport.date.slice(5, 7)}/${viewingReport.date.slice(0, 4)}` : 'N/D'} • Tesoureiro: {viewingReport.reporterName}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopyNormalText(viewingReport)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-[#1d4ed8] border border-blue-200 rounded-xl text-[9px] font-black uppercase hover:bg-blue-100 transition-all"
                >
                  {copiedNotice ? <CheckCircle size={12} /> : <Copy size={12} />}
                  {copiedNotice ? 'Copiado' : 'Copiar Texto'}
                </button>

                <button
                  type="button"
                  onClick={() => handleDownloadNormalPDF(viewingReport)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-xl text-[9px] font-black uppercase hover:bg-slate-200 transition-all"
                >
                  <FileDown size={12} /> Baixar PDF
                </button>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-1 px-3 py-1.5 bg-[#1d4ed8] text-white rounded-xl text-[9px] font-black uppercase hover:bg-blue-800 transition-all"
                >
                  <Printer size={12} /> Imprimir
                </button>

                <button
                  type="button"
                  onClick={() => setViewingReport(null)}
                  className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-xl transition-all ml-2"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Conteúdo do Relatório Normal no Modal */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-100/60">
              <PrintableReportView
                report={mapToNormalReportData(viewingReport)}
                settings={churchSettings}
                forceMode="NORMAL"
              />
            </div>
          </div>
        </div>
      )}

      {/* Área invisível em tela, usada para acionar impressão nativa do navegador */}
      <div id="printable-report-area" className="hidden print:block w-full">
        {viewingReport ? (
          <PrintableReportView
            report={mapToNormalReportData(viewingReport)}
            settings={churchSettings}
            forceMode="NORMAL"
          />
        ) : (
          <PrintableReportView
            report={consolidatedReport}
            settings={churchSettings}
            forceMode={activeTab === 'CONSOLIDATED_ADM' ? 'CONSOLIDATED' : 'NORMAL'}
          />
        )}
      </div>

      {/* DIÁLOGO DE CONFIRMAÇÃO */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-50 rounded-2xl text-amber-600">
                <AlertTriangle size={22} />
              </div>
              <h3 className="text-base font-black text-slate-900 uppercase">
                {confirmDialog.title}
              </h3>
            </div>
            <p className="text-xs text-slate-600 font-medium leading-relaxed">
              {confirmDialog.message}
            </p>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={confirmDialog.onCancel}
                className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-slate-200 transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDialog.onConfirm}
                className="px-4 py-2.5 bg-[#1d4ed8] text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-blue-800 transition-all shadow-sm"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DIÁLOGO DE REJEIÇÃO / AJUSTE */}
      {rejectDialog && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-rose-50 rounded-2xl text-rose-600">
                <AlertCircle size={22} />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 uppercase">
                  Solicitar Ajustes no Relatório
                </h3>
                <p className="text-[10px] font-bold text-slate-500 uppercase">
                  {rejectDialog.report.institutionName}
                </p>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider">
                Motivo / Instruções de Correção:
              </label>
              <textarea
                value={rejectDialog.reason}
                onChange={(e) =>
                  setRejectDialog((prev) => (prev ? { ...prev, reason: e.target.value } : null))
                }
                placeholder="Informe as correções necessárias que o tesoureiro deve fazer..."
                rows={3}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs outline-none focus:border-[#1d4ed8]"
              />
            </div>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setRejectDialog(null)}
                className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-black uppercase hover:bg-slate-200 transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmRejectReport}
                className="px-4 py-2.5 bg-rose-600 text-white rounded-xl text-xs font-black uppercase hover:bg-rose-700 transition-all shadow-sm"
              >
                Enviar Devolução
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

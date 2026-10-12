import React, { useState, useEffect, useMemo } from 'react';
import { DailyTransaction, FinancialReport, UserAccount, UserSession } from '../types';
import { getReports, getSettings, getTransactions, getUsers } from '../services/storageService';
import {
  Calendar as CalendarIcon,
  CheckCircle,
  Copy,
  FileDown,
  Printer,
  RefreshCw,
} from 'lucide-react';
import {
  buildOfficialReportPDF,
  consolidateFinancialData,
  formatConsolidatedReportText,
  getDefaultLogoDataUrl,
} from '../services/reportPdfService';
import { PrintableReportView } from './PrintableReportView';

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

export const AdminDashboard: React.FC<{ session: UserSession }> = () => {
  const now = new Date();
  const [reports, setReports] = useState<FinancialReport[]>([]);
  const [transactions, setTransactions] = useState<DailyTransaction[]>([]);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [churchSettings, setChurchSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [selectedMonth, setSelectedMonth] = useState<string>(
    String(now.getMonth() + 1).padStart(2, '0')
  );
  const [selectedYear, setSelectedYear] = useState<string>(String(now.getFullYear()));
  const [consolidateAllMonths, setConsolidateAllMonths] = useState<boolean>(false);
  const [hasAutoSelectedCompetence, setHasAutoSelectedCompetence] = useState<boolean>(false);
  const [copiedNotice, setCopiedNotice] = useState<boolean>(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [repData, txData, settingsData, usersData] = await Promise.all([
        getReports(),
        getTransactions(),
        getSettings(),
        getUsers(),
      ]);
      setReports(repData || []);
      setTransactions(txData || []);
      setChurchSettings(settingsData || null);
      setUsers(usersData || []);

      if (!hasAutoSelectedCompetence) {
        const allDates: string[] = [];
        for (const r of repData || []) {
          if (r.date && !r.deletedAt) allDates.push(r.date.slice(0, 7));
        }
        for (const t of txData || []) {
          if (t.date && !(t as any).deletedAt && t.status !== 'AGENDADO') {
            allDates.push(t.date.slice(0, 7));
          }
        }
        const sortedCompetences = Array.from(new Set(allDates.filter(Boolean))).sort().reverse();
        const currentComp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        if (sortedCompetences.length > 0 && !sortedCompetences.includes(currentComp)) {
          const [latestYear, latestMonth] = sortedCompetences[0].split('-');
          if (latestYear && latestMonth) {
            setSelectedYear(latestYear);
            setSelectedMonth(latestMonth);
          }
        }
        setHasAutoSelectedCompetence(true);
      }
    } catch (err) {
      console.error('Erro ao carregar dados para consolidação:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
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
    const yrs = new Set<string>([String(now.getFullYear()), selectedYear]);
    reports.forEach((r) => {
      if (r.date) yrs.add(r.date.slice(0, 4));
    });
    transactions.forEach((t) => {
      if (t.date) yrs.add(t.date.slice(0, 4));
    });
    return Array.from(yrs).filter(Boolean).sort().reverse();
  }, [reports, transactions, selectedYear]);

  const competenceLabel = useMemo(() => {
    if (consolidateAllMonths) return 'TODAS AS COMPETÊNCIAS';
    return `${selectedMonth}/${selectedYear}`;
  }, [consolidateAllMonths, selectedMonth, selectedYear]);

  const filteredReports = useMemo(() => {
    if (consolidateAllMonths) return reports.filter((r) => !r.deletedAt);
    const targetPrefix = `${selectedYear}-${selectedMonth}`;
    return reports.filter((r) => !r.deletedAt && (r.date || '').startsWith(targetPrefix));
  }, [reports, consolidateAllMonths, selectedMonth, selectedYear]);

  const filteredTransactions = useMemo(() => {
    if (consolidateAllMonths) {
      return transactions.filter((t) => !(t as any).deletedAt && t.status !== 'AGENDADO');
    }
    const targetPrefix = `${selectedYear}-${selectedMonth}`;
    return transactions.filter(
      (t) =>
        !(t as any).deletedAt &&
        t.status !== 'AGENDADO' &&
        (t.date || '').startsWith(targetPrefix)
    );
  }, [transactions, consolidateAllMonths, selectedMonth, selectedYear]);

  const consolidatedReport = useMemo(() => {
    return consolidateFinancialData({
      reports: filteredReports,
      transactions: filteredTransactions,
      competenceLabel,
      settings: churchSettings,
      users,
    });
  }, [filteredReports, filteredTransactions, competenceLabel, churchSettings, users]);

  const handleExportPDF = async () => {
    const [settings] = await Promise.all([getSettings(), getDefaultLogoDataUrl()]);
    const doc = buildOfficialReportPDF(consolidatedReport, settings);
    const safeComp = competenceLabel.replace(/[^a-zA-Z0-9_-]/g, '_');
    doc.save(`ADGU_Relatorio_Geral_Consolidado_${safeComp}.pdf`);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCopyText = async () => {
    try {
      const text = formatConsolidatedReportText(consolidatedReport);
      await navigator.clipboard.writeText(text);
      setCopiedNotice(true);
      setTimeout(() => setCopiedNotice(false), 3000);
    } catch (e) {
      console.error('Erro ao copiar texto:', e);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10 print:space-y-0 print:pb-0">
      {/* Área Exclusiva de Impressão Nativa */}
      <div id="printable-report-area" className="hidden print:block w-full">
        <PrintableReportView report={consolidatedReport} settings={churchSettings} forceMode="CONSOLIDATED" />
      </div>

      {/* Barra de Controle e Seleção de Competência (Oculta na Impressão) */}
      <div className="bg-white p-5 sm:p-6 rounded-[2rem] border border-slate-200/80 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4 print:hidden">
        <div>
          <h2 className="text-lg sm:text-xl font-black text-[#0f172a] uppercase tracking-tight">
            Relatório Financeiro Geral Consolidado
          </h2>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
            Consolidação única de todas as receitas e despesas da competência selecionada
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Seletor de Competência (Mês/Ano) */}
          <div className="flex items-center gap-2 bg-slate-50 px-3.5 py-2.5 rounded-xl border border-slate-200">
            <CalendarIcon size={15} className="text-[#1d4ed8]" />
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
              Competência:
            </span>
            <select
              value={consolidateAllMonths ? 'ALL' : selectedMonth}
              onChange={(e) => {
                if (e.target.value === 'ALL') {
                  setConsolidateAllMonths(true);
                } else {
                  setConsolidateAllMonths(false);
                  setSelectedMonth(e.target.value);
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

            {!consolidateAllMonths && (
              <>
                <span className="text-slate-300 font-bold">/</span>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
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

          <button
            type="button"
            onClick={loadData}
            className="p-2.5 bg-slate-50 text-slate-600 rounded-xl border border-slate-200 hover:text-[#1d4ed8] hover:bg-blue-50 transition-all"
            title="Sincronizar Dados"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin text-[#1d4ed8]' : ''} />
          </button>

          <button
            type="button"
            onClick={handleCopyText}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 text-[#1d4ed8] border border-blue-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-100 transition-all"
          >
            {copiedNotice ? <CheckCircle size={15} /> : <Copy size={15} />}
            {copiedNotice ? 'Copiado!' : 'Copiar Texto'}
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-sm"
          >
            <Printer size={15} /> Imprimir
          </button>

          <button
            type="button"
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#1d4ed8] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-800 transition-all shadow-sm"
          >
            <FileDown size={15} /> Baixar PDF
          </button>
        </div>
      </div>

      {/* Resultado Final: SOMENTE O RELATÓRIO GERAL CONSOLIDADO */}
      <div className="print:hidden">
        <PrintableReportView report={consolidatedReport} settings={churchSettings} forceMode="CONSOLIDATED" />
      </div>
    </div>
  );
};

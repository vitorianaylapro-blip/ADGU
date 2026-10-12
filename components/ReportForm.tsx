import React, { useState, useEffect, useRef } from 'react';
import { FinancialReport, MiscItem, UserSession } from '../types';
import {
  CheckCircle,
  Lock,
  Info,
  Plus,
  Trash2,
  ArrowRight,
  ArrowLeft,
  UploadCloud,
  RefreshCw,
  FileText,
  AlertCircle,
  TrendingUp,
  Wallet,
  Calendar,
  Download,
  Printer,
  Cloud,
  ExternalLink,
} from 'lucide-react';
import { saveReport, getSettings, getTransactions, getUsers } from '../services/storageService';
import { sendReportEmailToAdmin } from '../services/emailService';
import {
  isGoogleDriveConfigured,
  requestGoogleAccessToken,
  uploadFileToDrive,
} from '../services/googleDriveService';
import {
  buildOfficialReportPDF,
  classifyExpenseCategory,
  isSedeTransferRevenue,
  formatBRL,
  OfficialReportPDFData,
  getDefaultLogoDataUrl,
} from '../services/reportPdfService';
import { PrintableReportView } from './PrintableReportView';

interface ReportFormProps {
  session: UserSession;
  initialData?: FinancialReport;
  readOnly?: boolean;
  onFinished: () => void;
  onCancel: () => void;
}

type FormTab = 'RECEITAS' | 'DESPESAS' | 'ANEXOS' | 'RESUMO';

const SPECIAL_EXPENSE_KEYS = [
  'ÁGUA E COPOS',
  'SANTA CEIA',
  'GASOLINA',
  'MATERIAL SECRETARIA/TESOURARIA',
  'OUTRAS DESPESAS MINISTERIAIS',
] as const;

export const ReportForm: React.FC<ReportFormProps> = ({
  session,
  initialData,
  readOnly = false,
  onFinished,
  onCancel,
}) => {
  const extractInitialSpecialExpense = (targetCanonical: string): number => {
    if (!initialData?.otherExpenses) return 0;
    return initialData.otherExpenses
      .filter((item) => classifyExpenseCategory(item.description || '') === targetCanonical)
      .reduce((sum, item) => sum + (Number(item.value) || 0), 0);
  };

  const extractInitialCustomOtherExpenses = (): MiscItem[] => {
    if (!initialData?.otherExpenses) return [];
    return initialData.otherExpenses.filter((item) => {
      const cat = classifyExpenseCategory(item.description || '');
      return !SPECIAL_EXPENSE_KEYS.includes(cat as any);
    });
  };

  const [activeTab, setActiveTab] = useState<FormTab>(readOnly ? 'RESUMO' : 'RECEITAS');
  const [date, setDate] = useState(initialData?.date || new Date().toISOString().split('T')[0]);

  const [tithes, setTithes] = useState(initialData?.tithes || 0);
  const [offers, setOffers] = useState(initialData?.offers || 0);
  const [specialOffers, setSpecialOffers] = useState(initialData?.specialOffers || 0);
  const [interestRevenue, setInterestRevenue] = useState(
    initialData?.interestRevenue || initialData?.financialRevenue || 0
  );
  const [rentRevenue, setRentRevenue] = useState(initialData?.rentRevenue || 0);
  const [otherRevenues, setOtherRevenues] = useState<MiscItem[]>(
    initialData?.otherRevenues || []
  );

  const [rent, setRent] = useState(initialData?.rent || 0);
  const [water, setWater] = useState(initialData?.water || 0);
  const [energy, setEnergy] = useState(initialData?.energy || 0);
  const [internet, setInternet] = useState(initialData?.internet || 0);
  const [cleaning, setCleaning] = useState(initialData?.cleaning || 0);
  const [maintenance, setMaintenance] = useState(initialData?.maintenance || 0);
  const [missions, setMissions] = useState(initialData?.missions || 0);
  const [social, setSocial] = useState(initialData?.social || 0);

  // Standard consolidated model expense categories stored in otherExpenses JSONB
  const [aguaECopos, setAguaECopos] = useState<number>(() =>
    extractInitialSpecialExpense('ÁGUA E COPOS')
  );
  const [santaCeia, setSantaCeia] = useState<number>(() =>
    extractInitialSpecialExpense('SANTA CEIA')
  );
  const [gasolina, setGasolina] = useState<number>(() =>
    extractInitialSpecialExpense('GASOLINA')
  );
  const [materialSecretaria, setMaterialSecretaria] = useState<number>(() =>
    extractInitialSpecialExpense('MATERIAL SECRETARIA/TESOURARIA')
  );
  const [outrasDespesasMinisteriais, setOutrasDespesasMinisteriais] = useState<number>(() =>
    extractInitialSpecialExpense('OUTRAS DESPESAS MINISTERIAIS')
  );

  const [otherExpenses, setOtherExpenses] = useState<MiscItem[]>(() =>
    extractInitialCustomOtherExpenses()
  );

  const [attachments, setAttachments] = useState<
    { name: string; type: string; data: string; driveId?: string; viewLink?: string }[]
  >(initialData?.attachments || []);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [previousBalance, setPreviousBalance] = useState(initialData?.previousBalance || 0);
  const [cashBalance, setCashBalance] = useState(initialData?.cashBalance || 0);
  const [pixBalance, setPixBalance] = useState(initialData?.pixBalance || 0);
  const [churchSettings, setChurchSettings] = useState<any>(null);
  const [dateInput, setDateInput] = useState(date.split('-').reverse().join('/'));
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [skipGoogleDrive, setSkipGoogleDrive] = useState(false);
  const [isDriveConfigured] = useState(isGoogleDriveConfigured());
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [isUploadingToDrive, setIsUploadingToDrive] = useState(false);
  const [authorIsDept, setAuthorIsDept] = useState(false);

  useEffect(() => {
    getSettings().then((s) => {
      setChurchSettings(s);
    });
    if (initialData) {
      getUsers()
        .then((users) => {
          const matched = users.find(
            (u) =>
              (initialData.userId && u.id === initialData.userId) ||
              (initialData.institutionName &&
                u.institution.toLowerCase().trim() ===
                  initialData.institutionName.toLowerCase().trim())
          );
          if (matched && (matched.role === 'DEPT_TREASURER' || matched.noDiscount)) {
            setAuthorIsDept(true);
          }
        })
        .catch(() => {});
    }
  }, [initialData]);

  useEffect(() => {
    if (date) {
      const parts = date.split('-');
      if (parts.length === 3) {
        const formatted = `${parts[2]}/${parts[1]}/${parts[0]}`;
        if (dateInput !== formatted) setDateInput(formatted);
      }
    }
  }, [date]);

  const handleConnectGoogle = async () => {
    setIsGoogleLoading(true);
    setGoogleError(null);
    try {
      const token = await requestGoogleAccessToken();
      setGoogleToken(token);
    } catch (err: any) {
      console.error(err);
      setGoogleError(err.message || 'Erro ao conectar conta Google.');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleDateInputChange = (val: string) => {
    if (readOnly) return;
    const clean = val.replace(/\D/g, '').slice(0, 8);
    let formatted = clean;
    if (clean.length > 2) formatted = clean.slice(0, 2) + '/' + clean.slice(2);
    if (clean.length > 4) formatted = formatted.slice(0, 5) + '/' + formatted.slice(5);

    setDateInput(formatted);

    if (clean.length === 8) {
      const d = clean.slice(0, 2);
      const m = clean.slice(2, 4);
      const y = clean.slice(4, 8);
      setDate(`${y}-${m}-${d}`);
    }
  };

  const isUserDeptTreasurer = session.role === 'DEPT_TREASURER' || !!session.noDiscount;
  const isCamposBelos = (initialData?.institutionName || session.institution)
    .toLowerCase()
    .replace(/\s+/g, '')
    .includes('camposbelos');
  const initialHasNoDiscount = !!(
    initialData?.noDiscount ||
    (initialData &&
      initialData.totalRevenue > 0 &&
      (initialData.sedeExpense || 0) === 0 &&
      (initialData.prebendaExpense || 0) === 0)
  );
  const noDiscount =
    isUserDeptTreasurer || isCamposBelos || initialHasNoDiscount || authorIsDept;

  const buildCombinedOtherExpenses = (): MiscItem[] => {
    const combined: MiscItem[] = [];
    if (Number(aguaECopos) > 0) {
      combined.push({ id: 'exp-agua-copos', description: 'ÁGUA E COPOS', value: Number(aguaECopos) });
    }
    if (Number(santaCeia) > 0) {
      combined.push({ id: 'exp-santa-ceia', description: 'SANTA CEIA', value: Number(santaCeia) });
    }
    if (Number(gasolina) > 0) {
      combined.push({ id: 'exp-gasolina', description: 'GASOLINA', value: Number(gasolina) });
    }
    if (Number(materialSecretaria) > 0) {
      combined.push({
        id: 'exp-mat-sec-tes',
        description: 'MATERIAL SECRETARIA/TESOURARIA',
        value: Number(materialSecretaria),
      });
    }
    if (Number(outrasDespesasMinisteriais) > 0) {
      combined.push({
        id: 'exp-outras-min',
        description: 'OUTRAS DESPESAS MINISTERIAIS',
        value: Number(outrasDespesasMinisteriais),
      });
    }
    for (const item of otherExpenses) {
      if ((item.description && item.description.trim()) || Number(item.value) > 0) {
        combined.push(item);
      }
    }
    return combined;
  };

  const combinedOtherExpenses = buildCombinedOtherExpenses();
  const sumOtherRevenues = otherRevenues.reduce((acc, curr) => acc + (curr.value || 0), 0);
  const financialRevenueTotal = (Number(interestRevenue) || 0) + (Number(rentRevenue) || 0);
  const totalRevenue =
    (Number(tithes) || 0) +
    (Number(offers) || 0) +
    (Number(specialOffers) || 0) +
    financialRevenueTotal +
    sumOtherRevenues;

  // Repasse Sede revenue is 100% integral and EXEMPT from 20% Sede and 20% Prebenda deduction!
  const sedeTransferRevenue = otherRevenues
    .filter((item) => isSedeTransferRevenue(item.description || ''))
    .reduce((acc, curr) => acc + (Number(curr.value) || 0), 0);

  const discountableRevenue = Math.max(0, totalRevenue - sedeTransferRevenue);

  const sedeExpense = noDiscount ? 0 : discountableRevenue * 0.2;
  const prebendaExpense = noDiscount ? 0 : discountableRevenue * 0.2;
  const revenueNetAvailable = noDiscount
    ? totalRevenue
    : discountableRevenue * 0.6 + sedeTransferRevenue;

  const sumOtherExpenses = combinedOtherExpenses.reduce(
    (acc, curr) => acc + (curr.value || 0),
    0
  );
  const totalFixedExpenses =
    (Number(rent) || 0) +
    (Number(water) || 0) +
    (Number(energy) || 0) +
    (Number(internet) || 0) +
    (Number(cleaning) || 0) +
    (Number(maintenance) || 0) +
    (Number(missions) || 0) +
    (Number(social) || 0) +
    sumOtherExpenses;

  const totalExpenses = sedeExpense + prebendaExpense + totalFixedExpenses;
  const saldoGU = revenueNetAvailable - totalFixedExpenses;
  const currentBalance = previousBalance + saldoGU;

  const getCompetenceFromDate = (dateStr: string): string => {
    const parts = (dateStr || '').split('-');
    if (parts.length >= 2) {
      return `${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  const getReportPDFData = (): OfficialReportPDFData => {
    const unitName = initialData?.institutionName || session.institution;
    const reporter = initialData?.reporterName || session.name;
    const refDate = date || initialData?.date || new Date().toISOString().split('T')[0];
    return {
      institutionName: unitName,
      dateLabel: getCompetenceFromDate(refDate),
      reporterName: reporter,
      tithes,
      offers,
      specialOffers,
      financialRevenue: financialRevenueTotal,
      otherRevenues,
      totalRevenue,
      sedeExpense,
      prebendaExpense,
      rent,
      energy,
      water,
      internet,
      cleaning,
      maintenance,
      missions,
      social,
      otherExpenses: combinedOtherExpenses,
      totalFixedExpenses,
      previousBalance,
      saldoGU,
      currentBalance,
      isCamposBelos: noDiscount,
      noDiscount,
    };
  };

  const generatePDF = async () => {
    const [settings] = await Promise.all([getSettings(), getDefaultLogoDataUrl()]);
    const refDate = date || initialData?.date || new Date().toISOString().split('T')[0];
    const unitName = (initialData?.institutionName || session.institution || 'Congregacao').replace(/[^a-zA-Z0-9_-]/g, '_');
    const doc = buildOfficialReportPDF(getReportPDFData(), settings);
    doc.save(`ADGU_Relatorio_${unitName}_${refDate.slice(0, 7)}.pdf`);
  };

  const handlePrintReport = () => {
    window.print();
  };

  const compressImage = (base64Str: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1200;
        let width = img.width;
        let height = img.height;
        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width;
          width = MAX_WIDTH;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      };
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (readOnly) return;
    const files = e.target.files;
    if (!files) return;
    setIsCompressing(true);
    for (const file of Array.from(files) as File[]) {
      try {
        const base64: string = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        const compressed = await compressImage(base64);

        if (isDriveConfigured && googleToken) {
          setIsUploadingToDrive(true);
          try {
            const driveFile = await uploadFileToDrive(
              compressed,
              file.name,
              'image/jpeg',
              googleToken
            );
            setAttachments((prev) => [
              ...prev,
              {
                name: file.name,
                type: 'image/jpeg',
                data: driveFile.thumbnailLink,
                driveId: driveFile.fileId,
                viewLink: driveFile.viewLink,
              },
            ]);
          } catch (err: any) {
            console.error('Erro Google Drive:', err);
            setAttachments((prev) => [
              ...prev,
              { name: file.name, type: 'image/jpeg', data: compressed },
            ]);
          } finally {
            setIsUploadingToDrive(false);
          }
        } else {
          setAttachments((prev) => [
            ...prev,
            { name: file.name, type: 'image/jpeg', data: compressed },
          ]);
        }
      } catch (err) {
        console.error(err);
      }
    }
    setIsCompressing(false);
  };

  const handleDeleteAttachment = async (idx: number) => {
    const at = attachments[idx];
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
    if (at?.driveId && googleToken) {
      try {
        await fetch(`https://www.googleapis.com/drive/v3/files/${at.driveId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${googleToken}` },
        });
      } catch (err) {
        console.warn('Não foi possível excluir o arquivo no Google Drive:', err);
      }
    }
  };

  const handleSubmit = async () => {
    if (readOnly && session.role !== 'ADMIN') {
      onFinished();
      return;
    }
    setIsSaving(true);
    setSaveError(null);
    const report: FinancialReport = {
      id: initialData?.id || crypto.randomUUID(),
      date,
      institutionName: initialData?.institutionName || session.institution,
      reporterName: initialData?.reporterName || session.name,
      userId: initialData?.userId || session.id,
      locked: initialData?.locked || false,

      tithes,
      offers,
      specialOffers,
      interestRevenue,
      rentRevenue,
      financialRevenue: financialRevenueTotal,
      otherRevenues,

      rent,
      water,
      energy,
      internet,
      cleaning,
      maintenance,
      missions,
      social,
      otherExpenses: combinedOtherExpenses,

      totalRevenue,
      totalFixedExpenses,
      sedeExpense,
      prebendaExpense,
      totalExpenses,
      saldoGU,
      currentBalance,
      previousBalance,
      cashBalance,
      pixBalance,
      attachments,
      createdAt: initialData?.createdAt || new Date().toISOString(),
      noDiscount,
    };
    try {
      await saveReport(report);
      sendReportEmailToAdmin(report).catch((e) =>
        console.warn('Aviso no envio de e-mail:', e)
      );
      onFinished();
    } catch (err: any) {
      console.error(err);
      setSaveError(`Falha ao salvar: ${err.message || 'Erro de conexão'}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto animate-in fade-in duration-700 pb-10 print:space-y-0 print:max-w-none print:pb-0">
      {/* Printable Report Area for Native Browser Print */}
      <div id="printable-report-area" className="hidden print:block w-full">
        <PrintableReportView report={getReportPDFData()} settings={churchSettings} forceMode="NORMAL" />
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-4 print:hidden">
        <div className="flex items-center gap-4">
          <button
            onClick={onCancel}
            className="p-3 bg-white text-slate-400 rounded-xl shadow-sm hover:text-[#1d4ed8] transition-colors active-scale"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                {readOnly
                  ? 'Visualização do Relatório'
                  : initialData
                  ? 'Ajustar Lançamentos'
                  : 'Novo Lançamento de Competência'}
              </h2>
              {noDiscount && (
                <span className="px-3 py-1 bg-blue-50 text-[#1d4ed8] border border-blue-200 rounded-full text-[8px] font-black uppercase tracking-widest">
                  Sem Desconto de 20%
                </span>
              )}
            </div>
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
              Competência: {getCompetenceFromDate(date)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handlePrintReport}
            className="bg-slate-900 text-white px-5 py-2.5 rounded-2xl flex items-center gap-2 hover:bg-slate-800 transition-all active-scale shadow-sm"
          >
            <Printer size={16} />
            <span className="text-[8px] font-black uppercase tracking-widest">Imprimir</span>
          </button>
          <button
            onClick={generatePDF}
            className="bg-blue-50 text-[#1d4ed8] px-5 py-2.5 rounded-2xl border border-blue-100 flex items-center gap-2 hover:bg-[#1d4ed8] hover:text-white transition-all active-scale shadow-sm"
          >
            <Download size={16} />
            <span className="text-[8px] font-black uppercase tracking-widest">Exportar PDF</span>
          </button>
          {initialData?.locked && (
            <div className="bg-blue-50 text-[#1d4ed8] px-4 py-2.5 rounded-2xl border border-blue-100 flex items-center gap-2">
              <Lock size={14} />
              <span className="text-[8px] font-black uppercase tracking-widest">
                Apenas Leitura
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-white p-2 rounded-[1.5rem] shadow-soft border border-slate-100 overflow-x-auto no-scrollbar print:hidden gap-1.5">
        {(['RECEITAS', 'DESPESAS', 'ANEXOS', 'RESUMO'] as FormTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 min-w-[100px] py-4 px-6 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all ${
              activeTab === tab
                ? 'bg-[#1d4ed8] text-white shadow-lg shadow-blue-100'
                : 'text-slate-500 hover:bg-blue-50/50 hover:text-[#1d4ed8]'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="bg-white rounded-[3rem] border border-slate-100 p-8 md:p-12 shadow-xl shadow-slate-100/50 min-h-[500px] relative overflow-hidden print:hidden">
        {saveError && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-600 animate-in shake duration-300">
            <AlertCircle size={20} />
            <p className="text-[10px] font-black uppercase">{saveError}</p>
          </div>
        )}

        {activeTab === 'RECEITAS' && (
          <div className="space-y-10 animate-in slide-in-from-right-8 duration-500 relative z-10">
            <div className="max-w-sm">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-4 mb-2 block">
                Data / Competência
              </label>
              <div className="relative">
                <Calendar
                  className="absolute left-5 top-1/2 -translate-y-1/2 text-[#1d4ed8]"
                  size={18}
                />
                <input
                  type="text"
                  disabled={readOnly}
                  value={dateInput}
                  onChange={(e) => handleDateInputChange(e.target.value)}
                  placeholder="DD/MM/AAAA"
                  className="w-full pl-14 pr-6 py-4 bg-slate-50 rounded-2xl border-2 border-transparent font-bold text-sm focus:bg-white focus:border-blue-200 transition-all outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-6">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                  <div className="w-8 h-8 bg-blue-50 rounded-xl flex items-center justify-center text-[#1d4ed8]">
                    <TrendingUp size={16} />
                  </div>
                  <h4 className="text-[10px] font-black uppercase text-slate-900 tracking-widest">
                    Categorias Principais de Receita
                  </h4>
                </div>
                <div className="space-y-4">
                  {[
                    { label: 'RECEITA (Geral / Financeira)', val: interestRevenue, set: setInterestRevenue },
                    { label: 'DÍZIMOS', val: tithes, set: setTithes },
                    { label: 'OFERTAS', val: offers, set: setOffers },
                    { label: 'OFERTAS ESPECIAIS', val: specialOffers, set: setSpecialOffers },
                  ].map((item) => (
                    <div key={item.label}>
                      <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-3 mb-1 block">
                        {item.label}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        disabled={readOnly}
                        value={item.val || ''}
                        onChange={(e) => item.set(Number(e.target.value))}
                        className="w-full p-4 bg-slate-50 rounded-2xl font-black text-sm outline-none border-2 border-transparent focus:bg-white focus:border-blue-200 transition-all"
                        placeholder="0,00"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-50 rounded-xl flex items-center justify-center text-[#1d4ed8]">
                      <Wallet size={16} />
                    </div>
                    <h4 className="text-[10px] font-black uppercase text-slate-900 tracking-widest">
                      Novas Categorias de Receita
                    </h4>
                  </div>
                  {!readOnly && (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setOtherRevenues([
                            ...otherRevenues,
                            { id: crypto.randomUUID(), description: 'REPASSE SEDE', value: 0 },
                          ])
                        }
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl hover:bg-emerald-600 hover:text-white transition-all text-[8px] font-black uppercase tracking-widest shadow-sm"
                        title="Incluir Repasse Sede (Isento de 20% Sede e 20% Prebenda)"
                      >
                        <Plus size={12} /> + Repasse Sede (Isento 20%)
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setOtherRevenues([
                            ...otherRevenues,
                            { id: crypto.randomUUID(), description: '', value: 0 },
                          ])
                        }
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-[#1d4ed8] rounded-xl hover:bg-[#1d4ed8] hover:text-white transition-all text-[8px] font-black uppercase tracking-widest"
                      >
                        <Plus size={12} /> Nova Categoria
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  {otherRevenues.length === 0 && (
                    <p className="text-[10px] text-slate-400 font-medium py-4">
                      Caso haja novas categorias de receita, clique em &ldquo;Nova Categoria&rdquo; ou &ldquo;+ Repasse Sede&rdquo; para incluí-las automaticamente no relatório geral.
                    </p>
                  )}
                  {otherRevenues.map((item) => (
                    <div key={item.id} className="space-y-1.5">
                      <div className="flex gap-2 sm:gap-3 items-center">
                        <input
                          type="text"
                          disabled={readOnly}
                          value={item.description}
                          onChange={(e) =>
                            setOtherRevenues(
                              otherRevenues.map((i) =>
                                i.id === item.id ? { ...i, description: e.target.value } : i
                              )
                            )
                          }
                          className="flex-1 p-4 bg-slate-50 rounded-xl text-xs font-bold outline-none focus:bg-white border border-transparent focus:border-blue-200 uppercase"
                          placeholder="Nome da Categoria (ex: REPASSE SEDE)"
                        />
                        <input
                          type="number"
                          step="0.01"
                          disabled={readOnly}
                          value={item.value || ''}
                          onChange={(e) =>
                            setOtherRevenues(
                              otherRevenues.map((i) =>
                                i.id === item.id ? { ...i, value: Number(e.target.value) } : i
                              )
                            )
                          }
                          className="w-28 sm:w-32 p-4 bg-slate-50 rounded-xl text-xs font-black outline-none focus:bg-white border border-transparent focus:border-blue-200"
                          placeholder="0,00"
                        />
                        {!readOnly && (
                          <button
                            type="button"
                            onClick={() =>
                              setOtherRevenues(otherRevenues.filter((i) => i.id !== item.id))
                            }
                            title="Excluir categoria"
                            className="p-3.5 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-xl transition-colors shrink-0"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                      {isSedeTransferRevenue(item.description) && (
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-[9px] font-bold animate-in fade-in duration-200">
                          <CheckCircle size={12} className="text-emerald-600 shrink-0" />
                          <span>Repasse Sede: Isento de porcentagem de 20% (100% do valor retido).</span>
                        </div>
                      )}
                    </div>
                  ))}

                  {sedeTransferRevenue > 0 && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2.5 text-emerald-800 text-[10px] font-bold">
                      <CheckCircle size={16} className="text-emerald-600 shrink-0" />
                      <span>
                        <strong>Repasse Sede ({formatBRL(sedeTransferRevenue)}):</strong> Não é tirada nenhuma porcentagem de 20% (Repasse Sede ou Prebenda) sobre este valor. O valor integral permanece com a congregação.
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'DESPESAS' && (
          <div className="space-y-10 animate-in slide-in-from-right-8 duration-500 relative z-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-6">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                  <div className="w-8 h-8 bg-blue-50 rounded-xl flex items-center justify-center text-[#1d4ed8]">
                    <Wallet size={16} />
                  </div>
                  <h4 className="text-[10px] font-black uppercase text-slate-900 tracking-widest">
                    Categorias de Despesas (Modelo Oficial)
                  </h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { label: 'AJUDA MISSIONÁRIA', val: missions, set: setMissions },
                    { label: 'ALUGUEL', val: rent, set: setRent },
                    { label: 'ÁGUA', val: water, set: setWater },
                    { label: 'ENERGIA', val: energy, set: setEnergy },
                    { label: 'ÁGUA E COPOS', val: aguaECopos, set: setAguaECopos },
                    { label: 'MATERIAL DE LIMPEZA', val: cleaning, set: setCleaning },
                    { label: 'SANTA CEIA', val: santaCeia, set: setSantaCeia },
                    { label: 'GASOLINA', val: gasolina, set: setGasolina },
                    {
                      label: 'MATERIAL SECRETARIA/TESOURARIA',
                      val: materialSecretaria,
                      set: setMaterialSecretaria,
                    },
                    {
                      label: 'OUTRAS DESPESAS MINISTERIAIS',
                      val: outrasDespesasMinisteriais,
                      set: setOutrasDespesasMinisteriais,
                    },
                  ].map((item) => (
                    <div key={item.label}>
                      <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-2 mb-1 block">
                        {item.label}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        disabled={readOnly}
                        value={item.val || ''}
                        onChange={(e) => item.set(Number(e.target.value))}
                        className="w-full p-3.5 bg-slate-50 rounded-2xl font-black text-sm outline-none border-2 border-transparent focus:bg-white focus:border-blue-200 transition-all"
                        placeholder="0,00"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-50 rounded-xl flex items-center justify-center text-[#1d4ed8]">
                      <Info size={16} />
                    </div>
                    <h4 className="text-[10px] font-black uppercase text-slate-900 tracking-widest">
                      Novas Categorias de Despesas
                    </h4>
                  </div>
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() =>
                        setOtherExpenses([
                          ...otherExpenses,
                          { id: crypto.randomUUID(), description: '', value: 0 },
                        ])
                      }
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-[#1d4ed8] rounded-xl hover:bg-[#1d4ed8] hover:text-white transition-all text-[8px] font-black uppercase tracking-widest"
                    >
                      <Plus size={12} /> Nova Categoria
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  {otherExpenses.length === 0 && (
                    <p className="text-[10px] text-slate-400 font-medium py-2">
                      Os repasses de 20% (Repasse Sede e Prebenda Ministerial) são calculados automaticamente. Para adicionar outras categorias de despesa, clique em &ldquo;Nova Categoria&rdquo;.
                    </p>
                  )}
                  {otherExpenses.map((item) => (
                    <div key={item.id} className="flex gap-3 items-center">
                      <input
                        type="text"
                        disabled={readOnly}
                        value={item.description}
                        onChange={(e) =>
                          setOtherExpenses(
                            otherExpenses.map((i) =>
                              i.id === item.id ? { ...i, description: e.target.value } : i
                            )
                          )
                        }
                        className="flex-1 p-4 bg-slate-50 rounded-xl text-xs font-bold outline-none focus:bg-white border border-transparent focus:border-blue-200 uppercase"
                        placeholder="Nome da Categoria"
                      />
                      <input
                        type="number"
                        step="0.01"
                        disabled={readOnly}
                        value={item.value || ''}
                        onChange={(e) =>
                          setOtherExpenses(
                            otherExpenses.map((i) =>
                              i.id === item.id ? { ...i, value: Number(e.target.value) } : i
                            )
                          )
                        }
                        className="w-32 p-4 bg-slate-50 rounded-xl text-xs font-black outline-none focus:bg-white border border-transparent focus:border-blue-200"
                        placeholder="0,00"
                      />
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() =>
                            setOtherExpenses(otherExpenses.filter((i) => i.id !== item.id))
                          }
                          title="Excluir despesa"
                          className="p-3.5 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-xl transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'ANEXOS' && (
          <div className="space-y-6 animate-in slide-in-from-right-4">
            {isDriveConfigured && !googleToken && !skipGoogleDrive ? (
              <div className="bg-slate-50 border border-slate-100 rounded-[2rem] p-8 text-center flex flex-col items-center justify-center space-y-5 shadow-sm max-w-xl mx-auto my-6">
                <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-[#1d4ed8]">
                  <Cloud size={24} className="animate-pulse" />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase text-slate-800 tracking-tight">
                    Armazenamento em Nuvem Ativo
                  </h4>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mt-2 max-w-sm mx-auto leading-relaxed">
                    Conecte sua conta Google Drive ou utilize o armazenamento local:
                  </p>
                </div>
                {googleError && (
                  <p className="text-[8px] font-black text-rose-500 uppercase bg-rose-50 px-4 py-2 rounded-xl border border-rose-100 max-w-sm">
                    {googleError}
                  </p>
                )}
                <div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
                  <button
                    type="button"
                    disabled={isGoogleLoading}
                    onClick={handleConnectGoogle}
                    className="px-6 py-4 bg-[#1d4ed8] text-white rounded-2xl font-black text-[9px] uppercase tracking-widest shadow-lg shadow-blue-100 active-scale hover:bg-blue-800 transition-all flex items-center justify-center gap-2"
                  >
                    {isGoogleLoading ? (
                      <RefreshCw className="animate-spin" size={14} />
                    ) : (
                      <Cloud size={14} />
                    )}
                    Conectar Google Drive
                  </button>
                  <button
                    type="button"
                    onClick={() => setSkipGoogleDrive(true)}
                    className="px-6 py-4 bg-slate-200/60 text-slate-600 rounded-2xl font-black text-[9px] uppercase tracking-widest active-scale hover:bg-slate-200 transition-all text-center"
                  >
                    Usar Envio Local
                  </button>
                </div>
              </div>
            ) : (
              <>
                {!readOnly && (
                  <div
                    onClick={() => !isUploadingToDrive && fileInputRef.current?.click()}
                    className={`border-2 border-dashed ${
                      isUploadingToDrive
                        ? 'border-blue-100 bg-blue-50/10 cursor-not-allowed'
                        : 'border-slate-200 hover:border-blue-300 cursor-pointer'
                    } rounded-[2rem] p-12 text-center group transition-all`}
                  >
                    {isUploadingToDrive ? (
                      <RefreshCw
                        size={48}
                        className="mx-auto text-[#1d4ed8] animate-spin mb-4"
                      />
                    ) : (
                      <UploadCloud
                        size={48}
                        className="mx-auto text-slate-300 group-hover:text-[#1d4ed8] mb-4 transition-colors"
                      />
                    )}
                    <h4 className="text-[10px] font-black uppercase text-slate-500 group-hover:text-[#1d4ed8]">
                      {isUploadingToDrive
                        ? 'Enviando ao Google Drive...'
                        : 'Comprovantes / Fotos'}
                    </h4>
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      multiple
                      accept="image/*"
                      onChange={handleFileChange}
                      disabled={isUploadingToDrive}
                    />
                  </div>
                )}
              </>
            )}

            {(isCompressing || isUploadingToDrive) && (
              <div className="flex items-center justify-center gap-2 text-[#1d4ed8] font-black text-[9px] uppercase">
                <RefreshCw size={14} className="animate-spin" />
                Processando comprovantes...
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {attachments.map((at, idx) => (
                <div
                  key={idx}
                  className="relative rounded-2xl overflow-hidden aspect-square border group shadow-sm hover:shadow-md transition-all"
                >
                  <img src={at.data} className="w-full h-full object-cover" />
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => handleDeleteAttachment(idx)}
                      title="Excluir comprovante"
                      className="absolute top-2 right-2 z-10 p-2 bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-all shadow-lg"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                  <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    {(at.viewLink || at.data.startsWith('http')) && (
                      <a
                        href={at.viewLink || at.data}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 bg-white text-slate-800 rounded-lg hover:bg-slate-100 transition-all shadow-md"
                      >
                        <ExternalLink size={14} />
                      </a>
                    )}
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => handleDeleteAttachment(idx)}
                        className="px-3 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-all shadow-md flex items-center gap-1 text-[9px] font-black uppercase"
                      >
                        <Trash2 size={14} /> Excluir
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'RESUMO' && (
          <div className="space-y-6 animate-in slide-in-from-right-8 duration-500 relative z-10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 print:hidden">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-50 rounded-xl flex items-center justify-center text-[#1d4ed8]">
                  <FileText size={16} />
                </div>
                <div>
                  <h4 className="text-[10px] font-black uppercase text-slate-900 tracking-widest">
                    Relatório Financeiro da Congregação
                  </h4>
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">
                    Conferência Matemática e Visualização Oficial da Unidade
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handlePrintReport}
                  className="px-5 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-md transition-all active-scale"
                >
                  <Printer size={14} /> Imprimir Relatório
                </button>
                <button
                  type="button"
                  onClick={generatePDF}
                  className="px-5 py-3 bg-[#1d4ed8] hover:bg-blue-800 text-white rounded-2xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-md transition-all active-scale"
                >
                  <Download size={14} /> Baixar Relatório em PDF
                </button>
              </div>
            </div>

            <PrintableReportView report={getReportPDFData()} settings={churchSettings} forceMode="NORMAL" />
          </div>
        )}
      </div>

      {saveError && activeTab === 'RESUMO' && (
        <div className="mx-4 sm:mx-0 p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-600 animate-in shake duration-300">
          <AlertCircle size={20} className="shrink-0" />
          <p className="text-[10px] font-black uppercase">{saveError}</p>
        </div>
      )}

      <div className="flex gap-4 px-4 sm:px-0 print:hidden">
        {activeTab !== 'RESUMO' ? (
          <button
            onClick={() => {
              const tabs: FormTab[] = ['RECEITAS', 'DESPESAS', 'ANEXOS', 'RESUMO'];
              const idx = tabs.indexOf(activeTab);
              setActiveTab(tabs[idx + 1]);
            }}
            className="flex-1 py-5 bg-[#1d4ed8] hover:bg-blue-800 text-white rounded-[2rem] font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 active-scale shadow-xl shadow-blue-200 transition-all"
          >
            Próxima Etapa <ArrowRight size={18} />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={isSaving || (readOnly && session.role !== 'ADMIN')}
            className={`flex-1 py-5 text-white rounded-[2rem] font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 active-scale shadow-xl transition-all ${
              readOnly && session.role !== 'ADMIN'
                ? 'bg-slate-300 shadow-none cursor-not-allowed'
                : 'bg-[#1d4ed8] hover:bg-blue-800 shadow-blue-200'
            }`}
          >
            {isSaving ? (
              <RefreshCw className="animate-spin" size={20} />
            ) : readOnly && session.role !== 'ADMIN' ? (
              'Apenas Visualização'
            ) : (
              <>
                <CheckCircle size={20} /> Salvar no Relatório Consolidado
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};

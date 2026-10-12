import React, { useState, useEffect } from 'react';
import { DailyTransaction, UserSession, FinancialReport } from '../types';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getTransactions, saveTransaction, deleteTransaction, getSettings, getUsers } from '../services/storageService';
import { isSedeTransferRevenue } from '../services/reportPdfService';
import { 
  PlusCircle, Trash2, Edit3, ArrowUpRight, ArrowDownRight, X, Loader2, CheckCircle, 
  DollarSign, Search, Filter, Save, Sparkles, Send, FileOutput, AlertCircle, FileDown, FileText,
  Check, Calendar, Clock, ChevronLeft, ChevronRight, ClipboardCheck, Coins,
  TrendingUp, HelpCircle, Users, UserPlus
} from 'lucide-react';

interface TransactionManagerProps {
  session: UserSession;
  initialTab?: 'CONTROLE_DIARIO' | 'LIVRO_CAIXA' | 'DIZIMISTAS';
  onExportToReport?: (report: FinancialReport) => void;
}

const REVENUE_CATEGORIES = ['Geral', 'Dízimo', 'Oferta', 'Oferta de Missões', 'Oferta Especial', 'Receita Financeira', 'Doação', 'Repasse Sede', 'Crédito Sede'];
const EXPENSE_CATEGORIES = ['Geral', 'Aluguel', 'Energia', 'Água', 'Internet', 'Limpeza', 'Manutenção', 'Prebenda', 'Sede', 'Social'];

export const TransactionManager: React.FC<TransactionManagerProps> = ({ session, initialTab = 'CONTROLE_DIARIO', onExportToReport }) => {
  const [activeTab, setActiveTab] = useState<'CONTROLE_DIARIO' | 'LIVRO_CAIXA' | 'DIZIMISTAS'>(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);
  
  // General Ledger States
  const [transactions, setTransactions] = useState<DailyTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [filterType, setFilterType] = useState<'TODOS' | 'RECEITA' | 'DESPESA'>('TODOS');
  const [filterStatus, setFilterStatus] = useState<'TODOS' | 'PAGO' | 'PENDENTE' | 'AGENDADO'>('TODOS');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMonth, setFilterMonth] = useState<string>(new Date().toISOString().slice(5, 7));
  const [filterYear, setFilterYear] = useState<string>(new Date().getFullYear().toString());
  const [useMonthFilter, setUseMonthFilter] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [editingTx, setEditingTx] = useState<Partial<DailyTransaction> | null>(null);
  const [manualDate, setManualDate] = useState('');
  const [institutions, setInstitutions] = useState<string[]>([]);
  const [selectedInstitution, setSelectedInstitution] = useState<string>(session.role === 'ADMIN' ? 'ALL' : session.institution);

  // States for Tithers (Dizimistas) Management
  const [registeredMembers, setRegisteredMembers] = useState<string[]>([]);
  const [newMemberName, setNewMemberName] = useState('');
  const [dizimistasFilterMonth, setDizimistasFilterMonth] = useState<string>(new Date().toISOString().slice(5, 7));
  const [dizimistasFilterYear, setDizimistasFilterYear] = useState<string>(new Date().getFullYear().toString());

  // Treasurer's Daily Control States
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [cashCounts, setCashCounts] = useState<Record<string, number>>({
    '200': 0, '100': 0, '50': 0, '20': 0, '10': 0, '5': 0, '2': 0,
    '1': 0, '0.50': 0, '0.25': 0, '0.10': 0, '0.05': 0
  });

  // Fast payment layout launch states (in Treasurer Control)
  const [quickTx, setQuickTx] = useState({
    description: '',
    value: '',
    type: 'DESPESA' as 'RECEITA' | 'DESPESA',
    category: 'Geral',
    paymentMethod: 'DINHEIRO' as 'DINHEIRO' | 'PIX',
    status: 'AGENDADO' as 'PAGO' | 'PENDENTE' | 'AGENDADO'
  });

  useEffect(() => {
    loadData();
    if (session.role === 'ADMIN') {
      loadInstitutions();
    }
    const handleUpdate = () => loadData();
    window.addEventListener('transactions-updated', handleUpdate);
    return () => window.removeEventListener('transactions-updated', handleUpdate);
  }, [session.institution]);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getTransactions(selectedInstitution === 'ALL' ? undefined : selectedInstitution);
      setTransactions(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedInstitution]);

  const loadInstitutions = async () => {
    try {
      const users = await getUsers();
      const insts = Array.from(new Set(users.map(u => u.institution))).filter(Boolean).sort();
      setInstitutions(insts);
    } catch (err) {
      console.error("Erro ao carregar congregações:", err);
    }
  };

  // Synchronize members list per congregation with persistence
  useEffect(() => {
    const instKey = selectedInstitution === 'ALL' ? 'geral' : selectedInstitution;
    const stored = localStorage.getItem(`adgu_members_list_${instKey}`);
    if (stored) {
      try {
        setRegisteredMembers(JSON.parse(stored).sort());
      } catch (e) {
        console.error(e);
      }
    } else {
      // Default initial seeds for seamless UX
      const defaults = ["Abraão Silva", "Ester Mendes", "Gideão de Souza", "Isaque Santos", "Noemi Oliveira", "Rute Lima", "Samuel Ferreira"];
      setRegisteredMembers(defaults.sort());
      localStorage.setItem(`adgu_members_list_${instKey}`, JSON.stringify(defaults));
    }
  }, [selectedInstitution]);

  const handleAddMember = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (registeredMembers.some(m => m.toLowerCase() === trimmed.toLowerCase())) {
      setStatusMessage({ type: 'error', text: 'Membro já cadastrado!' });
      return;
    }
    const updated = [...registeredMembers, trimmed].sort();
    setRegisteredMembers(updated);
    const instKey = selectedInstitution === 'ALL' ? 'geral' : selectedInstitution;
    localStorage.setItem(`adgu_members_list_${instKey}`, JSON.stringify(updated));
    setNewMemberName('');
    setStatusMessage({ type: 'success', text: 'Membro cadastrado com sucesso!' });
  };

  const handleDeleteMember = (name: string) => {
    setConfirmDialog({
      title: "Remover Membro Dizimista",
      message: `Deseja realmente remover o nome "${name}" do cadastro de membros desta congregação? Lançamentos anteriores associados continuarão existindo.`,
      onConfirm: () => {
        const updated = registeredMembers.filter(m => m !== name).sort();
        setRegisteredMembers(updated);
        const instKey = selectedInstitution === 'ALL' ? 'geral' : selectedInstitution;
        localStorage.setItem(`adgu_members_list_${instKey}`, JSON.stringify(updated));
        setStatusMessage({ type: 'success', text: 'Membro removido do cadastro!' });
        setConfirmDialog(null);
      },
      onCancel: () => setConfirmDialog(null)
    });
  };

  // State load/save for checklist and cashcounts on selectedDate & selectedInstitution changes
  useEffect(() => {
    const institutionKey = selectedInstitution === 'ALL' ? 'geral' : selectedInstitution;
    const checklistKey = `adgu_checklist_${institutionKey}_${selectedDate}`;
    const cashKey = `adgu_cash_count_${institutionKey}_${selectedDate}`;
    
    try {
      const storedChecklist = localStorage.getItem(checklistKey);
      setChecklist(storedChecklist ? JSON.parse(storedChecklist) : {
        'envelope': false,
        'conciliar_pix': false,
        'lancar_entradas': false,
        'registrar_despesas': false,
        'agenda_futuros': false,
        'conferencia_fisica': false,
        'pdf_backup': false
      });
      
      const storedCash = localStorage.getItem(cashKey);
      setCashCounts(storedCash ? JSON.parse(storedCash) : {
        '200': 0, '100': 0, '50': 0, '20': 0, '10': 0, '5': 0, '2': 0,
        '1': 0, '0.50': 0, '0.25': 0, '0.10': 0, '0.05': 0
      });
    } catch(e) {
      console.error(e);
    }
  }, [selectedDate, selectedInstitution]);

  const handleToggleChecklist = (key: string) => {
    const updated = { ...checklist, [key]: !checklist[key] };
    setChecklist(updated);
    const institutionKey = selectedInstitution === 'ALL' ? 'geral' : selectedInstitution;
    localStorage.setItem(`adgu_checklist_${institutionKey}_${selectedDate}`, JSON.stringify(updated));
  };

  const handleCashCountChange = (denom: string, qty: number) => {
    const updated = { ...cashCounts, [denom]: Math.max(0, qty) };
    setCashCounts(updated);
    const institutionKey = selectedInstitution === 'ALL' ? 'geral' : selectedInstitution;
    localStorage.setItem(`adgu_cash_count_${institutionKey}_${selectedDate}`, JSON.stringify(updated));
  };

  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
  } | null>(null);

  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  useEffect(() => {
    if (statusMessage) {
      const timer = setTimeout(() => setStatusMessage(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [statusMessage]);

  const handleDelete = async (id: string) => {
    setConfirmDialog({
      title: "Excluir Lançamento",
      message: "Deseja realmente excluir este lançamento? Ele será movido para a Lixeira.",
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          setTransactions(prev => prev.filter(t => t.id !== id));
          await deleteTransaction(id);
          loadData();
          setStatusMessage({ type: 'success', text: "Lançamento excluído com sucesso." });
        } catch (err) {
          setStatusMessage({ type: 'error', text: "Erro ao excluir lançamento." });
          loadData();
        }
      },
      onCancel: () => setConfirmDialog(null)
    });
  };

  const handleOpenModal = (tx?: DailyTransaction) => {
    const initialTx = tx || {
      type: 'RECEITA',
      date: new Date().toISOString().split('T')[0],
      status: 'PAGO' as const,
      value: 0,
      description: '',
      category: 'Geral',
      paymentMethod: 'DINHEIRO' as const,
      institutionName: selectedInstitution === 'ALL' ? session.institution : selectedInstitution
    };
    setEditingTx(initialTx);
    setManualDate(initialTx.date ? initialTx.date.split('-').reverse().join('/') : '');
    setShowModal(true);
  };

  const handleManualDateChange = (val: string) => {
    const clean = val.replace(/\D/g, '').slice(0, 8);
    let formatted = clean;
    if (clean.length > 2) formatted = clean.slice(0, 2) + '/' + clean.slice(2);
    if (clean.length > 4) formatted = formatted.slice(0, 5) + '/' + formatted.slice(5);
    
    setManualDate(formatted);
    
    if (clean.length === 8) {
      const d = clean.slice(0, 2);
      const m = clean.slice(2, 4);
      const y = clean.slice(4, 8);
      setEditingTx(prev => prev ? {...prev, date: `${y}-${m}-${d}`} : null);
    }
  };

  const handleSave = async (stayOpen = false) => {
    let finalDescription = editingTx?.description || '';
    if (editingTx?.category === 'Dízimo' && editingTx?.titherName) {
      if (!finalDescription || finalDescription.trim() === '' || finalDescription.trim().toLowerCase() === 'dízimo' || finalDescription.trim().toLowerCase() === 'dizimo') {
        finalDescription = `Dízimo - ${editingTx.titherName}`;
      }
    }

    if (!finalDescription || !editingTx?.value || !editingTx?.date) {
      setStatusMessage({ type: 'error', text: "Por favor, preencha a descrição, valor e data." });
      return;
    }

    setIsSaving(true);
    
    if (window.navigator && window.navigator.vibrate) {
      window.navigator.vibrate(15);
    }

    try {
      const tx: any = {
        ...editingTx,
        description: finalDescription,
        id: editingTx.id || crypto.randomUUID(),
        institutionName: editingTx.institutionName || (selectedInstitution === 'ALL' ? session.institution : selectedInstitution),
        userId: session.id,
        createdAt: editingTx.createdAt || new Date().toISOString()
      };
      
      await saveTransaction(tx);
      setStatusMessage({ type: 'success', text: "Lançamento confirmado e registrado!" });
      
      if (!stayOpen) {
        setShowModal(false);
      } else {
        setEditingTx({
          ...editingTx,
          id: undefined,
          description: '',
          value: 0
        });
      }

      loadData();
    } catch (err) {
      console.error(err);
      setStatusMessage({ type: 'error', text: "Erro ao salvar lançamento. Verifique sua conexão." });
    } finally {
      setIsSaving(false);
    }
  };

  // Quick launch for daily payment schedules
  const handleQuickLaunch = async (e: React.FormEvent) => {
    e.preventDefault();
    const valNum = parseFloat(quickTx.value);
    if (!quickTx.description.trim() || isNaN(valNum) || valNum <= 0) {
      setStatusMessage({ type: 'error', text: "Preencha a descrição e um valor real." });
      return;
    }

    setIsSaving(true);
    try {
      const tx: DailyTransaction = {
        id: crypto.randomUUID(),
        type: quickTx.type,
        date: selectedDate,
        status: quickTx.status,
        value: valNum,
        description: quickTx.description.trim(),
        category: quickTx.category,
        paymentMethod: quickTx.paymentMethod,
        institutionName: selectedInstitution === 'ALL' ? session.institution : selectedInstitution,
        userId: session.id,
        createdAt: new Date().toISOString()
      };

      await saveTransaction(tx);
      setStatusMessage({ 
        type: 'success', 
        text: tx.status === 'AGENDADO' ? 'Pagamento agendado!' : 'Lançamento registrado!'
      });

      // Reset description & value
      setQuickTx(prev => ({ ...prev, description: '', value: '' }));
      loadData();
    } catch (err) {
      console.error(err);
      setStatusMessage({ type: 'error', text: 'Erro ao registrar.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmScheduledPayment = async (tx: DailyTransaction) => {
    setConfirmDialog({
      title: "Confirmar Pagamento",
      message: `Deseja quitar e registrar o pagamento de "${tx.description}" (${formatBRL(tx.value)}) no caixa de hoje?`,
      onConfirm: async () => {
        try {
          const updated: DailyTransaction = {
            ...tx,
            status: 'PAGO',
            date: selectedDate // Settle it on currently selected day
          };
          await saveTransaction(updated);
          setStatusMessage({ type: 'success', text: "Pagamento quitado com sucesso!" });
          setConfirmDialog(null);
          loadData();
        } catch (err) {
          console.error(err);
          setStatusMessage({ type: 'error', text: "Erro ao confirmar pagamento." });
          setConfirmDialog(null);
        }
      },
      onCancel: () => setConfirmDialog(null)
    });
  };

  const formatBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  // General Filtered Data for Ledger
  const filteredData = transactions
    .filter(tx => filterType === 'TODOS' || tx.type === filterType)
    .filter(tx => filterStatus === 'TODOS' || tx.status === filterStatus)
    .filter(tx => {
      if (!useMonthFilter) return true;
      const [y, m] = tx.date.split('-');
      return y === filterYear && m === filterMonth;
    })
    .filter(tx => tx.description.toLowerCase().includes(searchTerm.toLowerCase()) || tx.category.toLowerCase().includes(searchTerm.toLowerCase()));

  // General totals (calculated only on PAID entries to keep standard of cash accounting)
  const totals = filteredData.reduce((acc, curr) => {
    if (curr.status !== 'PAGO') return acc;
    if (curr.type === 'RECEITA') {
      acc.receitas += curr.value;
      if (curr.paymentMethod === 'PIX') acc.pix += curr.value;
      else acc.caixa += curr.value;
    } else {
      acc.despesas += curr.value;
      if (curr.paymentMethod === 'PIX') acc.pix -= curr.value;
      else acc.caixa -= curr.value;
    }
    return acc;
  }, { receitas: 0, despesas: 0, caixa: 0, pix: 0 });

  // 1. Daily Control statistics (specific selectedDate)
  const dailyTransactions = transactions.filter(t => t.date === selectedDate);
  const dailyTotals = dailyTransactions.reduce((acc, curr) => {
    if (curr.status !== 'PAGO') return acc;
    if (curr.type === 'RECEITA') {
      acc.receitas += curr.value;
      if (curr.paymentMethod === 'PIX') acc.pix += curr.value;
      else acc.caixa += curr.value;
    } else {
      acc.despesas += curr.value;
      if (curr.paymentMethod === 'PIX') acc.pix -= curr.value;
      else acc.caixa -= curr.value;
    }
    return acc;
  }, { receitas: 0, despesas: 0, caixa: 0, pix: 0 });

  // 2. Scheduled/Agenda payments (Active overall PENDENTE or AGENDADO)
  const allScheduledAndPending = transactions.filter(tx => tx.status === 'AGENDADO' || tx.status === 'PENDENTE');

  // Unified absolute cash tracking in check-drawer (cumulative physical cash in hand)
  const theoreticalTotalCashBalance = transactions.reduce((acc, tx) => {
    if (tx.status !== 'PAGO') return acc;
    if (tx.paymentMethod !== 'DINHEIRO') return acc;
    return tx.type === 'RECEITA' ? acc + tx.value : acc - tx.value;
  }, 0);

  // Counts summation
  const denominations = [
    { label: 'Cédulas de R$ 200', val: 200, k: '200' },
    { label: 'Cédulas de R$ 100', val: 100, k: '100' },
    { label: 'Cédulas de R$ 50', val: 50, k: '50' },
    { label: 'Cédulas de R$ 20', val: 20, k: '20' },
    { label: 'Cédulas de R$ 10', val: 10, k: '10' },
    { label: 'Cédulas de R$ 5', val: 5, k: '5' },
    { label: 'Cédulas de R$ 2', val: 2, k: '2' },
    { label: 'Moedas de R$ 1,00', val: 1.00, k: '1' },
    { label: 'Moedas de R$ 0,50', val: 0.50, k: '0.50' },
    { label: 'Moedas de R$ 0,25', val: 0.25, k: '0.25' },
    { label: 'Moedas de R$ 0,10', val: 0.10, k: '0.10' },
    { label: 'Moedas de R$ 0,05', val: 0.05, k: '0.05' },
  ];

  const totalPhysicalCounter = denominations.reduce((sum, item) => {
    return sum + (item.val * (cashCounts[item.k] || 0));
  }, 0);

  const physicalCashGap = totalPhysicalCounter - theoreticalTotalCashBalance;

  const handleImportJson = async () => {
    try {
      setImportError(null);
      const data = JSON.parse(importJson);
      if (!Array.isArray(data)) throw new Error("O formato deve ser uma lista de lançamentos.");
      
      let count = 0;
      for (const item of data) {
        if (item.description && item.value) {
          await saveTransaction({
            id: crypto.randomUUID(),
            type: item.type || 'RECEITA',
            date: item.date || new Date().toISOString().split('T')[0],
            status: item.status || 'PAGO',
            value: Number(item.value),
            description: item.description,
            category: item.category || 'Geral',
            paymentMethod: item.paymentMethod || 'DINHEIRO',
            institutionName: selectedInstitution === 'ALL' ? session.institution : selectedInstitution,
            userId: session.id,
            createdAt: new Date().toISOString()
          });
          count++;
        }
      }
      
      setStatusMessage({ type: 'success', text: `${count} lançamentos importados com sucesso!` });
      setShowImportModal(false);
      setImportJson('');
      loadData();
    } catch (err: any) {
      setImportError(err.message || "Erro ao processar o JSON.");
    }
  };

  const addDoubleSignatureBlock = (doc: any, signatureY: number, settings: any) => {
    const pageWidth = doc.internal.pageSize.getWidth();
    
    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.3);

    // Left side: Treasurer
    const tName = settings.treasurerName || session.name || "Tesoureiro Local";
    const tRole = settings.treasurerRole || "Tesoureiro Responsável";

    doc.line(20, signatureY, 90, signatureY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(tName.toUpperCase(), 55, signatureY + 4, { align: 'center' });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(tRole, 55, signatureY + 8, { align: 'center' });

    // Right side: Pastor
    const pName = settings.pastorName || settings.president || "Pr. Antônio Chaves Crus";
    const pRole = settings.pastorRole || "Pastor Presidente / Dirigente";

    doc.line(pageWidth - 90, signatureY, pageWidth - 20, signatureY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(pName.toUpperCase(), pageWidth - 55, signatureY + 4, { align: 'center' });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(pRole, pageWidth - 55, signatureY + 8, { align: 'center' });
  };

  const generateRoteiroPDF = async () => {
    const settings = await getSettings();
    const doc = new jsPDF() as any;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Top Brand Bar
    doc.setFillColor(79, 70, 229);
    doc.rect(0, 0, pageWidth, 38, 'F');

    if (settings.logo) {
      try {
        doc.addImage(settings.logo, 'PNG', 12, 6, 20, 20);
      } catch (e) { console.error(e); }
    }

    doc.setFontSize(13); doc.setFont("helvetica", "bold"); doc.setTextColor(255, 255, 255);
    doc.text(settings.institutionName.toUpperCase(), 36, 15);

    doc.setFontSize(8.5); doc.setFont("helvetica", "normal"); doc.setTextColor(224, 231, 255);
    doc.text(`ROTEIRO DIÁRIO E CONCILIAÇÃO DE CAIXA FÍSICO`, 36, 21);
    const instName = selectedInstitution === 'ALL' ? session.institution : selectedInstitution;
    doc.text(`CONGREGAÇÃO: ${instName.toUpperCase()} | DATA DE REFERÊNCIA: ${new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR')}`, 36, 26);
    doc.text(`RESPONSÁVEL PELA EMISSÃO: ${session.name.toUpperCase()}`, 36, 31);

    let currentY = 46;

    // Section 1: Checklist de Etapas
    doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.setTextColor(15, 23, 42);
    doc.text("1. ETAPAS E VERIFICAÇÕES DO TESOUREIRO NO DIA", 15, currentY);
    currentY += 4;

    const checklistItems = [
      { k: 'envelope', label: 'Conferir e contar ofertas/votos nos envelopes do culto' },
      { k: 'conciliar_pix', label: 'Conciliar depósitos PIX com extrato e comprovantes bancários' },
      { k: 'lancar_entradas', label: 'Lançar dízimos, ofertas e doações no Livro Caixa (Entradas)' },
      { k: 'registrar_despesas', label: 'Registrar recibos físicos e pagamentos ocorridos hoje' },
      { k: 'agenda_futuros', label: 'Verificar pauta de agendamentos e registrar contas a pagar futuras' },
      { k: 'pdf_backup', label: 'Exportar Backup do Livro Caixa diário/semanal' }
    ];

    const checklistBody = checklistItems.map((item, idx) => [
      idx + 1,
      item.label,
      checklist[item.k] ? 'CONCLUÍDO / OK' : 'PENDENTE'
    ]);

    autoTable(doc, {
      startY: currentY,
      margin: { left: 15, right: 15 },
      head: [['Nº', 'ITEM DE CONFERÊNCIA DIÁRIA', 'STATUS']],
      body: checklistBody,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontSize: 8 },
      styles: { fontSize: 7.5, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        2: { cellWidth: 35, halign: 'center', fontStyle: 'bold' }
      }
    });

    currentY = ((doc as any).lastAutoTable?.finalY || currentY + 30) + 12;

    // Section 2: Resumo do Caixa Teórico
    doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.setTextColor(15, 23, 42);
    doc.text("2. RESUMO DE CONCILIAÇÃO DO CAIXA", 15, currentY);
    currentY += 6;

    doc.setFillColor(248, 250, 252);
    doc.roundedRect(15, currentY, pageWidth - 30, 20, 2, 2, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(15, currentY, pageWidth - 30, 20, 'D');

    doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(15, 23, 42);
    doc.text(`SALDO REGISTRADO EM DINHEIRO: ${formatBRL(theoreticalTotalCashBalance)}`, 20, currentY + 8);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(100, 116, 139);
    doc.text(`Demonstrativo gerado em base aos lançamentos quitados da congregação.`, 20, currentY + 14);

    currentY += 30;

    // Section 3: Double Signatures
    let signatureY = currentY;
    if (signatureY > pageHeight - 35) {
      doc.addPage();
      signatureY = 30;
    }

    addDoubleSignatureBlock(doc, signatureY, settings);

    // Footer
    doc.setFont("helvetica", "italic"); doc.setFontSize(6.5); doc.setTextColor(148, 163, 184);
    const now = new Date();
    doc.text(`Roteiro de Conciliação emitido em ${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`, pageWidth / 2, pageHeight - 8, { align: 'center' });

    doc.save(`ADGU_RoteiroDiario_${instName.replace(/\s+/g, '_')}_${selectedDate}.pdf`);
  };

  const generatePDF = async () => {
    const settings = await getSettings();
    const doc = new jsPDF() as any;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    doc.setFillColor(79, 70, 229);
    doc.rect(0, 0, pageWidth, 40, 'F');
    
    doc.setFontSize(14); doc.setFont("helvetica", "bold"); doc.setTextColor(255, 255, 255);
    doc.text(settings.institutionName.toUpperCase(), 15, 18);
    
    doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(255, 255, 255, 0.8);
    doc.text(`LIVRO CAIXA - DETALHAMENTO DE LANÇAMENTOS`, 15, 24);
    doc.text(`UNIDADE: ${(selectedInstitution === 'ALL' ? session.institution : selectedInstitution).toUpperCase()}`, 15, 28);
    
    let periodText = "TODO O HISTÓRICO";
    if (useMonthFilter) {
      const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
      periodText = `${months[parseInt(filterMonth) - 1]} / ${filterYear}`;
    }
    doc.text(`PERÍODO: ${periodText}`, 15, 32);

    const tableBody = filteredData.map(tx => [
      new Date(tx.date).toLocaleDateString('pt-BR'),
      tx.description,
      tx.category,
      tx.paymentMethod,
      tx.status,
      tx.type === 'RECEITA' ? `+ ${formatBRL(tx.value)}` : `- ${formatBRL(tx.value)}`
    ]);

    autoTable(doc, {
      startY: 50,
      head: [['DATA', 'DESCRIÇÃO', 'CATEGORIA', 'FORMA', 'STATUS', 'VALOR']],
      body: tableBody,
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 3 },
      headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255] },
      columnStyles: { 5: { halign: 'right', fontStyle: 'bold' } }
    });

    let finalY = ((doc as any).lastAutoTable?.finalY || 70) + 10;
    if (finalY > pageHeight - 50) { doc.addPage(); finalY = 20; }

    doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(15, 23, 42);
    doc.text("RESUMO DO PERÍODO (APENAS PAGOS/QUITADOS):", 15, finalY);
    
    doc.setFontSize(8); doc.setFont("helvetica", "normal");
    doc.text(`TOTAL RECEITAS: ${formatBRL(totals.receitas)}`, 15, finalY + 6);
    doc.text(`TOTAL DESPESAS: ${formatBRL(totals.despesas)}`, 15, finalY + 11);
    
    doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(79, 70, 229);
    doc.text(`SALDO FINAL REAL DE CAIXA: ${formatBRL(totals.receitas - totals.despesas)}`, 15, finalY + 18);

    // Signatures
    let sigY = finalY + 36;
    if (sigY > pageHeight - 25) { doc.addPage(); sigY = 30; }
    addDoubleSignatureBlock(doc, sigY, settings);

    doc.save(`ADGU_LivroCaixa_${(selectedInstitution === 'ALL' ? session.institution : selectedInstitution).replace(/\s+/g, '_')}_${periodText.replace(/\s+/g, '_')}.pdf`);
  };

  // Monthly Dízimos Calculation for the reports view
  const monthlyDizimos = transactions
    .filter(tx => {
      const cat = (tx.category || '').toLowerCase();
      const desc = (tx.description || '').toLowerCase();
      return cat.includes('dízimo') || cat.includes('dizimo') || desc.includes('dízimo') || desc.includes('dizimo');
    })
    .filter(tx => {
      if (!tx.date) return false;
      const [y, m] = tx.date.split('-');
      return y === dizimistasFilterYear && m === dizimistasFilterMonth;
    })
    .filter(tx => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        (tx.titherName || '').toLowerCase().includes(term) ||
        tx.description.toLowerCase().includes(term)
      );
    })
    .sort((a, b) => (a.titherName || a.description).localeCompare(b.titherName || b.description));

  const generateDizimistasPDF = async () => {
    const settings = await getSettings();
    const doc = new jsPDF() as any;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    // Background decoration
    doc.setFillColor(248, 250, 252);
    doc.rect(0, 0, pageWidth, 35, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.line(0, 35, pageWidth, 35);

    if (settings.logo) {
      try { 
        const logoWidth = 18;
        const logoHeight = 18;
        doc.addImage(settings.logo, 'PNG', 15, 8, logoWidth, logoHeight); 
      } catch (e) {
        console.error("Logo error", e);
      }
    }
    
    // Header Info (Professional Helvetica)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11); 
    doc.setTextColor(15, 23, 42);
    doc.text(settings.institutionName.toUpperCase(), 38, 14);
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10); 
    doc.setTextColor(79, 70, 229); // Brand indigo color
    doc.text(`RELAÇÃO MENSAL DE DIZIMISTAS E CONTRIBUINTES`, 38, 20);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5); 
    doc.setTextColor(100, 116, 139);
    const instName = selectedInstitution === 'ALL' ? session.institution : selectedInstitution;
    doc.text(`CONGREGAÇÃO: ${instName.toUpperCase()}`, 38, 25);
    
    const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const periodText = `${months[parseInt(dizimistasFilterMonth) - 1]} / ${dizimistasFilterYear}`;
    doc.text(`COMPETÊNCIA: ${periodText.toUpperCase()}`, 38, 29);

    const tableBody = monthlyDizimos.map((tx, idx) => [
      idx + 1,
      tx.titherName || tx.description.replace(/^Dízimo\s*-\s*/, '') || "Contribuinte Não Identificado",
      new Date(tx.date + 'T12:00:00').toLocaleDateString('pt-BR'),
      tx.paymentMethod,
      tx.status === 'PAGO' ? 'QUITADO' : tx.status,
      formatBRL(tx.value)
    ]);

    autoTable(doc, {
      startY: 42,
      head: [['Nº', 'NOME DO DIZIMISTA / CONTRIBUINTE', 'DATA REC.', 'MEIO', 'STATUS', 'VALOR']],
      body: tableBody,
      theme: 'grid',
      styles: { 
        fontSize: 8.5, 
        cellPadding: 2, 
        lineColor: [226, 232, 240], 
        lineWidth: 0.1,
        textColor: [15, 23, 42]
      },
      headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255] },
      columnStyles: { 
        0: { cellWidth: 10, halign: 'center' },
        2: { cellWidth: 30, halign: 'center' },
        3: { cellWidth: 22, halign: 'center' },
        4: { cellWidth: 25, halign: 'center' },
        5: { cellWidth: 35, halign: 'right', fontStyle: 'bold' } 
      }
    });

    let currentY = ((doc as any).lastAutoTable?.finalY || 70) + 8;
    if (currentY > pageHeight - 55) { doc.addPage(); currentY = 15; }

    // Summary Box
    doc.setFillColor(30, 41, 59);
    doc.roundedRect(15, currentY, pageWidth - 30, 22, 1.5, 1.5, 'F');
    
    const totalArrecadado = monthlyDizimos.filter(m => m.status === 'PAGO').reduce((acc, curr) => acc + curr.value, 0);
    const countNomes = new Set(monthlyDizimos.filter(m => m.status === 'PAGO').map(m => m.titherName || "Identificado")).size;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9); 
    doc.setTextColor(255, 255, 255);
    doc.text("RESUMO DA ARRECADAÇÃO DE DÍZIMOS", 22, currentY + 7);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8); 
    doc.setTextColor(203, 213, 225);
    doc.text(`CONTRIBUINTES ATIVOS NO MÊS: ${countNomes}`, 22, currentY + 14);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(129, 140, 248); // Indigo highlight 
    doc.text(`TOTAL ARRECADADO NO MÊS: ${formatBRL(totalArrecadado)}`, pageWidth - 22, currentY + 13, { align: 'right' });

    // Double Signature Block (Treasurer & Pastor)
    let signatureY = currentY + 36;
    if (signatureY > pageHeight - 25) { 
      doc.addPage(); 
      signatureY = 30; 
    }

    addDoubleSignatureBlock(doc, signatureY, settings);

    // Footer
    doc.setFont("helvetica", "italic");
    doc.setFontSize(6.5); 
    doc.setTextColor(148, 163, 184);
    const now = new Date();
    const dateStr = now.toLocaleDateString('pt-BR');
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    doc.text(`Documento gerado em ${dateStr} às ${timeStr} via Sistema ADGU Finanças`, pageWidth / 2, pageHeight - 8, { align: 'center' });

    doc.save(`ADGU_Relatorio_Dizimistas_${instName.replace(/\s+/g, '_')}_${periodText.replace(/\s+/g, '_')}.pdf`);
  };

  const handleExportToReport = () => {
    // Collect strictly the ones with status 'PAGO'
    const paidOnlyFilter = filteredData.filter(tx => tx.status === 'PAGO');

    if (paidOnlyFilter.length === 0) {
      setStatusMessage({ type: 'error', text: "Não há lançamentos QUITADOS/PAGOS no filtro atual para exportar." });
      return;
    }

    setConfirmDialog({
      title: "Exportar para Relatório",
      message: `Deseja exportar apenas os ${paidOnlyFilter.length} lançamentos QUITADOS filtrados para um novo relatório ministerial?`,
      onConfirm: async () => {
        try {
          setConfirmDialog(null);
          const report: FinancialReport = {
            id: crypto.randomUUID(),
            date: selectedDate,
            institutionName: selectedInstitution === 'ALL' ? session.institution : selectedInstitution,
            reporterName: session.name,
            userId: session.id,
            locked: false,
            tithes: 0,
            offers: 0,
            specialOffers: 0,
            interestRevenue: 0,
            rentRevenue: 0,
            financialRevenue: 0,
            otherRevenues: [],
            rent: 0,
            water: 0,
            energy: 0,
            internet: 0,
            cleaning: 0,
            maintenance: 0,
            missions: 0,
            social: 0,
            otherExpenses: [],
            totalRevenue: 0,
            totalFixedExpenses: 0,
            sedeExpense: 0,
            prebendaExpense: 0,
            totalExpenses: 0,
            saldoGU: 0,
            currentBalance: 0,
            previousBalance: 0,
            cashBalance: 0,
            pixBalance: 0,
            attachments: [],
            createdAt: new Date().toISOString()
          };

          const otherRevenuesMap: Record<string, number> = {};
          const otherExpensesMap: Record<string, number> = {};

          paidOnlyFilter.forEach(tx => {
            const val = Number(tx.value) || 0;
            if (tx.type === 'RECEITA') {
              if (tx.category === 'Dízimo') report.tithes += val;
              else if (tx.category === 'Oferta') report.offers += val;
              else if (tx.category === 'Oferta Especial') report.specialOffers += val;
              else if (tx.category === 'Receita Financeira') report.interestRevenue += val;
              else {
                otherRevenuesMap[tx.category] = (otherRevenuesMap[tx.category] || 0) + val;
              }
            } else {
              if (tx.category === 'Aluguel') report.rent += val;
              else if (tx.category === 'Energia') report.energy += val;
              else if (tx.category === 'Água') report.water += val;
              else if (tx.category === 'Internet') report.internet += val;
              else if (tx.category === 'Limpeza') report.cleaning += val;
              else if (tx.category === 'Manutenção') report.maintenance += val;
              else if (tx.category === 'Oferta de Missões') report.missions += val;
              else if (tx.category === 'Social') report.social += val;
              else {
                otherExpensesMap[tx.category] = (otherExpensesMap[tx.category] || 0) + val;
              }
            }
          });

          report.otherRevenues = Object.entries(otherRevenuesMap).map(([desc, val]) => ({
            id: crypto.randomUUID(),
            description: desc,
            value: val
          }));

          report.otherExpenses = Object.entries(otherExpensesMap).map(([desc, val]) => ({
            id: crypto.randomUUID(),
            description: desc,
            value: val
          }));

          // Recalculate totals
          const financialRevenueTotal = report.interestRevenue + report.rentRevenue;
          report.financialRevenue = financialRevenueTotal;
          const sumOtherRevenues = report.otherRevenues.reduce((acc, curr) => acc + curr.value, 0);
          report.totalRevenue = report.tithes + report.offers + report.specialOffers + financialRevenueTotal + sumOtherRevenues;

          const isCamposBelos = (selectedInstitution === 'ALL' ? session.institution : selectedInstitution).toLowerCase().replace(/\s+/g, '').includes('camposbelos');

          // Repasse Sede is 100% integral and EXEMPT from 20% deductions
          const sedeTransferRevenue = report.otherRevenues
            .filter((item) => isSedeTransferRevenue(item.description || ''))
            .reduce((acc, curr) => acc + (Number(curr.value) || 0), 0);
          const discountableRev = Math.max(0, report.totalRevenue - sedeTransferRevenue);

          report.sedeExpense = isCamposBelos ? 0 : discountableRev * 0.20;
          report.prebendaExpense = isCamposBelos ? 0 : discountableRev * 0.20;
          const revenue60 = isCamposBelos ? report.totalRevenue : (discountableRev * 0.60) + sedeTransferRevenue;

          const sumOtherExpenses = report.otherExpenses.reduce((acc, curr) => acc + curr.value, 0);
          report.totalFixedExpenses = report.rent + report.water + report.energy + report.internet + 
                                     report.cleaning + report.maintenance + report.missions + report.social + sumOtherExpenses;
          
          report.totalExpenses = report.sedeExpense + report.prebendaExpense + report.totalFixedExpenses;
          report.saldoGU = revenue60 - report.totalFixedExpenses;

          onExportToReport?.(report);
          setStatusMessage({ type: 'success', text: "Lançamentos exportados com sucesso!" });
        } catch (err) {
          setStatusMessage({ type: 'error', text: "Erro ao exportar lançamentos." });
        }
      },
      onCancel: () => setConfirmDialog(null)
    });
  };

  const isFormValid = editingTx?.description && editingTx?.value && Number(editingTx.value) > 0;

  // Change single day helpers
  const handlePrevDay = () => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-10">
      
      {/* Top Banner & Tab Toggle */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden">
        <div className="relative z-10 space-y-1">
          <span className="text-[8px] font-black uppercase tracking-[0.25em] text-indigo-400">Canal Executivo de Finanças</span>
          <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight">Livro Caixa &amp; Controle Diário</h2>
          <p className="text-[9px] text-slate-300 font-bold uppercase">Congregação Ativa: <span className="text-indigo-300">{selectedInstitution === 'ALL' ? 'Todas as Unidades' : selectedInstitution}</span></p>
        </div>

        {/* Tab Toggle Navigation */}
        <div className="flex bg-white/10 backdrop-blur-md p-1 rounded-2xl relative z-10 border border-white/10 self-stretch md:self-auto flex-wrap md:flex-nowrap gap-1">
          <button 
            onClick={() => setActiveTab('CONTROLE_DIARIO')}
            className={`flex-1 md:flex-none px-4 py-3 rounded-xl text-[9px] font-bold uppercase tracking-widest transition-all whitespace-nowrap flex items-center justify-center gap-2 ${activeTab === 'CONTROLE_DIARIO' ? 'bg-white text-slate-950 shadow-md font-black' : 'text-slate-200 hover:text-white hover:bg-white/5'}`}
          >
            <ClipboardCheck size={14} /> Controle Diário
          </button>
          <button 
            onClick={() => setActiveTab('LIVRO_CAIXA')}
            className={`flex-1 md:flex-none px-4 py-3 rounded-xl text-[9px] font-bold uppercase tracking-widest transition-all whitespace-nowrap flex items-center justify-center gap-2 ${activeTab === 'LIVRO_CAIXA' ? 'bg-white text-slate-950 shadow-md font-black' : 'text-slate-200 hover:text-white hover:bg-white/5'}`}
          >
            <Coins size={14} /> Extrato do Caixa
          </button>
          <button 
            onClick={() => setActiveTab('DIZIMISTAS')}
            className={`flex-1 md:flex-none px-4 py-3 rounded-xl text-[9px] font-bold uppercase tracking-widest transition-all whitespace-nowrap flex items-center justify-center gap-2 ${activeTab === 'DIZIMISTAS' ? 'bg-white text-slate-950 shadow-md font-black' : 'text-slate-200 hover:text-white hover:bg-white/5'}`}
          >
            <Users size={14} /> Dizimistas
          </button>
        </div>
      </div>

      {/* ALERTA DE SALDO NEGATIVO E PAGAMENTOS EM ATRASO */}
      {(() => {
        const todayStr = new Date().toISOString().split('T')[0];
        const overdueList = transactions.filter(t => (t.status === 'PENDENTE' || t.status === 'AGENDADO') && t.date < todayStr);
        const isNegativeBalance = (totals.receitas - totals.despesas) < 0;

        if (!isNegativeBalance && overdueList.length === 0) return null;

        return (
          <div className="space-y-3">
            {isNegativeBalance && (
              <div className="bg-rose-50 border-2 border-rose-200 p-4 rounded-2xl flex items-center justify-between gap-4 text-rose-900 shadow-sm animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-rose-600 text-white rounded-xl font-bold">
                    <AlertCircle size={20} />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-rose-950">Atenção: Saldo de Caixa Negativo!</h4>
                    <p className="text-[11px] font-medium text-rose-700">
                      O saldo atual das movimentações quitadas está negativo em <strong className="font-black text-rose-900">{formatBRL(totals.receitas - totals.despesas)}</strong>.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {overdueList.length > 0 && (
              <div className="bg-amber-50 border-2 border-amber-200 p-4 rounded-2xl flex items-center justify-between gap-4 text-amber-900 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-amber-500 text-white rounded-xl font-bold">
                    <Clock size={20} />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-amber-950">Alerta de Pagamentos em Atraso</h4>
                    <p className="text-[11px] font-medium text-amber-800">
                      Existem <strong className="font-black">{overdueList.length} pagamento(s) agendado(s) ou pendente(s)</strong> com data vencida anterior a hoje.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setActiveTab('CONTROLE_DIARIO');
                  }}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-black text-[9px] uppercase tracking-widest rounded-xl transition-all shadow-sm shrink-0"
                >
                  Ver Agendados
                </button>
              </div>
            )}
          </div>
        );
      })()}

      {/* ADMIN CONGREGATION FILTER */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-50 text-indigo-600 p-2.5 rounded-2xl">
            <TrendingUp size={16} />
          </div>
          <div>
            <h4 className="text-[10px] font-black uppercase text-slate-400">Filtrar por Unidade / Congregação</h4>
            <p className="text-xs font-black text-slate-800 uppercase">{selectedInstitution === 'ALL' ? 'Todas Unidades ADGU' : selectedInstitution}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {session.role === 'ADMIN' && (
            <select 
              value={selectedInstitution} 
              onChange={e => setSelectedInstitution(e.target.value)}
              className="bg-slate-50 border border-slate-100 text-[10px] font-black uppercase outline-none cursor-pointer text-slate-900 py-3 px-4 rounded-xl"
            >
              <option value="ALL">Todas Unidades</option>
              {institutions.map(inst => (
                <option key={inst} value={inst}>{inst}</option>
              ))}
            </select>
          )}

          {activeTab === 'CONTROLE_DIARIO' && (
            <button 
              onClick={generateRoteiroPDF}
              className="flex items-center gap-2 bg-slate-900 text-white hover:bg-black transition-colors px-5 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest active-scale shadow-sm"
            >
              <FileText size={15} /> Gerar PDF do Roteiro
            </button>
          )}

          <button 
            onClick={() => handleOpenModal()} 
            className="flex items-center gap-2 bg-indigo-600 text-white hover:bg-indigo-700 transition-colors px-6 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest active-scale"
          >
            <PlusCircle size={15} /> Novo Lançamento
          </button>
        </div>
      </div>

      {/* TAB CONTENT 1: CONTROLE DIÁRIO DO TESOUREIRO */}
      {activeTab === 'CONTROLE_DIARIO' && (
        <div className="space-y-6 animate-in fade-in duration-500">
          
          {/* Day Selector & Quick Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-stretch">
            
            {/* Elegant day selector card */}
            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-soft flex flex-col justify-between min-h-[160px]">
              <div>
                <span className="text-[8px] font-black uppercase tracking-wider text-slate-400">DATA DE CONCILIAÇÃO</span>
                <div className="flex items-center justify-between mt-3">
                  <button onClick={handlePrevDay} className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl transition-all">
                    <ChevronLeft size={16} />
                  </button>
                  <input 
                    type="date" 
                    value={selectedDate}
                    onChange={e => setSelectedDate(e.target.value)}
                    className="bg-transparent font-black text-xs text-center border-b border-indigo-200 focus:border-indigo-500 outline-none cursor-pointer max-w-[130px]"
                  />
                  <button onClick={handleNextDay} className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl transition-all">
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
              <div className="pt-4 border-t border-slate-50 flex items-center justify-between text-[8px] font-black text-slate-400 uppercase tracking-widest">
                <span>DIA SELECIONADO</span>
                <span className="text-indigo-600 underline cursor-pointer" onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}>HOJE</span>
              </div>
            </div>

            {/* Inflows today */}
            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-soft flex flex-col justify-between h-[160px]">
              <div className="flex justify-between items-center">
                <span className="text-[8px] font-black uppercase tracking-wider text-slate-400">ENTRADAS DO DIA</span>
                <span className="bg-emerald-50 text-emerald-600 p-2.5 rounded-2xl"><ArrowUpRight size={16} /></span>
              </div>
              <div>
                <h3 className="text-2xl font-black text-emerald-500">{formatBRL(dailyTotals.receitas)}</h3>
                <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">PIX: {formatBRL(dailyTotals.pix)} | Dinheiro: {formatBRL(dailyTotals.caixa)}</p>
              </div>
            </div>

            {/* Outflows today (Payments) */}
            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-soft flex flex-col justify-between h-[160px]">
              <div className="flex justify-between items-center">
                <span className="text-[8px] font-black uppercase tracking-wider text-slate-400">SAÍDAS (PAGO) HOJE</span>
                <span className="bg-rose-50 text-rose-600 p-2.5 rounded-2xl"><ArrowDownRight size={16} /></span>
              </div>
              <div>
                <h3 className="text-2xl font-black text-rose-500">{formatBRL(dailyTotals.despesas)}</h3>
                <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">Saldos efetivos quitados</p>
              </div>
            </div>

            {/* Net liquid for today */}
            <div className="bg-slate-900 border border-slate-800 text-white p-6 rounded-[2rem] shadow-lg flex flex-col justify-between h-[160px]">
              <div className="flex justify-between items-center">
                <span className="text-[8px] font-black uppercase tracking-wider text-indigo-300">SALDO REAL DO DIA</span>
                <span className="bg-white/10 text-white p-2.5 rounded-2xl"><DollarSign size={16} /></span>
              </div>
              <div>
                <h3 className="text-2xl font-black text-indigo-300">{formatBRL(dailyTotals.receitas - dailyTotals.despesas)}</h3>
                <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">Fluxo líquido consolidado</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left/Middle block: Checklist & Bill Counter */}
            <div className="lg:col-span-8 space-y-6">
              
              {/* Routine Checklist & Guidelines */}
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-soft">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-900">Roteiro Diário de Fechamento</h3>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">Instruções regulamentadas do tesoureiro para a data: {new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
                  </div>
                  <span className="bg-indigo-50 text-indigo-600 text-[8px] font-black px-3 py-1 rounded-full uppercase">
                    {Object.values(checklist).filter(Boolean).length} / {Object.keys(checklist).length} ETAPAS
                  </span>
                </div>

                <div className="space-y-3">
                  {[
                    { k: 'envelope', label: 'Conferir e contar ofertas/votos nos envelopes do culto' },
                    { k: 'conciliar_pix', label: 'Conciliar depósitos PIX com extrato e comprovantes bancários' },
                    { k: 'lancar_entradas', label: 'Lançar dízimos, ofertas e doações no Livro Caixa (Entradas)' },
                    { k: 'registrar_despesas', label: 'Registrar recibos físicos e pagamentos ocorridos hoje' },
                    { k: 'agenda_futuros', label: 'Verificar pauta de agendamentos e registrar contas a pagar futuras' },
                    { k: 'conferencia_fisica', label: 'Conferência de valores e fechamento do dia' },
                    { k: 'pdf_backup', label: 'Exportar Backup do Livro Caixa diário/semanal' }
                  ].map(item => (
                    <div 
                      key={item.k} 
                      onClick={() => handleToggleChecklist(item.k)}
                      className={`flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer ${
                        checklist[item.k] 
                          ? 'bg-indigo-50/50 border-indigo-100 text-slate-500 LineThrough' 
                          : 'bg-slate-50/50 border-slate-100 text-slate-800 hover:bg-slate-100/50'
                      }`}
                    >
                      <div className={`p-1.5 rounded-lg border-2 transition-colors ${checklist[item.k] ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 text-transparent'}`}>
                        <Check size={10} strokeWidth={4} />
                      </div>
                      <span className={`text-xs font-bold uppercase tracking-tight ${checklist[item.k] ? 'line-through text-slate-400' : ''}`}>{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Right block: Scheduled Payments list & Quick launch payment */}
            <div className="lg:col-span-4 space-y-6">
              
              {/* Quick Launch payment / schedule payment */}
              <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-soft">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2.5 bg-rose-50 text-rose-600 rounded-2xl">
                    <Clock size={16} />
                  </div>
                  <div>
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-900">Agendar / Lançar Saída</h3>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Registre pagamentos rápidos ou programe saídas</p>
                  </div>
                </div>

                <form onSubmit={handleQuickLaunch} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-slate-400 uppercase ml-2 select-none">Descrição da Despesa</label>
                    <input 
                      type="text" 
                      placeholder="Ex: Água, Luz, Faxina, Aluguel..."
                      value={quickTx.description}
                      onChange={e => setQuickTx(prev => ({ ...prev, description: e.target.value }))}
                      className="w-full px-4 py-3 bg-slate-50 border border-transparent rounded-xl font-bold text-xs outline-none focus:bg-white focus:border-indigo-100"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-slate-400 uppercase ml-2 select-none">Valor (R$)</label>
                      <input 
                        type="number" 
                        step="0.01"
                        placeholder="0.00"
                        value={quickTx.value}
                        onChange={e => setQuickTx(prev => ({ ...prev, value: e.target.value }))}
                        className="w-full px-4 py-3 bg-slate-50 border border-transparent rounded-xl font-black text-xs outline-none focus:bg-white focus:border-indigo-100"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-slate-400 uppercase ml-2 select-none">Categoria</label>
                      <select 
                        value={quickTx.category}
                        onChange={e => setQuickTx(prev => ({ ...prev, category: e.target.value }))}
                        className="w-full px-4 py-3 bg-slate-50 border border-transparent rounded-xl font-bold text-xs cursor-pointer outline-none focus:bg-white"
                      >
                        {EXPENSE_CATEGORIES.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-slate-400 uppercase ml-2 select-none">Forma de Saída</label>
                      <select 
                        value={quickTx.paymentMethod}
                        onChange={e => setQuickTx(prev => ({ ...prev, paymentMethod: e.target.value as any }))}
                        className="w-full px-4 py-3 bg-slate-50 border border-transparent rounded-xl font-bold text-xs cursor-pointer outline-none focus:bg-white"
                      >
                        <option value="DINHEIRO">Dinheiro</option>
                        <option value="PIX">PIX</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-slate-400 uppercase ml-2 select-none">Status Inicial</label>
                      <select 
                        value={quickTx.status}
                        onChange={e => setQuickTx(prev => ({ ...prev, status: e.target.value as any }))}
                        className="w-full px-4 py-3 bg-slate-50 border border-transparent rounded-xl font-bold text-xs cursor-pointer outline-none focus:bg-white"
                      >
                        <option value="AGENDADO">Agendado/Progr.</option>
                        <option value="PENDENTE">Pendente</option>
                        <option value="PAGO">Pago na Hora</option>
                      </select>
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    disabled={isSaving}
                    className="w-full py-4 mt-2 bg-slate-900 text-white rounded-xl font-black text-[9px] uppercase tracking-widest active-scale hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-md"
                  >
                    {isSaving ? <Loader2 className="animate-spin" size={14} /> : <PlusCircle size={14} />} Agendar ou Lançar Despesa
                  </button>
                </form>
              </div>

              {/* Waiting list of scheduled Payments & Overdues with click settle */}
              <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-soft space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-900">Agenda de Pagamentos</h3>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Pendentes ou programações do ministério</p>
                  </div>
                  <span className="bg-rose-50 text-rose-600 text-[8px] font-black px-2.5 py-1 rounded-full uppercase">
                    {allScheduledAndPending.length} LANÇAMENTOS
                  </span>
                </div>

                <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                  {allScheduledAndPending.map(tx => {
                    const isOverdue = tx.date < new Date().toISOString().split('T')[0];
                    return (
                      <div 
                        key={tx.id} 
                        className="p-4 rounded-xl border border-slate-100 bg-slate-50 flex flex-col justify-between space-y-3 group hover:border-indigo-100 transition-all"
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <span className={`text-[7px] font-black px-1.5 py-0.5 rounded uppercase ${
                              tx.status === 'AGENDADO' ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'
                            }`}>
                              {tx.status}
                            </span>
                            <h4 className="text-[10px] font-black text-slate-900 uppercase mt-1 leading-tight">{tx.description}</h4>
                            <p className="text-[7px] font-bold text-slate-400 uppercase mt-0.5 flex items-center gap-1">
                              <Calendar size={10} /> {new Date(tx.date + 'T12:00:00').toLocaleDateString('pt-BR')} 
                              {isOverdue && <span className="text-rose-500 font-extrabold">(VENCIDO)</span>}
                            </p>
                          </div>
                          <span className="text-[11px] font-black text-rose-500 whitespace-nowrap">{formatBRL(tx.value)}</span>
                        </div>

                        <div className="flex justify-between items-center pt-2 border-t border-slate-100/50 gap-2">
                          <span className="text-[7px] font-bold text-slate-400 uppercase">Via {tx.paymentMethod}</span>
                          <div className="flex items-center gap-1.5">
                            <button 
                              type="button"
                              onClick={() => handleConfirmScheduledPayment(tx)}
                              className="bg-blue-50 text-[#1d4ed8] hover:bg-[#1d4ed8] hover:text-white border border-blue-100 rounded-lg px-2.5 py-1.5 text-[8px] font-black uppercase tracking-wider transition-all flex items-center gap-1"
                            >
                              <Check size={10} /> Quitar / Pagar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenModal(tx)}
                              title="Editar agendamento"
                              className="p-1.5 bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-[#1d4ed8] rounded-lg transition-all"
                            >
                              <Edit3 size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(tx.id)}
                              title="Excluir agendamento"
                              className="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-lg transition-all"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {allScheduledAndPending.length === 0 && (
                    <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      <CheckCircle className="mx-auto text-emerald-500 opacity-60" size={24} />
                      <p className="text-[8px] font-black text-slate-400 uppercase mt-2">Nenhum agendamento pendente</p>
                    </div>
                  )}
                </div>
              </div>

            </div>

          </div>

        </div>
      )}

      {/* TAB CONTENT 2: LIVRO CAIXA GERAL TABLE */}
      {activeTab === 'LIVRO_CAIXA' && (
        <div className="space-y-6 animate-in fade-in duration-500">
          
          {/* Quick Stats Cards for period */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-[2rem] shadow-soft border border-slate-100 flex items-center justify-between group hover:shadow-lg transition-shadow">
              <div>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Receitas do Filtro (PAGO)</p>
                <h3 className="text-xl font-black text-emerald-500">{formatBRL(totals.receitas)}</h3>
              </div>
              <div className="p-3 bg-emerald-50 text-emerald-500 rounded-2xl group-hover:scale-110 transition-transform">
                <ArrowUpRight size={20}/>
              </div>
            </div>
            <div className="bg-white p-6 rounded-[2rem] shadow-soft border border-slate-100 flex items-center justify-between group hover:shadow-lg transition-shadow">
              <div>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Saídas do Filtro (PAGO)</p>
                <h3 className="text-xl font-black text-rose-500">{formatBRL(totals.despesas)}</h3>
              </div>
              <div className="p-3 bg-rose-50 text-rose-500 rounded-2xl group-hover:scale-110 transition-transform">
                <ArrowDownRight size={20}/>
              </div>
            </div>
            <div className="bg-white p-6 rounded-[2rem] shadow-soft border border-slate-100 flex items-center justify-between group hover:shadow-lg transition-shadow">
              <div>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Líquido em Dinheiro (Filtro)</p>
                <h3 className="text-xl font-black text-amber-600">{formatBRL(totals.caixa)}</h3>
              </div>
              <div className="p-3 bg-amber-50 text-amber-500 rounded-2xl group-hover:scale-110 transition-transform">
                <DollarSign size={20}/>
              </div>
            </div>
            <div className="bg-slate-900 p-6 rounded-[2rem] text-white shadow-xl shadow-slate-200 flex items-center justify-between group overflow-hidden relative">
              <div className="relative z-10">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest opacity-60">Líquido em PIX (Filtro)</p>
                <h3 className="text-xl font-black text-indigo-400">{formatBRL(totals.pix)}</h3>
              </div>
              <Sparkles size={80} className="absolute -right-4 -bottom-4 text-white opacity-5 group-hover:scale-110 transition-transform"/>
            </div>
          </div>

          {/* Filters Interface Grid */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
            
            {/* Filter by Type */}
            <div className="md:col-span-3">
              <label className="text-[7px] font-black text-slate-400 uppercase tracking-wider mb-1.5 block ml-1 select-none">Tipo de Operação</label>
              <div className="flex bg-slate-50 p-1.5 rounded-xl border border-slate-100 w-full">
                {['TODOS', 'RECEITA', 'DESPESA'].map((t: any) => (
                  <button 
                    key={t} 
                    onClick={() => setFilterType(t)} 
                    className={`flex-1 text-center py-2.5 rounded-lg text-[8px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${filterType === t ? 'bg-white text-slate-900 shadow-sm font-black' : 'text-slate-400'}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Filter by Status */}
            <div className="md:col-span-3">
              <label className="text-[7px] font-black text-slate-400 uppercase tracking-wider mb-1.5 block ml-1 select-none">Status de Registro</label>
              <select 
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-100 text-[10px] font-black uppercase outline-none text-slate-900 p-3.5 rounded-xl cursor-pointer"
              >
                <option value="TODOS">Todos os Status</option>
                <option value="PAGO">Pago / Quitado</option>
                <option value="PENDENTE">Pendentes</option>
                <option value="AGENDADO">Agendados</option>
              </select>
            </div>

            {/* Search inputs */}
            <div className="md:col-span-3">
              <label className="text-[7px] font-black text-slate-400 uppercase tracking-wider mb-1.5 block ml-1 select-none">Pesquisa de Histórico</label>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                <input 
                  type="text" 
                  placeholder="Pesquisar..." 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-xl outline-none font-bold text-xs"
                />
              </div>
            </div>

            {/* Custom Month option */}
            <div className="md:col-span-3 flex h-full items-end justify-between items-center gap-2 pt-5 md:pt-0">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[7px] font-black text-slate-400 uppercase tracking-wider block ml-1 select-none">Por Mês?</label>
                  <input 
                    type="checkbox" 
                    checked={useMonthFilter} 
                    onChange={e => setUseMonthFilter(e.target.checked)} 
                    className="cursor-pointer accent-indigo-600 scale-100" 
                  />
                </div>
                {useMonthFilter ? (
                  <div className="flex items-center gap-1">
                    <select 
                      value={filterMonth} 
                      onChange={e => setFilterMonth(e.target.value)}
                      className="bg-slate-50 border border-slate-100 text-[9px] font-black uppercase outline-none cursor-pointer text-slate-900 py-2.5 px-2 rounded-xl flex-1"
                    >
                      <option value="01">Jan</option>
                      <option value="02">Fev</option>
                      <option value="03">Mar</option>
                      <option value="04">Abr</option>
                      <option value="05">Mai</option>
                      <option value="06">Jun</option>
                      <option value="07">Jul</option>
                      <option value="08">Ago</option>
                      <option value="09">Set</option>
                      <option value="10">Out</option>
                      <option value="11">Nov</option>
                      <option value="12">Dez</option>
                    </select>
                    <input 
                      type="number" 
                      value={filterYear} 
                      onChange={e => setFilterYear(e.target.value)}
                      className="bg-slate-50 border border-slate-100 text-[9px] font-black uppercase outline-none py-2.5 px-2 rounded-xl w-14 text-center"
                    />
                  </div>
                ) : (
                  <div className="text-[9px] font-black text-slate-300 uppercase py-2 bg-slate-50 rounded-xl text-center border mr-2 select-none">Todo o Histórico</div>
                )}
              </div>
            </div>
          </div>

          {/* Table Utilities Bar */}
          <div className="flex flex-wrap justify-between items-center gap-4 bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block ml-2">
              EXIBINDO {filteredData.length} LANÇAMENTOS DO LIVRO CAIXA
            </span>

            <div className="flex flex-wrap gap-2">
              <button 
                onClick={() => setShowImportModal(true)} 
                className="flex items-center gap-2.5 px-5 py-3 bg-slate-50 text-slate-600 rounded-xl font-bold text-[9px] uppercase tracking-wider hover:bg-slate-100 transition-all border border-slate-100"
              >
                📥 Importar JSON
              </button>
              <button 
                onClick={generatePDF} 
                className="flex items-center gap-2.5 px-5 py-3 bg-slate-900 text-white rounded-xl font-bold text-[9px] uppercase tracking-wider hover:bg-black transition-all shadow-md"
              >
                📄 Gerar PDF
              </button>
              <button 
                onClick={handleExportToReport} 
                className="flex items-center gap-2.5 px-5 py-3 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl font-bold text-[9px] uppercase tracking-wider hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
              >
                📊 Exportar p/ Relatório
              </button>
            </div>
          </div>

          {/* Ledger Table Rendering */}
          <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-soft overflow-hidden overflow-x-auto">
            <table className="w-full text-left min-w-[700px] border-collapse animate-in fade-in">
              <thead>
                <tr className="bg-slate-50/50 text-[8px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                  <th className="px-6 py-5">Descrição / Data</th>
                  <th className="px-6 py-5">Categoria</th>
                  <th className="px-6 py-5">Forma</th>
                  <th className="px-6 py-5">Unidade</th>
                  <th className="px-6 py-5">Status</th>
                  <th className="px-6 py-5 text-right">Valor</th>
                  <th className="px-6 py-5 text-center w-28">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  <tr><td colSpan={7} className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-indigo-500" size={32}/></td></tr>
                ) : filteredData.length === 0 ? (
                  <tr><td colSpan={7} className="p-20 text-center text-slate-300 font-black uppercase text-[10px]">Nenhum lançamento encontrado nos filtros</td></tr>
                ) : filteredData.map(tx => (
                  <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-tight truncate max-w-[200px] group-hover:text-indigo-600 transition-colors">{tx.description}</h4>
                      <p className="text-[7px] font-bold text-slate-400 uppercase mt-0.5">{new Date(tx.date + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-[8px] font-black px-2.5 py-1 rounded-md uppercase ${tx.type === 'RECEITA' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                        {tx.category}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-[8px] font-black px-2.5 py-1 rounded-md uppercase ${tx.paymentMethod === 'PIX' ? 'bg-indigo-50 text-indigo-600' : 'bg-amber-50 text-amber-600'}`}>
                        {tx.paymentMethod}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[8px] font-bold text-slate-500 uppercase truncate max-w-[120px] block">{tx.institutionName}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-[8px] font-black px-2.5 py-1 rounded-md uppercase ${
                        tx.status === 'PAGO' 
                          ? 'bg-blue-50 text-blue-600' 
                          : tx.status === 'AGENDADO'
                          ? 'bg-indigo-50 text-indigo-600'
                          : 'bg-amber-50 text-amber-600'
                      }`}>
                        {tx.status}
                      </span>
                    </td>
                    <td className={`px-6 py-4 text-right font-black text-xs ${tx.type === 'RECEITA' ? 'text-emerald-600' : 'text-slate-900'}`}>
                      {tx.type === 'RECEITA' ? '+' : '-'} {formatBRL(tx.value)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {tx.status !== 'PAGO' && (
                          <button 
                            type="button"
                            onClick={() => handleConfirmScheduledPayment(tx)} 
                            title="Quitar / Pagar"
                            className="p-2 bg-blue-50 text-[#1d4ed8] hover:bg-[#1d4ed8] hover:text-white rounded-xl transition-colors active-scale"
                          >
                            <Check size={14} strokeWidth={3} />
                          </button>
                        )}
                        <button type="button" onClick={() => handleOpenModal(tx)} title="Editar lançamento" className="p-2 bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-[#1d4ed8] rounded-xl transition-colors active-scale"><Edit3 size={15}/></button>
                        <button type="button" onClick={() => handleDelete(tx.id)} title="Excluir lançamento" className="p-2 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-xl transition-colors active-scale"><Trash2 size={15}/></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* TAB CONTENT 3: REGISTRO DE DIZIMISTAS */}
      {activeTab === 'DIZIMISTAS' && (
        <div className="space-y-6 animate-in fade-in duration-500">
          
          {/* Quick Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-in fade-in">
            <div className="bg-white p-6 rounded-[2rem] shadow-soft border border-slate-100 flex items-center justify-between group hover:shadow-lg transition-all duration-300">
              <div>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Total de Dízimos (Mês)</p>
                <h3 className="text-xl font-black text-slate-900 mt-1">
                  {formatBRL(monthlyDizimos.filter(tx => tx.status === 'PAGO').reduce((acc, curr) => acc + curr.value, 0))}
                </h3>
              </div>
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                <DollarSign size={20}/>
              </div>
            </div>

            <div className="bg-white p-6 rounded-[2rem] shadow-soft border border-slate-100 flex items-center justify-between group hover:shadow-lg transition-all duration-300">
              <div>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Contribuintes Ativos</p>
                <h3 className="text-xl font-black text-slate-900 mt-1">
                  {new Set(monthlyDizimos.filter(tx => tx.status === 'PAGO').map(tx => tx.titherName || 'Identificado')).size}
                </h3>
              </div>
              <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                <Users size={20}/>
              </div>
            </div>

            <div className="bg-white p-6 rounded-[2rem] shadow-soft border border-slate-100 flex items-center justify-between group hover:shadow-lg transition-all duration-300">
              <div>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Dízimo Médio (Doação)</p>
                <h3 className="text-xl font-black text-slate-900 mt-1">
                  {monthlyDizimos.filter(tx => tx.status === 'PAGO').length > 0 
                    ? formatBRL(monthlyDizimos.filter(tx => tx.status === 'PAGO').reduce((acc, curr) => acc + curr.value, 0) / monthlyDizimos.filter(tx => tx.status === 'PAGO').length)
                    : formatBRL(0)
                  }
                </h3>
              </div>
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                <TrendingUp size={20}/>
              </div>
            </div>

            <div className="bg-slate-900 text-white p-6 rounded-[2rem] shadow-xl flex items-center justify-between group overflow-hidden relative">
              <div className="relative z-10">
                <p className="text-[8px] font-black text-indigo-300 uppercase tracking-widest opacity-60">Porcentagem PIX</p>
                <h3 className="text-xl font-black text-indigo-400 mt-1">
                  {monthlyDizimos.filter(tx => tx.status === 'PAGO').length > 0
                    ? `${Math.round((monthlyDizimos.filter(tx => tx.status === 'PAGO' && tx.paymentMethod === 'PIX').length / monthlyDizimos.filter(tx => tx.status === 'PAGO').length) * 100)}%`
                    : '0%'
                  }
                </h3>
              </div>
              <Sparkles size={80} className="absolute -right-4 -bottom-4 text-white opacity-5"/>
            </div>
          </div>

          {/* Filters Control Interface */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm animate-in fade-in">
            {/* Choose Month */}
            <div className="md:col-span-3">
              <label className="text-[7px] font-black text-slate-400 uppercase tracking-wider mb-1.5 block ml-1 select-none">Mês do Relatório</label>
              <select 
                value={dizimistasFilterMonth} 
                onChange={e => setDizimistasFilterMonth(e.target.value)}
                className="w-full bg-slate-50 border border-slate-100 text-[10px] font-black uppercase outline-none text-slate-900 p-3.5 rounded-xl cursor-pointer"
              >
                <option value="01">Janeiro</option>
                <option value="02">Fevereiro</option>
                <option value="03">Março</option>
                <option value="04">Abril</option>
                <option value="05">Maio</option>
                <option value="06">Junho</option>
                <option value="07">Julho</option>
                <option value="08">Agosto</option>
                <option value="09">Setembro</option>
                <option value="10">Outubro</option>
                <option value="11">Novembro</option>
                <option value="12">Dezembro</option>
              </select>
            </div>

            {/* Choose Year */}
            <div className="md:col-span-3">
              <label className="text-[7px] font-black text-slate-400 uppercase tracking-wider mb-1.5 block ml-1 select-none">Ano Exercício</label>
              <input 
                type="number" 
                value={dizimistasFilterYear} 
                onChange={e => setDizimistasFilterYear(e.target.value)}
                className="w-full bg-slate-50 border border-slate-100 text-[10px] font-black outline-none text-slate-900 p-3.5 rounded-xl text-center"
              />
            </div>

            {/* Search filter */}
            <div className="md:col-span-3">
              <label className="text-[7px] font-black text-slate-400 uppercase tracking-wider mb-1.5 block ml-1 select-none">Pesquisar por Dizimista</label>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                <input 
                  type="text" 
                  placeholder="Pesquisar..." 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none font-bold text-xs"
                />
              </div>
            </div>

            {/* Print Official Button */}
            <div className="md:col-span-3 h-full flex items-end">
              <button 
                onClick={generateDizimistasPDF} 
                className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold text-[9px] uppercase tracking-wider hover:bg-black transition-all flex items-center justify-center gap-2 shadow-md hover:scale-[1.02] active-scale h-[48px]"
              >
                <FileDown size={14} /> Relação PDF do Mês
              </button>
            </div>
          </div>

          {/* Grid Layout splits Listings and Registrations */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* LEFT SIDE: Received Tithes Listings */}
            <div className="lg:col-span-8 bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-soft space-y-4">
              <div className="flex justify-between items-center mb-2">
                <div>
                  <h3 className="text-xs font-black uppercase text-slate-900 tracking-tight">Entradas de Dízimos do Período</h3>
                  <p className="text-[8px] font-black text-slate-400 uppercase mt-0.5">Lista de contribuições que entraram na competência</p>
                </div>
                <span className="bg-indigo-50 text-indigo-600 text-[8px] font-black px-2.5 py-1 rounded-full uppercase">
                  {monthlyDizimos.length} ENTRADAS NO PERÍODO
                </span>
              </div>

              <div className="overflow-hidden overflow-x-auto border border-slate-100/50 rounded-2xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 text-[8px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                      <th className="px-4 py-3">Contribuinte / Dizimista</th>
                      <th className="px-4 py-3">Data</th>
                      <th className="px-4 py-3">Meio</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Valor</th>
                      <th className="px-4 py-3 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {monthlyDizimos.map(tx => (
                      <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-4 py-3">
                          <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-tight truncate max-w-[200px]">
                            {tx.titherName || tx.description.replace(/^Dízimo\s*-\s*/, '') || "Contribuinte Não Identificado"}
                          </h4>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[8px] font-bold text-slate-400 uppercase">{new Date(tx.date + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-[7px] font-black px-1.5 py-0.5 rounded uppercase ${tx.paymentMethod === 'PIX' ? 'bg-indigo-50 text-indigo-600' : 'bg-amber-50 text-amber-600'}`}>
                            {tx.paymentMethod}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-[7px] font-black px-1.5 py-0.5 rounded uppercase ${tx.status === 'PAGO' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>
                            {tx.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-black text-[11px] text-emerald-600">
                          {formatBRL(tx.value)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button type="button" onClick={() => handleOpenModal(tx)} title="Editar dízimo" className="p-1.5 bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-[#1d4ed8] rounded-lg transition-colors active-scale"><Edit3 size={13}/></button>
                            <button type="button" onClick={() => handleDelete(tx.id)} title="Excluir dízimo" className="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-lg transition-colors active-scale"><Trash2 size={13}/></button>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {monthlyDizimos.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center py-16 text-slate-300 font-bold uppercase text-[9px]">
                          Nenhum lançamento de dízimo neste mês
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* RIGHT SIDE: Registered Dizimistas Names */}
            <div className="lg:col-span-4 bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-soft space-y-4">
              <div>
                <h3 className="text-xs font-black uppercase text-slate-900 tracking-tight">Cadastro de Dizimistas</h3>
                <p className="text-[8px] font-black text-slate-400 uppercase mt-0.5">Gerencie a lista de membros cadastrados da congregação</p>
              </div>

              {/* Add Member Form */}
              <div className="flex gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-100">
                <input 
                  type="text" 
                  placeholder="Nome completo..." 
                  value={newMemberName}
                  onChange={e => setNewMemberName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddMember(newMemberName)}
                  className="flex-1 px-3 py-2 bg-white rounded-xl text-xs font-bold font-sans outline-none focus:ring-1 focus:ring-blue-100 cursor-text"
                />
                <button 
                  type="button"
                  onClick={() => handleAddMember(newMemberName)}
                  className="p-2.5 bg-[#1d4ed8] hover:bg-blue-800 text-white rounded-xl transition-all font-black text-xs active-scale"
                >
                  <UserPlus size={16} />
                </button>
              </div>

              {/* Members Scrollable List */}
              <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
                {registeredMembers.map(m => (
                  <div key={m} className="flex justify-between items-center p-3 rounded-xl hover:bg-slate-50 transition-colors group">
                    <span className="text-[10px] font-bold text-slate-700 uppercase">{m}</span>
                    <button 
                      type="button"
                      onClick={() => handleDeleteMember(m)}
                      title="Excluir membro dizimista"
                      className="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-lg transition-colors active-scale"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}

                {registeredMembers.length === 0 && (
                  <div className="text-center py-10 text-slate-300 font-bold uppercase text-[8px]">
                    Nenhum membro cadastrado nesta congregação
                  </div>
                )}
              </div>
            </div>

          </div>

        </div>
      )}

      {/* Enhanced Add/Edit Modal (Double support PAGO, PENDENTE, AGENDADO) */}
      {showModal && editingTx && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-300" onClick={() => !isSaving && setShowModal(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-[3rem] p-10 shadow-3xl animate-in zoom-in-95 duration-500">
             <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-xl font-black uppercase text-slate-900 tracking-tight">{editingTx.id ? 'Editar Registro' : 'Novo Lançamento'}</h3>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">Preencha os detalhes financeiros</p>
                </div>
                <button onClick={() => !isSaving && setShowModal(false)} className="p-2 bg-slate-50 text-slate-300 hover:text-slate-900 rounded-xl transition-colors"><X size={20}/></button>
             </div>
             
             <div className="space-y-6">
                <div className="flex bg-slate-100 p-1.5 rounded-[1.5rem] border border-slate-200/50">
                   <button 
                    onClick={() => setEditingTx({...editingTx, type: 'RECEITA'})} 
                    className={`flex-1 py-4 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all ${editingTx.type === 'RECEITA' ? 'bg-white text-emerald-600 shadow-md scale-100' : 'text-slate-400 hover:text-slate-600 scale-95'}`}
                   >Receita</button>
                   <button 
                    onClick={() => setEditingTx({...editingTx, type: 'DESPESA'})} 
                    className={`flex-1 py-4 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all ${editingTx.type === 'DESPESA' ? 'bg-white text-rose-600 shadow-md scale-100' : 'text-slate-400 hover:text-slate-600 scale-95'}`}
                   >Despesa</button>
                </div>

                <div className="space-y-4">
                   <div className="space-y-1">
                      <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-3">Descrição do Lançamento</label>
                      <input type="text" value={editingTx.description || ''} onChange={e => setEditingTx({...editingTx, description: e.target.value})} className="w-full p-5 bg-slate-50 rounded-2xl outline-none font-bold text-xs border border-transparent focus:bg-white focus:border-indigo-100 transition-all" placeholder="Ex: Oferta de Domingo, Conta de Luz..." />
                   </div>
                   
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-3">Valor (R$)</label>
                        <input type="number" step="0.01" value={editingTx.value ?? ''} onChange={e => setEditingTx({...editingTx, value: parseFloat(e.target.value)})} className="w-full p-5 bg-slate-50 rounded-2xl font-black text-xs border border-transparent focus:bg-white focus:border-indigo-100 transition-all" placeholder="0,00" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-3">Data / Alvo (DD/MM/AAAA)</label>
                        <input 
                          type="text" 
                          value={manualDate} 
                          onChange={e => handleManualDateChange(e.target.value)} 
                          placeholder="00/00/0000"
                          className="w-full p-5 bg-slate-50 rounded-2xl font-bold text-xs border border-transparent focus:bg-white focus:border-indigo-100 transition-all" 
                        />
                      </div>
                   </div>

                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-3">Categoria</label>
                        <select value={editingTx.category || 'Geral'} onChange={e => setEditingTx({...editingTx, category: e.target.value})} className="w-full p-5 bg-slate-50 rounded-2xl font-bold text-xs outline-none cursor-pointer focus:bg-white transition-all">
                           {(editingTx.type === 'RECEITA' ? REVENUE_CATEGORIES : EXPENSE_CATEGORIES).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-3">Forma de Pagamento</label>
                        <select value={editingTx.paymentMethod || 'DINHEIRO'} onChange={e => setEditingTx({...editingTx, paymentMethod: e.target.value as any})} className="w-full p-5 bg-slate-50 rounded-2xl font-bold text-xs outline-none cursor-pointer focus:bg-white transition-all">
                           <option value="DINHEIRO">Dinheiro</option>
                           <option value="PIX">PIX</option>
                        </select>
                      </div>
                   </div>

                   {editingTx.category === 'Dízimo' && (
                     <div className="space-y-4 bg-indigo-50/40 p-5 rounded-3xl border border-indigo-100/30">
                       <div className="space-y-1">
                         <label className="text-[8px] font-black text-indigo-700 uppercase tracking-widest ml-1">Dizimista / Contribuinte Registrado</label>
                         <select 
                           value={editingTx.titherName || ''} 
                           onChange={e => setEditingTx({...editingTx, titherName: e.target.value})} 
                           className="w-full p-4 bg-white rounded-2xl font-bold text-xs outline-none cursor-pointer border border-indigo-100/50"
                         >
                           <option value="">-- Selecionar nome da lista --</option>
                           {registeredMembers.map(m => (
                             <option key={m} value={m}>{m}</option>
                           ))}
                           <option value="CUSTOM_NAME">Outro (Digitar Nome Manualmente)</option>
                         </select>
                       </div>

                       {(editingTx.titherName === 'CUSTOM_NAME' || !registeredMembers.includes(editingTx.titherName || '')) && (
                         <div className="space-y-1 animate-in slide-in-from-top-1 duration-200">
                           <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">Nome do Dizimista (Texto Livre)</label>
                           <input 
                             type="text" 
                             value={editingTx.titherName === 'CUSTOM_NAME' ? '' : (editingTx.titherName || '')} 
                             onChange={e => setEditingTx({...editingTx, titherName: e.target.value})} 
                             placeholder="Nome completo do dizimista..." 
                             className="w-full p-4 bg-white rounded-2xl outline-none font-bold text-xs border border-indigo-100/50 text-slate-800"
                           />
                         </div>
                       )}
                     </div>
                   )}

                   <div className="space-y-1">
                     <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-3">Status Atual</label>
                     <select value={editingTx.status || 'PAGO'} onChange={e => setEditingTx({...editingTx, status: e.target.value as any})} className="w-full p-5 bg-slate-50 rounded-2xl font-bold text-xs outline-none cursor-pointer focus:bg-white transition-all border-2 border-indigo-50">
                        <option value="PAGO">Pago / Quitado</option>
                        <option value="AGENDADO">Agendado (Agenda Futura / Progr.)</option>
                        <option value="PENDENTE">Pendente</option>
                     </select>
                   </div>

                   {session.role === 'ADMIN' && (
                     <div className="space-y-1">
                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-3">Unidade / Congregação</label>
                        <select 
                          value={editingTx.institutionName || session.institution} 
                          onChange={e => setEditingTx({...editingTx, institutionName: e.target.value})} 
                          className="w-full p-5 bg-slate-50 rounded-2xl font-bold text-xs outline-none cursor-pointer focus:bg-white border text-slate-800"
                        >
                           {institutions.map(inst => (
                             <option key={inst} value={inst}>{inst}</option>
                           ))}
                        </select>
                     </div>
                   )}
                </div>

                <div className="pt-6 space-y-3">
                   <button 
                    onClick={() => handleSave(false)} 
                    disabled={isSaving} 
                    className={`w-full py-5 rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.2em] active-scale shadow-2xl transition-all flex items-center justify-center gap-3 ${
                      isFormValid 
                        ? 'bg-indigo-600 text-white shadow-indigo-200 hover:bg-indigo-700 hover:scale-[1.02]' 
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed opacity-70'
                    }`}
                   >
                     {isSaving ? (
                       <Loader2 className="animate-spin" size={20}/>
                     ) : (
                       <>
                        {isFormValid ? <Sparkles size={18} className="animate-pulse" /> : <Save size={18}/>}
                        {editingTx.id ? 'Atualizar Registro' : 'Confirmar e Salvar'}
                       </>
                     )}
                   </button>

                   {!editingTx.id && (
                     <button 
                      onClick={() => handleSave(true)} 
                      disabled={isSaving} 
                      className="w-full py-5 bg-white text-indigo-600 border-2 border-indigo-50 rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.2em] active-scale flex items-center justify-center gap-3 hover:bg-indigo-50 transition-all"
                     >
                       <PlusCircle size={18}/> Salvar e Adicionar Outro
                     </button>
                   )}
                </div>
             </div>
          </div>
        </div>
      )}

      {/* Custom Confirmation Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={confirmDialog.onCancel} />
          <div className="relative w-full max-w-md bg-white rounded-[2.5rem] p-8 shadow-2xl border border-slate-100 animate-in zoom-in-95">
            <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center mb-6">
              <AlertCircle size={32} />
            </div>
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">{confirmDialog.title}</h3>
            <p className="text-sm text-slate-500 mb-8 leading-relaxed">{confirmDialog.message}</p>
            <div className="flex gap-3">
              <button 
                onClick={confirmDialog.onCancel}
                className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmDialog.onConfirm}
                className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={() => setShowImportModal(false)} />
          <div className="relative w-full max-w-2xl bg-white rounded-[2.5rem] p-8 shadow-2xl border border-slate-100 animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Importar Lançamentos</h3>
              <button onClick={() => setShowImportModal(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-all"><X size={20}/></button>
            </div>
            
            <p className="text-[10px] font-bold text-slate-400 uppercase mb-4">Cole o conteúdo JSON abaixo para importar os dados para esta unidade.</p>
            
            <textarea 
              value={importJson}
              onChange={e => setImportJson(e.target.value)}
              placeholder='[{"description": "Exemplo", "value": 100, "type": "RECEITA", "date": "2024-03-22"}]'
              className="w-full h-64 p-4 bg-slate-50 rounded-2xl border border-slate-100 outline-none font-mono text-xs focus:ring-2 focus:ring-indigo-500/10 transition-all mb-4"
            />
            
            {importError && (
              <div className="p-4 bg-rose-50 text-rose-600 rounded-2xl text-[10px] font-black uppercase mb-4 flex items-center gap-2">
                <AlertCircle size={16} /> {importError}
              </div>
            )}
            
            <div className="flex gap-3">
              <button 
                onClick={() => setShowImportModal(false)}
                className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={handleImportJson}
                disabled={!importJson.trim()}
                className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all disabled:opacity-50"
              >
                Processar Importação
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Status Message Toast */}
      {statusMessage && (
        <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[400] px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-4 duration-300 ${
          statusMessage.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
        }`}>
          {statusMessage.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          <span className="text-[10px] font-black uppercase tracking-widest">{statusMessage.text}</span>
        </div>
      )}
    </div>
  );
};

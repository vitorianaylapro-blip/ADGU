import React, { useState, useEffect, useRef } from 'react';
import { UserSession, ReceiptRecord } from '../types';
import { getReceipts, saveReceipt, deleteReceipt, getSettings, saveSettings, SystemSettings } from '../services/storageService';
import { valorPorExtenso } from '../services/extensoService';
import { jsPDF } from 'jspdf';
import { 
  Receipt, Plus, Search, Printer, Trash2, CheckCircle2, FileText, User, Building, 
  DollarSign, Calendar, AlertCircle, Coins, Sparkles, TrendingUp, HandCoins, Share2, 
  Copy, Check, Settings2, Scissors, ArrowDownToLine, Eye, RefreshCw, X, ShieldCheck
} from 'lucide-react';

interface ReceiptGeneratorProps {
  session: UserSession;
}

export const ReceiptGenerator: React.FC<ReceiptGeneratorProps> = ({ session }) => {
  const [receipts, setReceipts] = useState<ReceiptRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'TODOS' | 'RECEITA' | 'DESPESA' | 'MEMBRO'>('TODOS');
  
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'CREATE' | 'HISTORY' | 'SETTINGS'>('CREATE');

  // Mode: RECEITA = Receita Diária / DESPESA = Recibo de Despesa / MEMBRO = Recibo ao Membro
  const [type, setType] = useState<'RECEITA' | 'DESPESA' | 'MEMBRO'>('RECEITA');
  
  // Receita Diária specific inputs
  const [tithes, setTithes] = useState<string>('');
  const [offerings, setOfferings] = useState<string>('');
  const [specialOfferings, setSpecialOfferings] = useState<string>('');
  
  // Common / Despesa / Membro inputs
  const [amount, setAmount] = useState<string>('');
  const [personName, setPersonName] = useState<string>('');
  const [docNumber, setDocNumber] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [city, setCity] = useState<string>('Maracanaú - CE');
  const [treasurerName, setTreasurerName] = useState<string>(session.name || '');
  const [treasurerRole, setTreasurerRole] = useState<string>('Tesoureiro Geral');
  const [pastorName, setPastorName] = useState<string>('');
  const [pastorRole, setPastorRole] = useState<string>('Pastor Presidente / Dirigente');
  const [institutionName, setInstitutionName] = useState<string>(session.institution);
  
  // Signature layout: DUAL (both with GOV.BR size) or SINGLE (pastor/treasurer)
  const [signatureLayout, setSignatureLayout] = useState<'DUAL' | 'SINGLE_PASTOR' | 'SINGLE_TREASURER'>('DUAL');
  const [showGovHelp, setShowGovHelp] = useState(false);
  
  // Settings copy for quick config
  const [churchSettings, setChurchSettings] = useState<SystemSettings | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  // UI helpers
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [copiedWhatsApp, setCopiedWhatsApp] = useState(false);
  const [previewVia, setPreviewVia] = useState<'1' | '2'>('1');
  const [selectedReceiptForPreview, setSelectedReceiptForPreview] = useState<ReceiptRecord | null>(null);

  const showError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 4000);
  };

  useEffect(() => {
    loadData();
    initDefaults();
  }, [session]);

  // Recalculate total amount for Receita Diária whenever tithes, offerings, specialOfferings change
  useEffect(() => {
    if (type === 'RECEITA') {
      const t = parseFloat(tithes.replace(',', '.')) || 0;
      const o = parseFloat(offerings.replace(',', '.')) || 0;
      const s = parseFloat(specialOfferings.replace(',', '.')) || 0;
      const total = t + o + s;
      setAmount(total > 0 ? total.toFixed(2).replace('.', ',') : '');
    }
  }, [tithes, offerings, specialOfferings, type]);

  // Set intelligent defaults on type switch
  useEffect(() => {
    if (type === 'RECEITA') {
      if (!description) setDescription('Fechamento de Receita Diária do Culto');
      if (treasurerRole === 'Tesoureiro Responsável') setTreasurerRole('Tesoureiro Geral');
    } else if (type === 'MEMBRO') {
      if (!description) setDescription('Dízimos e Ofertas Eclesiásticas');
    } else if (type === 'DESPESA') {
      if (description === 'Fechamento de Receita Diária do Culto' || description === 'Dízimos e Ofertas Eclesiásticas') {
        setDescription('');
      }
    }
  }, [type]);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getReceipts(session.role === 'ADMIN' ? 'ALL' : session.institution);
      setReceipts(data);
    } catch (e) {
      console.error("Erro ao carregar recibos:", e);
    } finally {
      setLoading(false);
    }
  };

  const initDefaults = async () => {
    try {
      const settings = await getSettings();
      setChurchSettings(settings);

      if (settings.treasurerName) {
        setTreasurerName(settings.treasurerName);
      } else if (session.name) {
        setTreasurerName(session.name);
      }

      if (settings.treasurerRole) {
        setTreasurerRole(settings.treasurerRole);
      } else {
        setTreasurerRole('Tesoureiro Geral');
      }

      if (settings.pastorName || settings.president) {
        setPastorName(settings.pastorName || settings.president);
      } else {
        setPastorName('Pr. Antônio Chaves Crus');
      }

      if (settings.pastorRole) {
        setPastorRole(settings.pastorRole);
      } else {
        setPastorRole('Pastor Presidente / Dirigente');
      }

      if (settings.address && settings.address.includes('Maracanaú')) {
        setCity('Maracanaú - CE');
      }
    } catch (e) {
      console.error("Erro ao inicializar configurações padrão do recibo:", e);
    }
  };

  const parseVal = (str: string): number => {
    if (!str) return 0;
    const clean = str.replace(/[^\d.,]/g, '').replace(',', '.');
    const v = parseFloat(clean);
    return isNaN(v) ? 0 : v;
  };

  const formatBRL = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  };

  const totalCalculated = type === 'RECEITA' 
    ? (parseVal(tithes) + parseVal(offerings) + parseVal(specialOfferings)) 
    : parseVal(amount);

  const extensoAtual = valorPorExtenso(totalCalculated);

  const handleSaveQuickSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const current = await getSettings();
      const updated: SystemSettings = {
        ...current,
        treasurerName: treasurerName.trim(),
        treasurerRole: treasurerRole.trim(),
        pastorName: pastorName.trim(),
        pastorRole: pastorRole.trim(),
        president: pastorName.trim(),
        institutionName: churchSettings?.institutionName || current.institutionName,
        cnpj: churchSettings?.cnpj || current.cnpj,
        address: churchSettings?.address || current.address
      };
      await saveSettings(updated);
      setChurchSettings(updated);
      setSuccessMsg("Configurações do recibo salvas como padrão!");
      setTimeout(() => setSuccessMsg(null), 3500);
      setActiveTab('CREATE');
    } catch (err) {
      showError("Erro ao salvar configurações do recibo.");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleGenerateAndSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    let totalVal = totalCalculated;
    const tithesVal = parseVal(tithes);
    const offeringsVal = parseVal(offerings);
    const specialVal = parseVal(specialOfferings);

    if (type === 'RECEITA') {
      if (totalVal <= 0) {
        showError("Por favor, preencha pelo menos um dos valores de Dízimo, Oferta ou Especial.");
        return;
      }
    } else if (type === 'MEMBRO') {
      if (totalVal <= 0) {
        showError("Por favor, insira o valor da contribuição do membro.");
        return;
      }
      if (!personName.trim()) {
        showError("Por favor, informe o nome do membro / dizimista.");
        return;
      }
    } else {
      if (totalVal <= 0) {
        showError("Por favor, insira um valor válido para a despesa.");
        return;
      }
      if (!personName.trim()) {
        showError("Por favor, informe o nome do favorecido / prestador de serviço.");
        return;
      }
      if (!description.trim()) {
        showError("Por favor, descreva a finalidade do pagamento.");
        return;
      }
    }

    setSaving(true);
    try {
      const count = receipts.length + 1;
      const year = new Date().getFullYear();
      let prefix = 'REC-DIARIA';
      if (type === 'DESPESA') prefix = 'REC-DESP';
      if (type === 'MEMBRO') prefix = 'REC-MEMBRO';
      const numStr = `${prefix}-${year}/${count.toString().padStart(4, '0')}`;

      const finalPersonName = type === 'RECEITA' 
        ? (personName.trim() || `Congregação ${institutionName}`)
        : personName.trim();

      const finalDescription = type === 'RECEITA'
        ? (description.trim() || `Fechamento de Receita Diária - Culto / Arrecadação`)
        : type === 'MEMBRO'
        ? (description.trim() || `Dízimos e Ofertas Eclesiásticas`)
        : description.trim();

      const newReceipt: ReceiptRecord = {
        id: crypto.randomUUID(),
        number: numStr,
        type,
        amount: totalVal,
        personName: finalPersonName,
        docNumber: docNumber.trim(),
        description: finalDescription,
        date,
        city: city.trim() || 'Maracanaú - CE',
        treasurerName: treasurerName.trim() || session.name,
        treasurerRole: treasurerRole.trim() || 'Tesoureiro Geral',
        pastorName: pastorName.trim() || 'Pr. Antônio Chaves Crus',
        pastorRole: pastorRole.trim() || 'Pastor Presidente / Dirigente',
        institutionName: institutionName.trim() || session.institution,
        tithes: tithesVal,
        offerings: offeringsVal,
        specialOfferings: specialVal,
        createdAt: new Date().toISOString()
      };

      await saveReceipt(newReceipt);
      setSelectedReceiptForPreview(newReceipt);

      setSuccessMsg(`Documento ${numStr} gerado com sucesso!`);
      setTimeout(() => setSuccessMsg(null), 4000);

      // Reset specific fields
      setAmount('');
      setTithes('');
      setOfferings('');
      setSpecialOfferings('');
      setPersonName('');
      setDocNumber('');
      setDescription('');
      
      loadData();
    } catch (err) {
      console.error(err);
      showError("Erro ao salvar o documento.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    setConfirmDeleteId(id);
  };

  const confirmDeleteReceipt = async () => {
    if (!confirmDeleteId) return;
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    try {
      setReceipts(prev => prev.filter(r => r.id !== id));
      if (selectedReceiptForPreview?.id === id) {
        setSelectedReceiptForPreview(null);
      }
      await deleteReceipt(id);
      setSuccessMsg("Recibo excluído com sucesso!");
      setTimeout(() => setSuccessMsg(null), 3500);
      loadData();
    } catch (err) {
      showError("Erro ao excluir recibo.");
      loadData();
    }
  };

  // Helper to get active receipt for rendering/printing
  const getCurrentReceiptData = (): ReceiptRecord => {
    if (selectedReceiptForPreview) return selectedReceiptForPreview;

    const count = receipts.length + 1;
    const year = new Date().getFullYear();
    let prefix = 'REC-DIARIA';
    if (type === 'DESPESA') prefix = 'REC-DESP';
    if (type === 'MEMBRO') prefix = 'REC-MEMBRO';

    return {
      id: 'preview',
      number: `${prefix}-${year}/${count.toString().padStart(4, '0')}`,
      type,
      amount: totalCalculated,
      personName: type === 'RECEITA' ? (personName.trim() || `Congregação ${institutionName}`) : (personName.trim() || 'Nome do Favorecido / Membro'),
      docNumber: docNumber.trim(),
      description: description.trim() || (type === 'RECEITA' ? 'Fechamento de Receita Diária - Culto' : type === 'MEMBRO' ? 'Dízimo e Oferta' : 'Prestação de serviços / Despesa'),
      date,
      city: city.trim() || 'Maracanaú - CE',
      treasurerName: treasurerName.trim() || 'Tesoureiro Geral',
      treasurerRole: treasurerRole.trim() || 'Tesoureiro Geral',
      pastorName: pastorName.trim() || 'Pr. Antônio Chaves Crus',
      pastorRole: pastorRole.trim() || 'Pastor Presidente / Dirigente',
      institutionName: institutionName.trim() || 'Sede Administrativa',
      tithes: parseVal(tithes),
      offerings: parseVal(offerings),
      specialOfferings: parseVal(specialOfferings),
      createdAt: new Date().toISOString()
    };
  };

  // ----------------------------------------------------
  // NATIVE BROWSER PRINT (PERFECTION ON A4 & ANY PRINTER)
  // ----------------------------------------------------
  const handleNativePrint = () => {
    window.print();
  };

  // ----------------------------------------------------
  // JSPDF DRAWING ENGINE (CONFIGURED & MILLIMETER-PERFECT)
  // ----------------------------------------------------
  const drawSingleVia = (
    doc: any, 
    receipt: ReceiptRecord, 
    startX: number, 
    startY: number, 
    cardWidth: number, 
    cardHeight: number,
    viaLabel: string,
    settings: SystemSettings,
    layout: 'DUAL' | 'SINGLE_PASTOR' | 'SINGLE_TREASURER' = signatureLayout
  ) => {
    const tealDark = [23, 147, 145]; // #179391
    const tealLight = [230, 246, 245]; // #e6f6f5
    const borderSlate = [203, 213, 225]; // #cbd5e1
    const textDark = [15, 23, 42]; // #0f172a
    const textMuted = [100, 116, 139]; // #64748b

    // 1. Outer Card Box with soft rounded corners
    doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]);
    doc.setLineWidth(0.35);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(startX, startY, cardWidth, cardHeight, 2.5, 2.5, 'FD');

    // 2. Top Color Stripe
    doc.setFillColor(tealDark[0], tealDark[1], tealDark[2]);
    doc.roundedRect(startX, startY, cardWidth, 2.5, 2.5, 2.5, 'F');
    doc.rect(startX, startY + 1.2, cardWidth, 1.3, 'F');

    // 3. Church Logo
    const logoX = startX + 4;
    const logoY = startY + 5.5;
    const logoSize = 16;
    if (settings.logo) {
      try {
        doc.addImage(settings.logo, 'PNG', logoX, logoY, logoSize, logoSize);
      } catch (e) {
        // Fallback text if image fails
      }
    }

    // 4. Header Texts (positioned safely next to logo, without colliding)
    const textX = settings.logo ? (logoX + logoSize + 4) : (startX + 6);
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.text(settings.institutionName || "Assembléia de Deus Geração Unida", textX, startY + 9.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text(`CNPJ: ${settings.cnpj || '49.386.673/0001-10'}  |  Ministério ADGU`, textX, startY + 13.5);
    doc.text(settings.address || "Rua 12 de Outubro, 779 - Parque Tijuca - Maracanaú - CE", textX, startY + 17.5);
    doc.text(`Contato: ${settings.email || 'guparquetijuca@gmail.com'}`, textX, startY + 21);

    // 5. Top Right Badges (Nº & VALOR TOTAL)
    const badgeW = 48;
    const badgeX = startX + cardWidth - badgeW - 4;

    // Badge Nº & Via
    doc.setFillColor(tealLight[0], tealLight[1], tealLight[2]);
    doc.setDrawColor(tealDark[0], tealDark[1], tealDark[2]);
    doc.setLineWidth(0.25);
    doc.roundedRect(badgeX, startY + 5, badgeW, 8.5, 1.5, 1.5, 'FD');

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(tealDark[0], tealDark[1], tealDark[2]);
    doc.text(receipt.number, badgeX + badgeW / 2, startY + 8.8, { align: 'center' });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text(viaLabel.toUpperCase(), badgeX + badgeW / 2, startY + 12.2, { align: 'center' });

    // Badge VALOR TOTAL
    doc.setFillColor(tealDark[0], tealDark[1], tealDark[2]);
    doc.roundedRect(badgeX, startY + 15, badgeW, 8.5, 1.5, 1.5, 'F');
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    doc.text(`TOTAL: ${formatBRL(receipt.amount)}`, badgeX + badgeW / 2, startY + 20.5, { align: 'center' });

    // Decorative Horizontal Divider
    doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]);
    doc.setLineWidth(0.2);
    doc.line(startX + 4, startY + 24.5, startX + cardWidth - 4, startY + 24.5);

    // 6. Body Content
    let curY = startY + 27;
    const bodyW = cardWidth - 8;
    const bodyX = startX + 4;
    const dateFormatted = new Date(receipt.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    const extenso = valorPorExtenso(receipt.amount);

    if (receipt.type === 'RECEITA') {
      // Line A: Congregação & Data / Local
      const halfW = (bodyW - 3) / 2;
      doc.setFillColor(255, 255, 255);
      doc.rect(bodyX, curY, halfW, 7.5, 'FD');
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
      doc.text(`CONGREGAÇÃO: ${receipt.institutionName.toUpperCase()}`, bodyX + 2.5, curY + 4.8);

      doc.setFillColor(tealLight[0], tealLight[1], tealLight[2]);
      doc.rect(bodyX + halfW + 3, curY, halfW, 7.5, 'F');
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(tealDark[0], tealDark[1], tealDark[2]);
      doc.text(`DATA DO CULTO: ${receipt.city || 'Maracanaú - CE'}, ${dateFormatted}`, bodyX + halfW + 5.5, curY + 4.8);

      curY += 9.5;

      // Line B: Quadro de Entradas (Dízimo, Oferta, Especial)
      const colW = (bodyW - 4) / 3;
      const colH = 15;

      // Col 1: Dízimos
      doc.setFillColor(255, 255, 255);
      doc.rect(bodyX, curY, colW, colH, 'FD');
      doc.setFillColor(tealLight[0], tealLight[1], tealLight[2]);
      doc.rect(bodyX, curY, colW, 4.5, 'F');
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(tealDark[0], tealDark[1], tealDark[2]);
      doc.text("DÍZIMOS", bodyX + colW / 2, curY + 3.3, { align: 'center' });
      doc.setFontSize(10.5);
      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
      doc.text(formatBRL(receipt.tithes || 0), bodyX + colW / 2, curY + 11.5, { align: 'center' });

      // Col 2: Ofertas
      const col2X = bodyX + colW + 2;
      doc.setFillColor(255, 255, 255);
      doc.rect(col2X, curY, colW, colH, 'FD');
      doc.setFillColor(tealLight[0], tealLight[1], tealLight[2]);
      doc.rect(col2X, curY, colW, 4.5, 'F');
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(tealDark[0], tealDark[1], tealDark[2]);
      doc.text("OFERTAS", col2X + colW / 2, curY + 3.3, { align: 'center' });
      doc.setFontSize(10.5);
      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
      doc.text(formatBRL(receipt.offerings || 0), col2X + colW / 2, curY + 11.5, { align: 'center' });

      // Col 3: Oferta Especial
      const col3X = bodyX + (colW * 2) + 4;
      doc.setFillColor(255, 255, 255);
      doc.rect(col3X, curY, colW, colH, 'FD');
      doc.setFillColor(tealLight[0], tealLight[1], tealLight[2]);
      doc.rect(col3X, curY, colW, 4.5, 'F');
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(tealDark[0], tealDark[1], tealDark[2]);
      doc.text("OFERTA ESPECIAL", col3X + colW / 2, curY + 3.3, { align: 'center' });
      doc.setFontSize(10.5);
      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
      doc.text(formatBRL(receipt.specialOfferings || 0), col3X + colW / 2, curY + 11.5, { align: 'center' });

      curY += colH + 2;

      // Line C: Total e Extenso
      doc.setFillColor(tealLight[0], tealLight[1], tealLight[2]);
      doc.rect(bodyX, curY, bodyW, 9.5, 'F');
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(tealDark[0], tealDark[1], tealDark[2]);
      doc.text("VALOR TOTAL DA RECEITA:", bodyX + 2.5, curY + 6);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
      const extensoLines = doc.splitTextToSize(`${formatBRL(receipt.amount)} (${extenso})`, bodyW - 48);
      doc.text(extensoLines, bodyX + 46, curY + 6);

      curY += 12;
    } else {
      // DESPESA ou MEMBRO
      const label1 = receipt.type === 'MEMBRO' ? "Recebemos do(a) irmão(ã)" : "Paguei(amos) a";
      
      // Line 1: Pessoa / Favorecido
      doc.setFillColor(255, 255, 255);
      doc.rect(bodyX, curY, bodyW, 8.5, 'FD');
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
      doc.text(label1, bodyX + 2.5, curY + 5.2);
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
      const nameWithDoc = `${receipt.personName.toUpperCase()} ${receipt.docNumber ? `(CPF/CNPJ: ${receipt.docNumber})` : ''}`;
      const nameLines = doc.splitTextToSize(nameWithDoc, bodyW - 35);
      doc.text(nameLines, bodyX + 34, curY + 5.2);

      curY += 10.5;

      // Line 2: A importância de (Extenso)
      doc.setFillColor(tealLight[0], tealLight[1], tealLight[2]);
      doc.rect(bodyX, curY, bodyW, 8.5, 'F');
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(tealDark[0], tealDark[1], tealDark[2]);
      doc.text("a importância de", bodyX + 2.5, curY + 5.2);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
      const valorExtensoLines = doc.splitTextToSize(`${formatBRL(receipt.amount)} (${extenso})`, bodyW - 35);
      doc.text(valorExtensoLines, bodyX + 28, curY + 5.2);

      curY += 10.5;

      // Line 3: Referente a
      doc.setFillColor(255, 255, 255);
      doc.rect(bodyX, curY, bodyW, 8.5, 'FD');
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
      doc.text("referente a", bodyX + 2.5, curY + 5.2);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
      const descLines = doc.splitTextToSize(receipt.description, bodyW - 25);
      doc.text(descLines, bodyX + 22, curY + 5.2);

      curY += 10.5;

      // Line 4: Congregação & Data
      const halfW = (bodyW - 3) / 2;
      doc.setFillColor(255, 255, 255);
      doc.rect(bodyX, curY, halfW, 7, 'FD');
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
      doc.text(`Congregação: ${receipt.institutionName.toUpperCase()}`, bodyX + 2.5, curY + 4.5);

      doc.setFillColor(tealLight[0], tealLight[1], tealLight[2]);
      doc.rect(bodyX + halfW + 3, curY, halfW, 7, 'F');
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(tealDark[0], tealDark[1], tealDark[2]);
      doc.text(`${receipt.city || 'Maracanaú - CE'}, ${dateFormatted}`, bodyX + halfW + 5.5, curY + 4.5);

      curY += 9;
    }

    // 7. Signature Boxes (Spacious blank area suitable for GOV.BR electronic seal or manual signature)
    const sigBoxH = 46;
    const sigY = curY + 2;

    if (layout === 'SINGLE_PASTOR' || layout === 'SINGLE_TREASURER') {
      // Formato Único Centralizado
      const isTreasurer = layout === 'SINGLE_TREASURER';
      const sigBoxW = 124;
      const singleX = bodyX + (bodyW - sigBoxW) / 2;
      const title = isTreasurer ? "TESOURARIA GERAL" : "DIRETORIA / DIRIGENTE RESPONSÁVEL";
      const signerName = isTreasurer ? (receipt.treasurerName || 'Tesoureiro Geral') : (receipt.pastorName || 'Pr. Antônio Chaves Crus');
      const signerRole = isTreasurer ? (receipt.treasurerRole || 'Tesoureiro Geral') : (receipt.pastorRole || 'Pastor Presidente / Dirigente');

      // Outer box - clean white background
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]);
      doc.setLineWidth(0.35);
      doc.roundedRect(singleX, sigY, sigBoxW, sigBoxH, 2, 2, 'FD');

      // Top Header
      doc.setFillColor(tealLight[0], tealLight[1], tealLight[2]);
      doc.roundedRect(singleX, sigY, sigBoxW, 5.5, 2, 2, 'F');
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(tealDark[0], tealDark[1], tealDark[2]);
      doc.text(title, singleX + sigBoxW / 2, sigY + 3.8, { align: 'center' });

      // Clean blank area: completely white space for signature (no text, no logo)

      // Signature Anchor Line
      doc.setDrawColor(148, 163, 184);
      doc.setLineWidth(0.25);
      doc.line(singleX + 14, sigY + 33, singleX + sigBoxW - 14, sigY + 33);

      // Signer Name
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
      doc.text(signerName.toUpperCase(), singleX + sigBoxW / 2, sigY + 37.5, { align: 'center' });

      // Signer Role
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
      doc.text(signerRole, singleX + sigBoxW / 2, sigY + 41.5, { align: 'center' });
    } else {
      // Formato Padrão Duplo (Tesouraria + Diretoria/Pastor)
      const sigBoxW = (bodyW - 4) / 2; // ~87mm

      // Sig 1: Tesouraria
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]);
      doc.setLineWidth(0.35);
      doc.roundedRect(bodyX, sigY, sigBoxW, sigBoxH, 2, 2, 'FD');

      doc.setFillColor(tealLight[0], tealLight[1], tealLight[2]);
      doc.roundedRect(bodyX, sigY, sigBoxW, 5.5, 2, 2, 'F');
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.setTextColor(tealDark[0], tealDark[1], tealDark[2]);
      doc.text("TESOURARIA GERAL", bodyX + sigBoxW / 2, sigY + 3.8, { align: 'center' });

      // Clean blank area: completely white space for signature (no text, no logo)

      // Signature Anchor Line
      doc.setDrawColor(148, 163, 184);
      doc.setLineWidth(0.25);
      doc.line(bodyX + 7, sigY + 33, bodyX + sigBoxW - 7, sigY + 33);

      // Signer Name
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
      doc.text((receipt.treasurerName || 'Tesoureiro Geral').toUpperCase(), bodyX + sigBoxW / 2, sigY + 37.5, { align: 'center' });

      // Signer Role
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.2);
      doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
      doc.text(receipt.treasurerRole || 'Tesoureiro Geral', bodyX + sigBoxW / 2, sigY + 41.5, { align: 'center' });

      // Sig 2: Diretoria / Pastor
      const sig2X = bodyX + sigBoxW + 4;
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]);
      doc.setLineWidth(0.35);
      doc.roundedRect(sig2X, sigY, sigBoxW, sigBoxH, 2, 2, 'FD');

      doc.setFillColor(tealLight[0], tealLight[1], tealLight[2]);
      doc.roundedRect(sig2X, sigY, sigBoxW, 5.5, 2, 2, 'F');
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.setTextColor(tealDark[0], tealDark[1], tealDark[2]);
      doc.text("DIRETORIA / DIRIGENTE RESPONSÁVEL", sig2X + sigBoxW / 2, sigY + 3.8, { align: 'center' });

      // Clean blank area: completely white space for signature (no text, no logo)

      // Signature Anchor Line
      doc.setDrawColor(148, 163, 184);
      doc.setLineWidth(0.25);
      doc.line(sig2X + 7, sigY + 33, sig2X + sigBoxW - 7, sigY + 33);

      // Signer Name
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
      doc.text((receipt.pastorName || 'Pr. Antônio Chaves Crus').toUpperCase(), sig2X + sigBoxW / 2, sigY + 37.5, { align: 'center' });

      // Signer Role
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.2);
      doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
      doc.text(receipt.pastorRole || 'Pastor Presidente / Dirigente', sig2X + sigBoxW / 2, sigY + 41.5, { align: 'center' });
    }

    // 8. Footer Watermark Slogan
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(tealDark[0], tealDark[1], tealDark[2]);
    doc.text("ADGU - Gerando Vidas para o Reino!", startX + cardWidth / 2, startY + cardHeight - 2.5, { align: 'center' });
  };

  // Export PDF A4 (2 Vias por folha - Padrão Eclesiástico / Contábil Brasileiro com Calibração GOV.BR)
  const exportPDF_A4 = async (receipt: ReceiptRecord) => {
    const settings = await getSettings();
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as any;
    const pageWidth = doc.internal.pageSize.getWidth(); // 210 mm
    const startX = 12;
    const cardW = pageWidth - 24; // 186 mm
    const cardH = 135; // 135 mm (Spacious for official GOV.BR stamp box)

    // Via 1: Top half
    drawSingleVia(doc, receipt, startX, 7, cardW, cardH, '1ª Via - Igreja / Tesouraria', settings, signatureLayout);

    // Cutting Guide / Serrilhado
    const lineY = 148.5;
    doc.setDrawColor(180, 190, 205);
    doc.setLineDashPattern([2, 2], 0);
    doc.setLineWidth(0.3);
    doc.line(8, lineY, pageWidth - 8, lineY);
    doc.setLineDashPattern([], 0); // reset

    doc.setFont("helvetica", "italic");
    doc.setFontSize(6.5);
    doc.setTextColor(140, 155, 175);
    doc.text("- - - - - - - - - - - - - - - - - - - - -  ✂  Destaque / Corte Aqui  - - - - - - - - - - - - - - - - - - - - -", pageWidth / 2, lineY - 1, { align: 'center' });

    // Via 2: Bottom half
    drawSingleVia(doc, receipt, startX, 155, cardW, cardH, receipt.type === 'DESPESA' ? '2ª Via - Favorecido' : receipt.type === 'MEMBRO' ? '2ª Via - Membro / Dizimista' : '2ª Via - Arquivo Geral', settings, signatureLayout);

    const safeNum = receipt.number.replace(/[\/\\]/g, '-');
    doc.save(`Recibo_ADGU_${safeNum}_A4_2Vias.pdf`);
  };

  // Export PDF A5 (1 Via Paisagem com Calibração GOV.BR)
  const exportPDF_A5 = async (receipt: ReceiptRecord) => {
    const settings = await getSettings();
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a5' }) as any;
    const pageWidth = doc.internal.pageSize.getWidth(); // 210 mm
    const startX = 12;
    const cardW = pageWidth - 24; // 186 mm
    const cardH = 135;

    drawSingleVia(doc, receipt, startX, 6.5, cardW, cardH, 'Via Única Oficial', settings, signatureLayout);

    const safeNum = receipt.number.replace(/[\/\\]/g, '-');
    doc.save(`Recibo_ADGU_${safeNum}_A5.pdf`);
  };

  // WhatsApp Summary Copy
  const handleCopyWhatsApp = () => {
    const current = getCurrentReceiptData();
    const formattedDate = new Date(current.date + 'T12:00:00').toLocaleDateString('pt-BR');
    
    let text = `🏛️ *ASSEMBLÉIA DE DEUS GERAÇÃO UNIDA*\n`;
    text += `📋 *${current.type === 'RECEITA' ? 'RECEITA DIÁRIA' : current.type === 'MEMBRO' ? 'RECIBO DE DIZIMISTA' : 'RECIBO DE PAGAMENTO'}* - Nº ${current.number}\n`;
    text += `📍 *Congregação:* ${current.institutionName}\n`;
    text += `📅 *Data:* ${formattedDate} (${current.city})\n`;
    text += `💰 *Valor Total:* ${formatBRL(current.amount)}\n`;
    text += `📝 *Por Extenso:* ${valorPorExtenso(current.amount)}\n`;

    if (current.type === 'RECEITA') {
      text += `\n*Detalhamento de Entradas:*\n`;
      text += `• Dízimos: ${formatBRL(current.tithes || 0)}\n`;
      text += `• Ofertas: ${formatBRL(current.offerings || 0)}\n`;
      text += `• Especial: ${formatBRL(current.specialOfferings || 0)}\n`;
    } else {
      text += `👤 *${current.type === 'MEMBRO' ? 'Membro / Dizimista' : 'Favorecido'}:* ${current.personName}\n`;
      if (current.docNumber) text += `📄 *CPF/CNPJ:* ${current.docNumber}\n`;
      text += `📌 *Referente a:* ${current.description}\n`;
    }

    text += `\n✍️ *Tesouraria:* ${current.treasurerName} (${current.treasurerRole})\n`;
    text += `✍️ *Diretoria:* ${current.pastorName} (${current.pastorRole})\n`;
    text += `\n_ADGU - Gerando Vidas para o Reino!_`;

    navigator.clipboard.writeText(text);
    setCopiedWhatsApp(true);
    setTimeout(() => setCopiedWhatsApp(false), 3000);
  };

  const filteredReceipts = receipts
    .filter(r => filterType === 'TODOS' || r.type === filterType)
    .filter(r => r.personName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                 r.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                 r.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                 r.institutionName.toLowerCase().includes(searchTerm.toLowerCase()));

  const activeReceipt = getCurrentReceiptData();
  const dateFormattedPreview = new Date(activeReceipt.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      
      {/* Printable Area Hook for Native Browser Print (@media print in index.css) */}
      <div id="printable-receipt-area" className="hidden print:block p-4 bg-white text-slate-900 font-sans">
        {/* Render 2 Vias on Print */}
        <div className="space-y-6">
          {/* VIA 1 */}
          <div className="border-2 border-slate-300 rounded-2xl p-5 bg-white space-y-4">
            <div className="flex justify-between items-start border-b border-slate-200 pb-3">
              <div className="flex items-center gap-3">
                {churchSettings?.logo ? (
                  <img src={churchSettings.logo} className="w-14 h-14 object-contain" alt="Logo" />
                ) : (
                  <div className="w-12 h-12 bg-teal-700 text-white rounded-xl flex items-center justify-center font-black text-sm">ADGU</div>
                )}
                <div>
                  <h3 className="text-base font-black text-slate-900 uppercase">{churchSettings?.institutionName || 'Assembléia de Deus Geração Unida'}</h3>
                  <p className="text-[10px] text-slate-500 font-semibold">CNPJ: {churchSettings?.cnpj || '49.386.673/0001-10'} | Ministério ADGU</p>
                  <p className="text-[10px] text-slate-500">{churchSettings?.address || 'Rua 12 de Outubro, 779 - Parque Tijuca - Maracanaú - CE'}</p>
                </div>
              </div>
              <div className="text-right space-y-1">
                <div className="bg-teal-50 border border-teal-200 px-3 py-1 rounded-lg text-xs font-black text-teal-900">
                  {activeReceipt.number} <span className="text-[9px] font-normal text-slate-500 block">1ª VIA - IGREJA</span>
                </div>
                <div className="bg-teal-700 text-white px-3 py-1 rounded-lg text-xs font-black">
                  TOTAL: {formatBRL(activeReceipt.amount)}
                </div>
              </div>
            </div>

            {/* Print Body */}
            {activeReceipt.type === 'RECEITA' ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 border border-slate-200 rounded-lg"><strong>CONGREGAÇÃO:</strong> {activeReceipt.institutionName}</div>
                  <div className="p-2 bg-teal-50 rounded-lg"><strong>DATA:</strong> {activeReceipt.city}, {dateFormattedPreview}</div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 border border-slate-200 rounded-lg"><span className="text-[10px] font-bold text-slate-500 block">DÍZIMOS</span><span className="text-sm font-black">{formatBRL(activeReceipt.tithes || 0)}</span></div>
                  <div className="p-2 border border-slate-200 rounded-lg"><span className="text-[10px] font-bold text-slate-500 block">OFERTAS</span><span className="text-sm font-black">{formatBRL(activeReceipt.offerings || 0)}</span></div>
                  <div className="p-2 border border-slate-200 rounded-lg"><span className="text-[10px] font-bold text-slate-500 block">OFERTA ESPECIAL</span><span className="text-sm font-black">{formatBRL(activeReceipt.specialOfferings || 0)}</span></div>
                </div>
                <div className="p-2.5 bg-teal-50 rounded-lg text-xs font-bold text-slate-800">
                  TOTAL RECEITA: {formatBRL(activeReceipt.amount)} ({valorPorExtenso(activeReceipt.amount)})
                </div>
              </div>
            ) : (
              <div className="space-y-2 text-xs">
                <div className="p-2 border border-slate-200 rounded-lg"><strong>{activeReceipt.type === 'MEMBRO' ? 'Recebemos do(a) irmão(ã):' : 'Paguei(amos) a:'}</strong> {activeReceipt.personName} {activeReceipt.docNumber && `(CPF/CNPJ: ${activeReceipt.docNumber})`}</div>
                <div className="p-2 bg-teal-50 rounded-lg"><strong>A quantia de:</strong> {formatBRL(activeReceipt.amount)} ({valorPorExtenso(activeReceipt.amount)})</div>
                <div className="p-2 border border-slate-200 rounded-lg"><strong>Referente a:</strong> {activeReceipt.description}</div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-1.5 border border-slate-200 rounded-lg"><strong>Congregação:</strong> {activeReceipt.institutionName}</div>
                  <div className="p-1.5 bg-teal-50 rounded-lg"><strong>Local/Data:</strong> {activeReceipt.city}, {dateFormattedPreview}</div>
                </div>
              </div>
            )}

            {/* Print Signatures - Área em Branco para Assinatura */}
            {signatureLayout === 'SINGLE_PASTOR' || signatureLayout === 'SINGLE_TREASURER' ? (
              <div className="pt-2 max-w-sm mx-auto text-center">
                <div className="border border-slate-200 rounded-xl p-3 bg-white space-y-2">
                  <span className="text-[9px] font-black uppercase text-teal-800 block">
                    {signatureLayout === 'SINGLE_TREASURER' ? 'Tesouraria Geral' : 'Diretoria / Dirigente Responsável'}
                  </span>
                  <div className="h-20 bg-white" />
                  <div className="border-b border-slate-400 w-4/5 mx-auto" />
                  <span className="text-xs font-black text-slate-900 block">
                    {signatureLayout === 'SINGLE_TREASURER' ? activeReceipt.treasurerName : activeReceipt.pastorName}
                  </span>
                  <span className="text-[9px] text-slate-500 font-semibold block">
                    {signatureLayout === 'SINGLE_TREASURER' ? activeReceipt.treasurerRole : activeReceipt.pastorRole}
                  </span>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="border border-slate-200 rounded-xl p-2.5 text-center space-y-1.5 bg-white">
                  <span className="text-[9px] font-black uppercase text-teal-800 block">Tesouraria Geral</span>
                  <div className="h-20 bg-white" />
                  <div className="border-b border-slate-400 w-4/5 mx-auto" />
                  <span className="text-xs font-black text-slate-900 block">{activeReceipt.treasurerName}</span>
                  <span className="text-[9px] text-slate-500 font-semibold block">{activeReceipt.treasurerRole}</span>
                </div>
                <div className="border border-slate-200 rounded-xl p-2.5 text-center space-y-1.5 bg-white">
                  <span className="text-[9px] font-black uppercase text-teal-800 block">Diretoria / Dirigente</span>
                  <div className="h-20 bg-white" />
                  <div className="border-b border-slate-400 w-4/5 mx-auto" />
                  <span className="text-xs font-black text-slate-900 block">{activeReceipt.pastorName}</span>
                  <span className="text-[9px] text-slate-500 font-semibold block">{activeReceipt.pastorRole}</span>
                </div>
              </div>
            )}
            <p className="text-center text-[10px] font-bold text-teal-800 pt-1">ADGU - Gerando Vidas para o Reino!</p>
          </div>

          {/* SERRILHADO CORTE */}
          <div className="text-center text-xs text-slate-400 border-b border-dashed border-slate-400 py-1 select-none">
            - - - - - - - - - - - - - - - - - - - - ✂ Destaque / Corte Aqui - - - - - - - - - - - - - - - - - - - -
          </div>

          {/* VIA 2 */}
          <div className="border-2 border-slate-300 rounded-2xl p-5 bg-white space-y-4">
            <div className="flex justify-between items-start border-b border-slate-200 pb-3">
              <div className="flex items-center gap-3">
                {churchSettings?.logo ? (
                  <img src={churchSettings.logo} className="w-14 h-14 object-contain" alt="Logo" />
                ) : (
                  <div className="w-12 h-12 bg-teal-700 text-white rounded-xl flex items-center justify-center font-black text-sm">ADGU</div>
                )}
                <div>
                  <h3 className="text-base font-black text-slate-900 uppercase">{churchSettings?.institutionName || 'Assembléia de Deus Geração Unida'}</h3>
                  <p className="text-[10px] text-slate-500 font-semibold">CNPJ: {churchSettings?.cnpj || '49.386.673/0001-10'} | Ministério ADGU</p>
                  <p className="text-[10px] text-slate-500">{churchSettings?.address || 'Rua 12 de Outubro, 779 - Parque Tijuca - Maracanaú - CE'}</p>
                </div>
              </div>
              <div className="text-right space-y-1">
                <div className="bg-teal-50 border border-teal-200 px-3 py-1 rounded-lg text-xs font-black text-teal-900">
                  {activeReceipt.number} <span className="text-[9px] font-normal text-slate-500 block">2ª VIA - {activeReceipt.type === 'DESPESA' ? 'FAVORECIDO' : activeReceipt.type === 'MEMBRO' ? 'MEMBRO' : 'ARQUIVO'}</span>
                </div>
                <div className="bg-teal-700 text-white px-3 py-1 rounded-lg text-xs font-black">
                  TOTAL: {formatBRL(activeReceipt.amount)}
                </div>
              </div>
            </div>

            {/* Print Body Via 2 */}
            {activeReceipt.type === 'RECEITA' ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 border border-slate-200 rounded-lg"><strong>CONGREGAÇÃO:</strong> {activeReceipt.institutionName}</div>
                  <div className="p-2 bg-teal-50 rounded-lg"><strong>DATA:</strong> {activeReceipt.city}, {dateFormattedPreview}</div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 border border-slate-200 rounded-lg"><span className="text-[10px] font-bold text-slate-500 block">DÍZIMOS</span><span className="text-sm font-black">{formatBRL(activeReceipt.tithes || 0)}</span></div>
                  <div className="p-2 border border-slate-200 rounded-lg"><span className="text-[10px] font-bold text-slate-500 block">OFERTAS</span><span className="text-sm font-black">{formatBRL(activeReceipt.offerings || 0)}</span></div>
                  <div className="p-2 border border-slate-200 rounded-lg"><span className="text-[10px] font-bold text-slate-500 block">OFERTA ESPECIAL</span><span className="text-sm font-black">{formatBRL(activeReceipt.specialOfferings || 0)}</span></div>
                </div>
                <div className="p-2.5 bg-teal-50 rounded-lg text-xs font-bold text-slate-800">
                  TOTAL RECEITA: {formatBRL(activeReceipt.amount)} ({valorPorExtenso(activeReceipt.amount)})
                </div>
              </div>
            ) : (
              <div className="space-y-2 text-xs">
                <div className="p-2 border border-slate-200 rounded-lg"><strong>{activeReceipt.type === 'MEMBRO' ? 'Recebemos do(a) irmão(ã):' : 'Paguei(amos) a:'}</strong> {activeReceipt.personName} {activeReceipt.docNumber && `(CPF/CNPJ: ${activeReceipt.docNumber})`}</div>
                <div className="p-2 bg-teal-50 rounded-lg"><strong>A quantia de:</strong> {formatBRL(activeReceipt.amount)} ({valorPorExtenso(activeReceipt.amount)})</div>
                <div className="p-2 border border-slate-200 rounded-lg"><strong>Referente a:</strong> {activeReceipt.description}</div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-1.5 border border-slate-200 rounded-lg"><strong>Congregação:</strong> {activeReceipt.institutionName}</div>
                  <div className="p-1.5 bg-teal-50 rounded-lg"><strong>Local/Data:</strong> {activeReceipt.city}, {dateFormattedPreview}</div>
                </div>
              </div>
            )}

            {/* Print Signatures Via 2 - Área em Branco para Assinatura */}
            {signatureLayout === 'SINGLE_PASTOR' || signatureLayout === 'SINGLE_TREASURER' ? (
              <div className="pt-2 max-w-sm mx-auto text-center">
                <div className="border border-slate-200 rounded-xl p-3 bg-white space-y-2">
                  <span className="text-[9px] font-black uppercase text-teal-800 block">
                    {signatureLayout === 'SINGLE_TREASURER' ? 'Tesouraria Geral' : 'Diretoria / Dirigente Responsável'}
                  </span>
                  <div className="h-20 bg-white" />
                  <div className="border-b border-slate-400 w-4/5 mx-auto" />
                  <span className="text-xs font-black text-slate-900 block">
                    {signatureLayout === 'SINGLE_TREASURER' ? activeReceipt.treasurerName : activeReceipt.pastorName}
                  </span>
                  <span className="text-[9px] text-slate-500 font-semibold block">
                    {signatureLayout === 'SINGLE_TREASURER' ? activeReceipt.treasurerRole : activeReceipt.pastorRole}
                  </span>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="border border-slate-200 rounded-xl p-2.5 text-center space-y-1.5 bg-white">
                  <span className="text-[9px] font-black uppercase text-teal-800 block">Tesouraria Geral</span>
                  <div className="h-20 bg-white" />
                  <div className="border-b border-slate-400 w-4/5 mx-auto" />
                  <span className="text-xs font-black text-slate-900 block">{activeReceipt.treasurerName}</span>
                  <span className="text-[9px] text-slate-500 font-semibold block">{activeReceipt.treasurerRole}</span>
                </div>
                <div className="border border-slate-200 rounded-xl p-2.5 text-center space-y-1.5 bg-white">
                  <span className="text-[9px] font-black uppercase text-teal-800 block">Diretoria / Dirigente</span>
                  <div className="h-20 bg-white" />
                  <div className="border-b border-slate-400 w-4/5 mx-auto" />
                  <span className="text-xs font-black text-slate-900 block">{activeReceipt.pastorName}</span>
                  <span className="text-[9px] text-slate-500 font-semibold block">{activeReceipt.pastorRole}</span>
                </div>
              </div>
            )}
            <p className="text-center text-[10px] font-bold text-teal-800 pt-1">ADGU - Gerando Vidas para o Reino!</p>
          </div>
        </div>
      </div>

      {/* Screen Header Banner */}
      <div className="bg-gradient-to-br from-teal-900 via-teal-800 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <div className="inline-flex items-center gap-2 bg-teal-500/20 border border-teal-400/30 px-3 py-1 rounded-full text-teal-200 text-xs font-bold uppercase tracking-widest mb-3">
            <Coins size={14} /> Emissão Oficial da Tesouraria ADGU
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Receita Diária & Recibos</h1>
          <p className="text-xs sm:text-sm text-teal-100 mt-1 max-w-2xl">
            Emita o fechamento do culto (<strong>Receita Diária</strong>), <strong>Recibos de Despesa</strong> para fornecedores ou <strong>Comprovante para Membro</strong>, 100% configurado para impressão em A4 (2 vias) ou A5.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 bg-white/10 p-1.5 rounded-2xl backdrop-blur-md border border-white/10 w-full md:w-auto">
          <button
            onClick={() => setActiveTab('CREATE')}
            className={`flex-1 md:flex-none px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'CREATE' ? 'bg-white text-teal-950 shadow-lg' : 'text-teal-100 hover:bg-white/10'}`}
          >
            <Plus size={16} /> Emitir Recibo
          </button>
          <button
            onClick={() => setActiveTab('HISTORY')}
            className={`flex-1 md:flex-none px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'HISTORY' ? 'bg-white text-teal-950 shadow-lg' : 'text-teal-100 hover:bg-white/10'}`}
          >
            <FileText size={16} /> Histórico ({receipts.length})
          </button>
          <button
            onClick={() => setActiveTab('SETTINGS')}
            className={`flex-1 md:flex-none px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'SETTINGS' ? 'bg-white text-teal-950 shadow-lg' : 'text-teal-100 hover:bg-white/10'}`}
          >
            <Settings2 size={16} /> Configurar Recibo
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 bg-blue-50 border border-blue-200 text-[#1d4ed8] rounded-2xl flex items-center gap-3 animate-fade-in shadow-sm">
          <CheckCircle2 size={20} className="text-[#1d4ed8] shrink-0" />
          <span className="text-xs font-bold">{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl flex items-center gap-3 animate-fade-in shadow-sm">
          <AlertCircle size={20} className="text-rose-600 shrink-0" />
          <span className="text-xs font-bold">{errorMsg}</span>
        </div>
      )}

      {/* TAB 1: EMITIR RECIBO */}
      {activeTab === 'CREATE' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Formulário de Preenchimento */}
          <form onSubmit={handleGenerateAndSave} className="lg:col-span-6 bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h2 className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                <Receipt size={18} className="text-teal-600" /> 
                {type === 'RECEITA' ? 'Preenchimento da Receita Diária' : type === 'MEMBRO' ? 'Recibo de Dízimo / Oferta para Membro' : 'Recibo de Despesa / Saída de Caixa'}
              </h2>
              <span className="text-[10px] font-black uppercase text-teal-800 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-200">
                Padrão Eclesiástico
              </span>
            </div>

            {/* Seletor de Tipo com 3 Opções Claras */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => setType('RECEITA')}
                className={`p-3 sm:p-3.5 rounded-2xl border-2 text-left transition-all ${type === 'RECEITA' ? 'border-teal-500 bg-teal-50/70 text-teal-950 shadow-sm ring-2 ring-teal-500/20' : 'border-slate-100 bg-slate-50/60 text-slate-600 hover:border-slate-200'}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-black uppercase tracking-wider text-teal-950">Receita Diária</span>
                  <span className={`w-3 h-3 rounded-full ${type === 'RECEITA' ? 'bg-teal-600' : 'bg-slate-300'}`} />
                </div>
                <p className="text-[9px] text-slate-500 leading-tight">Dízimos e Ofertas do Culto</p>
              </button>

              <button
                type="button"
                onClick={() => setType('DESPESA')}
                className={`p-3 sm:p-3.5 rounded-2xl border-2 text-left transition-all ${type === 'DESPESA' ? 'border-rose-500 bg-rose-50/70 text-rose-950 shadow-sm ring-2 ring-rose-500/20' : 'border-slate-100 bg-slate-50/60 text-slate-600 hover:border-slate-200'}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-black uppercase tracking-wider text-rose-950">Despesa</span>
                  <span className={`w-3 h-3 rounded-full ${type === 'DESPESA' ? 'bg-rose-600' : 'bg-slate-300'}`} />
                </div>
                <p className="text-[9px] text-slate-500 leading-tight">Pagamento a Prestador</p>
              </button>

              <button
                type="button"
                onClick={() => setType('MEMBRO')}
                className={`p-3 sm:p-3.5 rounded-2xl border-2 text-left transition-all ${type === 'MEMBRO' ? 'border-indigo-500 bg-indigo-50/70 text-indigo-950 shadow-sm ring-2 ring-indigo-500/20' : 'border-slate-100 bg-slate-50/60 text-slate-600 hover:border-slate-200'}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-black uppercase tracking-wider text-indigo-950">Ao Membro</span>
                  <span className={`w-3 h-3 rounded-full ${type === 'MEMBRO' ? 'bg-indigo-600' : 'bg-slate-300'}`} />
                </div>
                <p className="text-[9px] text-slate-500 leading-tight">Comprovante Dizimista</p>
              </button>
            </div>

            {/* Data, Congregação e Cidade */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1">
                  {type === 'RECEITA' ? 'Data do Culto*' : 'Data de Emissão*'}
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-900 text-xs font-bold focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1">Congregação*</label>
                <input
                  type="text"
                  value={institutionName}
                  onChange={(e) => setInstitutionName(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-900 text-xs font-bold focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                />
              </div>
            </div>

            {/* CAMPOS ESPECÍFICOS POR TIPO */}
            {type === 'RECEITA' ? (
              <div className="space-y-4 pt-1">
                <div className="p-4 sm:p-5 bg-gradient-to-br from-teal-50/90 to-emerald-50/40 rounded-2xl border-2 border-teal-200 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-teal-100 pb-2">
                    <span className="text-xs font-black text-teal-950 uppercase tracking-wide flex items-center gap-1.5">
                      <TrendingUp size={16} className="text-teal-700" /> Discriminativo das Entradas
                    </span>
                    <span className="text-[9px] text-teal-800 font-extrabold bg-teal-200/80 px-2 py-0.5 rounded-full uppercase">
                      Soma Automática
                    </span>
                  </div>

                  {/* 3 Colunas de Entradas */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="bg-white p-3.5 rounded-2xl border-2 border-emerald-200 shadow-sm">
                      <span className="text-[10px] font-black text-emerald-900 uppercase tracking-wider block mb-1">1. Dízimos</span>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-emerald-600 font-black text-xs">R$</span>
                        <input
                          type="text"
                          value={tithes}
                          onChange={(e) => setTithes(e.target.value)}
                          placeholder="0,00"
                          className="w-full pl-9 pr-2 py-2 rounded-xl border border-emerald-200 font-black text-slate-900 text-base bg-emerald-50/20 focus:bg-white outline-none"
                        />
                      </div>
                    </div>

                    <div className="bg-white p-3.5 rounded-2xl border-2 border-teal-200 shadow-sm">
                      <span className="text-[10px] font-black text-teal-900 uppercase tracking-wider block mb-1">2. Ofertas</span>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-teal-600 font-black text-xs">R$</span>
                        <input
                          type="text"
                          value={offerings}
                          onChange={(e) => setOfferings(e.target.value)}
                          placeholder="0,00"
                          className="w-full pl-9 pr-2 py-2 rounded-xl border border-teal-200 font-black text-slate-900 text-base bg-teal-50/20 focus:bg-white outline-none"
                        />
                      </div>
                    </div>

                    <div className="bg-white p-3.5 rounded-2xl border-2 border-amber-200 shadow-sm">
                      <span className="text-[10px] font-black text-amber-950 uppercase tracking-wider block mb-1">3. Especial</span>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-amber-600 font-black text-xs">R$</span>
                        <input
                          type="text"
                          value={specialOfferings}
                          onChange={(e) => setSpecialOfferings(e.target.value)}
                          placeholder="0,00"
                          className="w-full pl-9 pr-2 py-2 rounded-xl border border-amber-200 font-black text-slate-900 text-base bg-amber-50/20 focus:bg-white outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Banner de Valor Total da Receita */}
                  <div className="p-3.5 bg-slate-900 text-white rounded-xl flex justify-between items-center">
                    <div>
                      <span className="text-[9px] font-black text-teal-300 uppercase tracking-widest block">TOTAL APURADO</span>
                      <span className="text-[10px] text-slate-300 italic block">{extensoAtual}</span>
                    </div>
                    <span className="text-xl sm:text-2xl font-black text-teal-300">{formatBRL(totalCalculated)}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1">Observações do Culto (Opcional)</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Ex: Culto de Domingo / Santa Ceia / Escola Bíblica"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-900 text-xs focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                  />
                </div>
              </div>
            ) : type === 'MEMBRO' ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1">Valor Contribuído (R$)*</label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-2.5 text-slate-400 font-bold text-xs">R$</span>
                      <input
                        type="text"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0,00"
                        required
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 font-black text-slate-900 text-base focus:border-indigo-500 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1">Nome do(a) Irmão(ã) / Dizimista*</label>
                    <input
                      type="text"
                      value={personName}
                      onChange={(e) => setPersonName(e.target.value)}
                      placeholder="Nome completo do membro"
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-900 text-xs font-bold focus:border-indigo-500 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-1">
                    <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1">CPF do Membro (Opcional)</label>
                    <input
                      type="text"
                      value={docNumber}
                      onChange={(e) => setDocNumber(e.target.value)}
                      placeholder="000.000.000-00"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-900 text-xs outline-none"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1">Referente a*</label>
                    <input
                      type="text"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Ex: Dízimo do mês de Setembro e Oferta de Missões"
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-900 text-xs font-bold outline-none"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1">Valor da Despesa (R$)*</label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-2.5 text-slate-400 font-bold text-xs">R$</span>
                      <input
                        type="text"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0,00"
                        required
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 font-black text-slate-900 text-base focus:border-rose-500 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1">Paguei(amos) a (Favorecido)*</label>
                    <input
                      type="text"
                      value={personName}
                      onChange={(e) => setPersonName(e.target.value)}
                      placeholder="Nome do fornecedor / prestador"
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-900 text-xs font-bold focus:border-rose-500 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-1">
                    <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1">CPF / CNPJ</label>
                    <input
                      type="text"
                      value={docNumber}
                      onChange={(e) => setDocNumber(e.target.value)}
                      placeholder="000.000.000-00"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-900 text-xs outline-none"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1">Referente a (Descrição)*</label>
                    <input
                      type="text"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Ex: Manutenção no sistema de som do templo"
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-900 text-xs font-bold outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Assinaturas e Responsáveis */}
            <div className="pt-2 border-t border-slate-100 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText size={16} className="text-teal-600" /> Assinaturas e Responsáveis
                  </h3>
                  <p className="text-[10px] text-slate-400">Espaço em branco reservado com tamanho ideal para assinatura digital GOV.BR ou manual</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowGovHelp(true)}
                    className="text-[10px] font-bold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors"
                    title="Ver como assinar digitalmente no GOV.BR"
                  >
                    Como Assinar no GOV.BR?
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('SETTINGS')}
                    className="text-[10px] font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1"
                  >
                    <Settings2 size={12} /> Configurar Padrão
                  </button>
                </div>
              </div>

              {/* Seletor de Modelo de Assinatura */}
              <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-200 space-y-1.5">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">
                  Disposição das Assinaturas no Documento:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSignatureLayout('DUAL')}
                    className={`py-2 px-2.5 rounded-xl text-[11px] font-bold transition-all border text-left flex items-center gap-2 ${signatureLayout === 'DUAL' ? 'bg-teal-700 text-white border-teal-700 shadow-sm' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'}`}
                  >
                    <span className="w-2 h-2 rounded-full bg-current shrink-0" />
                    <span>2 Assinaturas (Tesoureiro e Pastor)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSignatureLayout('SINGLE_PASTOR')}
                    className={`py-2 px-2.5 rounded-xl text-[11px] font-bold transition-all border text-left flex items-center gap-2 ${signatureLayout === 'SINGLE_PASTOR' ? 'bg-teal-700 text-white border-teal-700 shadow-sm' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'}`}
                  >
                    <span className="w-2 h-2 rounded-full bg-current shrink-0" />
                    <span>Apenas Pastor (Centralizada)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSignatureLayout('SINGLE_TREASURER')}
                    className={`py-2 px-2.5 rounded-xl text-[11px] font-bold transition-all border text-left flex items-center gap-2 ${signatureLayout === 'SINGLE_TREASURER' ? 'bg-teal-700 text-white border-teal-700 shadow-sm' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'}`}
                  >
                    <span className="w-2 h-2 rounded-full bg-current shrink-0" />
                    <span>Apenas Tesoureiro (Centralizada)</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className={`p-3 rounded-2xl border transition-all space-y-2 ${signatureLayout === 'SINGLE_PASTOR' ? 'bg-slate-50/50 border-slate-200 opacity-60' : 'bg-white border-teal-200 shadow-xs'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-teal-900 uppercase tracking-wider block">1. Tesouraria</span>
                  </div>
                  <input
                    type="text"
                    value={treasurerName}
                    onChange={(e) => setTreasurerName(e.target.value)}
                    placeholder="Nome do Tesoureiro"
                    required={signatureLayout !== 'SINGLE_PASTOR'}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs bg-white font-bold"
                  />
                  <input
                    type="text"
                    value={treasurerRole}
                    onChange={(e) => setTreasurerRole(e.target.value)}
                    placeholder="Cargo (ex: Tesoureiro Geral)"
                    required={signatureLayout !== 'SINGLE_PASTOR'}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-[11px] bg-white text-slate-600"
                  />
                </div>

                <div className={`p-3 rounded-2xl border transition-all space-y-2 ${signatureLayout === 'SINGLE_TREASURER' ? 'bg-slate-50/50 border-slate-200 opacity-60' : 'bg-white border-teal-200 shadow-xs'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-teal-900 uppercase tracking-wider block">2. Diretoria / Pastoral</span>
                  </div>
                  <input
                    type="text"
                    value={pastorName}
                    onChange={(e) => setPastorName(e.target.value)}
                    placeholder="Nome do Pastor / Dirigente"
                    required={signatureLayout !== 'SINGLE_TREASURER'}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs bg-white font-bold"
                  />
                  <input
                    type="text"
                    value={pastorRole}
                    onChange={(e) => setPastorRole(e.target.value)}
                    placeholder="Cargo (ex: Pastor Presidente / Dirigente)"
                    required={signatureLayout !== 'SINGLE_TREASURER'}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-[11px] bg-white text-slate-600"
                  />
                </div>
              </div>
            </div>

            {/* Ações de Geração */}
            <div className="pt-2 flex flex-col gap-2.5">
              <button
                type="submit"
                disabled={saving}
                className="w-full py-4 bg-teal-700 hover:bg-teal-800 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-lg shadow-teal-700/20 transition-all flex items-center justify-center gap-2"
              >
                <Plus size={18} />
                {saving ? 'Registrando...' : 'Salvar e Gerar Novo Recibo'}
              </button>
            </div>
          </form>

          {/* PAINEL DE PRÉ-VISUALIZAÇÃO E IMPRESSÃO (LIVE PREVIEW) */}
          <div className="lg:col-span-6 space-y-4">
            {/* Header da Visualização */}
            <div className="bg-slate-900 text-white p-4 rounded-3xl shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <span className="text-[9px] font-black text-teal-400 uppercase tracking-widest block">VISUALIZAÇÃO AO VIVO</span>
                <h3 className="text-sm font-black uppercase tracking-tight">Recibo Eclesiástico ADGU</h3>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
                {selectedReceiptForPreview && (
                  <>
                    <button
                      type="button"
                      onClick={() => setSelectedReceiptForPreview(null)}
                      className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                      title="Voltar para rascunho de novo recibo"
                    >
                      <RefreshCw size={14} /> Novo
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(selectedReceiptForPreview.id)}
                      className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                      title="Excluir este recibo"
                    >
                      <Trash2 size={14} /> Excluir
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={handleNativePrint}
                  className="flex-1 sm:flex-none px-3.5 py-2 bg-[#1d4ed8] hover:bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-md"
                  title="Abrir diálogo de impressão do navegador"
                >
                  <Printer size={15} /> Imprimir Recibo
                </button>
                <button
                  type="button"
                  onClick={handleCopyWhatsApp}
                  className="px-3 py-2 bg-[#2D7FF9] hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                  title="Copiar dados para enviar pelo WhatsApp"
                >
                  {copiedWhatsApp ? <Check size={15} className="text-blue-200" /> : <Share2 size={15} />}
                  <span className="hidden sm:inline">{copiedWhatsApp ? 'Copiado!' : 'WhatsApp'}</span>
                </button>
              </div>
            </div>

            {/* Caixa Visual do Recibo (Espelho Perfeito do que Sai na Folha) */}
            <div className="bg-white rounded-3xl border-2 border-slate-300 shadow-xl overflow-hidden p-6 space-y-4 relative">
              
              {/* Faixa Superior Turquesa */}
              <div className="h-2 bg-teal-700 -mx-6 -mt-6" />

              {/* Cabeçalho do Recibo */}
              <div className="flex justify-between items-start border-b border-slate-200 pb-3 gap-3">
                <div className="flex items-center gap-3">
                  {churchSettings?.logo ? (
                    <img src={churchSettings.logo} className="w-12 h-12 object-contain rounded-lg" alt="Logo" />
                  ) : (
                    <div className="w-11 h-11 bg-teal-700 text-white rounded-xl flex items-center justify-center font-black text-xs">
                      ADGU
                    </div>
                  )}
                  <div>
                    <h4 className="text-xs sm:text-sm font-black text-slate-900 uppercase">
                      {churchSettings?.institutionName || 'Assembléia de Deus Geração Unida'}
                    </h4>
                    <p className="text-[9px] text-slate-500 font-bold">CNPJ: {churchSettings?.cnpj || '49.386.673/0001-10'} | Ministério ADGU</p>
                    <p className="text-[9px] text-slate-400">{churchSettings?.address || 'Rua 12 de Outubro, 779 - Parque Tijuca - Maracanaú - CE'}</p>
                  </div>
                </div>

                <div className="text-right space-y-1.5 shrink-0">
                  <div className="bg-teal-50 border border-teal-200 px-2.5 py-1 rounded-lg text-right">
                    <span className="text-[8px] font-black text-teal-800 uppercase block">{activeReceipt.number}</span>
                    <span className="text-[8px] text-slate-400 font-bold block">1ª VIA - IGREJA</span>
                  </div>
                  <div className="bg-teal-700 text-white px-2.5 py-1 rounded-lg text-right">
                    <span className="text-[8px] text-teal-200 font-bold block uppercase">VALOR TOTAL</span>
                    <span className="text-xs font-black block">{formatBRL(activeReceipt.amount)}</span>
                  </div>
                </div>
              </div>

              {/* Corpo do Recibo */}
              {activeReceipt.type === 'RECEITA' ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="p-2 border border-slate-200 rounded-xl bg-slate-50/50">
                      <span className="text-[9px] font-bold text-slate-400 block uppercase">Congregação</span>
                      <span className="font-black text-slate-800">{activeReceipt.institutionName}</span>
                    </div>
                    <div className="p-2 bg-teal-50/70 border border-teal-100 rounded-xl">
                      <span className="text-[9px] font-bold text-teal-700 block uppercase">Data do Culto / Local</span>
                      <span className="font-black text-teal-950">{activeReceipt.city}, {dateFormattedPreview}</span>
                    </div>
                  </div>

                  {/* 3 Blocos de Entradas */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2.5 border-2 border-emerald-100 bg-emerald-50/40 rounded-xl">
                      <span className="text-[8px] font-black text-emerald-800 uppercase block">DÍZIMOS</span>
                      <span className="text-xs sm:text-sm font-black text-slate-900 block mt-0.5">{formatBRL(activeReceipt.tithes || 0)}</span>
                    </div>
                    <div className="p-2.5 border-2 border-teal-100 bg-teal-50/40 rounded-xl">
                      <span className="text-[8px] font-black text-teal-800 uppercase block">OFERTAS</span>
                      <span className="text-xs sm:text-sm font-black text-slate-900 block mt-0.5">{formatBRL(activeReceipt.offerings || 0)}</span>
                    </div>
                    <div className="p-2.5 border-2 border-amber-100 bg-amber-50/40 rounded-xl">
                      <span className="text-[8px] font-black text-amber-800 uppercase block">ESPECIAL</span>
                      <span className="text-xs sm:text-sm font-black text-slate-900 block mt-0.5">{formatBRL(activeReceipt.specialOfferings || 0)}</span>
                    </div>
                  </div>

                  {/* Faixa de Total e Extenso */}
                  <div className="p-3 bg-gradient-to-r from-teal-50 via-teal-100/50 to-emerald-50 border border-teal-200 rounded-xl space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-black text-teal-900 uppercase">VALOR TOTAL DA RECEITA DIÁRIA</span>
                      <span className="text-sm font-black text-teal-950">{formatBRL(activeReceipt.amount)}</span>
                    </div>
                    <p className="text-[10px] text-teal-900 font-bold italic leading-tight">
                      ({valorPorExtenso(activeReceipt.amount)})
                    </p>
                  </div>

                  {activeReceipt.description && (
                    <div className="p-2 border border-slate-100 rounded-lg text-[10px] text-slate-500 bg-slate-50/40">
                      <strong>Obs:</strong> {activeReceipt.description}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2.5 text-xs">
                  <div className="p-2.5 border border-slate-200 rounded-xl bg-white space-y-0.5">
                    <span className="text-[9px] font-bold text-slate-400 block uppercase">
                      {activeReceipt.type === 'MEMBRO' ? 'Recebemos do(a) irmão(ã)' : 'Paguei(amos) a'}
                    </span>
                    <span className="font-black text-slate-900 text-xs sm:text-sm block">
                      {activeReceipt.personName} {activeReceipt.docNumber && `(CPF/CNPJ: ${activeReceipt.docNumber})`}
                    </span>
                  </div>

                  <div className="p-2.5 bg-teal-50/70 border border-teal-100 rounded-xl space-y-0.5">
                    <span className="text-[9px] font-bold text-teal-700 block uppercase">a importância de</span>
                    <span className="font-black text-teal-950 text-xs block">
                      {formatBRL(activeReceipt.amount)} ({valorPorExtenso(activeReceipt.amount)})
                    </span>
                  </div>

                  <div className="p-2.5 border border-slate-200 rounded-xl bg-white space-y-0.5">
                    <span className="text-[9px] font-bold text-slate-400 block uppercase">referente a</span>
                    <span className="font-bold text-slate-800 text-xs block">{activeReceipt.description}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div className="p-2 border border-slate-200 rounded-lg bg-slate-50/50">
                      <span className="text-[8px] font-bold text-slate-400 uppercase block">Congregação</span>
                      <span className="font-bold text-slate-800 block">{activeReceipt.institutionName}</span>
                    </div>
                    <div className="p-2 bg-teal-50/50 rounded-lg border border-teal-100">
                      <span className="text-[8px] font-bold text-teal-700 uppercase block">Local e Data</span>
                      <span className="font-bold text-teal-950 block">{activeReceipt.city}, {dateFormattedPreview}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Quadro de Assinaturas - Área em Branco para Assinatura */}
              {signatureLayout === 'SINGLE_PASTOR' || signatureLayout === 'SINGLE_TREASURER' ? (
                <div className="pt-2 max-w-md mx-auto text-center">
                  <div className="p-3.5 bg-white rounded-2xl border-2 border-slate-200 flex flex-col justify-between min-h-[160px] shadow-sm">
                    <span className="text-[9px] font-black text-teal-800 uppercase tracking-wider block">
                      {signatureLayout === 'SINGLE_TREASURER' ? 'TESOURARIA GERAL' : 'DIRETORIA / DIRIGENTE RESPONSÁVEL'}
                    </span>
                    <div className="h-24 bg-white" />
                    <div className="w-4/5 mx-auto border-b-2 border-slate-700 mb-1.5" />
                    <span className="font-black text-slate-900 text-xs uppercase block">
                      {signatureLayout === 'SINGLE_TREASURER' ? activeReceipt.treasurerName : activeReceipt.pastorName}
                    </span>
                    <span className="text-[9px] text-slate-500 font-medium block">
                      {signatureLayout === 'SINGLE_TREASURER' ? activeReceipt.treasurerRole : activeReceipt.pastorRole}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 pt-2 text-center">
                  <div className="p-3 bg-white rounded-2xl border-2 border-slate-200 flex flex-col justify-between min-h-[160px] shadow-sm">
                    <span className="text-[8px] font-black text-teal-800 uppercase tracking-wider block">TESOURARIA GERAL</span>
                    <div className="h-20 bg-white" />
                    <div className="w-full border-b border-slate-500 mb-1" />
                    <span className="font-black text-slate-900 text-[10px] leading-tight block">{activeReceipt.treasurerName.toUpperCase()}</span>
                    <span className="text-[8px] text-slate-500 font-medium block">{activeReceipt.treasurerRole}</span>
                  </div>

                  <div className="p-3 bg-white rounded-2xl border-2 border-slate-200 flex flex-col justify-between min-h-[160px] shadow-sm">
                    <span className="text-[8px] font-black text-teal-800 uppercase tracking-wider block">DIRETORIA / DIRIGENTE</span>
                    <div className="h-20 bg-white" />
                    <div className="w-full border-b border-slate-500 mb-1" />
                    <span className="font-black text-slate-900 text-[10px] leading-tight block">{activeReceipt.pastorName.toUpperCase()}</span>
                    <span className="text-[8px] text-slate-500 font-medium block">{activeReceipt.pastorRole}</span>
                  </div>
                </div>
              )}

              {/* Informação sobre Assinatura */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 flex items-center justify-between gap-2 text-[10px] text-slate-600">
                <div className="flex items-center gap-2">
                  <span>Área em branco dimensionada com tamanho reservado para carimbo GOV.BR ou assinatura manual.</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowGovHelp(true)}
                  className="underline font-bold text-teal-800 hover:text-teal-950 shrink-0"
                >
                  Como assinar no GOV.BR
                </button>
              </div>

              {/* Rodapé Oficial Slogan */}
              <p className="text-center text-[9px] font-black text-teal-800 pt-1 tracking-wider uppercase">
                ADGU - Gerando Vidas para o Reino!
              </p>
            </div>

            {/* Botões de Download do PDF */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
              <div>
                <span className="text-xs font-black text-slate-800 block">Opções de Exportação em PDF:</span>
                <span className="text-[10px] text-slate-500 block">Escolha o formato ideal para impressão ou envio digital</span>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => exportPDF_A4(activeReceipt)}
                  className="flex-1 sm:flex-none px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-md"
                  title="Baixa folha A4 com 2 vias separadas por corte"
                >
                  <Scissors size={14} className="text-teal-400" /> Baixar A4 (2 Vias)
                </button>
                <button
                  type="button"
                  onClick={() => exportPDF_A5(activeReceipt)}
                  className="flex-1 sm:flex-none px-4 py-2.5 bg-teal-800 hover:bg-teal-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all"
                  title="Baixa 1 via em formato A5 paisagem"
                >
                  <ArrowDownToLine size={14} /> Baixar A5 (1 Via)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: HISTÓRICO DE DOCUMENTOS */}
      {activeTab === 'HISTORY' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">Histórico de Documentos Emitidos</h2>
              <p className="text-xs text-slate-500">Consulte, reimprima ou baixe receitas diárias e recibos cadastrados</p>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar por congregação, nº..."
                  className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                />
              </div>

              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white"
              >
                <option value="TODOS">Todos os Documentos</option>
                <option value="RECEITA">Receitas Diárias</option>
                <option value="DESPESA">Recibos de Despesa</option>
                <option value="MEMBRO">Recibos para Membros</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-400 text-xs">Carregando documentos...</div>
          ) : filteredReceipts.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs space-y-2">
              <Receipt size={32} className="mx-auto text-slate-300" />
              <p>Nenhum registro encontrado no histórico.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="p-3">Nº Documento</th>
                    <th className="p-3">Data</th>
                    <th className="p-3">Tipo</th>
                    <th className="p-3">Congregação / Favorecido</th>
                    <th className="p-3">Detalhamento</th>
                    <th className="p-3 text-right">Valor Total</th>
                    <th className="p-3 text-center">Imprimir / PDF</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredReceipts.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 font-bold text-slate-900">{r.number}</td>
                      <td className="p-3">{new Date(r.date + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                      <td className="p-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase ${
                          r.type === 'RECEITA' ? 'bg-teal-100 text-teal-800' : 
                          r.type === 'MEMBRO' ? 'bg-indigo-100 text-indigo-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {r.type === 'RECEITA' ? 'Receita Diária' : r.type === 'MEMBRO' ? 'Membro' : 'Despesa'}
                        </span>
                      </td>
                      <td className="p-3 font-bold text-slate-900">{r.personName}</td>
                      <td className="p-3 max-w-xs truncate text-slate-500">
                        {r.type === 'RECEITA' && (r.tithes !== undefined || r.offerings !== undefined)
                          ? `Dízimos: ${formatBRL(r.tithes || 0)} | Ofertas: ${formatBRL(r.offerings || 0)} | Especial: ${formatBRL(r.specialOfferings || 0)}`
                          : r.description}
                      </td>
                      <td className="p-3 text-right font-black text-slate-900">{formatBRL(r.amount)}</td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedReceiptForPreview(r);
                              setType(r.type);
                              setActiveTab('CREATE');
                            }}
                            title="Visualizar e Imprimir"
                            className="p-2 rounded-lg bg-blue-50 text-[#1d4ed8] hover:bg-[#1d4ed8] hover:text-white transition-colors"
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => exportPDF_A4(r)}
                            title="Baixar PDF A4 (2 Vias)"
                            className="p-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors font-bold text-[10px]"
                          >
                            A4
                          </button>
                          <button
                            type="button"
                            onClick={() => exportPDF_A5(r)}
                            title="Baixar PDF A5 (1 Via)"
                            className="p-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors font-bold text-[10px]"
                          >
                            A5
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(r.id)}
                            title="Excluir documento"
                            className="px-2.5 py-2 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white transition-colors flex items-center gap-1 text-[10px] font-black uppercase"
                          >
                            <Trash2 size={14} /> Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: CONFIGURAR DADOS PADRÃO DO RECIBO */}
      {activeTab === 'SETTINGS' && (
        <form onSubmit={handleSaveQuickSettings} className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6 max-w-4xl mx-auto">
          <div className="border-b border-slate-100 pb-4 flex justify-between items-center">
            <div>
              <h2 className="text-base font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                <Settings2 size={20} className="text-teal-600" /> Configurações Oficiais do Recibo
              </h2>
              <p className="text-xs text-slate-500">Defina os nomes, cargos, endereço e cidade padrão que saem em todos os recibos</p>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('CREATE')}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              <X size={18} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider block">Nome do Tesoureiro Geral*</label>
              <input
                type="text"
                value={treasurerName}
                onChange={(e) => setTreasurerName(e.target.value)}
                required
                placeholder="Nome do Tesoureiro"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-900 text-xs font-bold focus:border-teal-500 outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider block">Cargo do Tesoureiro*</label>
              <input
                type="text"
                value={treasurerRole}
                onChange={(e) => setTreasurerRole(e.target.value)}
                required
                placeholder="Ex: Tesoureiro Geral"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-900 text-xs font-bold focus:border-teal-500 outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider block">Nome do Pastor / Dirigente*</label>
              <input
                type="text"
                value={pastorName}
                onChange={(e) => setPastorName(e.target.value)}
                required
                placeholder="Nome do Pastor Dirigente"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-900 text-xs font-bold focus:border-teal-500 outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider block">Cargo do Pastor*</label>
              <input
                type="text"
                value={pastorRole}
                onChange={(e) => setPastorRole(e.target.value)}
                required
                placeholder="Ex: Pastor Presidente / Dirigente"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-900 text-xs font-bold focus:border-teal-500 outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider block">Cidade e Estado Padrão*</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                required
                placeholder="Ex: Maracanaú - CE"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-900 text-xs font-bold focus:border-teal-500 outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider block">Nome da Instituição*</label>
              <input
                type="text"
                value={churchSettings?.institutionName || 'Assembléia de Deus Geração Unida'}
                onChange={(e) => churchSettings && setChurchSettings({ ...churchSettings, institutionName: e.target.value })}
                required
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-900 text-xs font-bold focus:border-teal-500 outline-none"
              />
            </div>

            <div className="sm:col-span-2 space-y-1">
              <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider block">Endereço da Sede (Impresso no Cabeçalho)*</label>
              <input
                type="text"
                value={churchSettings?.address || 'Rua 12 de Outubro, 779 - Parque Tijuca - Maracanaú - CE'}
                onChange={(e) => churchSettings && setChurchSettings({ ...churchSettings, address: e.target.value })}
                required
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-900 text-xs font-bold focus:border-teal-500 outline-none"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setActiveTab('CREATE')}
              className="px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={savingSettings}
              className="px-6 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-black uppercase tracking-wider shadow-md"
            >
              {savingSettings ? 'Salvando...' : 'Salvar Alterações como Padrão'}
            </button>
          </div>
        </form>
      )}

      {/* MODAL GUIA PASSO A PASSO ASSINATURA GOV.BR */}
      {showGovHelp && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-teal-100 text-teal-800 rounded-2xl flex items-center justify-center">
                  <ShieldCheck size={28} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Como Assinar com o GOV.BR</h3>
                  <p className="text-xs text-slate-500">Validade jurídica nacional gratuita (Lei 14.063/2020)</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGovHelp(false)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3.5 text-xs text-slate-600">
              <div className="flex items-start gap-3 p-3 bg-teal-50/60 border border-teal-100 rounded-2xl">
                <span className="w-6 h-6 rounded-full bg-teal-700 text-white font-bold flex items-center justify-center shrink-0 text-xs">1</span>
                <div>
                  <strong className="text-slate-900 block">Baixe o PDF do Recibo</strong>
                  Clique no botão <strong>"Baixar A4 (2 Vias)"</strong> ou <strong>"Baixar A5"</strong> aqui no app.
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-teal-50/60 border border-teal-100 rounded-2xl">
                <span className="w-6 h-6 rounded-full bg-teal-700 text-white font-bold flex items-center justify-center shrink-0 text-xs">2</span>
                <div>
                  <strong className="text-slate-900 block">Acesse o Assinador Oficial GOV.BR</strong>
                  Entre no portal oficial: <span className="font-mono text-teal-800 font-bold">assinador.iti.br</span> ou abra o aplicativo <strong>GOV.BR</strong> no celular.
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-teal-50/60 border border-teal-100 rounded-2xl">
                <span className="w-6 h-6 rounded-full bg-teal-700 text-white font-bold flex items-center justify-center shrink-0 text-xs">3</span>
                <div>
                  <strong className="text-slate-900 block">Posicione o Carimbo no Espaço em Branco</strong>
                  O recibo possui uma área em branco ampla e limpa (~80 × 24 mm). Basta arrastar o carimbo oficial do GOV.BR para o espaço em branco acima do nome e da linha do responsável.
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-teal-50/60 border border-teal-100 rounded-2xl">
                <span className="w-6 h-6 rounded-full bg-teal-700 text-white font-bold flex items-center justify-center shrink-0 text-xs">4</span>
                <div>
                  <strong className="text-slate-900 block">Conclua e Baixe o Documento Assinado</strong>
                  Confirme a assinatura pelo código SMS ou app GOV.BR. O documento terá selo de autenticidade ICP-Brasil e validade jurídica para prestação de contas!
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowGovHelp(false)}
                className="w-full py-3 bg-[#1d4ed8] hover:bg-blue-800 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all"
              >
                Entendi, Fechar Guia
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO DE RECIBO */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-[300] bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2.5rem] max-w-md w-full p-8 space-y-6 shadow-2xl border border-slate-100 animate-in zoom-in-95">
            <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center">
              <Trash2 size={32} />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Excluir Recibo</h3>
              <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                Deseja realmente excluir este recibo do histórico? Esta ação removerá o documento da listagem.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteReceipt}
                className="flex-1 py-4 bg-rose-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-700 shadow-lg shadow-rose-100 transition-all"
              >
                Sim, Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

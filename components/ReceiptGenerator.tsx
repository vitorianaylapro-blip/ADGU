import React, { useState, useEffect, useRef } from 'react';
import { UserSession, ReceiptRecord } from '../types';
import { getReceipts, saveReceipt, deleteReceipt, getSettings, saveSettings, SystemSettings, saveUser, getUsers } from '../services/storageService';
import { valorPorExtenso } from '../services/extensoService';
import { jsPDF } from 'jspdf';
import { 
  Receipt, Plus, Search, Printer, Trash2, CheckCircle2, FileText, User, Building, 
  DollarSign, Calendar, AlertCircle, Coins, Sparkles, TrendingUp, HandCoins, Share2, 
  Copy, Check, Settings2, Scissors, ArrowDownToLine, Eye, RefreshCw, X, ShieldCheck,
  MessageCircle, CheckSquare, Square, Maximize2, Minimize2, Layers, ChevronDown
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
  const [currentUser, setCurrentUser] = useState<import('../types').UserAccount | null>(null);
  const [copiedWhatsApp, setCopiedWhatsApp] = useState(false);
  const [previewVia, setPreviewVia] = useState<'1' | '2'>('1');
  const [selectedReceiptForPreview, setSelectedReceiptForPreview] = useState<ReceiptRecord | null>(null);

  // New features: Dedicated Eye modal ("Olhinho"), preview size, and multi-receipt print
  const [viewingReceiptModal, setViewingReceiptModal] = useState<ReceiptRecord | null>(null);
  const [modalMode, setModalMode] = useState<'SINGLE' | '2VIAS' | 'MULTI'>('SINGLE');
  const [previewSize, setPreviewSize] = useState<'NORMAL' | 'LARGE'>('LARGE');
  const [printMode, setPrintMode] = useState<'SINGLE' | '2VIAS' | 'MULTI'>('2VIAS');
  const [multiPrintList, setMultiPrintList] = useState<ReceiptRecord[]>([]);
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<string[]>([]);

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
      const allUsers = await getUsers();
      setCurrentUser(allUsers.find(u => u.id === session.id) || null);
    } catch (e) {
      console.error("Erro ao carregar dados:", e);
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

  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && currentUser) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            // Simple threshold: treat light pixels as transparent
            for (let i = 0; i < data.length; i += 4) {
              const r = data[i];
              const g = data[i + 1];
              const b = data[i + 2];
              // Assuming signature is dark, white-ish background
              if (r > 200 && g > 200 && b > 200) {
                data[i + 3] = 0; // Set alpha to transparent
              }
            }
            ctx.putImageData(imageData, 0, 0);
            const signatureData = canvas.toDataURL('image/png');
            const updatedUser = { ...currentUser, signature: signatureData };
            setCurrentUser(updatedUser);
            saveUser(updatedUser.id, updatedUser);
            setSuccessMsg("Assinatura salva com sucesso!");
            setTimeout(() => setSuccessMsg(null), 3500);
          }
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
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
      setViewingReceiptModal(newReceipt);

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

  // ----------------------------------------------------
  // DRAW SINGLE VIA LARGE (A4 ÚNICO - GRANDE E LIMPO)
  // ----------------------------------------------------
  const drawSingleViaLarge = (
    doc: any,
    receipt: ReceiptRecord,
    settings: SystemSettings,
    layout: 'DUAL' | 'SINGLE_PASTOR' | 'SINGLE_TREASURER' = signatureLayout
  ) => {
    const pageWidth = doc.internal.pageSize.getWidth(); // 210 mm
    const startX = 14;
    const startY = 16;
    const cardWidth = pageWidth - 28; // 182 mm
    const cardHeight = 254; // Ocupa a folha A4 com proporção harmoniosa

    const tealDark = [23, 147, 145]; // #179391
    const tealLight = [230, 246, 245]; // #e6f6f5
    const borderSlate = [203, 213, 225]; // #cbd5e1
    const textDark = [15, 23, 42]; // #0f172a
    const textMuted = [100, 116, 139]; // #64748b

    // Borda Externa do Recibo
    doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]);
    doc.setLineWidth(0.4);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(startX, startY, cardWidth, cardHeight, 3.5, 3.5, 'FD');

    // Faixa Superior
    doc.setFillColor(tealDark[0], tealDark[1], tealDark[2]);
    doc.roundedRect(startX, startY, cardWidth, 4, 3.5, 3.5, 'F');
    doc.rect(startX, startY + 2, cardWidth, 2, 'F');

    // Logo
    const logoX = startX + 6;
    const logoY = startY + 9;
    const logoSize = 22;
    if (settings.logo) {
      try {
        doc.addImage(settings.logo, 'PNG', logoX, logoY, logoSize, logoSize);
      } catch (e) {}
    }

    // Cabeçalho da Instituição
    const textX = settings.logo ? (logoX + logoSize + 6) : (startX + 8);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.text((settings.institutionName || "Assembléia de Deus Geração Unida").toUpperCase(), textX, startY + 15);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text(`CNPJ: ${settings.cnpj || '49.386.673/0001-10'}   |   Ministério Eclesiástico ADGU`, textX, startY + 21);
    doc.text(settings.address || "Rua 12 de Outubro, 779 - Parque Tijuca - Maracanaú - CE", textX, startY + 26);
    doc.text(`Contato: ${settings.email || 'guparquetijuca@gmail.com'}`, textX, startY + 31);

    // Badges Nº e Total à Direita
    const badgeW = 56;
    const badgeX = startX + cardWidth - badgeW - 6;

    // Badge Nº & Identificação
    doc.setFillColor(tealLight[0], tealLight[1], tealLight[2]);
    doc.setDrawColor(tealDark[0], tealDark[1], tealDark[2]);
    doc.setLineWidth(0.3);
    doc.roundedRect(badgeX, startY + 9, badgeW, 11, 2, 2, 'FD');

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(tealDark[0], tealDark[1], tealDark[2]);
    doc.text(receipt.number, badgeX + badgeW / 2, startY + 14.5, { align: 'center' });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text("RECIBO OFICIAL (VIA ÚNICA)", badgeX + badgeW / 2, startY + 18.5, { align: 'center' });

    // Badge TOTAL
    doc.setFillColor(tealDark[0], tealDark[1], tealDark[2]);
    doc.roundedRect(badgeX, startY + 22, badgeW, 11, 2, 2, 'F');
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text(`TOTAL: ${formatBRL(receipt.amount)}`, badgeX + badgeW / 2, startY + 29.5, { align: 'center' });

    // Divisor
    doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]);
    doc.setLineWidth(0.3);
    doc.line(startX + 6, startY + 36, startX + cardWidth - 6, startY + 36);

    // Corpo
    let curY = startY + 43;
    const bodyW = cardWidth - 12;
    const bodyX = startX + 6;
    const dateFormatted = new Date(receipt.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    const extenso = valorPorExtenso(receipt.amount);

    if (receipt.type === 'RECEITA') {
      const halfW = (bodyW - 4) / 2;
      doc.setFillColor(255, 255, 255);
      doc.rect(bodyX, curY, halfW, 10, 'FD');
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
      doc.text(`CONGREGAÇÃO: ${receipt.institutionName.toUpperCase()}`, bodyX + 4, curY + 6.5);

      doc.setFillColor(tealLight[0], tealLight[1], tealLight[2]);
      doc.rect(bodyX + halfW + 4, curY, halfW, 10, 'F');
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(tealDark[0], tealDark[1], tealDark[2]);
      doc.text(`DATA DO CULTO: ${receipt.city || 'Maracanaú - CE'}, ${dateFormatted}`, bodyX + halfW + 6, curY + 6.5);

      curY += 15;

      const colW = (bodyW - 6) / 3;
      const colH = 22;

      // Col 1 Dízimos
      doc.setFillColor(255, 255, 255);
      doc.rect(bodyX, curY, colW, colH, 'FD');
      doc.setFillColor(tealLight[0], tealLight[1], tealLight[2]);
      doc.rect(bodyX, curY, colW, 6.5, 'F');
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(tealDark[0], tealDark[1], tealDark[2]);
      doc.text("DÍZIMOS", bodyX + colW / 2, curY + 4.5, { align: 'center' });
      doc.setFontSize(13);
      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
      doc.text(formatBRL(receipt.tithes || 0), bodyX + colW / 2, curY + 16, { align: 'center' });

      // Col 2 Ofertas
      const col2X = bodyX + colW + 3;
      doc.setFillColor(255, 255, 255);
      doc.rect(col2X, curY, colW, colH, 'FD');
      doc.setFillColor(tealLight[0], tealLight[1], tealLight[2]);
      doc.rect(col2X, curY, colW, 6.5, 'F');
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(tealDark[0], tealDark[1], tealDark[2]);
      doc.text("OFERTAS", col2X + colW / 2, curY + 4.5, { align: 'center' });
      doc.setFontSize(13);
      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
      doc.text(formatBRL(receipt.offerings || 0), col2X + colW / 2, curY + 16, { align: 'center' });

      // Col 3 Especial
      const col3X = bodyX + (colW * 2) + 6;
      doc.setFillColor(255, 255, 255);
      doc.rect(col3X, curY, colW, colH, 'FD');
      doc.setFillColor(tealLight[0], tealLight[1], tealLight[2]);
      doc.rect(col3X, curY, colW, 6.5, 'F');
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(tealDark[0], tealDark[1], tealDark[2]);
      doc.text("OFERTA ESPECIAL", col3X + colW / 2, curY + 4.5, { align: 'center' });
      doc.setFontSize(13);
      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
      doc.text(formatBRL(receipt.specialOfferings || 0), col3X + colW / 2, curY + 16, { align: 'center' });

      curY += colH + 4;

      // Faixa Total e Extenso
      doc.setFillColor(tealLight[0], tealLight[1], tealLight[2]);
      doc.rect(bodyX, curY, bodyW, 14, 'F');
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(tealDark[0], tealDark[1], tealDark[2]);
      doc.text("VALOR TOTAL:", bodyX + 4, curY + 9);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
      const extensoLines = doc.splitTextToSize(`${formatBRL(receipt.amount)} (${extenso})`, bodyW - 40);
      doc.text(extensoLines, bodyX + 38, curY + 9);

      if (receipt.description) {
        curY += 18;
        doc.setFillColor(255, 255, 255);
        doc.rect(bodyX, curY, bodyW, 10, 'FD');
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
        doc.text("OBSERVAÇÕES:", bodyX + 4, curY + 6.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(textDark[0], textDark[1], textDark[2]);
        doc.text(receipt.description, bodyX + 38, curY + 6.5);
      }

      curY += 24;
    } else {
      // DESPESA ou MEMBRO
      const label1 = receipt.type === 'MEMBRO' ? "Recebemos do(a) irmão(ã)" : "Paguei(amos) a";
      
      // Favorecido
      doc.setFillColor(255, 255, 255);
      doc.rect(bodyX, curY, bodyW, 12, 'FD');
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
      doc.text(label1, bodyX + 4, curY + 7.5);
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
      const nameWithDoc = `${receipt.personName.toUpperCase()} ${receipt.docNumber ? `(CPF/CNPJ: ${receipt.docNumber})` : ''}`;
      const nameLines = doc.splitTextToSize(nameWithDoc, bodyW - 46);
      doc.text(nameLines, bodyX + 44, curY + 7.5);

      curY += 16;

      // Importância de
      doc.setFillColor(tealLight[0], tealLight[1], tealLight[2]);
      doc.rect(bodyX, curY, bodyW, 13, 'F');
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(tealDark[0], tealDark[1], tealDark[2]);
      doc.text("a importância de", bodyX + 4, curY + 8);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
      const valorExtensoLines = doc.splitTextToSize(`${formatBRL(receipt.amount)} (${extenso})`, bodyW - 42);
      doc.text(valorExtensoLines, bodyX + 38, curY + 8);

      curY += 17;

      // Referente a
      doc.setFillColor(255, 255, 255);
      doc.rect(bodyX, curY, bodyW, 14, 'FD');
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
      doc.text("referente a", bodyX + 4, curY + 8.5);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
      const descLines = doc.splitTextToSize(receipt.description, bodyW - 32);
      doc.text(descLines, bodyX + 30, curY + 8.5);

      curY += 18;

      // Congregação e Data
      const halfW = (bodyW - 4) / 2;
      doc.setFillColor(255, 255, 255);
      doc.rect(bodyX, curY, halfW, 10, 'FD');
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
      doc.text(`Congregação: ${receipt.institutionName.toUpperCase()}`, bodyX + 4, curY + 6.5);

      doc.setFillColor(tealLight[0], tealLight[1], tealLight[2]);
      doc.rect(bodyX + halfW + 4, curY, halfW, 10, 'F');
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(tealDark[0], tealDark[1], tealDark[2]);
      doc.text(`${receipt.city || 'Maracanaú - CE'}, ${dateFormatted}`, bodyX + halfW + 7, curY + 6.5);

      curY += 15;
    }

    // Assinaturas Amplas (com espaço generoso para carimbo GOV.BR ou caneta)
    const sigBoxH = 64;
    const sigY = Math.max(curY + 8, startY + cardHeight - sigBoxH - 12);

    if (layout === 'SINGLE_PASTOR' || layout === 'SINGLE_TREASURER') {
      const isTreasurer = layout === 'SINGLE_TREASURER';
      const sigBoxW = 140;
      const singleX = bodyX + (bodyW - sigBoxW) / 2;
      const title = isTreasurer ? "TESOURARIA GERAL" : "DIRETORIA / DIRIGENTE RESPONSÁVEL";
      const signerName = isTreasurer ? (receipt.treasurerName || 'Tesoureiro Geral') : (receipt.pastorName || 'Pr. Antônio Chaves Crus');
      const signerRole = isTreasurer ? (receipt.treasurerRole || 'Tesoureiro Geral') : (receipt.pastorRole || 'Pastor Presidente / Dirigente');

      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]);
      doc.setLineWidth(0.35);
      doc.roundedRect(singleX, sigY, sigBoxW, sigBoxH, 2.5, 2.5, 'FD');

      doc.setFillColor(tealLight[0], tealLight[1], tealLight[2]);
      doc.roundedRect(singleX, sigY, sigBoxW, 7, 2.5, 2.5, 'F');
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(tealDark[0], tealDark[1], tealDark[2]);
      doc.text(title, singleX + sigBoxW / 2, sigY + 5, { align: 'center' });

      doc.setDrawColor(148, 163, 184);
      doc.setLineWidth(0.3);
      doc.line(singleX + 16, sigY + 46, singleX + sigBoxW - 16, sigY + 46);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
      doc.text(signerName.toUpperCase(), singleX + sigBoxW / 2, sigY + 52, { align: 'center' });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
      doc.text(signerRole, singleX + sigBoxW / 2, sigY + 57, { align: 'center' });
    } else {
      const sigBoxW = (bodyW - 6) / 2;

      // Sig 1: Tesouraria
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]);
      doc.setLineWidth(0.35);
      doc.roundedRect(bodyX, sigY, sigBoxW, sigBoxH, 2.5, 2.5, 'FD');

      doc.setFillColor(tealLight[0], tealLight[1], tealLight[2]);
      doc.roundedRect(bodyX, sigY, sigBoxW, 7, 2.5, 2.5, 'F');
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(tealDark[0], tealDark[1], tealDark[2]);
      doc.text("TESOURARIA GERAL", bodyX + sigBoxW / 2, sigY + 5, { align: 'center' });

      doc.setDrawColor(148, 163, 184);
      doc.setLineWidth(0.3);
      doc.line(bodyX + 10, sigY + 46, bodyX + sigBoxW - 10, sigY + 46);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
      doc.text((receipt.treasurerName || 'Tesoureiro Geral').toUpperCase(), bodyX + sigBoxW / 2, sigY + 52, { align: 'center' });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
      doc.text(receipt.treasurerRole || 'Tesoureiro Geral', bodyX + sigBoxW / 2, sigY + 57, { align: 'center' });

      // Sig 2: Diretoria / Pastor
      const sig2X = bodyX + sigBoxW + 6;
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]);
      doc.setLineWidth(0.35);
      doc.roundedRect(sig2X, sigY, sigBoxW, sigBoxH, 2.5, 2.5, 'FD');

      doc.setFillColor(tealLight[0], tealLight[1], tealLight[2]);
      doc.roundedRect(sig2X, sigY, sigBoxW, 7, 2.5, 2.5, 'F');
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(tealDark[0], tealDark[1], tealDark[2]);
      doc.text("DIRETORIA / DIRIGENTE RESPONSÁVEL", sig2X + sigBoxW / 2, sigY + 5, { align: 'center' });

      doc.setDrawColor(148, 163, 184);
      doc.setLineWidth(0.3);
      doc.line(sig2X + 10, sigY + 46, sig2X + sigBoxW - 10, sigY + 46);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
      doc.text((receipt.pastorName || 'Pr. Antônio Chaves Crus').toUpperCase(), sig2X + sigBoxW / 2, sigY + 52, { align: 'center' });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
      doc.text(receipt.pastorRole || 'Pastor Presidente / Dirigente', sig2X + sigBoxW / 2, sigY + 57, { align: 'center' });
    }

    // Slogan Oficial
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(tealDark[0], tealDark[1], tealDark[2]);
    doc.text("ADGU - Gerando Vidas para o Reino!", startX + cardWidth / 2, startY + cardHeight - 3.5, { align: 'center' });
  };

  // ----------------------------------------------------
  // DRAW SINGLE VIA COMPACT (A4 PREENCHIDA COM VÁRIOS - 3 POR PÁGINA)
  // ----------------------------------------------------
  const drawSingleViaCompact = (
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
    const tealDark = [23, 147, 145];
    const tealLight = [230, 246, 245];
    const borderSlate = [203, 213, 225];
    const textDark = [15, 23, 42];
    const textMuted = [100, 116, 139];

    // Card Box
    doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]);
    doc.setLineWidth(0.3);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(startX, startY, cardWidth, cardHeight, 2, 2, 'FD');

    // Faixa Superior
    doc.setFillColor(tealDark[0], tealDark[1], tealDark[2]);
    doc.roundedRect(startX, startY, cardWidth, 2, 2, 2, 'F');
    doc.rect(startX, startY + 1, cardWidth, 1, 'F');

    // Logo
    const logoX = startX + 3.5;
    const logoY = startY + 4;
    const logoSize = 12;
    if (settings.logo) {
      try {
        doc.addImage(settings.logo, 'PNG', logoX, logoY, logoSize, logoSize);
      } catch (e) {}
    }

    // Header Texts
    const textX = settings.logo ? (logoX + logoSize + 3.5) : (startX + 5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.text(settings.institutionName || "Assembléia de Deus Geração Unida", textX, startY + 7);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text(`CNPJ: ${settings.cnpj || '49.386.673/0001-10'} | Ministério ADGU`, textX, startY + 10.5);
    doc.text(settings.address || "Rua 12 de Outubro, 779 - Parque Tijuca - Maracanaú - CE", textX, startY + 13.8);

    // Badges right
    const badgeW = 44;
    const badgeX = startX + cardWidth - badgeW - 3.5;

    // Badge Nº & Via
    doc.setFillColor(tealLight[0], tealLight[1], tealLight[2]);
    doc.setDrawColor(tealDark[0], tealDark[1], tealDark[2]);
    doc.setLineWidth(0.2);
    doc.roundedRect(badgeX, startY + 3.5, badgeW, 6.5, 1, 1, 'FD');

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.8);
    doc.setTextColor(tealDark[0], tealDark[1], tealDark[2]);
    doc.text(receipt.number, badgeX + badgeW / 2, startY + 6.5, { align: 'center' });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(5.5);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text(viaLabel.toUpperCase(), badgeX + badgeW / 2, startY + 9, { align: 'center' });

    // Badge Total
    doc.setFillColor(tealDark[0], tealDark[1], tealDark[2]);
    doc.roundedRect(badgeX, startY + 11, badgeW, 6.5, 1, 1, 'F');
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text(`TOTAL: ${formatBRL(receipt.amount)}`, badgeX + badgeW / 2, startY + 15.5, { align: 'center' });

    // Horizontal Line
    doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]);
    doc.setLineWidth(0.2);
    doc.line(startX + 3.5, startY + 18.5, startX + cardWidth - 3.5, startY + 18.5);

    // Body
    let curY = startY + 21;
    const bodyW = cardWidth - 7;
    const bodyX = startX + 3.5;
    const dateFormatted = new Date(receipt.date + 'T12:00:00').toLocaleDateString('pt-BR');
    const extenso = valorPorExtenso(receipt.amount);

    if (receipt.type === 'RECEITA') {
      const halfW = (bodyW - 2) / 2;
      doc.setFillColor(255, 255, 255);
      doc.rect(bodyX, curY, halfW, 5.5, 'FD');
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
      doc.text(`CONGREGAÇÃO: ${receipt.institutionName.toUpperCase()}`, bodyX + 2, curY + 3.8);

      doc.setFillColor(tealLight[0], tealLight[1], tealLight[2]);
      doc.rect(bodyX + halfW + 2, curY, halfW, 5.5, 'F');
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.setTextColor(tealDark[0], tealDark[1], tealDark[2]);
      doc.text(`DATA: ${receipt.city || 'Maracanaú - CE'}, ${dateFormatted}`, bodyX + halfW + 4, curY + 3.8);

      curY += 7.5;

      const colW = (bodyW - 3) / 3;
      const colH = 10;

      // Col 1
      doc.setFillColor(255, 255, 255);
      doc.rect(bodyX, curY, colW, colH, 'FD');
      doc.setFillColor(tealLight[0], tealLight[1], tealLight[2]);
      doc.rect(bodyX, curY, colW, 3.5, 'F');
      doc.setFont("helvetica", "bold");
      doc.setFontSize(5.8);
      doc.setTextColor(tealDark[0], tealDark[1], tealDark[2]);
      doc.text("DÍZIMOS", bodyX + colW / 2, curY + 2.5, { align: 'center' });
      doc.setFontSize(8);
      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
      doc.text(formatBRL(receipt.tithes || 0), bodyX + colW / 2, curY + 7.8, { align: 'center' });

      // Col 2
      const col2X = bodyX + colW + 1.5;
      doc.setFillColor(255, 255, 255);
      doc.rect(col2X, curY, colW, colH, 'FD');
      doc.setFillColor(tealLight[0], tealLight[1], tealLight[2]);
      doc.rect(col2X, curY, colW, 3.5, 'F');
      doc.setFont("helvetica", "bold");
      doc.setFontSize(5.8);
      doc.setTextColor(tealDark[0], tealDark[1], tealDark[2]);
      doc.text("OFERTAS", col2X + colW / 2, curY + 2.5, { align: 'center' });
      doc.setFontSize(8);
      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
      doc.text(formatBRL(receipt.offerings || 0), col2X + colW / 2, curY + 7.8, { align: 'center' });

      // Col 3
      const col3X = bodyX + (colW * 2) + 3;
      doc.setFillColor(255, 255, 255);
      doc.rect(col3X, curY, colW, colH, 'FD');
      doc.setFillColor(tealLight[0], tealLight[1], tealLight[2]);
      doc.rect(col3X, curY, colW, 3.5, 'F');
      doc.setFont("helvetica", "bold");
      doc.setFontSize(5.8);
      doc.setTextColor(tealDark[0], tealDark[1], tealDark[2]);
      doc.text("ESPECIAL", col3X + colW / 2, curY + 2.5, { align: 'center' });
      doc.setFontSize(8);
      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
      doc.text(formatBRL(receipt.specialOfferings || 0), col3X + colW / 2, curY + 7.8, { align: 'center' });

      curY += colH + 2;

      // Extenso
      doc.setFillColor(tealLight[0], tealLight[1], tealLight[2]);
      doc.rect(bodyX, curY, bodyW, 6.5, 'F');
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.setTextColor(tealDark[0], tealDark[1], tealDark[2]);
      doc.text("TOTAL RECEITA:", bodyX + 2, curY + 4.2);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
      const extensoLines = doc.splitTextToSize(`${formatBRL(receipt.amount)} (${extenso})`, bodyW - 30);
      doc.text(extensoLines, bodyX + 26, curY + 4.2);

      curY += 8.5;
    } else {
      // DESPESA / MEMBRO
      const label1 = receipt.type === 'MEMBRO' ? "Recebemos de" : "Paguei a";
      doc.setFillColor(255, 255, 255);
      doc.rect(bodyX, curY, bodyW, 6, 'FD');
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
      doc.text(label1, bodyX + 2, curY + 4);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
      const nameWithDoc = `${receipt.personName.toUpperCase()} ${receipt.docNumber ? `(CPF/CNPJ: ${receipt.docNumber})` : ''}`;
      const nameLines = doc.splitTextToSize(nameWithDoc, bodyW - 28);
      doc.text(nameLines, bodyX + 26, curY + 4);

      curY += 7.5;

      doc.setFillColor(tealLight[0], tealLight[1], tealLight[2]);
      doc.rect(bodyX, curY, bodyW, 6, 'F');
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.setTextColor(tealDark[0], tealDark[1], tealDark[2]);
      doc.text("A quantia de", bodyX + 2, curY + 4);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
      const valorExtensoLines = doc.splitTextToSize(`${formatBRL(receipt.amount)} (${extenso})`, bodyW - 26);
      doc.text(valorExtensoLines, bodyX + 22, curY + 4);

      curY += 7.5;

      doc.setFillColor(255, 255, 255);
      doc.rect(bodyX, curY, bodyW, 6, 'FD');
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
      doc.text("Referente a", bodyX + 2, curY + 4);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
      const descLines = doc.splitTextToSize(receipt.description, bodyW - 22);
      doc.text(descLines, bodyX + 20, curY + 4);

      curY += 7.5;

      const halfW = (bodyW - 2) / 2;
      doc.setFillColor(255, 255, 255);
      doc.rect(bodyX, curY, halfW, 5, 'FD');
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6);
      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
      doc.text(`Congregação: ${receipt.institutionName.toUpperCase()}`, bodyX + 2, curY + 3.5);

      doc.setFillColor(tealLight[0], tealLight[1], tealLight[2]);
      doc.rect(bodyX + halfW + 2, curY, halfW, 5, 'F');
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6);
      doc.setTextColor(tealDark[0], tealDark[1], tealDark[2]);
      doc.text(`${receipt.city || 'Maracanaú - CE'}, ${dateFormatted}`, bodyX + halfW + 4, curY + 3.5);

      curY += 7;
    }

    // Assinaturas compactas
    const sigBoxH = 21;
    const sigY = startY + cardHeight - sigBoxH - 3;

    if (layout === 'SINGLE_PASTOR' || layout === 'SINGLE_TREASURER') {
      const isTreasurer = layout === 'SINGLE_TREASURER';
      const sigBoxW = 90;
      const singleX = bodyX + (bodyW - sigBoxW) / 2;
      const title = isTreasurer ? "TESOURARIA GERAL" : "DIRETORIA / DIRIGENTE";
      const signerName = isTreasurer ? (receipt.treasurerName || 'Tesoureiro Geral') : (receipt.pastorName || 'Pr. Antônio Chaves Crus');

      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]);
      doc.setLineWidth(0.25);
      doc.roundedRect(singleX, sigY, sigBoxW, sigBoxH, 1.5, 1.5, 'FD');

      doc.setFillColor(tealLight[0], tealLight[1], tealLight[2]);
      doc.roundedRect(singleX, sigY, sigBoxW, 3.8, 1.5, 1.5, 'F');
      doc.setFont("helvetica", "bold");
      doc.setFontSize(5.5);
      doc.setTextColor(tealDark[0], tealDark[1], tealDark[2]);
      doc.text(title, singleX + sigBoxW / 2, sigY + 2.7, { align: 'center' });

      doc.setDrawColor(148, 163, 184);
      doc.setLineWidth(0.2);
      doc.line(singleX + 8, sigY + 14, singleX + sigBoxW - 8, sigY + 14);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
      doc.text(signerName.toUpperCase(), singleX + sigBoxW / 2, sigY + 18, { align: 'center' });
    } else {
      const sigBoxW = (bodyW - 3) / 2;

      // Tesouraria
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]);
      doc.setLineWidth(0.25);
      doc.roundedRect(bodyX, sigY, sigBoxW, sigBoxH, 1.5, 1.5, 'FD');

      doc.setFillColor(tealLight[0], tealLight[1], tealLight[2]);
      doc.roundedRect(bodyX, sigY, sigBoxW, 3.8, 1.5, 1.5, 'F');
      doc.setFont("helvetica", "bold");
      doc.setFontSize(5.5);
      doc.setTextColor(tealDark[0], tealDark[1], tealDark[2]);
      doc.text("TESOURARIA GERAL", bodyX + sigBoxW / 2, sigY + 2.7, { align: 'center' });

      doc.setDrawColor(148, 163, 184);
      doc.setLineWidth(0.2);
      doc.line(bodyX + 5, sigY + 14, bodyX + sigBoxW - 5, sigY + 14);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
      doc.text((receipt.treasurerName || 'Tesoureiro Geral').toUpperCase(), bodyX + sigBoxW / 2, sigY + 18, { align: 'center' });

      // Diretoria
      const sig2X = bodyX + sigBoxW + 3;
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]);
      doc.setLineWidth(0.25);
      doc.roundedRect(sig2X, sigY, sigBoxW, sigBoxH, 1.5, 1.5, 'FD');

      doc.setFillColor(tealLight[0], tealLight[1], tealLight[2]);
      doc.roundedRect(sig2X, sigY, sigBoxW, 3.8, 1.5, 1.5, 'F');
      doc.setFont("helvetica", "bold");
      doc.setFontSize(5.5);
      doc.setTextColor(tealDark[0], tealDark[1], tealDark[2]);
      doc.text("DIRETORIA / DIRIGENTE", sig2X + sigBoxW / 2, sigY + 2.7, { align: 'center' });

      doc.setDrawColor(148, 163, 184);
      doc.setLineWidth(0.2);
      doc.line(sig2X + 5, sigY + 14, sig2X + sigBoxW - 5, sigY + 14);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
      doc.text((receipt.pastorName || 'Pr. Antônio Chaves Crus').toUpperCase(), sig2X + sigBoxW / 2, sigY + 18, { align: 'center' });
    }

    // Slogan
    doc.setFont("helvetica", "bold");
    doc.setFontSize(5.5);
    doc.setTextColor(tealDark[0], tealDark[1], tealDark[2]);
    doc.text("ADGU - Gerando Vidas para o Reino!", startX + cardWidth / 2, startY + cardHeight - 1.2, { align: 'center' });
  };

  // ----------------------------------------------------
  // EXPORTADORES PDF (A4 1 VIA GRANDE, A4 2 VIAS, A4 MULTI/3 VIAS, A5)
  // ----------------------------------------------------
  
  // 1) Export PDF A4 - 1 Recibo Único Grande e Limpo (Sem Informações Extras)
  const exportPDF_A4_Single = async (receipt: ReceiptRecord) => {
    const settings = await getSettings();
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as any;
    drawSingleViaLarge(doc, receipt, settings, signatureLayout);
    const safeNum = receipt.number.replace(/[\/\\]/g, '-');
    doc.save(`Recibo_ADGU_${safeNum}_A4_Grande.pdf`);
  };

  // 2) Export PDF A4 - 2 Vias (Padrão 2 Vias com Serrilhado de Corte)
  const exportPDF_A4_2Vias = async (receipt: ReceiptRecord) => {
    const settings = await getSettings();
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as any;
    const pageWidth = doc.internal.pageSize.getWidth();
    const startX = 12;
    const cardW = pageWidth - 24;
    const cardH = 135;

    // Via 1
    drawSingleVia(doc, receipt, startX, 7, cardW, cardH, '1ª Via - Igreja / Tesouraria', settings, signatureLayout);

    // Linha de Corte
    const lineY = 148.5;
    doc.setDrawColor(180, 190, 205);
    doc.setLineDashPattern([2, 2], 0);
    doc.setLineWidth(0.3);
    doc.line(8, lineY, pageWidth - 8, lineY);
    doc.setLineDashPattern([], 0);

    doc.setFont("helvetica", "italic");
    doc.setFontSize(6.5);
    doc.setTextColor(140, 155, 175);
    doc.text("- - - - - - - - - - - - - - - - - - - - -  ✂  Destaque / Corte Aqui  - - - - - - - - - - - - - - - - - - - - -", pageWidth / 2, lineY - 1, { align: 'center' });

    // Via 2
    drawSingleVia(doc, receipt, startX, 155, cardW, cardH, receipt.type === 'DESPESA' ? '2ª Via - Favorecido' : receipt.type === 'MEMBRO' ? '2ª Via - Membro / Dizimista' : '2ª Via - Arquivo Geral', settings, signatureLayout);

    const safeNum = receipt.number.replace(/[\/\\]/g, '-');
    doc.save(`Recibo_ADGU_${safeNum}_A4_2Vias.pdf`);
  };

  // 3) Export PDF A4 - Folha A4 Preenchida com 3 Recibos (Econômico / Multi)
  const exportPDF_A4_3Vias = async (receipt: ReceiptRecord) => {
    const settings = await getSettings();
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as any;
    const pageWidth = doc.internal.pageSize.getWidth();
    const startX = 12;
    const cardW = pageWidth - 24;
    const cardH = 88;

    const labels = [
      '1ª Via - Igreja / Tesouraria',
      receipt.type === 'DESPESA' ? '2ª Via - Favorecido' : receipt.type === 'MEMBRO' ? '2ª Via - Membro' : '2ª Via - Secretaria',
      '3ª Via - Arquivo Geral / Canhoto'
    ];

    const yOffsets = [7, 103, 199];
    const cutY = [99, 195];

    yOffsets.forEach((y, i) => {
      drawSingleViaCompact(doc, receipt, startX, y, cardW, cardH, labels[i], settings, signatureLayout);
    });

    cutY.forEach(y => {
      doc.setDrawColor(180, 190, 205);
      doc.setLineDashPattern([2, 2], 0);
      doc.setLineWidth(0.3);
      doc.line(8, y, pageWidth - 8, y);
      doc.setLineDashPattern([], 0);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(6);
      doc.setTextColor(140, 155, 175);
      doc.text("- - - - - - - - - - - - - - - - -  ✂  Corte Aqui  - - - - - - - - - - - - - - - -", pageWidth / 2, y - 1, { align: 'center' });
    });

    const safeNum = receipt.number.replace(/[\/\\]/g, '-');
    doc.save(`Recibo_ADGU_${safeNum}_A4_3Vias.pdf`);
  };

  // 4) Export PDF A4 - Vários Recibos Selecionados Preenchendo Folhas A4 (3 por folha)
  const exportPDF_A4_Multi = async (receiptList: ReceiptRecord[]) => {
    if (receiptList.length === 0) return;
    const settings = await getSettings();
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as any;
    const pageWidth = doc.internal.pageSize.getWidth();
    const startX = 12;
    const cardW = pageWidth - 24;
    const cardH = 88;
    const yOffsets = [7, 103, 199];
    const cutY = [99, 195];

    for (let i = 0; i < receiptList.length; i++) {
      const pageIndex = Math.floor(i / 3);
      const slotIndex = i % 3;

      if (slotIndex === 0 && pageIndex > 0) {
        doc.addPage();
      }

      const r = receiptList[i];
      const slotY = yOffsets[slotIndex];
      drawSingleViaCompact(doc, r, startX, slotY, cardW, cardH, 'Via Contábil Oficial', settings, signatureLayout);

      if (slotIndex < 2 && i + 1 < receiptList.length) {
        const cy = cutY[slotIndex];
        doc.setDrawColor(180, 190, 205);
        doc.setLineDashPattern([2, 2], 0);
        doc.setLineWidth(0.3);
        doc.line(8, cy, pageWidth - 8, cy);
        doc.setLineDashPattern([], 0);
        doc.setFont("helvetica", "italic");
        doc.setFontSize(6);
        doc.setTextColor(140, 155, 175);
        doc.text("- - - - - - - - - - - - - - - - -  ✂  Corte Aqui  - - - - - - - - - - - - - - - -", pageWidth / 2, cy - 1, { align: 'center' });
      }
    }

    doc.save(`Recibos_ADGU_Lote_${receiptList.length}_A4.pdf`);
  };

  // 5) Export PDF A5 (1 Via Paisagem)
  const exportPDF_A5 = async (receipt: ReceiptRecord) => {
    const settings = await getSettings();
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a5' }) as any;
    const pageWidth = doc.internal.pageSize.getWidth();
    const startX = 12;
    const cardW = pageWidth - 24;
    const cardH = 135;

    drawSingleVia(doc, receipt, startX, 6.5, cardW, cardH, 'Via Única Oficial', settings, signatureLayout);

    const safeNum = receipt.number.replace(/[\/\\]/g, '-');
    doc.save(`Recibo_ADGU_${safeNum}_A5.pdf`);
  };

  // ----------------------------------------------------
  // INTEGRAÇÃO WHATSAPP (MANDAR PARA WHATSAPP / COPIAR)
  // ----------------------------------------------------
  const buildWhatsAppText = (receipt: ReceiptRecord): string => {
    const formattedDate = new Date(receipt.date + 'T12:00:00').toLocaleDateString('pt-BR');
    
    let text = `🏛️ *ASSEMBLÉIA DE DEUS GERAÇÃO UNIDA*\n`;
    text += `📋 *${receipt.type === 'RECEITA' ? 'RECEITA DIÁRIA' : receipt.type === 'MEMBRO' ? 'RECIBO DE DIZIMISTA / MEMBRO' : 'RECIBO DE PAGAMENTO'}*\n`;
    text += `🔢 *Nº:* ${receipt.number}\n`;
    text += `📍 *Congregação:* ${receipt.institutionName}\n`;
    text += `📅 *Data:* ${formattedDate} (${receipt.city || 'Maracanaú - CE'})\n`;
    text += `💰 *Valor Total:* ${formatBRL(receipt.amount)}\n`;
    text += `📝 *Por Extenso:* ${valorPorExtenso(receipt.amount)}\n`;

    if (receipt.type === 'RECEITA') {
      text += `\n*Detalhamento de Entradas:*\n`;
      text += `• Dízimos: ${formatBRL(receipt.tithes || 0)}\n`;
      text += `• Ofertas: ${formatBRL(receipt.offerings || 0)}\n`;
      text += `• Especial: ${formatBRL(receipt.specialOfferings || 0)}\n`;
    } else {
      text += `👤 *${receipt.type === 'MEMBRO' ? 'Membro / Dizimista' : 'Favorecido'}:* ${receipt.personName}\n`;
      if (receipt.docNumber) text += `📄 *CPF/CNPJ:* ${receipt.docNumber}\n`;
      text += `📌 *Referente a:* ${receipt.description}\n`;
    }

    text += `\n✍️ *Tesouraria:* ${receipt.treasurerName} (${receipt.treasurerRole || 'Tesoureiro Geral'})\n`;
    text += `✍️ *Diretoria:* ${receipt.pastorName} (${receipt.pastorRole || 'Pastor Presidente / Dirigente'})\n`;
    text += `\n_ADGU - Gerando Vidas para o Reino!_`;

    return text;
  };

  const handleSendWhatsApp = (receipt: ReceiptRecord) => {
    const text = buildWhatsAppText(receipt);
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
    navigator.clipboard.writeText(text);
    setCopiedWhatsApp(true);
    setTimeout(() => setCopiedWhatsApp(false), 3000);
  };

  const handleCopyWhatsApp = (receipt?: ReceiptRecord) => {
    const current = receipt || viewingReceiptModal || getCurrentReceiptData();
    const text = buildWhatsAppText(current);
    navigator.clipboard.writeText(text);
    setCopiedWhatsApp(true);
    setTimeout(() => setCopiedWhatsApp(false), 3000);
  };

  // ----------------------------------------------------
  // IMPRESSÃO NATIVA DO NAVEGADOR
  // ----------------------------------------------------
  const handlePrint = (mode: 'SINGLE' | '2VIAS' | 'MULTI', target?: ReceiptRecord, multi?: ReceiptRecord[]) => {
    setPrintMode(mode);
    if (target) setSelectedReceiptForPreview(target);
    if (multi && multi.length > 0) setMultiPrintList(multi);
    else if (target) setMultiPrintList([target, target, target]);
    else setMultiPrintList([getCurrentReceiptData(), getCurrentReceiptData(), getCurrentReceiptData()]);

    setTimeout(() => {
      window.print();
    }, 150);
  };

  const filteredReceipts = receipts
    .filter(r => filterType === 'TODOS' || r.type === filterType)
    .filter(r => r.personName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                 r.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                 r.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                 r.institutionName.toLowerCase().includes(searchTerm.toLowerCase()));

  const activeReceipt = getCurrentReceiptData();
  const dateFormattedPreview = new Date(activeReceipt.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

  // Helper to render visual receipt card in print, modal, and live preview
  const renderCard = (
    rec: ReceiptRecord,
    viaLabel: string,
    size: 'LARGE' | 'NORMAL' | 'COMPACT' = 'LARGE'
  ) => {
    const formattedDate = new Date(rec.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    const isLarge = size === 'LARGE';
    const isCompact = size === 'COMPACT';

    return (
      <div className={`border-2 border-slate-300 rounded-2xl bg-white relative overflow-hidden ${isLarge ? 'p-6 sm:p-8 space-y-5 shadow-sm' : isCompact ? 'p-3 space-y-2' : 'p-4 sm:p-5 space-y-3.5'}`}>
        {/* Top Teal Stripe */}
        <div className={`bg-teal-700 ${isLarge ? 'h-2.5 -mx-8 -mt-8 mb-5' : isCompact ? 'h-1.5 -mx-4 -mt-4 mb-2' : 'h-2 -mx-6 -mt-6 mb-3'}`} />

        {/* Header */}
        <div className="flex justify-between items-start border-b border-slate-200 pb-3 gap-3">
          <div className="flex items-center gap-3">
            {churchSettings?.logo ? (
              <img src={churchSettings.logo} className={`object-contain rounded-lg shrink-0 ${isLarge ? 'w-14 h-14 sm:w-16 sm:h-16' : isCompact ? 'w-9 h-9' : 'w-12 h-12'}`} alt="Logo" />
            ) : (
              <div className={`bg-teal-700 text-white rounded-xl flex items-center justify-center font-black shrink-0 ${isLarge ? 'w-14 h-14 text-sm' : isCompact ? 'w-9 h-9 text-[10px]' : 'w-12 h-12 text-xs'}`}>
                ADGU
              </div>
            )}
            <div>
              <h3 className={`font-black text-slate-900 uppercase tracking-tight leading-tight ${isLarge ? 'text-base sm:text-lg' : isCompact ? 'text-xs' : 'text-sm'}`}>
                {churchSettings?.institutionName || 'Assembléia de Deus Geração Unida'}
              </h3>
              <p className={`text-slate-600 font-bold ${isLarge ? 'text-xs' : 'text-[10px]'}`}>
                CNPJ: {churchSettings?.cnpj || '49.386.673/0001-10'} | Ministério ADGU
              </p>
              <p className={`text-slate-500 ${isLarge ? 'text-xs' : 'text-[9px]'}`}>
                {churchSettings?.address || 'Rua 12 de Outubro, 779 - Parque Tijuca - Maracanaú - CE'}
              </p>
            </div>
          </div>

          <div className="text-right space-y-1.5 shrink-0">
            <div className={`bg-teal-50 border border-teal-200 rounded-lg text-right ${isLarge ? 'px-3.5 py-1.5' : 'px-2 py-1'}`}>
              <span className={`font-black text-teal-900 uppercase block ${isLarge ? 'text-xs' : 'text-[9px]'}`}>{rec.number}</span>
              <span className={`text-slate-500 font-bold block ${isLarge ? 'text-[10px]' : 'text-[8px]'}`}>{viaLabel.toUpperCase()}</span>
            </div>
            <div className={`bg-teal-700 text-white rounded-lg text-right ${isLarge ? 'px-4 py-2' : 'px-2.5 py-1'}`}>
              <span className={`font-bold uppercase block text-teal-200 ${isLarge ? 'text-[9px]' : 'text-[8px]'}`}>VALOR TOTAL</span>
              <span className={`font-black block leading-none ${isLarge ? 'text-xl sm:text-2xl text-white' : 'text-sm text-white'}`}>{formatBRL(rec.amount)}</span>
            </div>
          </div>
        </div>

        {/* Body */}
        {rec.type === 'RECEITA' ? (
          <div className={`space-y-3 ${isCompact ? 'space-y-1.5' : 'space-y-3'}`}>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className={`p-2.5 border border-slate-200 rounded-xl bg-slate-50/60 ${isLarge ? 'text-xs' : 'text-[10px]'}`}>
                <span className="text-[9px] font-black text-slate-400 block uppercase">Congregação</span>
                <span className="font-black text-slate-900">{rec.institutionName}</span>
              </div>
              <div className={`p-2.5 bg-teal-50 border border-teal-100 rounded-xl ${isLarge ? 'text-xs' : 'text-[10px]'}`}>
                <span className="text-[9px] font-black text-teal-700 block uppercase">Data do Culto / Local</span>
                <span className="font-black text-teal-950">{rec.city || 'Maracanaú - CE'}, {formattedDate}</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className={`border-2 border-emerald-100 bg-emerald-50/50 rounded-xl ${isLarge ? 'p-3' : isCompact ? 'p-1.5' : 'p-2'}`}>
                <span className={`font-black text-emerald-800 uppercase block ${isLarge ? 'text-[10px]' : 'text-[8px]'}`}>1. DÍZIMOS</span>
                <span className={`font-black text-slate-900 block ${isLarge ? 'text-xl sm:text-2xl mt-1' : isCompact ? 'text-xs' : 'text-sm'}`}>{formatBRL(rec.tithes || 0)}</span>
              </div>
              <div className={`border-2 border-teal-100 bg-teal-50/50 rounded-xl ${isLarge ? 'p-3' : isCompact ? 'p-1.5' : 'p-2'}`}>
                <span className={`font-black text-teal-800 uppercase block ${isLarge ? 'text-[10px]' : 'text-[8px]'}`}>2. OFERTAS</span>
                <span className={`font-black text-slate-900 block ${isLarge ? 'text-xl sm:text-2xl mt-1' : isCompact ? 'text-xs' : 'text-sm'}`}>{formatBRL(rec.offerings || 0)}</span>
              </div>
              <div className={`border-2 border-amber-100 bg-amber-50/50 rounded-xl ${isLarge ? 'p-3' : isCompact ? 'p-1.5' : 'p-2'}`}>
                <span className={`font-black text-amber-800 uppercase block ${isLarge ? 'text-[10px]' : 'text-[8px]'}`}>3. ESPECIAL</span>
                <span className={`font-black text-slate-900 block ${isLarge ? 'text-xl sm:text-2xl mt-1' : isCompact ? 'text-xs' : 'text-sm'}`}>{formatBRL(rec.specialOfferings || 0)}</span>
              </div>
            </div>

            <div className={`bg-gradient-to-r from-teal-50 via-teal-100/60 to-emerald-50 border border-teal-200 rounded-xl ${isLarge ? 'p-3.5 space-y-1' : 'p-2 space-y-0.5'}`}>
              <div className="flex justify-between items-center">
                <span className={`font-black text-teal-950 uppercase ${isLarge ? 'text-xs' : 'text-[9px]'}`}>VALOR TOTAL DA RECEITA DIÁRIA</span>
                <span className={`font-black text-teal-950 ${isLarge ? 'text-lg' : 'text-xs'}`}>{formatBRL(rec.amount)}</span>
              </div>
              <p className={`text-teal-900 font-bold italic leading-tight ${isLarge ? 'text-xs' : 'text-[9px]'}`}>
                ({valorPorExtenso(rec.amount)})
              </p>
            </div>

            {rec.description && (
              <div className={`p-2 border border-slate-100 rounded-lg text-slate-600 bg-slate-50/60 ${isLarge ? 'text-xs' : 'text-[9px]'}`}>
                <strong>Obs:</strong> {rec.description}
              </div>
            )}
          </div>
        ) : (
          <div className={`space-y-2.5 ${isCompact ? 'space-y-1' : 'space-y-2.5'}`}>
            <div className={`border border-slate-200 rounded-xl bg-white ${isLarge ? 'p-3' : 'p-2'}`}>
              <span className={`font-bold text-slate-400 block uppercase ${isLarge ? 'text-[10px]' : 'text-[8px]'}`}>
                {rec.type === 'MEMBRO' ? 'Recebemos do(a) irmão(ã)' : 'Paguei(amos) a'}
              </span>
              <span className={`font-black text-slate-900 block ${isLarge ? 'text-sm sm:text-base' : 'text-xs'}`}>
                {rec.personName} {rec.docNumber && `(CPF/CNPJ: ${rec.docNumber})`}
              </span>
            </div>

            <div className={`bg-teal-50/80 border border-teal-100 rounded-xl ${isLarge ? 'p-3' : 'p-2'}`}>
              <span className={`font-bold text-teal-700 block uppercase ${isLarge ? 'text-[10px]' : 'text-[8px]'}`}>a importância de</span>
              <span className={`font-black text-teal-950 block ${isLarge ? 'text-sm sm:text-base' : 'text-xs'}`}>
                {formatBRL(rec.amount)} ({valorPorExtenso(rec.amount)})
              </span>
            </div>

            <div className={`border border-slate-200 rounded-xl bg-white ${isLarge ? 'p-3' : 'p-2'}`}>
              <span className={`font-bold text-slate-400 block uppercase ${isLarge ? 'text-[10px]' : 'text-[8px]'}`}>referente a</span>
              <span className={`font-bold text-slate-800 block ${isLarge ? 'text-xs sm:text-sm' : 'text-[11px]'}`}>{rec.description}</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className={`border border-slate-200 rounded-xl bg-slate-50/50 ${isLarge ? 'p-2.5 text-xs' : 'p-1.5 text-[10px]'}`}>
                <span className="text-[8px] font-bold text-slate-400 uppercase block">Congregação</span>
                <span className="font-bold text-slate-800">{rec.institutionName}</span>
              </div>
              <div className={`bg-teal-50 rounded-xl border border-teal-100 ${isLarge ? 'p-2.5 text-xs' : 'p-1.5 text-[10px]'}`}>
                <span className="text-[8px] font-bold text-teal-700 uppercase block">Local e Data</span>
                <span className="font-bold text-teal-950">{rec.city || 'Maracanaú - CE'}, {formattedDate}</span>
              </div>
            </div>
          </div>
        )}

        {/* Signatures */}
        {signatureLayout === 'SINGLE_PASTOR' || signatureLayout === 'SINGLE_TREASURER' ? (
          <div className={`pt-2 max-w-md mx-auto text-center ${isCompact ? 'pt-1' : 'pt-2'}`}>
            <div className={`p-3 bg-white rounded-2xl border-2 border-slate-200 flex flex-col justify-between ${isLarge ? 'min-h-[160px]' : isCompact ? 'min-h-[80px]' : 'min-h-[120px]'}`}>
              <span className="text-[9px] font-black text-teal-800 uppercase tracking-wider block">
                {signatureLayout === 'SINGLE_TREASURER' ? 'TESOURARIA GERAL' : 'DIRETORIA / DIRIGENTE RESPONSÁVEL'}
              </span>
              <div className={`flex items-center justify-center ${isLarge ? 'h-24' : isCompact ? 'h-10' : 'h-16'}`}>
                {signatureLayout === 'SINGLE_TREASURER' && rec.treasurerSignature ? (
                  <img src={rec.treasurerSignature} className="max-h-full object-contain" alt="Assinatura Tesoureiro" />
                ) : null}
              </div>
              <div className="w-4/5 mx-auto border-b-2 border-slate-700 mb-1" />
              <span className={`font-black text-slate-900 uppercase block ${isLarge ? 'text-sm' : 'text-xs'}`}>
                {signatureLayout === 'SINGLE_TREASURER' ? rec.treasurerName : rec.pastorName}
              </span>
              <span className="text-[9px] text-slate-500 font-medium block">
                {signatureLayout === 'SINGLE_TREASURER' ? rec.treasurerRole : rec.pastorRole}
              </span>
            </div>
          </div>
        ) : (
          <div className={`grid grid-cols-2 gap-3 text-center ${isCompact ? 'pt-1 gap-2' : 'pt-2'}`}>
            <div className={`bg-white rounded-2xl border-2 border-slate-200 flex flex-col justify-between ${isLarge ? 'p-3.5 min-h-[160px]' : isCompact ? 'p-1.5 min-h-[80px]' : 'p-2.5 min-h-[120px]'}`}>
              <span className="text-[8px] font-black text-teal-800 uppercase tracking-wider block">TESOURARIA GERAL</span>
              <div className={`flex items-center justify-center ${isLarge ? 'h-24' : isCompact ? 'h-10' : 'h-16'}`}>
                {rec.treasurerSignature ? (
                  <img src={rec.treasurerSignature} className="max-h-full object-contain" alt="Assinatura Tesoureiro" />
                ) : null}
              </div>
              <div className="w-full border-b border-slate-500 mb-1" />
              <span className={`font-black text-slate-900 leading-tight block ${isLarge ? 'text-xs' : 'text-[10px]'}`}>{rec.treasurerName.toUpperCase()}</span>
              <span className="text-[8px] text-slate-500 font-medium block">{rec.treasurerRole}</span>
            </div>

            <div className={`bg-white rounded-2xl border-2 border-slate-200 flex flex-col justify-between ${isLarge ? 'p-3.5 min-h-[160px]' : isCompact ? 'p-1.5 min-h-[80px]' : 'p-2.5 min-h-[120px]'}`}>
              <span className="text-[8px] font-black text-teal-800 uppercase tracking-wider block">DIRETORIA / DIRIGENTE</span>
              <div className={`bg-white ${isLarge ? 'h-24' : isCompact ? 'h-10' : 'h-16'}`} />
              <div className="w-full border-b border-slate-500 mb-1" />
              <span className={`font-black text-slate-900 leading-tight block ${isLarge ? 'text-xs' : 'text-[10px]'}`}>{rec.pastorName.toUpperCase()}</span>
              <span className="text-[8px] text-slate-500 font-medium block">{rec.pastorRole}</span>
            </div>
          </div>
        )}

        <p className="text-center text-[9px] font-black text-teal-800 pt-1 tracking-wider uppercase">
          ADGU - Gerando Vidas para o Reino!
        </p>
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      
      {/* Printable Area Hook for Native Browser Print (@media print in index.css) */}
      <div id="printable-receipt-area" className="hidden print:block p-2 bg-white text-slate-900 font-sans">
        {printMode === 'SINGLE' && (
          <div>
            {renderCard(activeReceipt, 'VIA ÚNICA OFICIAL', 'LARGE')}
          </div>
        )}

        {printMode === '2VIAS' && (
          <div className="space-y-6">
            {renderCard(activeReceipt, '1ª VIA - IGREJA / TESOURARIA', 'NORMAL')}
            <div className="text-center text-xs text-slate-400 border-b border-dashed border-slate-400 py-1 select-none">
              - - - - - - - - - - - - - - - - - - - - ✂ Destaque / Corte Aqui - - - - - - - - - - - - - - - - - - - -
            </div>
            {renderCard(activeReceipt, activeReceipt.type === 'DESPESA' ? '2ª VIA - FAVORECIDO' : activeReceipt.type === 'MEMBRO' ? '2ª VIA - MEMBRO' : '2ª VIA - ARQUIVO', 'NORMAL')}
          </div>
        )}

        {printMode === 'MULTI' && (
          <div className="space-y-4">
            {multiPrintList.map((rec, index) => {
              const isPageBreak = index > 0 && index % 3 === 0;
              return (
                <React.Fragment key={`${rec.id}-${index}`}>
                  {isPageBreak && <div style={{ pageBreakAfter: 'always' }} />}
                  {renderCard(rec, `VIA CONTÁBIL #${index + 1}`, 'COMPACT')}
                  {index % 3 < 2 && index < multiPrintList.length - 1 && (
                    <div className="text-center text-[10px] text-slate-400 border-b border-dashed border-slate-400 py-0.5 select-none">
                      - - - - - - - - - - - - ✂ Corte Aqui - - - - - - - - - - - -
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        )}
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

      {/* Signature Management Logic */}
      {/* (To be implemented in SETTINGS tab) */}

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

      {/* TAB 1: EMITIR RECIBO - PREENCHIMENTO EM TELA COMPLETA */}
      {activeTab === 'CREATE' && (
        <div className="w-full">
          {/* Formulário de Preenchimento em Tela Completa */}
          <form onSubmit={handleGenerateAndSave} className="w-full bg-white p-6 sm:p-10 rounded-3xl border border-slate-200 shadow-sm space-y-6">
            {/* Header com Título e Ações Rápidas de Visualizar / Enviar / Imprimir */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div>
                <span className="text-[10px] font-black uppercase text-teal-800 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-200">
                  Padrão Eclesiástico Oficial
                </span>
                <h2 className="text-base sm:text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-2 mt-1">
                  <Receipt size={20} className="text-teal-600" /> 
                  {type === 'RECEITA' ? 'Preenchimento da Receita Diária' : type === 'MEMBRO' ? 'Recibo de Dízimo / Oferta para Membro' : 'Recibo de Despesa / Saída de Caixa'}
                </h2>
                <p className="text-xs text-slate-500">
                  Preencha os dados abaixo. O recibo oficial será exibido em tela completa apenas quando você for visualizar, imprimir ou enviar.
                </p>
              </div>

              {/* Botões de Ação no Topo */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setViewingReceiptModal(getCurrentReceiptData())}
                  className="px-3.5 py-2.5 bg-teal-50 hover:bg-teal-100 text-teal-950 border border-teal-300 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-xs"
                  title="Visualizar recibo completo no Olhinho com todas as opções de impressão"
                >
                  <Eye size={16} className="text-teal-700" />
                  <span>Ver no Olhinho</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSendWhatsApp(getCurrentReceiptData())}
                  className="px-3.5 py-2.5 bg-blue-50 hover:bg-[#2D7FF9] text-[#2D7FF9] hover:text-white border border-blue-200 hover:border-transparent rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-xs"
                  title="Enviar dados deste recibo diretamente pelo WhatsApp"
                >
                  <MessageCircle size={16} />
                  <span>WhatsApp</span>
                </button>

                <button
                  type="button"
                  onClick={() => handlePrint('SINGLE', getCurrentReceiptData())}
                  className="px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-sm"
                  title="Imprimir 1 Recibo Limpo na Folha A4"
                >
                  <Printer size={16} />
                  <span>Imprimir A4</span>
                </button>
              </div>
            </div>

            {/* Seletor de Tipo com 3 Opções Claras */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              <button
                type="button"
                onClick={() => setType('RECEITA')}
                className={`p-3.5 sm:p-4 rounded-2xl border-2 text-left transition-all ${type === 'RECEITA' ? 'border-teal-500 bg-teal-50/70 text-teal-950 shadow-sm ring-2 ring-teal-500/20' : 'border-slate-100 bg-slate-50/60 text-slate-600 hover:border-slate-200'}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-teal-950">Receita Diária</span>
                  <span className={`w-3.5 h-3.5 rounded-full ${type === 'RECEITA' ? 'bg-teal-600 ring-2 ring-teal-300' : 'bg-slate-300'}`} />
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">Dízimos e Ofertas do Culto</p>
              </button>

              <button
                type="button"
                onClick={() => setType('DESPESA')}
                className={`p-3.5 sm:p-4 rounded-2xl border-2 text-left transition-all ${type === 'DESPESA' ? 'border-rose-500 bg-rose-50/70 text-rose-950 shadow-sm ring-2 ring-rose-500/20' : 'border-slate-100 bg-slate-50/60 text-slate-600 hover:border-slate-200'}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-rose-950">Despesa</span>
                  <span className={`w-3.5 h-3.5 rounded-full ${type === 'DESPESA' ? 'bg-rose-600 ring-2 ring-rose-300' : 'bg-slate-300'}`} />
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">Pagamento a Prestador</p>
              </button>

              <button
                type="button"
                onClick={() => setType('MEMBRO')}
                className={`p-3.5 sm:p-4 rounded-2xl border-2 text-left transition-all ${type === 'MEMBRO' ? 'border-indigo-500 bg-indigo-50/70 text-indigo-950 shadow-sm ring-2 ring-indigo-500/20' : 'border-slate-100 bg-slate-50/60 text-slate-600 hover:border-slate-200'}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-indigo-950">Ao Membro</span>
                  <span className={`w-3.5 h-3.5 rounded-full ${type === 'MEMBRO' ? 'bg-indigo-600 ring-2 ring-indigo-300' : 'bg-slate-300'}`} />
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">Comprovante Dizimista</p>
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
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-900 text-xs font-bold focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1">Congregação*</label>
                <input
                  type="text"
                  value={institutionName}
                  onChange={(e) => setInstitutionName(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-900 text-xs font-bold focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                />
              </div>
            </div>

            {/* CAMPOS ESPECÍFICOS POR TIPO */}
            {type === 'RECEITA' ? (
              <div className="space-y-4 pt-1">
                <div className="p-4 sm:p-6 bg-gradient-to-br from-teal-50/90 to-emerald-50/40 rounded-2xl border-2 border-teal-200 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-teal-100 pb-2">
                    <span className="text-xs sm:text-sm font-black text-teal-950 uppercase tracking-wide flex items-center gap-1.5">
                      <TrendingUp size={18} className="text-teal-700" /> Discriminativo das Entradas
                    </span>
                    <span className="text-[9px] text-teal-800 font-extrabold bg-teal-200/80 px-2.5 py-0.5 rounded-full uppercase">
                      Soma Automática
                    </span>
                  </div>

                  {/* 3 Colunas de Entradas Espaçosas */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-white p-4 rounded-2xl border-2 border-emerald-200 shadow-sm">
                      <span className="text-[10px] font-black text-emerald-900 uppercase tracking-wider block mb-1">1. Dízimos</span>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-emerald-600 font-black text-xs">R$</span>
                        <input
                          type="text"
                          value={tithes}
                          onChange={(e) => setTithes(e.target.value)}
                          placeholder="0,00"
                          className="w-full pl-9 pr-2 py-2 rounded-xl border border-emerald-200 font-black text-slate-900 text-lg bg-emerald-50/20 focus:bg-white outline-none"
                        />
                      </div>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border-2 border-teal-200 shadow-sm">
                      <span className="text-[10px] font-black text-teal-900 uppercase tracking-wider block mb-1">2. Ofertas</span>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-teal-600 font-black text-xs">R$</span>
                        <input
                          type="text"
                          value={offerings}
                          onChange={(e) => setOfferings(e.target.value)}
                          placeholder="0,00"
                          className="w-full pl-9 pr-2 py-2 rounded-xl border border-teal-200 font-black text-slate-900 text-lg bg-teal-50/20 focus:bg-white outline-none"
                        />
                      </div>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border-2 border-amber-200 shadow-sm">
                      <span className="text-[10px] font-black text-amber-950 uppercase tracking-wider block mb-1">3. Especial</span>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-amber-600 font-black text-xs">R$</span>
                        <input
                          type="text"
                          value={specialOfferings}
                          onChange={(e) => setSpecialOfferings(e.target.value)}
                          placeholder="0,00"
                          className="w-full pl-9 pr-2 py-2 rounded-xl border border-amber-200 font-black text-slate-900 text-lg bg-amber-50/20 focus:bg-white outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Banner de Valor Total da Receita */}
                  <div className="p-4 bg-slate-900 text-white rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <div>
                      <span className="text-[10px] font-black text-teal-300 uppercase tracking-widest block">TOTAL APURADO</span>
                      <span className="text-xs text-slate-300 italic block">{extensoAtual}</span>
                    </div>
                    <span className="text-2xl sm:text-3xl font-black text-teal-300">{formatBRL(totalCalculated)}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1">Observações do Culto (Opcional)</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Ex: Culto de Domingo / Santa Ceia / Escola Bíblica"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-900 text-xs focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
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
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-900 text-xs font-bold focus:border-indigo-500 outline-none"
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
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-900 text-xs outline-none"
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
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-900 text-xs font-bold outline-none"
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
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-900 text-xs font-bold focus:border-rose-500 outline-none"
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
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-900 text-xs outline-none"
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
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-900 text-xs font-bold outline-none"
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

            {/* Ações de Geração e Envio: 4 Botões Claros */}
            <div className="pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <button
                type="button"
                onClick={() => setViewingReceiptModal(getCurrentReceiptData())}
                className="py-4 px-4 bg-teal-50 hover:bg-teal-100 text-teal-950 border-2 border-teal-300 font-black text-xs uppercase tracking-wider rounded-2xl transition-all flex items-center justify-center gap-2 shadow-xs"
                title="Abrir recibo oficial em tela cheia (Olhinho)"
              >
                <Eye size={18} className="text-teal-700" />
                <span>Ver no Olhinho</span>
              </button>

              <button
                type="button"
                onClick={() => handleSendWhatsApp(getCurrentReceiptData())}
                className="py-4 px-4 bg-[#2D7FF9] hover:bg-blue-600 text-white font-black text-xs uppercase tracking-wider rounded-2xl transition-all flex items-center justify-center gap-2 shadow-sm"
                title="Mandar recibo formatado pelo WhatsApp"
              >
                <MessageCircle size={18} />
                <span>Mandar no WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={() => handlePrint('SINGLE', getCurrentReceiptData())}
                className="py-4 px-4 bg-[#1d4ed8] hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider rounded-2xl transition-all flex items-center justify-center gap-2 shadow-sm"
                title="Imprimir 1 Recibo Limpo na Folha A4"
              >
                <Printer size={18} />
                <span>Imprimir A4</span>
              </button>

              <button
                type="submit"
                disabled={saving}
                className="py-4 px-4 bg-teal-700 hover:bg-teal-800 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-lg shadow-teal-700/25 transition-all flex items-center justify-center gap-2"
                title="Gravar no sistema e abrir para impressão/envio"
              >
                <Plus size={18} />
                <span>{saving ? 'Registrando...' : 'Salvar e Gerar Recibo'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: HISTÓRICO DE DOCUMENTOS */}
      {activeTab === 'HISTORY' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">Histórico de Documentos Emitidos</h2>
              <p className="text-xs text-slate-500">Consulte, visualize no olhinho, envie por WhatsApp ou imprima na folha A4</p>
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

          {/* BARRA DE AÇÕES EM LOTE QUANDO HOUVER SELEÇÃO */}
          {selectedHistoryIds.length > 0 && (
            <div className="bg-teal-900 text-white p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-xl bg-teal-500 text-slate-950 font-black flex items-center justify-center text-xs">
                  {selectedHistoryIds.length}
                </span>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider">
                    {selectedHistoryIds.length} {selectedHistoryIds.length === 1 ? 'Recibo Selecionado' : 'Recibos Selecionados'}
                  </h4>
                  <p className="text-[10px] text-teal-200">
                    Pronto para imprimir na folha A4 preenchida sem poluição de software (3 recibos por página)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    const selectedList = filteredReceipts.filter(r => selectedHistoryIds.includes(r.id));
                    handlePrint('MULTI', undefined, selectedList);
                  }}
                  className="px-3.5 py-2 bg-white text-teal-950 hover:bg-teal-50 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md"
                  title="Imprime todos os recibos selecionados agrupados na folha A4 (3 por página)"
                >
                  <Printer size={15} />
                  <span>Imprimir na A4 (3 por Folha)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const selectedList = filteredReceipts.filter(r => selectedHistoryIds.includes(r.id));
                    exportPDF_A4_Multi(selectedList);
                  }}
                  className="px-3 py-2 bg-teal-700 hover:bg-teal-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                  title="Baixa PDF A4 com todos os selecionados agrupados"
                >
                  <FileText size={15} />
                  <span>Baixar PDF A4 em Lote</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedHistoryIds([])}
                  className="px-3 py-2 bg-teal-950/60 hover:bg-teal-950 text-teal-200 rounded-xl text-xs font-bold transition-all"
                >
                  Desmarcar
                </button>
              </div>
            </div>
          )}

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
                    <th className="p-3 w-10 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedHistoryIds.length === filteredReceipts.length) {
                            setSelectedHistoryIds([]);
                          } else {
                            setSelectedHistoryIds(filteredReceipts.map(r => r.id));
                          }
                        }}
                        className="text-slate-600 hover:text-slate-900"
                        title={selectedHistoryIds.length === filteredReceipts.length ? 'Desmarcar todos' : 'Selecionar todos para impressão A4 em lote'}
                      >
                        {selectedHistoryIds.length === filteredReceipts.length && filteredReceipts.length > 0 ? (
                          <CheckSquare size={16} className="text-teal-700" />
                        ) : (
                          <Square size={16} />
                        )}
                      </button>
                    </th>
                    <th className="p-3">Nº Documento</th>
                    <th className="p-3">Data</th>
                    <th className="p-3">Tipo</th>
                    <th className="p-3">Congregação / Favorecido</th>
                    <th className="p-3">Detalhamento</th>
                    <th className="p-3 text-right">Valor Total</th>
                    <th className="p-3 text-center">Ações (Olhinho / Whats / A4)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredReceipts.map((r) => {
                    const isSelected = selectedHistoryIds.includes(r.id);
                    return (
                      <tr key={r.id} className={`hover:bg-slate-50/80 transition-colors ${isSelected ? 'bg-teal-50/40' : ''}`}>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedHistoryIds(prev =>
                                prev.includes(r.id) ? prev.filter(id => id !== r.id) : [...prev, r.id]
                              );
                            }}
                            className="text-slate-600 hover:text-slate-900"
                          >
                            {isSelected ? (
                              <CheckSquare size={16} className="text-teal-700" />
                            ) : (
                              <Square size={16} />
                            )}
                          </button>
                        </td>
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
                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            {/* Olhinho Button: Visualizar no Modal */}
                            <button
                              type="button"
                              onClick={() => setViewingReceiptModal(r)}
                              title="Visualizar no Olhinho (Tela Cheia com todas as opções de Impressão e WhatsApp)"
                              className="px-2.5 py-1.5 rounded-xl bg-teal-50 text-teal-800 hover:bg-teal-700 hover:text-white transition-all font-black text-[11px] flex items-center gap-1 shadow-xs"
                            >
                              <Eye size={15} />
                              <span className="hidden sm:inline">Ver</span>
                            </button>

                            {/* WhatsApp Button */}
                            <button
                              type="button"
                              onClick={() => handleSendWhatsApp(r)}
                              title="Enviar este recibo diretamente no WhatsApp"
                              className="p-1.5 rounded-xl bg-blue-50 text-[#2D7FF9] hover:bg-[#2D7FF9] hover:text-white transition-all shadow-xs"
                            >
                              <MessageCircle size={15} />
                            </button>

                            {/* Imprimir A4 Limpo */}
                            <button
                              type="button"
                              onClick={() => handlePrint('SINGLE', r)}
                              title="Imprimir 1 Recibo Limpo na Folha A4"
                              className="p-1.5 rounded-xl bg-slate-100 text-slate-700 hover:bg-[#1d4ed8] hover:text-white transition-all"
                            >
                              <Printer size={15} />
                            </button>

                            {/* Baixar PDF A4 */}
                            <button
                              type="button"
                              onClick={() => exportPDF_A4_Single(r)}
                              title="Baixar PDF A4 (1 Via Grande e Limpa)"
                              className="px-2 py-1.5 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors font-bold text-[10px]"
                            >
                              PDF A4
                            </button>

                            {/* Excluir */}
                            <button
                              type="button"
                              onClick={() => handleDelete(r.id)}
                              title="Excluir documento"
                              className="p-1.5 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
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

            {/* Signature Upload */}
            <div className="sm:col-span-2 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider block mb-3">Minha Assinatura Digital (Aparecerá nos recibos)</label>
              <div className="flex items-center gap-4">
                <div className="w-32 h-16 rounded-xl bg-white border border-slate-200 flex items-center justify-center overflow-hidden">
                  {currentUser?.signature ? (
                    <img src={currentUser.signature} className="max-h-full object-contain" alt="Assinatura" />
                  ) : (
                    <span className="text-[8px] text-slate-400">Sem assinatura</span>
                  )}
                </div>
                <label className="px-4 py-2 bg-teal-600 text-white rounded-xl text-[10px] font-black cursor-pointer hover:bg-teal-700 transition-all">
                  Upload Assinatura
                  <input type="file" className="hidden" accept="image/*" onChange={handleSignatureUpload} />
                </label>
              </div>
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

      {/* MODAL OFICIAL DO OLHINHO: VISUALIZAÇÃO AMPLIADA DO RECIBO, IMPRESSÃO A4 LIMPA E WHATSAPP */}
      {viewingReceiptModal && (
        <div className="fixed inset-0 z-[250] bg-slate-950/85 backdrop-blur-md overflow-y-auto p-2 sm:p-4 md:p-6 flex flex-col items-center animate-in fade-in duration-200">
          {/* Barra Superior Principal */}
          <div className="bg-slate-900 border border-slate-800 text-white w-full max-w-5xl rounded-3xl p-4 shadow-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-3 sticky top-2 z-30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-teal-500/20 text-teal-400 flex items-center justify-center font-black">
                <Eye size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-teal-400 uppercase tracking-widest">VISUALIZAÇÃO OFICIAL NO OLHINHO</span>
                  <span className="bg-teal-900/80 text-teal-300 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-teal-500/40">
                    {viewingReceiptModal.number}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <span>{viewingReceiptModal.personName}</span>
                  <span className="text-slate-400 font-normal">|</span>
                  <span className="text-teal-300 font-black">{formatBRL(viewingReceiptModal.amount)}</span>
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap w-full md:w-auto justify-end">
              {/* WhatsApp Button */}
              <button
                type="button"
                onClick={() => handleSendWhatsApp(viewingReceiptModal)}
                className="px-3.5 py-2 bg-[#2D7FF9] hover:bg-blue-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-md"
                title="Mandar este recibo diretamente para o WhatsApp do irmão ou tesoureiro"
              >
                <MessageCircle size={16} />
                <span>Enviar no WhatsApp</span>
              </button>

              {/* Copiar Texto */}
              <button
                type="button"
                onClick={() => handleCopyWhatsApp(viewingReceiptModal)}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border border-slate-700"
                title="Copiar texto detalhado do recibo para colar no WhatsApp ou e-mail"
              >
                {copiedWhatsApp ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                <span>{copiedWhatsApp ? 'Copiado!' : 'Copiar Texto'}</span>
              </button>

              {/* Botão de Impressão Direta A4 */}
              <button
                type="button"
                onClick={() => handlePrint('SINGLE', viewingReceiptModal)}
                className="px-4 py-2 bg-[#1d4ed8] hover:bg-blue-600 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-md uppercase tracking-wider"
                title="Imprime apenas o recibo em Folha A4 limpa sem barras ou cabeçalhos do site"
              >
                <Printer size={16} />
                <span>Imprimir A4</span>
              </button>

              {/* Fechar Modal */}
              <button
                type="button"
                onClick={() => setViewingReceiptModal(null)}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
                title="Fechar Visualização"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Barra Secundária: Modos de Impressão na A4 e Downloads de PDF */}
          <div className="w-full max-w-5xl bg-white border border-slate-200 rounded-2xl p-3 my-3 shadow-md flex flex-wrap items-center justify-between gap-3 text-xs sticky top-[76px] z-20">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-black text-slate-800 text-[10px] uppercase tracking-wider flex items-center gap-1 mr-1">
                <Printer size={14} className="text-teal-700" /> Formatos para Folha A4:
              </span>
              <button
                type="button"
                onClick={() => {
                  setModalMode('SINGLE');
                  handlePrint('SINGLE', viewingReceiptModal);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  modalMode === 'SINGLE'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
                title="Imprime 1 recibo em folha A4 limpa sem poluição de software"
              >
                1 Recibo Grande (A4 Limpa)
              </button>
              <button
                type="button"
                onClick={() => {
                  setModalMode('2VIAS');
                  handlePrint('2VIAS', viewingReceiptModal);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  modalMode === '2VIAS'
                    ? 'bg-teal-800 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
                title="Imprime 2 vias na mesma folha A4 separadas por linha de corte"
              >
                2 Vias em A4 (Com Picote)
              </button>
              <button
                type="button"
                onClick={() => {
                  setModalMode('MULTI');
                  handlePrint('MULTI', viewingReceiptModal);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  modalMode === 'MULTI'
                    ? 'bg-emerald-800 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
                title="Folha A4 preenchida com 3 vias/recibos para economia de papel"
              >
                3 por Folha A4 (Preenchida)
              </button>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-black text-slate-500 text-[10px] uppercase tracking-wider mr-1">
                Baixar PDF:
              </span>
              <button
                type="button"
                onClick={() => exportPDF_A4_Single(viewingReceiptModal)}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-bold text-[11px] transition-all"
                title="PDF com 1 recibo grande ocupando a folha A4"
              >
                PDF A4 (1 Via)
              </button>
              <button
                type="button"
                onClick={() => exportPDF_A4_2Vias(viewingReceiptModal)}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-bold text-[11px] transition-all"
                title="PDF com 2 vias na folha A4 com picote"
              >
                PDF A4 (2 Vias)
              </button>
              <button
                type="button"
                onClick={() => exportPDF_A4_3Vias(viewingReceiptModal)}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-bold text-[11px] transition-all"
                title="PDF com folha A4 preenchida com 3 vias"
              >
                PDF A4 (3 Vias)
              </button>
              <button
                type="button"
                onClick={() => exportPDF_A5(viewingReceiptModal)}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-bold text-[11px] transition-all"
                title="PDF formato A5 paisagem"
              >
                PDF A5
              </button>
            </div>
          </div>

          {/* CORPO DO RECIBO: SIMULAÇÃO REALISTA DA FOLHA A4 */}
          <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl p-4 sm:p-8 my-4 border border-slate-300">
            {modalMode === 'SINGLE' && (
              <div>
                <div className="mb-4 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">
                  Pré-visualização da Folha A4 Completa (1 Recibo Oficial Limpo)
                </div>
                {renderCard(viewingReceiptModal, 'VIA ÚNICA OFICIAL - IGREJA / TESOURARIA', 'LARGE')}
              </div>
            )}

            {modalMode === '2VIAS' && (
              <div className="space-y-6">
                <div className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">
                  Pré-visualização da Folha A4 com 2 Vias (Com Picote)
                </div>
                {renderCard(viewingReceiptModal, '1ª VIA - IGREJA / TESOURARIA', 'NORMAL')}
                <div className="text-center text-xs text-slate-400 border-b border-dashed border-slate-400 py-1 select-none">
                  - - - - - - - - - - - - - - - - - - - - ✂ Destaque / Corte Aqui - - - - - - - - - - - - - - - - - - - -
                </div>
                {renderCard(viewingReceiptModal, viewingReceiptModal.type === 'DESPESA' ? '2ª VIA - FAVORECIDO' : viewingReceiptModal.type === 'MEMBRO' ? '2ª VIA - MEMBRO' : '2ª VIA - ARQUIVO', 'NORMAL')}
              </div>
            )}

            {modalMode === 'MULTI' && (
              <div className="space-y-4">
                <div className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">
                  Pré-visualização da Folha A4 Preenchida com 3 Recibos (Econômico)
                </div>
                {renderCard(viewingReceiptModal, '1ª VIA - TESOURARIA', 'COMPACT')}
                <div className="text-center text-[10px] text-slate-400 border-b border-dashed border-slate-400 py-0.5 select-none">
                  - - - - - - - - - - - - - - - - - - - - ✂ Corte Aqui - - - - - - - - - - - - - - - - - - - -
                </div>
                {renderCard(viewingReceiptModal, '2ª VIA - DIRETORIA', 'COMPACT')}
                <div className="text-center text-[10px] text-slate-400 border-b border-dashed border-slate-400 py-0.5 select-none">
                  - - - - - - - - - - - - - - - - - - - - ✂ Corte Aqui - - - - - - - - - - - - - - - - - - - -
                </div>
                {renderCard(viewingReceiptModal, '3ª VIA - ARQUIVO CONTÁBIL', 'COMPACT')}
              </div>
            )}
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

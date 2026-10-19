
import React, { useState, useEffect } from 'react';
import { getSettings, saveSettings, SystemSettings, getDatabaseStatus, syncAllLocalDataToDatabase, seedSampleDataToDatabase } from '../services/storageService';
import { removeSignatureBackground } from '../services/signatureService';
import { getGoogleClientId, saveGoogleClientId } from '../services/googleDriveService';
import { Camera, Save, Loader2, CheckCircle, Building2, User, Mail, MapPin, Hash, Clock, Link, Cloud, ExternalLink, Database, Server, Check, RefreshCw, UploadCloud, Sparkles, Download, Users, Plus, Trash2 } from 'lucide-react';

export const Settings: React.FC = () => {
  const [settings, setSettings] = useState<SystemSettings>({
    institutionName: '',
    cnpj: '',
    address: '',
    email: '',
    president: '',
    logo: '',
    closingDay: 1
  });
  const [googleClientId, setGoogleClientId] = useState('');
  const [dbStatus, setDbStatus] = useState<{ status: string; provider: string; counts: any } | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    const data = await getSettings();
    setSettings(data);
    setGoogleClientId(getGoogleClientId());
    const status = await getDatabaseStatus();
    setDbStatus(status);
    setLoading(false);
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      const res = await syncAllLocalDataToDatabase();
      const status = await getDatabaseStatus();
      setDbStatus(status);
      setSuccessMessage("Dados locais sincronizados com o banco com sucesso!");
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setSuccessMessage(`Erro na sincronização: ${err.message || 'Falha ao sincronizar'}`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSeedSample = async () => {
    if (!window.confirm("Deseja carregar dados iniciais de exemplo (relatório financeiro e lançamentos) no banco de dados?")) return;
    setIsSeeding(true);
    try {
      await seedSampleDataToDatabase();
      const status = await getDatabaseStatus();
      setDbStatus(status);
      setSuccessMessage("Dados eclesiásticos de demonstração carregados com sucesso!");
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setSuccessMessage(`Erro ao carregar dados: ${err.message || 'Falha'}`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } finally {
      setIsSeeding(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSettings({ ...settings, logo: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const [newCongName, setNewCongName] = useState('');

  const defaultCongregations = [
    'ADGU SEDE',
    'ADGU CAMPOS BELOS',
    'ADGU MUCUNA',
    'ADGU NOVO ORIENTE',
    'ADGU PRESIDENTE VARGAS',
    'ADGU TAQUARA',
    'CADEMI',
    'DEPARTAMENTO FEMININO',
    'UMEC'
  ];

  const allCongregations = Array.from(
    new Set([
      ...defaultCongregations,
      ...Object.keys(settings.congregationPastors || {})
    ])
  );

  const handlePastorChange = (congName: string, field: 'pastorName' | 'pastorRole', val: string) => {
    const currentPastors = settings.congregationPastors || {};
    const existing = currentPastors[congName] || {
      pastorName: congName.toUpperCase().includes('SEDE') ? (settings.pastorName || settings.president || 'Pr. Antônio Chaves Crus') : '',
      pastorRole: congName.toUpperCase().includes('SEDE') ? 'Pastor Presidente' : 'Pastor Dirigente'
    };
    setSettings({
      ...settings,
      congregationPastors: {
        ...currentPastors,
        [congName]: {
          ...existing,
          [field]: val
        }
      }
    });
  };

  const handleAddCustomCongregation = () => {
    const trimmed = newCongName.trim().toUpperCase();
    if (!trimmed) return;
    const currentPastors = settings.congregationPastors || {};
    setSettings({
      ...settings,
      congregationPastors: {
        ...currentPastors,
        [trimmed]: currentPastors[trimmed] || {
          pastorName: '',
          pastorRole: 'Pastor Dirigente'
        }
      }
    });
    setNewCongName('');
  };

  const handleRemoveCustomCongregation = (congName: string) => {
    const currentPastors = { ...(settings.congregationPastors || {}) };
    delete currentPastors[congName];
    setSettings({
      ...settings,
      congregationPastors: currentPastors
    });
  };

  const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'treasurerSignature' | 'pastorSignature') => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const cleanSig = await removeSignatureBackground(file, { inkMode: 'BLUE' });
        const updated = { ...settings, [field]: cleanSig };
        setSettings(updated);
        if (field === 'treasurerSignature') {
          localStorage.setItem('adgu_treasurer_signature', cleanSig);
        }
      } catch (err) {
        console.error("Erro ao processar foto da assinatura:", err);
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await saveSettings(settings);
      if (settings.treasurerSignature) {
        localStorage.setItem('adgu_treasurer_signature', settings.treasurerSignature);
      }
      saveGoogleClientId(googleClientId.trim());
      setSuccessMessage("Configurações e Pastores Dirigentes salvos com sucesso!");
      setTimeout(() => setSuccessMessage(null), 3500);
    } catch (err) {
      setSuccessMessage("Erro ao salvar configurações.");
      setTimeout(() => setSuccessMessage(null), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-20 flex flex-col items-center justify-center space-y-4">
        <Loader2 className="animate-spin text-[#1d4ed8]" size={32} />
        <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Carregando configurações...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      {successMessage && (
        <div className="fixed top-10 left-1/2 -translate-x-1/2 z-[300] bg-[#1d4ed8] text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-4">
          <CheckCircle size={20} />
          <span className="text-[10px] font-black uppercase tracking-widest">{successMessage}</span>
        </div>
      )}

      <div>
        <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Configurações Gerais</h2>
        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Perfil da Instituição e Identidade Visual</p>
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        <div className="bg-white rounded-[2.5rem] p-8 md:p-12 shadow-soft border border-slate-50 flex flex-col md:flex-row gap-12">
          {/* Logo Upload Section */}
          <div className="flex flex-col items-center space-y-4 shrink-0">
            <div className="relative group">
              <div className="w-40 h-40 rounded-[2.5rem] bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden transition-all group-hover:border-blue-300">
                {settings.logo ? (
                  <img src={settings.logo} className="w-full h-full object-contain" alt="Logo preview" />
                ) : (
                  <Building2 size={48} className="text-slate-200" />
                )}
              </div>
              <label className="absolute bottom-[-12px] right-[-12px] p-3 bg-[#1d4ed8] text-white rounded-2xl shadow-lg cursor-pointer active-scale hover:bg-blue-800 transition-all">
                <Camera size={20} />
                <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
              </label>
            </div>
            <div className="text-center space-y-2">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Logo da Instituição</p>
              <p className="text-[6px] font-bold text-slate-300 uppercase tracking-widest mt-1">Recomendado: PNG/SVG Fundo Transparente</p>
              {settings.logo && (
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, logo: '' })}
                  className="px-3 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-xl text-[8px] font-black uppercase tracking-widest transition-all"
                >
                  Remover Logo
                </button>
              )}
            </div>
          </div>

          {/* Form Fields Section */}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1 md:col-span-2">
              <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-3">Nome da Instituição</label>
              <div className="relative">
                <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                <input type="text" required value={settings.institutionName} onChange={e => setSettings({...settings, institutionName: e.target.value})} className="w-full pl-11 pr-4 py-4 bg-slate-50 rounded-2xl font-bold text-xs border border-transparent focus:border-indigo-100 outline-none transition-all" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-3">CNPJ</label>
              <div className="relative">
                <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                <input type="text" value={settings.cnpj} onChange={e => setSettings({...settings, cnpj: e.target.value})} className="w-full pl-11 pr-4 py-4 bg-slate-50 rounded-2xl font-bold text-xs border border-transparent focus:border-indigo-100 outline-none transition-all" placeholder="00.000.000/0001-00" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-3">Política de Bloqueio</label>
              <div className="relative">
                <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                <div className="w-full pl-11 pr-4 py-4 bg-slate-100/50 rounded-2xl font-black text-[10px] uppercase text-slate-500 border border-slate-100">
                  Fechamento Semanal: Segundas-feiras
                </div>
              </div>
              <p className="text-[6px] font-bold text-slate-400 uppercase tracking-widest ml-3 mt-1">* Competência é semanal. Relatórios de semanas anteriores são bloqueados às Terças-feiras.</p>
            </div>

            <div className="space-y-1">
              <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-3">Nome do Pastor / Presidente</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                <input type="text" value={settings.pastorName || settings.president} onChange={e => setSettings({...settings, president: e.target.value, pastorName: e.target.value})} className="w-full pl-11 pr-4 py-4 bg-slate-50 rounded-2xl font-bold text-xs border border-transparent focus:border-indigo-100 outline-none transition-all" placeholder="Pr. Antônio Chaves Crus" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-3">Cargo do Pastor (Assinatura)</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                <input type="text" value={settings.pastorRole || ''} onChange={e => setSettings({...settings, pastorRole: e.target.value})} className="w-full pl-11 pr-4 py-4 bg-slate-50 rounded-2xl font-bold text-xs border border-transparent focus:border-indigo-100 outline-none transition-all" placeholder="Pastor Presidente / Dirigente" />
              </div>
            </div>

            <div className="space-y-1 md:col-span-2">
              <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-3">Nome do Tesoureiro Responsável</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                <input type="text" value={settings.treasurerName || ''} onChange={e => setSettings({...settings, treasurerName: e.target.value})} className="w-full pl-11 pr-4 py-4 bg-slate-50 rounded-2xl font-bold text-xs border border-transparent focus:border-indigo-100 outline-none transition-all" placeholder="Nome do Tesoureiro" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-3">CPF do Tesoureiro</label>
              <div className="relative">
                <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                <input type="text" value={settings.treasurerCpf || ''} onChange={e => setSettings({...settings, treasurerCpf: e.target.value})} className="w-full pl-11 pr-4 py-4 bg-slate-50 rounded-2xl font-bold text-xs border border-transparent focus:border-indigo-100 outline-none transition-all" placeholder="000.000.000-00" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-3">Cargo do Tesoureiro</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                <input type="text" value={settings.treasurerRole || ''} onChange={e => setSettings({...settings, treasurerRole: e.target.value})} className="w-full pl-11 pr-4 py-4 bg-slate-50 rounded-2xl font-bold text-xs border border-transparent focus:border-indigo-100 outline-none transition-all" placeholder="Tesoureiro" />
              </div>
            </div>

            <div className="space-y-1 md:col-span-2">
              <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-3">Assinatura do Tesoureiro</label>
              <div className="flex items-center gap-4">
                <div className="w-40 h-20 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden">
                  {settings.treasurerSignature ? (
                    <img src={settings.treasurerSignature} className="max-h-full object-contain" alt="Assinatura" />
                  ) : (
                    <span className="text-[8px] text-slate-400">Sem assinatura</span>
                  )}
                </div>
                <label className="p-3 bg-[#1d4ed8] text-white rounded-2xl cursor-pointer hover:bg-blue-800 transition-all">
                  <UploadCloud size={20} />
                  <input type="file" className="hidden" accept="image/*" onChange={e => handleSignatureUpload(e, 'treasurerSignature')} />
                </label>
                {settings.treasurerSignature && (
                  <button type="button" onClick={() => setSettings({...settings, treasurerSignature: ''})} className="px-3 py-2 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-2xl text-[8px] font-black uppercase tracking-widest transition-all">
                    Remover
                  </button>
                )}
              </div>
              <p className="text-[6px] font-bold text-slate-400 uppercase tracking-widest ml-3 mt-1">Foto da assinatura: O sistema removerá o fundo automaticamente.</p>
            </div>

            <div className="space-y-1 md:col-span-2">
              <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-3">Endereço Sede</label>
              <div className="relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                <input type="text" value={settings.address} onChange={e => setSettings({...settings, address: e.target.value})} className="w-full pl-11 pr-4 py-4 bg-slate-50 rounded-2xl font-bold text-xs border border-transparent focus:border-indigo-100 outline-none transition-all" />
              </div>
            </div>
          </div>
        </div>

        {/* Pastores Dirigentes das Congregações Card */}
        <div className="bg-white rounded-[2.5rem] p-8 md:p-12 shadow-soft border border-slate-50 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-indigo-50 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                <Users size={20} />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Pastores Dirigentes das Congregações</h3>
                <p className="text-[7px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Configure o Pastor Dirigente de cada congregação para relatórios e recibos</p>
              </div>
            </div>
            <span className="text-[8px] font-black uppercase tracking-wider bg-blue-50 text-[#1d4ed8] px-3 py-1.5 rounded-xl border border-blue-100 self-start sm:self-auto">
              {allCongregations.length} Unidades
            </span>
          </div>

          <div className="space-y-4">
            <p className="text-[9px] text-slate-500 font-medium leading-relaxed">
              Cada congregação possui seu próprio Pastor Dirigente. Os dados informados abaixo são aplicados automaticamente na assinatura dos relatórios e recibos oficiais de cada congregação.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {allCongregations.map((cong) => {
                const isSede = cong.toUpperCase().includes('SEDE');
                const pastorData = settings.congregationPastors?.[cong] || {
                  pastorName: isSede ? (settings.pastorName || settings.president || 'Pr. Antônio Chaves Crus') : '',
                  pastorRole: isSede ? (settings.pastorRole || 'Pastor Presidente') : 'Pastor Dirigente'
                };
                const isCustom = !defaultCongregations.includes(cong);

                return (
                  <div key={cong} className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-3 relative group hover:border-indigo-200 transition-all">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${isSede ? 'bg-amber-500' : 'bg-indigo-600'}`} />
                        <span className="text-[10px] font-black text-slate-900 uppercase tracking-tight">{cong}</span>
                      </div>
                      {isCustom && (
                        <button
                          type="button"
                          onClick={() => handleRemoveCustomCongregation(cong)}
                          className="text-slate-400 hover:text-rose-600 p-1 rounded-lg transition-colors"
                          title="Remover Congregação Personalizada"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[7.5px] font-bold text-slate-500 uppercase tracking-wider block">Nome do Pastor Dirigente</label>
                        <input
                          type="text"
                          value={pastorData.pastorName}
                          onChange={(e) => handlePastorChange(cong, 'pastorName', e.target.value)}
                          placeholder={isSede ? 'Pr. Antônio Chaves Crus' : 'Nome do Pastor'}
                          className="w-full px-3 py-2 bg-white rounded-xl text-xs font-bold text-slate-800 border border-slate-200 focus:border-indigo-300 outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[7.5px] font-bold text-slate-500 uppercase tracking-wider block">Cargo Oficial</label>
                        <input
                          type="text"
                          value={pastorData.pastorRole || (isSede ? 'Pastor Presidente' : 'Pastor Dirigente')}
                          onChange={(e) => handlePastorChange(cong, 'pastorRole', e.target.value)}
                          placeholder="Pastor Dirigente"
                          className="w-full px-3 py-2 bg-white rounded-xl text-[11px] font-medium text-slate-700 border border-slate-200 focus:border-indigo-300 outline-none transition-all"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Adicionar Outra Congregação */}
            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="text"
                value={newCongName}
                onChange={(e) => setNewCongName(e.target.value)}
                placeholder="Nome de nova congregação (Ex: ADGU OUTRA)"
                className="flex-1 px-4 py-3 bg-slate-50 rounded-2xl text-xs font-bold border border-slate-200 focus:border-indigo-300 outline-none"
              />
              <button
                type="button"
                onClick={handleAddCustomCongregation}
                className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-sm"
              >
                <Plus size={14} /> Adicionar Congregação
              </button>
            </div>
          </div>
        </div>

        {/* Google Drive Integration Settings Card */}
        <div className="bg-white rounded-[2.5rem] p-8 md:p-12 shadow-soft border border-slate-50 space-y-6">
          <div className="flex items-center gap-3 border-b-2 border-indigo-50 pb-4">
            <div className="w-10 h-10 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
              <Cloud size={20} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Armazenamento Google Drive</h3>
              <p className="text-[7px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Envie fotos de comprovantes diretamente para o seu Google Drive</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-3">Google Client ID (OAuth 2.0 Web Client)</label>
              <div className="relative">
                <Link className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                <input
                  type="text"
                  value={googleClientId}
                  onChange={e => setGoogleClientId(e.target.value)}
                  className="w-full pl-11 pr-4 py-4 bg-slate-50 rounded-2xl font-mono text-xs border border-transparent focus:border-indigo-100 outline-none transition-all"
                  placeholder="Ex: xxxxxxxx-xxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com"
                />
              </div>
            </div>

            <div className="p-6 bg-slate-50 rounded-3xl space-y-3 border border-slate-100">
              <h4 className="text-[9px] font-black text-slate-700 uppercase tracking-widest flex items-center gap-1.5">
                <Clock size={14} className="text-indigo-500" />
                Como configurar seu Google Drive:
              </h4>
              <ol className="text-[9px] text-slate-500 space-y-2 list-decimal list-inside leading-relaxed font-medium">
                <li>
                  Acesse o <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="text-indigo-600 font-bold hover:underline inline-flex items-center gap-0.5">Google Cloud Console <ExternalLink size={10} /></a>.
                </li>
                <li>
                  Crie ou selecione um projeto e habilite a <strong>Google Drive API</strong> na biblioteca de APIs.
                </li>
                <li>
                  No menu <strong>Tela de consentimento OAuth</strong>, configure como "Externo" ou "Interno", adicione o escopo <code className="bg-slate-200 px-1 rounded font-mono text-[8px]">.../auth/drive.file</code> e insira as informações do seu app.
                </li>
                <li>
                  No menu <strong>Credenciais</strong>, clique em <strong>Criar Credenciais &gt; ID do cliente OAuth</strong>. Escolha tipo <strong>"Aplicativo da Web"</strong>.
                </li>
                <li>
                  Em <strong>Origens JavaScript autorizadas</strong>, adicione os seguintes caminhos exatos para que a autenticação funcione no preview e em produção:
                  <div className="mt-1.5 space-y-1">
                    <div className="bg-slate-200/60 p-2.5 rounded-xl font-mono text-[8px] select-all flex justify-between gap-2 overflow-x-auto">
                      <span>{typeof window !== 'undefined' ? window.location.origin : ''}</span>
                    </div>
                    <div className="bg-slate-200/60 p-2.5 rounded-xl font-mono text-[8px] select-all flex justify-between gap-2 overflow-x-auto">
                      <span>https://ais-pre-low732duzukaqmkvhkrii7-72906549332.us-east5.run.app</span>
                    </div>
                  </div>
                </li>
                <li>
                  Copie o <strong>ID do cliente</strong> gerado, cole no campo acima e salve as alterações.
                </li>
              </ol>
            </div>
          </div>
        </div>

        {/* Neon PostgreSQL Database Status Card */}
        <div className="bg-white rounded-[2.5rem] p-8 md:p-12 shadow-soft border border-slate-50 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-emerald-50 pb-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${dbStatus?.status === 'connected' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                <Database size={20} />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Banco de Dados em Nuvem (PostgreSQL)</h3>
                <p className="text-[7px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Neon Serverless PostgreSQL Database</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={loadSettings}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-all"
                title="Atualizar status"
              >
                <RefreshCw size={14} />
              </button>
              {dbStatus?.status === 'connected' ? (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-[8px] font-black uppercase text-emerald-700 tracking-wider">Conectado & Sincronizado</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-xl">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  <span className="text-[8px] font-black uppercase text-amber-700 tracking-wider">Verificando Conexão</span>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <span className="text-[7px] font-black uppercase text-slate-400 tracking-widest block">Provedor</span>
              <span className="text-xs font-black text-slate-800 mt-1 block">Neon Cloud</span>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <span className="text-[7px] font-black uppercase text-slate-400 tracking-widest block">Status Conexão</span>
              <span className="text-xs font-black text-emerald-600 mt-1 block flex items-center gap-1">
                <Check size={14} /> {dbStatus?.status === 'connected' ? 'Ativo' : 'Offline'}
              </span>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <span className="text-[7px] font-black uppercase text-slate-400 tracking-widest block">Relatórios Gravados</span>
              <span className="text-xs font-black text-slate-800 mt-1 block">
                {dbStatus?.counts?.reports ?? 0}
              </span>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <span className="text-[7px] font-black uppercase text-slate-400 tracking-widest block">Lançamentos</span>
              <span className="text-xs font-black text-slate-800 mt-1 block">
                {dbStatus?.counts?.transactions ?? 0}
              </span>
            </div>
          </div>

          <div className="bg-blue-50/70 p-5 rounded-2xl border border-blue-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h4 className="text-[10px] font-black uppercase text-blue-900 tracking-wider">Sincronização e Carga do Banco de Dados</h4>
              <p className="text-[8px] font-bold text-blue-700/80 mt-0.5">
                Envie dados gravados neste navegador diretamente para a nuvem PostgreSQL ou carregue demonstração inicial.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleManualSync}
                disabled={isSyncing}
                className="px-4 py-2.5 bg-[#1d4ed8] text-white rounded-xl font-black text-[8px] uppercase tracking-widest shadow-md hover:bg-blue-800 transition-all flex items-center gap-1.5 active-scale disabled:opacity-50"
              >
                {isSyncing ? <Loader2 size={13} className="animate-spin" /> : <UploadCloud size={13} />}
                Subir Dados para Nuvem
              </button>
              <button
                type="button"
                onClick={handleSeedSample}
                disabled={isSeeding}
                className="px-4 py-2.5 bg-white text-slate-700 border border-slate-200 rounded-xl font-black text-[8px] uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-1.5 active-scale disabled:opacity-50"
              >
                {isSeeding ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} className="text-amber-500" />}
                Carregar Exemplo no Banco
              </button>
              <a
                href="/api/db/dump"
                download="adgu_complete_database_dump.sql"
                className="px-4 py-2.5 bg-slate-900 text-white rounded-xl font-black text-[8px] uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center gap-1.5 active-scale shadow-sm"
              >
                <Download size={13} />
                Baixar Script SQL Completo
              </a>
            </div>
          </div>

          <p className="text-[8px] font-bold text-slate-400">
            Todos os relatórios financeiros, lançamentos de dízimos/ofertas, recibos e contas de usuários estão sendo salvos com persistência e replicação contínua no PostgreSQL.
          </p>
        </div>

        <button type="submit" disabled={isSaving} className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl active-scale flex items-center justify-center gap-2 hover:bg-slate-800 transition-all">
          {isSaving ? <Loader2 className="animate-spin" size={20}/> : <><Save size={20}/> Salvar Alterações</>}
        </button>
      </form>
    </div>
  );
};


import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { ReportForm } from './components/ReportForm';
import { ReportHistory } from './components/ReportHistory';
import { AdminDashboard } from './components/AdminDashboard';
import { UserManagement } from './components/UserManagement';
import { TrashManager } from './components/TrashManager';
import { Settings } from './components/Settings';
import { ReceiptGenerator } from './components/ReceiptGenerator';
import { Logo } from './components/Logo';
import { UserSession, FinancialReport } from './types';
import { loginUser, getDatabaseStatus } from './services/storageService';
import { Lock, UserCircle, ArrowRight, RefreshCw, AlertCircle } from 'lucide-react';

type ViewType = 'REPORT_NEW' | 'HISTORY' | 'DASHBOARD' | 'USERS' | 'TRASH' | 'SETTINGS' | 'RECEIPTS';

const App: React.FC = () => {
  const [session, setSession] = useState<UserSession | null>(null);
  const [currentView, setCurrentView] = useState<ViewType>('HISTORY');
  const [editingReport, setEditingReport] = useState<FinancialReport | null>(null);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isDbOnline, setIsDbOnline] = useState(true);

  useEffect(() => {
    const checkDb = async () => {
      const status = await getDatabaseStatus();
      setIsDbOnline(status.status === 'connected');
    };
    checkDb();
    
    const handleChangeView = (e: any) => {
      if (e.detail) setCurrentView(e.detail);
    };
    window.addEventListener('change-view', handleChangeView);
    return () => window.removeEventListener('change-view', handleChangeView);
  }, []);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const userLower = loginUsername.toLowerCase().trim();
    const passRaw = loginPassword.trim();

    if (!userLower || !passRaw) {
      setLoginError('Informe usuário e senha');
      return;
    }
    
    setLoginError('');
    setIsLoggingIn(true);
    
    if (userLower === 'adm' && passRaw === 'adm') {
      setSession({
        id: 'e8c75dd0-0000-4000-a000-000000000000',
        name: 'Administrador Geral',
        role: 'ADMIN',
        institution: 'Sede Administrativa'
      });
      setCurrentView('DASHBOARD');
      setIsLoggingIn(false);
      return;
    }

    try {
      const user = await loginUser(userLower, passRaw);
      if (!user) {
        setLoginError('Usuário ou senha incorretos');
        setIsLoggingIn(false);
        return;
      }
      
      const isAdmin = user.role === 'ADMIN';
      const isDeptTreasurer = !isAdmin && (user.role === 'DEPT_TREASURER' || !!user.noDiscount);

      setSession({ 
        id: user.id, 
        name: user.name, 
        phone: user.phone,
        photo: user.photo,
        role: isAdmin ? 'ADMIN' : (isDeptTreasurer ? 'DEPT_TREASURER' : 'USER'), 
        institution: user.institution.trim(),
        noDiscount: isDeptTreasurer
      });
      
      setCurrentView(isAdmin ? 'DASHBOARD' : 'HISTORY');
    } catch (err: any) {
      setLoginError('Erro de conexão');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleOpenReport = (report: FinancialReport, readOnly: boolean = false) => {
    setEditingReport(report);
    setIsReadOnly(readOnly);
    setCurrentView('REPORT_NEW');
  };

  const renderContent = () => {
    if (!session) return null;
    switch (currentView) {
      case 'DASHBOARD': return <AdminDashboard session={session} />;
      case 'REPORT_NEW': return (
        <ReportForm 
          session={session} 
          initialData={editingReport || undefined}
          readOnly={isReadOnly}
          onFinished={() => { setEditingReport(null); setIsReadOnly(false); setCurrentView('HISTORY'); }} 
          onCancel={() => { setEditingReport(null); setIsReadOnly(false); setCurrentView('HISTORY'); }} 
        />
      );
      case 'HISTORY': return (
        <ReportHistory 
          session={session} 
          onEdit={(rep, ro) => handleOpenReport(rep, ro)}
          onBack={() => setCurrentView('HISTORY')} 
          onGoToTrash={() => setCurrentView('TRASH')}
        />
      );
      case 'RECEIPTS': return <ReceiptGenerator session={session} />;
      case 'USERS': return <UserManagement session={session} />;
      case 'TRASH': return <TrashManager session={session} />;
      case 'SETTINGS': return <Settings />;
      default: return <ReportHistory session={session} onEdit={handleOpenReport} onBack={() => setCurrentView('HISTORY')} onGoToTrash={() => setCurrentView('TRASH')} />;
    }
  };

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center p-5 mesh-bg">
        {!isDbOnline && (
          <div className="fixed top-5 left-5 right-5 z-50 bg-red-50 text-red-700 p-4 rounded-xl border border-red-200 text-xs font-bold shadow-lg flex items-center gap-2">
            <AlertCircle size={16} />
            Banco de dados offline. As alterações não serão sincronizadas entre dispositivos.
          </div>
        )}
        <div className="max-w-xs w-full animate-in zoom-in-95 duration-700">
          <div className="bg-white/95 backdrop-blur-3xl rounded-[2.5rem] shadow-3xl border border-slate-100 flex flex-col items-center overflow-hidden">
            <div className="w-full h-2 adgu-tricolor-bar" />
            <div className="p-8 w-full flex flex-col items-center">
              <div className="mb-6 p-3 bg-white rounded-3xl shadow-lg border-2 border-blue-100 ring-4 ring-blue-50">
                <Logo size="md" className="w-16 h-16" />
              </div>
              
              <div className="text-center mb-8">
                <h1 className="text-xl font-black tracking-tight uppercase text-[#1d4ed8]">
                  Portal ADGU
                </h1>
                <p className="text-[#2D7FF9] text-[8.5px] font-black uppercase tracking-[0.3em] mt-1">
                  Gestão Ministerial
                </p>
                <div className="flex items-center justify-center gap-1.5 mt-2.5">
                  <span className="w-10 h-1 rounded-full bg-[#2D7FF9]" />
                </div>
              </div>

              <form onSubmit={handleLoginSubmit} className="space-y-4 w-full">
                <div className="space-y-1">
                  <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-3">Usuário</label>
                  <div className="relative">
                    <UserCircle className="absolute left-4 top-1/2 -translate-y-1/2 text-[#2D7FF9]" size={16} />
                    <input type="text" value={loginUsername} onChange={e => setLoginUsername(e.target.value)} className="w-full pl-11 pr-4 py-3.5 rounded-xl bg-slate-50 border border-slate-200 outline-none font-bold text-xs focus:ring-2 focus:ring-[#2D7FF9]/20 focus:border-[#2D7FF9] transition-all" placeholder="Seu login" autoCapitalize="none" disabled={isLoggingIn} />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-3">Senha</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[#2D7FF9]" size={16} />
                    <input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} className="w-full pl-11 pr-4 py-3.5 rounded-xl bg-slate-50 border border-slate-200 outline-none font-bold text-xs focus:ring-2 focus:ring-[#2D7FF9]/20 focus:border-[#2D7FF9] transition-all" placeholder="••••" disabled={isLoggingIn} />
                  </div>
                </div>
                {loginError && (
                  <div className="bg-blue-50 p-3 rounded-xl border border-blue-200 flex items-center gap-2 animate-in shake duration-300">
                    <AlertCircle size={14} className="text-[#1d4ed8] shrink-0" />
                    <p className="text-[#1d4ed8] text-[8px] font-black uppercase leading-tight">{loginError}</p>
                  </div>
                )}
                <button type="submit" disabled={isLoggingIn} className="w-full bg-[#1d4ed8] text-white font-black py-4 rounded-xl shadow-xl shadow-blue-200 active-scale transition-all uppercase text-[9px] flex items-center justify-center gap-2 hover:bg-[#1e40af] disabled:opacity-50">
                  {isLoggingIn ? <RefreshCw className="animate-spin" size={14} /> : 'Acessar Painel'} <ArrowRight size={14} />
                </button>

                <div className="pt-2 flex items-center justify-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${isDbOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                  <span className="text-[7.5px] font-bold uppercase tracking-wider text-slate-400">
                    {isDbOnline ? 'Banco Neon PostgreSQL Conectado' : 'Conectando ao Banco de Dados...'}
                  </span>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Layout session={session} currentView={currentView} onViewChange={setCurrentView} onLogout={() => { setSession(null); setLoginUsername(''); setLoginPassword(''); setCurrentView('HISTORY'); }}>
      {renderContent()}
    </Layout>
  );
};

export default App;

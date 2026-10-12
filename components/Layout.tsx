
import React, { useState, useEffect } from 'react';
import { UserSession } from '../types';
import { Logo } from './Logo';
import { LogOut, Receipt, FileText, FilePlus, Users, BarChart3, Settings as SettingsIcon, Menu, ChevronRight, Trash2 } from 'lucide-react';
import { getReports, getDatabaseStatus } from '../services/storageService';
import { validateFinancialReport } from '../services/reportValidator';

interface LayoutProps {
  children: React.ReactNode;
  session: UserSession;
  currentView: string;
  onViewChange: (view: any) => void;
  onLogout: () => void;
}

const navItems = [
  { id: 'HISTORY', label: 'Relatório', icon: FileText, adminOnly: false },
  { id: 'REPORT_NEW', label: 'Novo Relatório', icon: FilePlus, adminOnly: false },
  { id: 'RECEIPTS', label: 'Recebido', icon: Receipt, adminOnly: false },
  { id: 'DASHBOARD', label: 'Painel Geral', icon: BarChart3, adminOnly: true },
  { id: 'USERS', label: 'Equipe', icon: Users, adminOnly: true },
  { id: 'TRASH', label: 'Lixeira', icon: Trash2, adminOnly: true },
  { id: 'SETTINGS', label: 'Ajustes', icon: SettingsIcon, adminOnly: true },
];

export const Layout: React.FC<LayoutProps> = ({ children, session, currentView, onViewChange, onLogout }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [isDbConnected, setIsDbConnected] = useState(true);
  const filteredNav = navItems.filter(item => !item.adminOnly || session.role === 'ADMIN');

  useEffect(() => {
    const checkDb = async () => {
      const status = await getDatabaseStatus();
      setIsDbConnected(status.status === 'connected');
    };
    checkDb();
    const interval = setInterval(checkDb, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const updatePendingCount = async () => {
      try {
        const allReports = await getReports();
        // filter by institution unless ADMIN, and count active pending ones
        const userReports = allReports.filter(r => 
          (session.role === 'ADMIN' || r.institutionName.toLowerCase() === session.institution.toLowerCase())
        );
        
        const count = userReports.filter(r => validateFinancialReport(r).isPending).length;
        setPendingCount(count);
      } catch (err) {
        console.error("Erro ao calcular relatórios pendentes:", err);
      }
    };

    updatePendingCount();
    window.addEventListener('reports-updated', updatePendingCount);
    return () => window.removeEventListener('reports-updated', updatePendingCount);
  }, [session]);

  return (
    <div className="h-screen w-full flex overflow-hidden bg-[#f8fafc] print:h-auto print:overflow-visible print:block print:bg-white">
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] lg:hidden animate-in fade-in duration-300 print:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      <aside className={`fixed inset-y-0 left-0 z-[70] w-72 bg-white border-r border-slate-200/80 flex flex-col transition-transform duration-500 ease-out lg:relative lg:translate-x-0 print:hidden ${isSidebarOpen ? 'translate-x-0 shadow-3xl' : '-translate-x-full'}`}>
        <div className="w-full h-1.5 adgu-tricolor-bar shrink-0" />
        <div className="p-6 flex-1 flex flex-col min-h-0">
          <div className="flex items-center gap-3.5 mb-10 px-2 pb-5 border-b border-slate-100">
            <div className="p-1.5 bg-white rounded-2xl border-2 border-[#2D7FF9]/30 shadow-md shrink-0">
              <Logo size="sm" className="w-10 h-10" />
            </div>
            <div>
              <h1 className="text-sm font-black tracking-tight uppercase text-[#1d4ed8]">
                ADGU FINANÇAS
              </h1>
              <p className="text-[7.5px] font-black text-[#2D7FF9] uppercase tracking-widest leading-none mt-1">
                Gestão Ministerial
              </p>
              <div className="flex items-center gap-1 mt-2">
                <span className="w-8 h-1 rounded-full bg-[#2D7FF9]" />
              </div>
            </div>
          </div>

          <nav className="flex-1 space-y-2 overflow-y-auto custom-scrollbar pr-1">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 px-4">Menu Principal</p>
            {filteredNav.map(item => {
              const isActive = currentView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => { onViewChange(item.id); setIsSidebarOpen(false); }}
                  className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-300 group active-scale ${
                    isActive 
                      ? 'bg-[#1d4ed8] text-white shadow-lg shadow-blue-200' 
                      : 'text-slate-500 hover:bg-blue-50/60 hover:text-[#1d4ed8]'
                  }`}
                >
                  <div className={`p-2 rounded-xl transition-colors ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-blue-50 text-[#2D7FF9] group-hover:bg-white'
                  }`}>
                    <item.icon size={19} />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest flex-1 text-left flex items-center justify-between">
                    <span>{item.label}</span>
                    {item.id === 'HISTORY' && pendingCount > 0 && (
                      <span className={`text-[8px] font-black px-2 py-0.5 rounded-full animate-pulse mr-1 ${isActive ? 'bg-white text-[#1d4ed8]' : 'bg-[#2D7FF9] text-white'}`}>
                        {pendingCount} PENDENTE{pendingCount > 1 ? 'S' : ''}
                      </span>
                    )}
                  </span>
                  {isActive && <ChevronRight size={14} className="opacity-70" />}
                </button>
              );
            })}
          </nav>

          <div className="mt-auto pt-6 border-t border-slate-100 space-y-3">
            <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-50 border border-slate-100 rounded-xl">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${isDbConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                <span className="text-[7.5px] font-black uppercase text-slate-600 tracking-wider">
                  {isDbConnected ? 'Nuvem Conectada' : 'Modo Offline'}
                </span>
              </div>
              <span className="text-[7px] font-bold text-slate-400 uppercase">Neon DB</span>
            </div>
            <button onClick={onLogout} className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl bg-blue-50 text-[#1d4ed8] font-black text-[9px] uppercase tracking-widest active-scale border border-blue-200 hover:bg-[#1d4ed8] hover:text-white transition-all">
              <LogOut size={16} /> Sair do Sistema
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative print:block print:overflow-visible">
        <div className="w-full h-1.5 adgu-tricolor-bar shrink-0 print:hidden" />
        <header className="shrink-0 h-20 px-6 flex items-center justify-between lg:hidden z-40 bg-white/90 backdrop-blur-xl border-b border-slate-200 print:hidden">
          <button onClick={() => setIsSidebarOpen(true)} className="p-3 bg-[#1d4ed8] text-white rounded-2xl active-scale shadow-lg shadow-blue-200"><Menu size={20} /></button>
          <div className="flex items-center gap-2.5">
            <Logo size="sm" className="w-8 h-8" />
            <span className="text-xs font-black uppercase tracking-widest text-[#1d4ed8]">
              ADGU FINANÇAS
            </span>
          </div>
          <div className="w-10" />
        </header>

        <main className="flex-1 overflow-y-auto scroll-container p-6 lg:p-10 pt-8 lg:pt-10 print:overflow-visible print:p-0 print:m-0">
          <div className="max-w-5xl mx-auto pb-10 print:max-w-none print:pb-0 print:m-0">{children}</div>
        </main>
      </div>
    </div>
  );
};

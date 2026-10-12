
import React, { useState, useEffect } from 'react';
import { FinancialReport, UserSession, DailyTransaction } from '../types';
import { 
  getReports, 
  restoreReport, 
  deleteReportPermanently,
  getDeletedTransactions,
  restoreTransaction,
  deleteTransactionPermanently
} from '../services/storageService';
import { Trash2, RotateCcw, AlertCircle, User, Clock, CheckCircle, RefreshCw } from 'lucide-react';

interface TrashManagerProps {
  session: UserSession;
}

export const TrashManager: React.FC<TrashManagerProps> = ({ session }) => {
  const [deletedReports, setDeletedReports] = useState<FinancialReport[]>([]);
  const [deletedTransactions, setDeletedTransactions] = useState<DailyTransaction[]>([]);
  const [activeTab, setActiveTab] = useState<'REPORTS' | 'TRANSACTIONS'>('REPORTS');
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    loadTrash();
  }, [activeTab]);

  const loadTrash = async () => {
    setLoading(true);
    try {
      const institutionFilter = session.role === 'ADMIN' ? undefined : session.institution;
      
      const [reps, trans] = await Promise.all([
        getReports(institutionFilter, true),
        getDeletedTransactions()
      ]);
      setDeletedReports(reps);
      const filteredTrans = session.role === 'ADMIN' 
        ? trans 
        : trans.filter(t => t.institutionName === session.institution);
      setDeletedTransactions(filteredTrans);
    } catch (err) {
      console.error("Erro ao carregar lixeira:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreReport = async (id: string) => {
    try {
      await restoreReport(id);
      setDeletedReports(prev => prev.filter(r => r.id !== id));
      setStatusMessage({ type: 'success', text: "Relatório restaurado com sucesso!" });
      loadTrash();
    } catch (err) {
      setStatusMessage({ type: 'error', text: "Erro ao restaurar relatório." });
    }
  };

  const handleRestoreTransaction = async (id: string) => {
    try {
      await restoreTransaction(id);
      setDeletedTransactions(prev => prev.filter(t => t.id !== id));
      setStatusMessage({ type: 'success', text: "Lançamento restaurado com sucesso!" });
      loadTrash();
    } catch (err) {
      setStatusMessage({ type: 'error', text: "Erro ao restaurar lançamento." });
    }
  };

  const handlePermanentDeleteReport = async (id: string) => {
    setConfirmDialog({
      title: "Exclusão Permanente",
      message: "ATENÇÃO: Esta ação é definitiva e não pode ser desfeita. Deseja excluir este relatório permanentemente?",
      onConfirm: async () => {
        try {
          await deleteReportPermanently(id);
          setDeletedReports(prev => prev.filter(r => r.id !== id));
          setStatusMessage({ type: 'success', text: "Relatório excluído permanentemente." });
          setConfirmDialog(null);
          loadTrash();
        } catch (err) {
          setStatusMessage({ type: 'error', text: "Erro ao excluir permanentemente." });
          setConfirmDialog(null);
        }
      },
      onCancel: () => setConfirmDialog(null)
    });
  };

  const handlePermanentDeleteTransaction = async (id: string) => {
    setConfirmDialog({
      title: "Exclusão Permanente",
      message: "ATENÇÃO: Esta ação é definitiva e não pode ser desfeita. Deseja excluir este lançamento permanentemente?",
      onConfirm: async () => {
        try {
          await deleteTransactionPermanently(id);
          setDeletedTransactions(prev => prev.filter(t => t.id !== id));
          setStatusMessage({ type: 'success', text: "Lançamento excluído permanentemente." });
          setConfirmDialog(null);
          loadTrash();
        } catch (err) {
          setStatusMessage({ type: 'error', text: "Erro ao excluir permanentemente." });
          setConfirmDialog(null);
        }
      },
      onCancel: () => setConfirmDialog(null)
    });
  };

  const handleEmptyTrash = () => {
    const itemsCount = activeTab === 'REPORTS' ? deletedReports.length : deletedTransactions.length;
    if (itemsCount === 0) return;

    setConfirmDialog({
      title: "Esvaziar Lixeira",
      message: `Deseja excluir permanentemente todos os ${itemsCount} itens desta aba da lixeira? Esta ação não pode ser desfeita.`,
      onConfirm: async () => {
        try {
          if (activeTab === 'REPORTS') {
            await Promise.all(deletedReports.map(r => deleteReportPermanently(r.id)));
            setDeletedReports([]);
          } else {
            await Promise.all(deletedTransactions.map(t => deleteTransactionPermanently(t.id)));
            setDeletedTransactions([]);
          }
          setStatusMessage({ type: 'success', text: "Lixeira esvaziada com sucesso!" });
          setConfirmDialog(null);
          loadTrash();
        } catch (err) {
          setStatusMessage({ type: 'error', text: "Erro ao esvaziar lixeira." });
          setConfirmDialog(null);
        }
      },
      onCancel: () => setConfirmDialog(null)
    });
  };

  const formatBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Lixeira do Sistema</h2>
          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
            {session.role === 'ADMIN' ? 'Gerenciamento de itens excluídos (Todas as Unidades)' : `Itens excluídos: ${session.institution}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-white p-1.5 rounded-2xl border border-slate-100 shadow-sm">
            <button
              type="button"
              onClick={() => setActiveTab('REPORTS')}
              className={`px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                activeTab === 'REPORTS' ? 'bg-[#1d4ed8] text-white shadow-sm' : 'text-slate-500 hover:text-[#1d4ed8]'
              }`}
            >
              Relatórios ({deletedReports.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('TRANSACTIONS')}
              className={`px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                activeTab === 'TRANSACTIONS' ? 'bg-[#1d4ed8] text-white shadow-sm' : 'text-slate-500 hover:text-[#1d4ed8]'
              }`}
            >
              Lançamentos ({deletedTransactions.length})
            </button>
          </div>

          <button
            type="button"
            onClick={loadTrash}
            className="p-3.5 bg-white text-[#2D7FF9] border border-blue-100 rounded-2xl hover:bg-blue-50 transition-all active-scale shadow-sm"
            title="Sincronizar Lixeira"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>

          {((activeTab === 'REPORTS' && deletedReports.length > 0) || (activeTab === 'TRANSACTIONS' && deletedTransactions.length > 0)) && (
            <button
              type="button"
              onClick={handleEmptyTrash}
              className="px-5 py-3.5 bg-rose-50 text-rose-600 border border-rose-200 rounded-2xl font-black text-[9px] uppercase tracking-widest hover:bg-rose-600 hover:text-white transition-all active-scale flex items-center gap-2 shadow-sm"
            >
              <Trash2 size={16} /> Esvaziar Lixeira
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-50 shadow-sm overflow-hidden overflow-x-auto">
        {loading ? (
          <div className="p-20 text-center text-slate-400 font-black uppercase text-[10px] animate-pulse">Carregando Lixeira...</div>
        ) : activeTab === 'REPORTS' ? (
          <table className="w-full text-left min-w-[700px]">
            <thead>
              <tr className="border-b border-slate-50">
                <th className="p-6 text-[8px] font-black text-slate-400 uppercase tracking-widest">Relatório Excluído</th>
                <th className="p-6 text-[8px] font-black text-slate-400 uppercase tracking-widest">Excluído Por</th>
                <th className="p-6 text-[8px] font-black text-slate-400 uppercase tracking-widest">Data Exclusão</th>
                <th className="p-6 text-[8px] font-black text-slate-400 uppercase tracking-widest text-right">Valor Bruto</th>
                <th className="p-6 text-[8px] font-black text-slate-400 uppercase tracking-widest text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {deletedReports.map(rep => (
                <tr key={rep.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-6">
                    <h4 className="text-[11px] font-black text-slate-900 uppercase">Fechamento: {rep.date ? rep.date.split('-').reverse().join('/') : 'N/A'}</h4>
                    <p className="text-[8px] font-bold text-[#2D7FF9] uppercase">{rep.institutionName}</p>
                  </td>
                  <td className="p-6">
                      <div className="flex items-center gap-2 text-[9px] font-black text-slate-600 uppercase">
                      <User size={12}/> {rep.deletedBy || 'Desconhecido'}
                    </div>
                  </td>
                  <td className="p-6">
                      <div className="flex items-center gap-2 text-[9px] font-black text-slate-600 uppercase">
                      <Clock size={12}/> {rep.deletedAt ? new Date(rep.deletedAt).toLocaleString('pt-BR') : 'N/A'}
                    </div>
                  </td>
                  <td className="p-6 text-right font-black text-xs text-slate-900">{formatBRL(rep.totalRevenue)}</td>
                  <td className="p-6">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleRestoreReport(rep.id)}
                        className="px-3.5 py-2 bg-blue-50 text-[#1d4ed8] hover:bg-[#1d4ed8] hover:text-white rounded-xl active-scale font-black text-[8px] uppercase tracking-widest flex items-center gap-1.5 transition-all"
                        title="Restaurar Relatório"
                      >
                        <RotateCcw size={14}/> Restaurar
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePermanentDeleteReport(rep.id)}
                        className="px-3.5 py-2 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-xl active-scale font-black text-[8px] uppercase tracking-widest flex items-center gap-1.5 transition-all"
                        title="Excluir Permanentemente"
                      >
                        <Trash2 size={14}/> Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {deletedReports.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-20 text-center text-[9px] font-black text-slate-300 uppercase tracking-widest">Nenhum relatório na lixeira</td>
                </tr>
              )}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-left min-w-[700px]">
            <thead>
              <tr className="border-b border-slate-50">
                <th className="p-6 text-[8px] font-black text-slate-400 uppercase tracking-widest">Lançamento Excluído</th>
                <th className="p-6 text-[8px] font-black text-slate-400 uppercase tracking-widest">Categoria</th>
                <th className="p-6 text-[8px] font-black text-slate-400 uppercase tracking-widest">Data Lançamento</th>
                <th className="p-6 text-[8px] font-black text-slate-400 uppercase tracking-widest text-right">Valor</th>
                <th className="p-6 text-[8px] font-black text-slate-400 uppercase tracking-widest text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {deletedTransactions.map(trans => (
                <tr key={trans.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-6">
                    <h4 className="text-[11px] font-black text-slate-900 uppercase">{trans.description}</h4>
                    <p className="text-[8px] font-bold text-[#2D7FF9] uppercase">{trans.institutionName}</p>
                  </td>
                  <td className="p-6">
                    <span className="px-2.5 py-1 rounded-lg text-[8px] font-black uppercase bg-blue-50 text-[#1d4ed8]">
                      {trans.category}
                    </span>
                  </td>
                  <td className="p-6 text-[9px] font-black text-slate-600 uppercase">
                    {trans.date ? trans.date.split('-').reverse().join('/') : 'N/A'}
                  </td>
                  <td className="p-6 text-right font-black text-xs text-slate-900">{formatBRL(trans.value)}</td>
                  <td className="p-6">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleRestoreTransaction(trans.id)}
                        className="px-3.5 py-2 bg-blue-50 text-[#1d4ed8] hover:bg-[#1d4ed8] hover:text-white rounded-xl active-scale font-black text-[8px] uppercase tracking-widest flex items-center gap-1.5 transition-all"
                        title="Restaurar"
                      >
                        <RotateCcw size={14}/> Restaurar
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePermanentDeleteTransaction(trans.id)}
                        className="px-3.5 py-2 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-xl active-scale font-black text-[8px] uppercase tracking-widest flex items-center gap-1.5 transition-all"
                        title="Excluir Permanente"
                      >
                        <Trash2 size={14}/> Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {deletedTransactions.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-20 text-center text-[9px] font-black text-slate-300 uppercase tracking-widest">Nenhum lançamento na lixeira</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Custom Confirmation Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={confirmDialog.onCancel} />
          <div className="relative w-full max-w-md bg-white rounded-[2.5rem] p-8 shadow-2xl border border-slate-100">
            <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mb-6">
              <AlertCircle size={32} />
            </div>
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">{confirmDialog.title}</h3>
            <p className="text-sm text-slate-500 mb-8 leading-relaxed">{confirmDialog.message}</p>
            <div className="flex gap-3">
              <button 
                type="button"
                onClick={confirmDialog.onCancel}
                className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all"
              >
                Cancelar
              </button>
              <button 
                type="button"
                onClick={confirmDialog.onConfirm}
                className="flex-1 py-4 bg-rose-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-700 shadow-lg shadow-rose-100 transition-all"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Messages */}
      {statusMessage && (
        <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[400] px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-4 duration-300 ${
          statusMessage.type === 'success' ? 'bg-[#1d4ed8] text-white' : 'bg-slate-900 text-white'
        }`}>
          {statusMessage.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          <span className="text-[10px] font-black uppercase tracking-widest">{statusMessage.text}</span>
        </div>
      )}
    </div>
  );
};

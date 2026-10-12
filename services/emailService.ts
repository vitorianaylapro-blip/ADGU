import { FinancialReport } from '../types';
import { getSettings, getUsers } from './storageService';

export const sendReportEmailToAdmin = async (report: FinancialReport): Promise<boolean> => {
  try {
    const settings = await getSettings();
    const users = await getUsers();
    const admins = users.filter(u => u.role === 'ADMIN' && u.email);

    // Fallback to settings email if no admin has email
    const recipientEmails = admins.length > 0
      ? admins.map(a => a.email!).filter(Boolean)
      : (settings.email ? [settings.email] : []);

    if (recipientEmails.length === 0) {
      return false;
    }

    const formatBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
    const dateFormatted = report.date ? report.date.split('-').reverse().join('/') : '';

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
        <h2 style="color: #4f46e5; margin-bottom: 5px; font-weight: 800; font-size: 20px; text-transform: uppercase; letter-spacing: -0.025em;">Relatório Financeiro Finalizado</h2>
        <p style="font-size: 14px; color: #64748b; margin-top: 0; text-transform: uppercase; font-weight: bold; letter-spacing: 0.05em;">Unidade: ${report.institutionName}</p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        
        <p style="font-size: 14px; color: #334155; line-height: 1.6;">Prezado Administrador,</p>
        <p style="font-size: 14px; color: #334155; line-height: 1.6;">Gostaríamos de notificar que o relatório de fechamento financeiro foi finalizado e enviado com sucesso para o banco de dados.</p>
        
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 12px; margin: 25px 0; border: 1px solid #f1f5f9;">
          <h3 style="margin-top: 0; font-size: 12px; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 15px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">Resumo dos Valores Consolidados</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #475569;">
            <tr>
              <td style="padding: 6px 0;"><strong>Relator responsável:</strong></td>
              <td style="padding: 6px 0; text-align: right; color: #0f172a; font-weight: 600;">${report.reporterName}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0;"><strong>Referência temporal:</strong></td>
              <td style="padding: 6px 0; text-align: right; color: #0f172a; font-weight: 600;">${dateFormatted}</td>
            </tr>
            <tr>
              <td style="padding: 12px 0 6px 0; border-top: 1px dotted #e2e8f0;"><strong>Receita Bruto Total:</strong></td>
              <td style="padding: 12px 0 6px 0; text-align: right; color: #16a34a; font-weight: bold; font-size: 14px;">${formatBRL(report.totalRevenue)}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0;"><strong>Despesas Operacionais:</strong></td>
              <td style="padding: 6px 0; text-align: right; color: #dc2626; font-weight: bold; font-size: 14px;">- ${formatBRL(report.totalFixedExpenses)}</td>
            </tr>
            ${!(report.noDiscount || report.institutionName.toLowerCase().replace(/\s+/g, '').includes('camposbelos') || ((report.sedeExpense || 0) === 0 && (report.prebendaExpense || 0) === 0)) ? `
            <tr>
              <td style="padding: 6px 0;"><strong>Repasse Sede (20%):</strong></td>
              <td style="padding: 6px 0; text-align: right; color: #e11d48;">- ${formatBRL(report.sedeExpense)}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0;"><strong>Repasse Prebenda (20%):</strong></td>
              <td style="padding: 6px 0; text-align: right; color: #e11d48;">- ${formatBRL(report.prebendaExpense)}</td>
            </tr>
            ` : ''}
            <tr>
              <td style="padding: 8px 0; border-top: 1px solid #e2e8f0; font-weight: bold; color: #0f172a; font-size: 14px;">Saldo Líquido Unidade:</td>
              <td style="padding: 8px 0; border-top: 1px solid #e2e8f0; text-align: right; font-weight: bold; color: #4f46e5; font-size: 14px;">${formatBRL(report.saldoGU)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #0f172a; font-size: 14px;">Caixa Disponível Total:</td>
              <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #0f172a; font-size: 14px;">${formatBRL(report.currentBalance)}</td>
            </tr>
          </table>
        </div>
        
        <p style="font-size: 12px; color: #64748b; line-height: 1.6;">O documento PDF detalhado e os respectivos comprovantes de despesa em anexo estão disponíveis para consulta e exportação através do Painel Administrativo.</p>
        
        <div style="margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 20px; text-align: center;">
          <p style="font-size: 11px; color: #94a3b8; margin: 0;">Este é um e-mail gerado automaticamente pelo Portal de Gestão Financeira ADGU.</p>
        </div>
      </div>
    `;

    const resendApiKey = import.meta.env.VITE_RESEND_API_KEY || '';

    const response = await fetch('/api/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        recipients: recipientEmails,
        subject: `Relatório Finalizado - ${report.institutionName} - ${dateFormatted}`,
        html: emailHtml,
        reportId: report.id,
        apiKey: resendApiKey
      })
    });

    if (!response.ok) {
      return false;
    }

    return true;
  } catch (error) {
    console.warn("Aviso no disparo de notificação por e-mail:", error);
    return false;
  }
};

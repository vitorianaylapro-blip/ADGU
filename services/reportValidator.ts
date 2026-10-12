import { FinancialReport } from '../types';

export interface ReportValidationResult {
  isPending: boolean;
  issues: string[];
}

export function validateFinancialReport(report: FinancialReport): ReportValidationResult {
  const issues: string[] = [];

  // 1. Check approval status
  if (report.approvalStatus === 'PENDENTE' || !report.approvalStatus) {
    issues.push('Aguardando aprovação ADM');
  } else if (report.approvalStatus === 'REJEITADO') {
    issues.push('Rejeitado pelo ADM (Ajustes requeridos)');
  }

  // 2. Check if the report is not finalized (not locked)
  if (!report.locked) {
    issues.push('Período em aberto');
  }

  // 2. Check if reference date is missing
  if (!report.date) {
    issues.push('Data de referência ausente');
  }

  // 3. Check if reporter name is missing
  if (!report.reporterName) {
    issues.push('Responsável pelo preenchimento não informado');
  }

  // 4. Check for missing attachments (comprovantes) when there are expenses
  // We check if total operational expenses are greater than 0, but no attachments exist
  const hasExpenses = (report.rent || 0) > 0 || 
                      (report.water || 0) > 0 || 
                      (report.energy || 0) > 0 || 
                      (report.internet || 0) > 0 || 
                      (report.cleaning || 0) > 0 || 
                      (report.maintenance || 0) > 0 ||
                      (report.otherExpenses && report.otherExpenses.length > 0);
                      
  if (hasExpenses && (!report.attachments || report.attachments.length === 0)) {
    issues.push('Comprovantes de despesa não anexados');
  }

  // 5. Check if cash and PIX balances are both exactly 0, while there is total revenue
  // This indicates that the final breakdown step was likely skipped or left blank
  if ((report.totalRevenue || 0) > 0 && (report.cashBalance || 0) === 0 && (report.pixBalance || 0) === 0) {
    issues.push('Detalhamento de saldos (Caixa/PIX) não preenchido');
  }

  return {
    isPending: issues.length > 0,
    issues
  };
}

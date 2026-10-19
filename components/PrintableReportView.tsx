import React from 'react';
import {
  ConsolidatedReportResult,
  formatBRL,
  formatDateBR,
  getCompetenceFromDate,
  isSedeTransferRevenue,
  OfficialReportPDFData,
  SystemSettings,
} from '../services/reportPdfService';
import { Logo } from './Logo';

interface PrintableReportViewProps {
  report: OfficialReportPDFData | ConsolidatedReportResult;
  settings?: Partial<SystemSettings> | null;
  className?: string;
  forceMode?: 'NORMAL' | 'CONSOLIDATED';
}

const DottedRow: React.FC<{
  label: string;
  value: number;
  bold?: boolean;
  highlight?: 'blue' | 'negative' | 'positive' | 'default';
  badge?: string;
}> = ({ label, value, bold = false, highlight = 'default', badge }) => {
  const valueClass =
    highlight === 'negative'
      ? 'text-rose-700 font-black'
      : highlight === 'positive'
      ? 'text-emerald-700 font-black'
      : highlight === 'blue'
      ? 'text-[#1d4ed8] font-black'
      : bold
      ? 'text-[#0f172a] font-black'
      : 'text-[#0f172a] font-bold';

  return (
    <div className="flex items-baseline justify-between py-1 text-[11px] sm:text-xs print:text-[10px] leading-snug">
      <div className="flex items-center gap-1.5 shrink-0 max-w-[65%]">
        <span
          className={`uppercase tracking-wide truncate ${
            bold ? 'font-black text-[#0f172a]' : 'font-semibold text-[#1e293b]'
          }`}
        >
          {label}
        </span>
        {badge && (
          <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 print:border print:border-emerald-600 shrink-0">
            {badge}
          </span>
        )}
      </div>
      <span
        className="flex-1 mx-2 border-b-2 border-dotted border-slate-300 print:border-slate-400 min-w-[20px]"
        aria-hidden="true"
      />
      <span className={`shrink-0 tabular-nums font-mono ${valueClass}`}>
        {formatBRL(value)}
      </span>
    </div>
  );
};

export const PrintableReportView: React.FC<PrintableReportViewProps> = ({
  report,
  settings,
  className = '',
  forceMode,
}) => {
  const isConsolidated =
    forceMode === 'CONSOLIDATED' ||
    (forceMode !== 'NORMAL' && 'revenueItems' in report && 'surplusOrDeficit' in report);

  const institutionTitle = (
    settings?.institutionName ||
    ('institutionTitle' in report ? report.institutionTitle : '') ||
    'ASSEMBLEIA DE DEUS GERAÇÃO UNIDA'
  ).toUpperCase();

  const cnpj =
    settings?.cnpj ||
    ('cnpj' in report ? report.cnpj : '') ||
    '49.386.673/0001-10';

  const president =
    settings?.president ||
    settings?.pastorName ||
    ('president' in report ? report.president : '') ||
    'Pr. Antônio Chaves Crus';

  const treasurerName =
    ('reporterName' in report ? report.reporterName : '') ||
    settings?.treasurerName ||
    'TESOUREIRO RESPONSÁVEL';
  const treasurerRole = settings?.treasurerRole || 'Tesoureiro Local';
  const pastorRole = settings?.pastorRole || 'Pastor Presidente';

  // -------------------------------------------------------------
  // MODO 1: RELATÓRIO GERAL CONSOLIDADO (EXCLUSIVO DO ADMINISTRADOR)
  // Com RECEITA, DESPESAS e RESUMO: SUPERÁVIT OU DÉFICIT
  // -------------------------------------------------------------
  if (isConsolidated) {
    const data = report as ConsolidatedReportResult;
    return (
      <div
        className={`bg-white text-[#0f172a] font-sans border border-slate-200 rounded-2xl shadow-sm overflow-hidden max-w-[210mm] mx-auto print:border-0 print:shadow-none print:rounded-none print:max-w-none print:w-full ${className}`}
      >
        {/* Cabeçalho do Relatório Geral Consolidado */}
        <div className="bg-[#f8fafc] border-b border-slate-200 px-6 py-5 sm:px-8 flex items-center gap-5 print:px-4 print:py-3">
          {settings?.logo ? (
            <img
              src={settings.logo}
              alt="Logo"
              className="w-14 h-14 object-contain shrink-0"
            />
          ) : (
            <Logo size="sm" className="w-14 h-14 shrink-0" />
          )}
          <div className="space-y-0.5">
            <h2 className="text-sm sm:text-base font-black text-[#0f172a] uppercase tracking-tight leading-snug">
              {institutionTitle}
            </h2>
            <div className="inline-block bg-blue-100 text-[#1d4ed8] text-[9px] font-black uppercase px-2 py-0.5 rounded tracking-wider mb-0.5">
              RELATÓRIO FINANCEIRO GERAL CONSOLIDADO (ADM)
            </div>
            <p className="text-[11px] font-bold text-slate-700 uppercase leading-snug">
              CNPJ: <span className="font-black text-slate-900">{cnpj}</span>
            </p>
            <p className="text-[11px] font-bold text-slate-700 uppercase leading-snug">
              PR. PRESIDENTE:{' '}
              <span className="font-black text-slate-900">{president}</span>
            </p>
            <p className="text-[11px] font-black text-[#1d4ed8] uppercase leading-snug pt-0.5">
              COMPETÊNCIA: {data.competence}
            </p>
          </div>
        </div>

        {/* Corpo do Relatório Geral */}
        <div className="px-6 py-5 sm:px-8 sm:py-6 space-y-6 print:px-4 print:py-4 print:space-y-4">
          {/* RECEITA */}
          <div>
            <div className="bg-[#1d4ed8] text-white px-3.5 py-1.5 rounded-lg mb-2.5">
              <h3 className="text-xs font-black uppercase tracking-widest">RECEITA</h3>
            </div>
            <div className="divide-y divide-slate-100/80 px-1">
              {data.revenueItems.map((item) => (
                <DottedRow key={item.label} label={item.label} value={item.value} />
              ))}
            </div>
          </div>

          {/* DESPESAS */}
          <div>
            <div className="bg-[#1d4ed8] text-white px-3.5 py-1.5 rounded-lg mb-2.5">
              <h3 className="text-xs font-black uppercase tracking-widest">DESPESAS</h3>
            </div>
            <div className="divide-y divide-slate-100/80 px-1">
              {data.expenseItems.map((item) => (
                <DottedRow key={item.label} label={item.label} value={item.value} />
              ))}
            </div>
          </div>

          {/* RESUMO DO ADM */}
          <div>
            <div className="bg-[#1d4ed8] text-white px-3.5 py-1.5 rounded-lg mb-2.5">
              <h3 className="text-xs font-black uppercase tracking-widest">RESUMO</h3>
            </div>
            <div className="bg-blue-50/50 border border-blue-100 rounded-xl px-4 py-3 space-y-1.5 print:bg-transparent print:border-slate-300">
              <DottedRow
                label="RECEITA"
                value={data.totalRevenue}
                bold
                highlight="blue"
              />
              <DottedRow
                label="DESPESA"
                value={data.totalExpense}
                bold
                highlight="default"
              />
              <DottedRow
                label="SUPERÁVIT OU DÉFICIT"
                value={data.surplusOrDeficit}
                bold
                highlight={data.surplusOrDeficit < 0 ? 'negative' : 'blue'}
              />
            </div>
          </div>

          {/* Assinaturas */}
          <div className="grid grid-cols-2 gap-10 pt-6 px-4 print:pt-5">
            <div className="text-center">
              <div className="border-t border-slate-400 pt-1.5">
                <p className="text-[10px] font-black text-[#0f172a] uppercase leading-tight">
                  {(settings?.treasurerName || 'TESOUREIRO GERAL').toUpperCase()}
                </p>
                <p className="text-[9px] text-slate-500 leading-tight">
                  {settings?.treasurerRole || 'Tesouraria Geral'}
                </p>
              </div>
            </div>
            <div className="text-center">
              <div className="border-t border-slate-400 pt-1.5">
                <p className="text-[10px] font-black text-[#0f172a] uppercase leading-tight">
                  {president.toUpperCase()}
                </p>
                <p className="text-[9px] text-slate-500 leading-tight">{pastorRole}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // MODO 2: RELATÓRIO NORMAL (INDIVIDUAL DAS CONGREGAÇÕES)
  // Modelo padrão da igreja com ENTRADAS, SAÍDAS, SALDO ANTERIOR,
  // SALDO GU e SALDO ATUAL (SOBRA PARA O PRÓXIMO MÊS)
  // -------------------------------------------------------------
  const normData = report as OfficialReportPDFData;
  const unitName = (normData.institutionName || 'CONGREGAÇÃO LOCAL').toUpperCase();
  const rawDate = normData.reportDate || normData.dateLabel || '';
  const dateFormatted = formatDateBR(rawDate) || 'N/D';
  const competence = getCompetenceFromDate(rawDate) || normData.dateLabel || 'COMPETÊNCIA ATUAL';
  const totalSaidas =
    (normData.sedeExpense || 0) +
    (normData.prebendaExpense || 0) +
    (normData.totalFixedExpenses || 0);

  return (
    <div
      className={`bg-white text-[#0f172a] font-sans border border-slate-200 rounded-2xl shadow-sm overflow-hidden max-w-[210mm] mx-auto print:border-0 print:shadow-none print:rounded-none print:max-w-none print:w-full ${className}`}
    >
      {/* Cabeçalho do Relatório Normal */}
      <div className="bg-[#f8fafc] border-b border-slate-200 px-6 py-5 sm:px-8 flex items-center gap-5 print:px-4 print:py-3">
        {settings?.logo ? (
          <img
            src={settings.logo}
            alt="Logo"
            className="w-14 h-14 object-contain shrink-0"
          />
        ) : (
          <Logo size="sm" className="w-14 h-14 shrink-0" />
        )}
        <div className="space-y-1 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-blue-100 text-[#1d4ed8] border border-blue-200">
              RELATÓRIO FINANCEIRO SEMANAL
            </span>
            <span className="text-[10px] font-black text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
              DATA: <span className="text-[#1d4ed8] font-black">{dateFormatted}</span>
            </span>
          </div>
          <h2 className="text-sm sm:text-base font-black text-[#0f172a] uppercase tracking-tight leading-snug">
            {institutionTitle}
          </h2>
          <p className="text-xs font-black text-[#1d4ed8] uppercase tracking-wide leading-snug">
            CONGREGAÇÃO: {unitName}
          </p>
          <div className="flex flex-wrap gap-x-4 text-[11px] font-bold text-slate-700 uppercase leading-snug pt-0.5">
            <span>
              CNPJ: <span className="font-black text-slate-900">{cnpj}</span>
            </span>
            <span>
              PR. PRESIDENTE: <span className="font-black text-slate-900">{president}</span>
            </span>
          </div>
          <div className="flex flex-wrap gap-x-4 text-[11px] font-bold text-slate-700 uppercase leading-snug">
            <span>
              TESOUREIRO:{' '}
              <span className="font-black text-slate-900">{treasurerName}</span>
            </span>
            <span>
              DATA DO RELATÓRIO:{' '}
              <span className="font-black text-slate-900">{dateFormatted}</span>
            </span>
            <span className="text-[#1d4ed8] font-black">
              COMPETÊNCIA: {competence}
            </span>
          </div>
        </div>
      </div>

      {/* Corpo do Relatório Normal */}
      <div className="px-6 py-5 sm:px-8 sm:py-6 space-y-6 print:px-4 print:py-4 print:space-y-4">
        {/* ENTRADAS / RECEITAS */}
        <div>
          <div className="bg-[#1d4ed8] text-white px-3.5 py-1.5 rounded-lg mb-2.5">
            <h3 className="text-xs font-black uppercase tracking-widest">
              ENTRADAS / RECEITAS
            </h3>
          </div>
          <div className="divide-y divide-slate-100/80 px-1">
            <DottedRow label="DÍZIMOS" value={normData.tithes || 0} />
            <DottedRow label="OFERTAS" value={normData.offers || 0} />
            <DottedRow label="OFERTAS ESPECIAIS" value={normData.specialOffers || 0} />

            {(normData.financialRevenue || 0) > 0 && (
              <DottedRow
                label="RECEITA FINANCEIRA"
                value={normData.financialRevenue || 0}
              />
            )}

            {(normData.otherRevenues || []).map((item, idx) => {
              if (!item || !item.value) return null;
              const isSede = isSedeTransferRevenue(item.description || '');
              return (
                <DottedRow
                  key={`other-rev-${idx}`}
                  label={item.description || 'OUTRAS RECEITAS'}
                  value={item.value}
                  badge={isSede ? '100% LÍQUIDO (ISENTO DE RETENÇÃO)' : undefined}
                />
              );
            })}
          </div>
          <div className="mt-2 pt-2 border-t border-slate-200">
            <DottedRow
              label="TOTAL DE ENTRADAS"
              value={normData.totalRevenue || 0}
              bold
              highlight="blue"
            />
          </div>
        </div>

        {/* SAÍDAS / DESPESAS */}
        <div>
          <div className="bg-[#1d4ed8] text-white px-3.5 py-1.5 rounded-lg mb-2.5">
            <h3 className="text-xs font-black uppercase tracking-widest">
              SAÍDAS / DESPESAS
            </h3>
          </div>
          <div className="divide-y divide-slate-100/80 px-1">
            {!normData.noDiscount && !normData.isCamposBelos && (
              <>
                <DottedRow
                  label="REPASSE SEDE (20%)"
                  value={normData.sedeExpense || 0}
                />
                <DottedRow
                  label="PREBENDA MINISTERIAL (20%)"
                  value={normData.prebendaExpense || 0}
                />
              </>
            )}
            {(normData.missions || 0) > 0 && (
              <DottedRow label="AJUDA MISSIONÁRIA" value={normData.missions || 0} />
            )}
            {(normData.rent || 0) > 0 && (
              <DottedRow label="ALUGUEL" value={normData.rent || 0} />
            )}
            {(normData.water || 0) > 0 && (
              <DottedRow label="ÁGUA" value={normData.water || 0} />
            )}
            {(normData.energy || 0) > 0 && (
              <DottedRow label="ENERGIA" value={normData.energy || 0} />
            )}
            {(normData.internet || 0) > 0 && (
              <DottedRow label="INTERNET" value={normData.internet || 0} />
            )}
            {(normData.cleaning || 0) > 0 && (
              <DottedRow label="MATERIAL DE LIMPEZA" value={normData.cleaning || 0} />
            )}
            {(normData.maintenance || 0) > 0 && (
              <DottedRow label="MANUTENÇÃO" value={normData.maintenance || 0} />
            )}
            {(normData.social || 0) > 0 && (
              <DottedRow label="ASSISTÊNCIA SOCIAL" value={normData.social || 0} />
            )}

            {(normData.otherExpenses || []).map((item, idx) => {
              if (!item || !item.value) return null;
              return (
                <DottedRow
                  key={`other-exp-${idx}`}
                  label={item.description || 'OUTRAS DESPESAS'}
                  value={item.value}
                />
              );
            })}
          </div>
          <div className="mt-2 pt-2 border-t border-slate-200">
            <DottedRow
              label="TOTAL DE SAÍDAS"
              value={totalSaidas}
              bold
              highlight="negative"
            />
          </div>
        </div>

        {/* RESUMO FINANCEIRO NORMAL (BALANÇO) */}
        <div>
          <div className="bg-[#1d4ed8] text-white px-3.5 py-1.5 rounded-lg mb-2.5">
            <h3 className="text-xs font-black uppercase tracking-widest">
              RESUMO FINANCEIRO (BALANÇO)
            </h3>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 space-y-1.5 print:bg-transparent print:border-slate-300">
            <DottedRow
              label="SALDO ANTERIOR"
              value={normData.previousBalance || 0}
              bold
            />
            <DottedRow
              label="(+) TOTAL DE ENTRADAS"
              value={normData.totalRevenue || 0}
              bold
              highlight="blue"
            />
            <DottedRow
              label="(-) TOTAL DE SAÍDAS"
              value={totalSaidas}
              bold
              highlight="negative"
            />
            <DottedRow
              label="(=) SALDO GU (RESULTADO DO MÊS)"
              value={normData.saldoGU || 0}
              bold
              highlight={normData.saldoGU < 0 ? 'negative' : 'positive'}
            />
            <div className="pt-1.5 border-t border-slate-200">
              <DottedRow
                label="(=) SALDO ATUAL (SOBRA PARA O PRÓXIMO MÊS)"
                value={normData.currentBalance || 0}
                bold
                highlight={normData.currentBalance < 0 ? 'negative' : 'blue'}
              />
            </div>
            {((normData.cashBalance || 0) > 0 || (normData.pixBalance || 0) > 0) && (
              <div className="text-[10px] font-bold text-slate-500 pt-1 flex justify-between border-t border-slate-100">
                <span>CONFERÊNCIA DE CAIXA:</span>
                <span>
                  Dinheiro: {formatBRL(normData.cashBalance || 0)} | PIX:{' '}
                  {formatBRL(normData.pixBalance || 0)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Assinaturas */}
        <div className="pt-6 px-4 print:pt-5 space-y-4">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">
            Fechamento do Relatório Financeiro Semanal — Data: <span className="text-[#1d4ed8] font-black">{dateFormatted}</span>
          </p>
          <div className="grid grid-cols-2 gap-10">
            <div className="text-center">
              <div className="h-16 flex items-center justify-center">
                {settings?.treasurerSignature && (
                  <img src={settings.treasurerSignature} className="max-h-full object-contain" alt="Assinatura" />
                )}
              </div>
              <div className="border-t border-slate-400 pt-1.5">
                <p className="text-[10px] font-black text-[#0f172a] uppercase leading-tight">
                  {treasurerName.toUpperCase()}
                </p>
                <p className="text-[9px] text-slate-500 leading-tight">{treasurerRole}</p>
              </div>
            </div>
            <div className="text-center">
              <div className="border-t border-slate-400 pt-1.5">
                <p className="text-[10px] font-black text-[#0f172a] uppercase leading-tight">
                  {president.toUpperCase()}
                </p>
                <p className="text-[9px] text-slate-500 leading-tight">{pastorRole}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

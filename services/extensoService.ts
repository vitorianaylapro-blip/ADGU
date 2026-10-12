/**
 * Utilitário profissional para converter valores numéricos em moeda por extenso (Reais e Centavos).
 * Padrão da língua portuguesa para recibos, cheques e documentos contábeis/eclesiásticos no Brasil.
 */

const UNIDADES = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
const ESPECIAIS = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const CENTENAS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

function converterGrupo(n: number): string {
  if (n === 0) return '';
  if (n === 100) return 'cem';

  const c = Math.floor(n / 100);
  const d = Math.floor((n % 100) / 10);
  const u = n % 10;

  const partes: string[] = [];

  if (c > 0) partes.push(CENTENAS[c]);

  if (d === 1) {
    partes.push(ESPECIAIS[u]);
  } else {
    if (d > 1) partes.push(DEZENAS[d]);
    if (u > 0) partes.push(UNIDADES[u]);
  }

  return partes.join(' e ');
}

export function valorPorExtenso(valor: number): string {
  if (isNaN(valor) || valor === 0) return 'zero reais';

  const negativo = valor < 0;
  const valAbs = Math.abs(valor);

  const inteiro = Math.floor(valAbs);
  const centavos = Math.round((valAbs - inteiro) * 100);

  const partesTexto: string[] = [];

  // Milhões
  const milhoes = Math.floor(inteiro / 1000000);
  const restoMilhoes = inteiro % 1000000;

  if (milhoes > 0) {
    const textoMilhoes = converterGrupo(milhoes);
    partesTexto.push(`${textoMilhoes} ${milhoes === 1 ? 'milhão' : 'milhões'}`);
  }

  // Milhares
  const milhares = Math.floor(restoMilhoes / 1000);
  const restoMilhares = restoMilhoes % 1000;

  if (milhares > 0) {
    if (milhares === 1) {
      partesTexto.push('um mil');
    } else {
      partesTexto.push(`${converterGrupo(milhares)} mil`);
    }
  }

  // Centenas/Unidades
  if (restoMilhares > 0) {
    partesTexto.push(converterGrupo(restoMilhares));
  }

  let resultadoFinal = '';

  if (inteiro > 0) {
    const conectaComE = restoMilhares > 0 && (restoMilhares <= 100 || restoMilhares % 100 === 0);
    const textoReais = partesTexto.join(conectaComE ? ' e ' : ', ');
    const moeda = inteiro === 1 ? 'real' : 'reais';
    resultadoFinal = `${textoReais} ${moeda}`;
  }

  if (centavos > 0) {
    const textoCentavos = converterGrupo(centavos);
    const moedaCentavos = centavos === 1 ? 'centavo' : 'centavos';
    if (inteiro > 0) {
      resultadoFinal += ` e ${textoCentavos} ${moedaCentavos}`;
    } else {
      resultadoFinal = `${textoCentavos} ${moedaCentavos}`;
    }
  }

  if (negativo) {
    resultadoFinal = `menos ${resultadoFinal}`;
  }

  // Limpeza de concordância de pontuação
  resultadoFinal = resultadoFinal
    .replace(/, e /g, ' e ')
    .replace(/, , /g, ', ')
    .trim();

  // Primeira letra maiúscula
  return resultadoFinal.charAt(0).toUpperCase() + resultadoFinal.slice(1);
}

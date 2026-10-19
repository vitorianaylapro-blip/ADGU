/**
 * Serviço de Processamento de Assinatura Digitalizada
 * Permite que a tesoureira/pastor tire foto da assinatura física no papel.
 * O sistema remove o fundo da folha automaticamente, isolando o traço da caneta com transparência PNG,
 * pronto para inclusão em recibos com Nome e CPF abaixo.
 */

export interface ProcessSignatureOptions {
  threshold?: number; // Sensibilidade de corte (100 - 250, padrão ~195)
  inkMode?: 'BLUE' | 'BLACK' | 'ORIGINAL'; // Cor do traço da caneta
  smoothEdges?: boolean;
}

export const formatCPF = (val: string): string => {
  const clean = (val || '').replace(/\D/g, '').slice(0, 11);
  if (clean.length <= 3) return clean;
  if (clean.length <= 6) return `${clean.slice(0, 3)}.${clean.slice(3)}`;
  if (clean.length <= 9) return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6)}`;
  return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9, 11)}`;
};

/**
 * Converte um arquivo (File/Blob) em Data URL base64
 */
export const fileToDataUrl = (file: File | Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * Remove o fundo de uma foto de assinatura em papel branco/pautado
 * Retorna uma imagem PNG com fundo transparente e corte automático (sem bordas brancas)
 */
export const removeSignatureBackground = async (
  imageSource: string | File | Blob,
  options: ProcessSignatureOptions = {}
): Promise<string> => {
  const {
    inkMode = 'BLUE'
  } = options;

  let src = typeof imageSource === 'string' ? imageSource : await fileToDataUrl(imageSource);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      // 1. Limitar dimensões para evitar lentidão e payload gigante de base64
      const maxDim = 1000;
      let w = img.width;
      let h = img.height;

      if (w > maxDim || h > maxDim) {
        if (w > h) {
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        } else {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      if (!ctx) {
        reject(new Error("Não foi possível inicializar canvas 2D"));
        return;
      }

      ctx.drawImage(img, 0, 0, w, h);
      const imgData = ctx.getImageData(0, 0, w, h);
      const data = imgData.data;

      // 2. Amostrar bordas (perímetro) da foto para detectar a luminosidade média do papel
      let bgLumaSum = 0;
      let bgCount = 0;
      const step = 4;

      // Topo e Fundo
      for (let x = 0; x < w; x += step) {
        const iTop = (0 * w + x) * 4;
        bgLumaSum += 0.299 * data[iTop] + 0.587 * data[iTop + 1] + 0.114 * data[iTop + 2];
        const iBottom = ((h - 1) * w + x) * 4;
        bgLumaSum += 0.299 * data[iBottom] + 0.587 * data[iBottom + 1] + 0.114 * data[iBottom + 2];
        bgCount += 2;
      }
      // Laterais Esquerda e Direita
      for (let y = 0; y < h; y += step) {
        const iLeft = (y * w + 0) * 4;
        bgLumaSum += 0.299 * data[iLeft] + 0.587 * data[iLeft + 1] + 0.114 * data[iLeft + 2];
        const iRight = (y * w + (w - 1)) * 4;
        bgLumaSum += 0.299 * data[iRight] + 0.587 * data[iRight + 1] + 0.114 * data[iRight + 2];
        bgCount += 2;
      }

      const avgPaperLuma = bgCount > 0 ? bgLumaSum / bgCount : 220;
      // O limiar adapta-se à iluminação da foto:
      // Se a folha estiver com sombra (luma 170), corta a partir de 145.
      // Se for papel bem iluminado (luma 240), corta a partir de 205.
      const threshold = Math.max(120, Math.min(235, options.threshold || (avgPaperLuma - 30)));
      const darkThreshold = Math.max(50, threshold - 50);

      let minX = w;
      let minY = h;
      let maxX = 0;
      let maxY = 0;
      let hasInk = false;

      // 3. Processamento de pixels
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // Luminância perceptiva (Luma)
        const luma = 0.299 * r + 0.587 * g + 0.114 * b;
        const x = (i / 4) % w;
        const y = Math.floor((i / 4) / w);

        if (luma >= threshold) {
          // Fundo de papel -> 100% Transparente
          data[i + 3] = 0;
        } else {
          // Traço de caneta
          let alpha = 255;
          if (luma > darkThreshold) {
            // Suavização anti-aliasing nos contornos do traço
            const ratio = (threshold - luma) / (threshold - darkThreshold);
            alpha = Math.min(255, Math.max(40, Math.round(ratio * 255)));
          }

          data[i + 3] = alpha;

          if (alpha > 45) {
            hasInk = true;
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
          }

          if (inkMode === 'BLUE') {
            // Caneta Azul Canônica (tom eclesiástico oficial, nítido e profissional)
            data[i] = 16;
            data[i + 1] = 68;
            data[i + 2] = 158;
          } else if (inkMode === 'BLACK') {
            // Caneta Preta Nanquim/Esferográfica
            data[i] = 20;
            data[i + 1] = 24;
            data[i + 2] = 33;
          } else {
            // Manter cor original reforçando nitidez e contraste
            data[i] = Math.max(0, r - 35);
            data[i + 1] = Math.max(0, g - 35);
            data[i + 2] = Math.max(0, b - 35);
          }
        }
      }

      ctx.putImageData(imgData, 0, 0);

      // 4. Recorte automático das margens vazias ao redor da assinatura
      if (hasInk && maxX > minX && maxY > minY) {
        const pad = 12;
        const cropX = Math.max(0, minX - pad);
        const cropY = Math.max(0, minY - pad);
        const cropW = Math.min(w - cropX, (maxX - minX) + pad * 2);
        const cropH = Math.min(h - cropY, (maxY - minY) + pad * 2);

        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = cropW;
        cropCanvas.height = cropH;
        const cropCtx = cropCanvas.getContext('2d');

        if (cropCtx) {
          cropCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
          resolve(cropCanvas.toDataURL('image/png'));
          return;
        }
      }

      resolve(canvas.toDataURL('image/png'));
    };

    img.onerror = () => {
      reject(new Error("Erro ao carregar a imagem da assinatura"));
    };

    img.src = src;
  });
};


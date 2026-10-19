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
    threshold = 195,
    inkMode = 'BLUE'
  } = options;

  let src = typeof imageSource === 'string' ? imageSource : await fileToDataUrl(imageSource);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      // Limitar dimensões para evitar travamento em fotos 4K de celular
      const maxDim = 1200;
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

      let minX = w;
      let minY = h;
      let maxX = 0;
      let maxY = 0;
      let hasInk = false;

      // Percorrer pixels e remover fundo
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // Luminância perceptiva (Luma)
        const luma = 0.299 * r + 0.587 * g + 0.114 * b;
        const x = (i / 4) % w;
        const y = Math.floor((i / 4) / w);

        // Se o pixel é mais claro que o limiar do papel -> torna transparente
        if (luma >= threshold) {
          data[i + 3] = 0; // Transparente
        } else {
          // Pixel de traço de caneta
          // Fator de intensidade do traço (quanto mais escuro, mais opaco)
          const delta = threshold - luma;
          const factor = Math.min(1, Math.max(0, delta / (threshold * 0.55)));
          const alpha = Math.min(255, Math.max(30, Math.round(factor * 255)));

          data[i + 3] = alpha;

          if (alpha > 40) {
            hasInk = true;
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
          }

          if (inkMode === 'BLUE') {
            // Caneta Azul Canônica (tom formal eclesiástico/cartorial)
            data[i] = 16;     // R
            data[i + 1] = 68; // G
            data[i + 2] = 158;// B
          } else if (inkMode === 'BLACK') {
            // Caneta Preta Nanquim/Esferográfica
            data[i] = 24;     // R
            data[i + 1] = 26; // G
            data[i + 2] = 32; // B
          } else {
            // Manter cor original, reforçando o contraste
            data[i] = Math.max(0, r - 30);
            data[i + 1] = Math.max(0, g - 30);
            data[i + 2] = Math.max(0, b - 30);
          }
        }
      }

      ctx.putImageData(imgData, 0, 0);

      // Recortar margens transparentes vazias (Auto-Trim)
      if (hasInk && maxX > minX && maxY > minY) {
        const pad = 12;
        const cropX = Math.max(0, minX - pad);
        const cropY = Math.max(0, minY - pad);
        const cropW = Math.min(w - cropX, maxX - minX + pad * 2);
        const cropH = Math.min(h - cropY, maxY - minY + pad * 2);

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

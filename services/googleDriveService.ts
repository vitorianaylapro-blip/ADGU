
let tokenClient: any = null;
let googleAccessToken: string | null = null;

export const loadGisScript = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (typeof window !== 'undefined' && (window as any).google?.accounts?.oauth2) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = (err) => reject(err);
    document.head.appendChild(script);
  });
};

export const getGoogleClientId = (): string => {
  return (
    (import.meta.env.VITE_GOOGLE_CLIENT_ID as string) ||
    localStorage.getItem('VITE_GOOGLE_CLIENT_ID') ||
    ''
  );
};

export const saveGoogleClientId = (clientId: string): void => {
  localStorage.setItem('VITE_GOOGLE_CLIENT_ID', clientId);
};

export const initTokenClient = (onSuccess: (token: string) => void, onError?: (err: any) => void) => {
  const clientId = getGoogleClientId();
  if (!clientId) {
    if (onError) onError(new Error("Google Client ID não configurado nas Configurações."));
    return;
  }

  try {
    tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/drive.file',
      callback: (tokenResponse: any) => {
        if (tokenResponse.error) {
          if (onError) onError(tokenResponse);
          return;
        }
        googleAccessToken = tokenResponse.access_token;
        onSuccess(tokenResponse.access_token);
      },
    });
  } catch (err) {
    if (onError) onError(err);
  }
};

export const requestGoogleAccessToken = (forceNew = false): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (googleAccessToken && !forceNew) {
      resolve(googleAccessToken);
      return;
    }

    loadGisScript()
      .then(() => {
        initTokenClient(
          (token) => resolve(token),
          (err) => reject(err)
        );
        if (tokenClient) {
          tokenClient.requestAccessToken({ prompt: forceNew ? 'consent' : '' });
        } else {
          reject(new Error("Não foi possível inicializar o cliente de autenticação do Google. Verifique se o Client ID é válido."));
        }
      })
      .catch((err) => reject(err));
  });
};

export const isGoogleDriveConfigured = (): boolean => {
  return !!getGoogleClientId();
};

export const uploadFileToDrive = async (
  base64Data: string,
  fileName: string,
  mimeType: string,
  accessToken: string
): Promise<{ fileId: string; viewLink: string; thumbnailLink: string }> => {
  const base64Clean = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
  const metadata = {
    name: fileName,
    mimeType: mimeType || 'image/jpeg'
  };

  const boundary = 'foo_bar_boundary';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const body = 
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    `Content-Type: ${mimeType}\r\n` +
    'Content-Transfer-Encoding: base64\r\n\r\n' +
    base64Clean +
    closeDelimiter;

  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink,thumbnailLink',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body: body
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Erro ao enviar para o Google Drive: ${errText}`);
  }

  const file = await response.json();
  const fileId = file.id;

  // Tornar visualização pública ("qualquer pessoa com o link" pode visualizar como leitor)
  try {
    const permissionResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        role: 'reader',
        type: 'anyone'
      })
    });
    if (!permissionResponse.ok) {
      console.warn("Falha ao atualizar permissões do arquivo.");
    }
  } catch (err) {
    console.warn("Não foi possível ajustar permissões de visualização pública:", err);
  }

  // Link direto público oficial do Google Drive para uso como embed em tags <img src="..." />
  const directLink = `https://lh3.googleusercontent.com/d/${fileId}`;
  return {
    fileId,
    viewLink: file.webViewLink || `https://drive.google.com/file/d/${fileId}/view`,
    thumbnailLink: directLink
  };
};

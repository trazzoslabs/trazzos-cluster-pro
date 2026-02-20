export interface WalletError {
  title: string;
  description: string;
  variant: 'error' | 'warn';
}

export function parseWalletError(error: unknown): WalletError {
  const errorString = String(error);
  const errorMessage = error instanceof Error ? error.message : errorString;
  const errorCode = (error as any)?.code;

  // Usuario rechazó la firma
  if (
    errorCode === 4001 ||
    errorCode === 'ACTION_REJECTED' ||
    errorMessage.includes('User rejected') ||
    errorMessage.includes('user rejected') ||
    errorMessage.includes('rejected the request') ||
    errorMessage.includes('denied transaction')
  ) {
    return {
      title: 'Firma cancelada',
      description: 'No pasa nada: puedes intentarlo de nuevo cuando quieras.',
      variant: 'warn',
    };
  }

  // Wallet no encontrada
  if (
    errorMessage.includes('No wallet') ||
    errorMessage.includes('Connector not found') ||
    errorMessage.includes('No wallet found') ||
    errorMessage.includes('No Ethereum provider') ||
    errorMessage.includes('ethereum is undefined')
  ) {
    return {
      title: 'Wallet no encontrada',
      description: 'No encontramos una wallet instalada. Instala MetaMask o usa WalletConnect.',
      variant: 'error',
    };
  }

  // Error de conexión
  if (
    errorMessage.includes('Connection') ||
    errorMessage.includes('Failed to connect') ||
    errorMessage.includes('Network error')
  ) {
    return {
      title: 'Error de conexión',
      description: 'No se pudo conectar con tu wallet. Verifica que esté desbloqueada e intenta de nuevo.',
      variant: 'error',
    };
  }

  // Error genérico
  return {
    title: 'No se pudo conectar',
    description: 'Ocurrió un error al conectar tu wallet. Por favor intenta de nuevo.',
    variant: 'error',
  };
}



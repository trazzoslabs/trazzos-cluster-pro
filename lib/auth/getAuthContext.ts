/**
 * Authentication context utilities
 * Unifies wallet, Google, and email authentication state
 */

export interface AuthContext {
  auth_method: 'wallet' | 'google' | 'email' | 'unknown';
  status: 'connected' | 'disconnected';
  display_name: string;
  address?: string;
  email?: string;
  chain_id?: number;
  chain_name?: string;
  wallet_provider?: 'metamask' | 'walletconnect' | 'unknown';
  is_demo?: boolean;
}

/**
 * Fetches authentication context from the API
 */
export async function getAuthContext(): Promise<AuthContext> {
  try {
    const response = await fetch('/api/auth/check');
    const data = await response.json();
    
    if (!data.authenticated) {
      return {
        auth_method: 'unknown',
        status: 'disconnected',
        display_name: 'No autenticado',
        is_demo: false,
      };
    }
    
    // Determine auth method
    let auth_method: 'wallet' | 'google' | 'email' = 'unknown';
    let display_name = 'Usuario';
    let address: string | undefined;
    let email: string | undefined;
    
    if (data.wallet) {
      auth_method = 'wallet';
      address = data.wallet;
      display_name = `${data.wallet.substring(0, 6)}...${data.wallet.substring(data.wallet.length - 4)}`;
    } else if (data.user) {
      // Check if it's an email or Google
      if (data.user.includes('@')) {
        auth_method = data.authMethod === 'google' ? 'google' : 'email';
        email = data.user;
        display_name = data.user;
      } else {
        auth_method = 'google';
        display_name = data.user;
      }
    }
    
    // Get chain info if wallet
    let chain_id: number | undefined;
    let chain_name: string | undefined;
    let wallet_provider: 'metamask' | 'walletconnect' | 'unknown' = 'unknown';
    
    if (auth_method === 'wallet' && typeof window !== 'undefined') {
      const ethereum = (window as any).ethereum;
      if (ethereum) {
        try {
          // Detect provider
          if (ethereum.isMetaMask) {
            wallet_provider = 'metamask';
          } else if (ethereum.isWalletConnect) {
            wallet_provider = 'walletconnect';
          }
          
          // Get chain ID
          const provider = await import('ethers').then(m => new m.BrowserProvider(ethereum));
          const network = await provider.getNetwork();
          chain_id = Number(network.chainId);
          chain_name = network.name;
        } catch (error) {
          // Silent fail - chain info not critical
          console.debug('Could not fetch chain info:', error);
        }
      }
    }
    
    // Check demo mode
    const is_demo = typeof window !== 'undefined' 
      ? (await import('../ui/demoMode')).isDemoMode()
      : false;
    
    return {
      auth_method,
      status: 'connected',
      display_name,
      address,
      email,
      chain_id,
      chain_name,
      wallet_provider,
      is_demo,
    };
  } catch (error) {
    console.error('Error fetching auth context:', error);
    return {
      auth_method: 'unknown',
      status: 'disconnected',
      display_name: 'Error al cargar sesión',
      is_demo: false,
    };
  }
}


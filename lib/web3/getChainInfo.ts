/**
 * Chain/Network information utilities
 * Maps chain IDs to human-readable names and checks support
 */

export interface ChainInfo {
  chainId: number;
  name: string;
  label: string;
  supported: boolean;
}

// Supported chains mapping
const SUPPORTED_CHAINS: Record<number, string> = {
  1: 'Ethereum Mainnet',
  137: 'Polygon',
  42161: 'Arbitrum One',
  10: 'Optimism',
  8453: 'Base',
};

export function getChainLabel(chainId: number | null | undefined): string {
  if (!chainId) return 'Desconocida';
  return SUPPORTED_CHAINS[chainId] || `Chain ID: ${chainId}`;
}

export function isSupportedChain(chainId: number | null | undefined): boolean {
  if (!chainId) return false;
  return chainId in SUPPORTED_CHAINS;
}

export function getChainInfo(chainId: number | null | undefined): ChainInfo {
  const supported = isSupportedChain(chainId);
  const label = getChainLabel(chainId);
  
  return {
    chainId: chainId || 0,
    name: label,
    label,
    supported,
  };
}





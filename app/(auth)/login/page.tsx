'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { parseWalletError } from '@/components/auth/parseWalletError';
import Toast from '@/components/auth/Toast';

export default function LoginPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // Estados de autenticación
  const [activeTab, setActiveTab] = useState<'wallet' | 'google' | 'email'>('wallet');
  const [connecting, setConnecting] = useState(false);
  const [email, setEmail] = useState('');
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [hasWallet, setHasWallet] = useState<boolean | null>(null);
  
  // Estados de UI
  const [toast, setToast] = useState<{ message: string; variant: 'error' | 'warn' | 'success' } | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Verificar si ya está autenticado
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/check');
        const data = await res.json();
        if (data.authenticated) {
          setIsAuthenticated(true);
          if (data.wallet) {
            setWalletAddress(data.wallet);
          }
        }
      } catch (error) {
        // No autenticado
      }
    };
    checkAuth();

    // Verificar si hay wallet disponible
    if (typeof window !== 'undefined') {
      const checkWallet = () => {
        setHasWallet(!!(window as any).ethereum);
      };
      checkWallet();
      
      if ((window as any).ethereum) {
        (window as any).ethereum.on('connect', checkWallet);
      }
      
      const interval = setInterval(checkWallet, 1000);
      return () => {
        clearInterval(interval);
        if ((window as any).ethereum) {
          (window as any).ethereum.removeListener('connect', checkWallet);
        }
      };
    }
  }, []);

  const showToast = (message: string, variant: 'error' | 'warn' | 'success' = 'error') => {
    setToast({ message, variant });
  };

  const connectWallet = async () => {
    try {
      setConnecting(true);
      setToast(null);

      if (typeof window === 'undefined' || !(window as any).ethereum) {
        showToast('No encontramos una wallet instalada. Instala MetaMask o usa WalletConnect.', 'error');
        return;
      }

      const { BrowserProvider } = await import('ethers');
      const ethereum = (window as any).ethereum;
      const provider = new BrowserProvider(ethereum);
      
      await provider.send('eth_requestAccounts', []);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      
      const timestamp = new Date().toISOString();
      const message = `Acceso a Cluster Pro — ${timestamp}`;
      const signature = await signer.signMessage(message);

      const response = await fetch('/api/auth/verify-signature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, signature, address }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Error al verificar firma' }));
        throw new Error(errorData.error || 'Error al verificar firma');
      }

      setWalletAddress(address);
      setIsAuthenticated(true);
      const next = searchParams.get('next') || '/';
      router.push(next);
    } catch (err) {
      const walletError = parseWalletError(err);
      showToast(`${walletError.title}. ${walletError.description}`, walletError.variant);
    } finally {
      setConnecting(false);
    }
  };

  const connectWithGoogle = async () => {
    try {
      setConnecting(true);
      setToast(null);

      const next = searchParams.get('next');
      const googleUrl = next ? `/api/auth/google?next=${encodeURIComponent(next)}` : '/api/auth/google';
      window.location.href = googleUrl;
    } catch (err) {
      showToast('Error al conectar con Google. Por favor intenta de nuevo.', 'error');
      setConnecting(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      showToast('Por favor ingresa un email válido', 'error');
      return;
    }

    try {
      setConnecting(true);
      const response = await fetch('/api/auth/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        setIsAuthenticated(true);
        const next = searchParams.get('next') || '/';
        router.push(next);
      } else {
        throw new Error('Error al autenticar con email');
      }
    } catch (err) {
      showToast('Error al autenticar con email. Por favor intenta de nuevo.', 'error');
    } finally {
      setConnecting(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setIsAuthenticated(false);
    setWalletAddress(null);
    showToast('Sesión cerrada', 'success');
  };

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Header minimalista */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-black/60 backdrop-blur-md border-b border-white/5">
        <div className="container mx-auto px-6 py-3 max-w-7xl">
          <div className="flex items-center justify-between">
            <div className="text-white font-semibold">TRAZZOS LABS</div>
            <div className="text-zinc-400 text-xs">prototipo v2</div>
          </div>
        </div>
      </header>

      {/* Textura sutil de fondo */}
      <div 
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `
            radial-gradient(circle at 2px 2px, rgba(154, 255, 141, 0.04) 1px, transparent 0)
          `,
          backgroundSize: '32px 32px',
        }}
      />

      {/* Contenido principal - Layout de 1 columna */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-6 pt-20 pb-12">
        <div className="w-full max-w-5xl mx-auto px-6 space-y-10">
          
          {/* Badge - centrado */}
          <div className="flex justify-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#9aff8d]/10 border border-[#9aff8d]/30">
              <svg className="w-3.5 h-3.5 text-[#9aff8d]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span className="text-xs font-medium text-white">Plataforma de Gestión de Sinergias para el Cluster Industrial de Cartagena</span>
            </div>
          </div>

          {/* Título principal */}
          <div className="text-center">
            <h1 className="text-4xl lg:text-5xl font-bold text-white mb-3 leading-tight">
              Optimiza la{' '}
              <span className="text-[#9aff8d]">colaboración</span>
              <br />
              entre empresas
            </h1>
            <p className="text-base text-zinc-400 leading-relaxed mt-4">
              Gestiona sinergias, RFPs y proveedores de forma inteligente. Maximiza el ahorro y potencia la eficiencia operativa.
            </p>
          </div>

          {/* Features en lista vertical - centrados */}
          <div className="space-y-5 pt-3">
            <div className="flex items-start gap-4 justify-center">
              <div className="mt-0.5 flex-shrink-0">
                <div className="w-6 h-6 rounded-full bg-[#9aff8d]/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-[#9aff8d]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
              <div className="text-center">
                <h3 className="text-white font-semibold text-sm mb-1.5">Detecta oportunidades conjuntas</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">Identifica sinergias entre empresas del cluster</p>
              </div>
            </div>

            <div className="flex items-start gap-4 justify-center">
              <div className="mt-0.5 flex-shrink-0">
                <div className="w-6 h-6 rounded-full bg-[#9aff8d]/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-[#9aff8d]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
              <div className="text-center">
                <h3 className="text-white font-semibold text-sm mb-1.5">Gestiona RFPs y decisiones</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">Flujo completo hasta orden de compra</p>
              </div>
            </div>

            <div className="flex items-start gap-4 justify-center">
              <div className="mt-0.5 flex-shrink-0">
                <div className="w-6 h-6 rounded-full bg-[#9aff8d]/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-[#9aff8d]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
              <div className="text-center">
                <h3 className="text-white font-semibold text-sm mb-1.5">Trazabilidad end-to-end</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">Registro completo de operaciones</p>
              </div>
            </div>
          </div>

          {/* Video de YouTube - En el medio */}
          <div className="relative w-full aspect-video rounded-2xl overflow-hidden shadow-2xl border border-zinc-800/50">
            {/* Overlay sutil con gradiente dark */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent z-10 pointer-events-none" />
            
            <iframe
              src="https://www.youtube.com/embed/5of9ZaX84Zk?autoplay=1&mute=1&loop=1&playlist=5of9ZaX84Zk&controls=1&modestbranding=1&rel=0&enablejsapi=1"
              className="w-full h-full"
              allow="autoplay; encrypted-media; accelerometer; gyroscope; picture-in-picture"
              allowFullScreen
              title="Trazzos Cluster Pro"
            />
          </div>

          {/* Card de login - Centrada y más compacta */}
          <div className="flex justify-center">
            <div className="w-full max-w-xl bg-zinc-900/60 backdrop-blur-sm border border-zinc-800/50 rounded-xl p-8 shadow-2xl">
              {isAuthenticated ? (
                <div className="space-y-5">
                  <div className="text-center">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-900/20 border border-green-800/50 mb-4">
                      <svg className="w-7 h-7 text-[#9aff8d]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2">Conectado</h2>
                    {walletAddress && (
                      <p className="text-zinc-400 text-xs font-mono">
                        {walletAddress.substring(0, 6)}...{walletAddress.substring(walletAddress.length - 4)}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        const next = searchParams.get('next') || '/';
                        router.push(next);
                      }}
                      className="flex-1 px-5 py-2.5 bg-[#9aff8d] hover:bg-[#9aff8d]/80 text-[#232323] rounded-lg font-semibold text-sm transition-colors"
                    >
                      Continuar
                    </button>
                    <button
                      onClick={handleLogout}
                      className="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm transition-colors"
                    >
                      Desconectar
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Tabs elegantes */}
                  <div className="flex gap-1 mb-6 border-b border-zinc-800/50">
                    <button
                      onClick={() => setActiveTab('wallet')}
                      className={`px-4 py-2.5 text-sm font-medium transition-all ${
                        activeTab === 'wallet'
                          ? 'text-[#9aff8d] border-b-2 border-[#9aff8d]'
                          : 'text-zinc-400 hover:text-zinc-300'
                      }`}
                    >
                      Wallet
                    </button>
                    <button
                      onClick={() => setActiveTab('google')}
                      className={`px-4 py-2.5 text-sm font-medium transition-all ${
                        activeTab === 'google'
                          ? 'text-[#9aff8d] border-b-2 border-[#9aff8d]'
                          : 'text-zinc-400 hover:text-zinc-300'
                      }`}
                    >
                      Google
                    </button>
                    <button
                      onClick={() => setActiveTab('email')}
                      className={`px-4 py-2.5 text-sm font-medium transition-all ${
                        activeTab === 'email'
                          ? 'text-[#9aff8d] border-b-2 border-[#9aff8d]'
                          : 'text-zinc-400 hover:text-zinc-300'
                      }`}
                    >
                      Email
                    </button>
                  </div>

                  {/* Wallet Tab */}
                  {activeTab === 'wallet' && (
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-base font-semibold text-white mb-1.5">Conectar tu wallet</h3>
                        <p className="text-xs text-zinc-400 leading-relaxed">
                          Conecta MetaMask, WalletConnect o cualquier wallet compatible para acceder.
                        </p>
                      </div>
                      {hasWallet === false && (
                        <div className="bg-yellow-900/20 border border-yellow-800/50 rounded-lg p-3">
                          <p className="text-yellow-300 text-xs leading-relaxed">
                            No se detectó ninguna wallet. Instala{' '}
                            <a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer" className="underline hover:text-yellow-200">
                              MetaMask
                            </a>{' '}
                            o usa otro método de acceso.
                          </p>
                        </div>
                      )}
                      <button
                        onClick={connectWallet}
                        disabled={connecting || hasWallet === false}
                        className="w-full px-5 py-3 bg-[#9aff8d] hover:bg-[#9aff8d]/80 disabled:bg-zinc-800 disabled:text-zinc-500 text-[#232323] rounded-lg font-semibold text-sm transition-all disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-[#9aff8d]/20"
                      >
                        {connecting ? (
                          <>
                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Conectando...
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                            Conectar wallet
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Google Tab */}
                  {activeTab === 'google' && (
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-base font-semibold text-white mb-1.5">Continuar con Google</h3>
                        <p className="text-xs text-zinc-400 leading-relaxed">
                          Accede rápidamente con tu cuenta de Google.
                        </p>
                      </div>
                      <button
                        onClick={connectWithGoogle}
                        disabled={connecting}
                        className="w-full px-5 py-3 bg-white hover:bg-gray-50 disabled:bg-zinc-800 disabled:text-zinc-500 text-gray-900 rounded-lg font-semibold text-sm transition-all disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md"
                      >
                        {connecting ? (
                          <>
                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Conectando...
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" viewBox="0 0 24 24">
                              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                            </svg>
                            Continuar con Google
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Email Tab */}
                  {activeTab === 'email' && (
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-base font-semibold text-white mb-1.5">Acceso por email</h3>
                        <p className="text-xs text-zinc-400 leading-relaxed">
                          Ingresa tu email para acceder al sistema.
                        </p>
                      </div>
                      <form onSubmit={handleEmailSubmit} className="space-y-4">
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="tu@email.com"
                          className="w-full px-4 py-2.5 bg-zinc-800/50 border border-zinc-700/50 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#9aff8d]/50 focus:border-[#9aff8d]/50 transition-all"
                          required
                        />
                        <button
                          type="submit"
                          disabled={connecting}
                          className="w-full px-5 py-3 bg-[#9aff8d] hover:bg-[#9aff8d]/80 disabled:bg-zinc-800 disabled:text-zinc-500 text-[#232323] rounded-lg font-semibold text-sm transition-all disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-[#9aff8d]/20"
                        >
                          {connecting ? (
                            <>
                              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Conectando...
                            </>
                          ) : (
                            'Continuar con email'
                          )}
                        </button>
                      </form>
                    </div>
                  )}

                  {/* Legal Text */}
                  <p className="text-[10px] text-zinc-500 text-center mt-6 pt-4 border-t border-zinc-800/50">
                    Al continuar aceptas nuestros{' '}
                    <a href="#" className="text-[#9aff8d] hover:underline">Términos</a> y{' '}
                    <a href="#" className="text-[#9aff8d] hover:underline">Privacidad</a>.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          variant={toast.variant}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}

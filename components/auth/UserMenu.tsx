'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getAuthContext, type AuthContext } from '@/lib/auth/getAuthContext';
import { getChainInfo, isSupportedChain } from '@/lib/web3/getChainInfo';
import { isDemoMode, setDemoMode } from '@/lib/ui/demoMode';
import StatusPill from '@/components/ui/StatusPill';
import LogoutModal from './LogoutModal';
import Toast from './Toast';

export default function UserMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [authContext, setAuthContext] = useState<AuthContext | null>(null);
  const [chainChanged, setChainChanged] = useState(false);
  const [hideSensitiveData, setHideSensitiveData] = useState(false);
  const [toast, setToast] = useState<{ message: string; variant: 'error' | 'warn' | 'success' } | null>(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Load auth context
  useEffect(() => {
    loadAuthContext();
    
    // Refresh every 10 seconds
    const interval = setInterval(loadAuthContext, 10000);
    return () => clearInterval(interval);
  }, []);

  // Listen for chain changes
  useEffect(() => {
    if (typeof window === 'undefined' || !(window as any).ethereum) return;
    
    const ethereum = (window as any).ethereum;
    
    const handleChainChanged = () => {
      setChainChanged(true);
      loadAuthContext();
    };
    
    ethereum.on('chainChanged', handleChainChanged);
    
    return () => {
      ethereum.removeListener('chainChanged', handleChainChanged);
    };
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowSettings(false);
      }
    };
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Load hide sensitive data preference
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setHideSensitiveData(localStorage.getItem('trazzos_hide_sensitive') === 'true');
    }
  }, []);

  const loadAuthContext = async () => {
    const context = await getAuthContext();
    setAuthContext(context);
  };

  const handleCopyAddress = async () => {
    if (!authContext?.address) return;
    
    try {
      await navigator.clipboard.writeText(authContext.address);
      setToast({ message: 'Dirección copiada', variant: 'success' });
    } catch (error) {
      setToast({ message: 'Error al copiar', variant: 'error' });
    }
  };

  const handleUpdateChain = async () => {
    setChainChanged(false);
    await loadAuthContext();
    setToast({ message: 'Estado de red actualizado', variant: 'success' });
  };

  const handleManageConnection = () => {
    if (authContext?.auth_method === 'wallet' && typeof window !== 'undefined') {
      const ethereum = (window as any).ethereum;
      if (ethereum && ethereum.request) {
        ethereum.request({ method: 'wallet_requestPermissions', params: [{ eth_accounts: {} }] });
      }
    }
    setIsOpen(false);
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setShowLogoutModal(false);
      setIsOpen(false);
      router.push('/login');
      setToast({ message: 'Sesión cerrada', variant: 'success' });
    } catch (error) {
      setToast({ message: 'Error al cerrar sesión', variant: 'error' });
    }
  };

  const toggleHideSensitiveData = () => {
    const newValue = !hideSensitiveData;
    setHideSensitiveData(newValue);
    if (typeof window !== 'undefined') {
      localStorage.setItem('trazzos_hide_sensitive', newValue ? 'true' : 'false');
    }
  };

  const toggleDemoMode = () => {
    const current = isDemoMode();
    setDemoMode(!current);
    loadAuthContext();
  };

  const formatAddress = (address: string) => {
    if (hideSensitiveData) {
      return `${address.substring(0, 4)}...${address.substring(address.length - 2)}`;
    }
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  const formatEmail = (email: string) => {
    if (hideSensitiveData) {
      const [local, domain] = email.split('@');
      return `${local.substring(0, 2)}***@${domain}`;
    }
    return email;
  };

  if (!authContext) {
    return (
      <div className="w-[38px] h-[38px] rounded-full bg-zinc-800 border border-zinc-700 animate-pulse" />
    );
  }

  if (authContext.status === 'disconnected') {
    return (
      <button
        onClick={() => router.push('/login')}
        className="px-3 py-1.5 text-sm text-zinc-400 hover:text-white border border-zinc-700 rounded-lg hover:border-zinc-600 transition-colors"
      >
        Iniciar sesión
      </button>
    );
  }

  const isDemo = isDemoMode();
  const chainInfo = authContext.chain_id ? getChainInfo(authContext.chain_id) : null;
  const chainSupported = authContext.chain_id ? isSupportedChain(authContext.chain_id) : true;

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        {/* Avatar button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 group"
        >
          {/* Chain pill (if wallet) */}
          {authContext.auth_method === 'wallet' && chainInfo && (
            <StatusPill
              label={chainInfo.label.split(' ')[0]}
              variant={chainSupported ? 'success' : 'error'}
              size="sm"
            />
          )}
          
          {/* Demo pill */}
          {isDemo && <StatusPill label="Modo Demo" variant="demo" size="sm" />}
          
          {/* Avatar */}
          <div className="w-[38px] h-[38px] rounded-full bg-zinc-800 border border-[#9aff8d]/30 flex items-center justify-center text-white font-semibold text-sm hover:border-[#9aff8d]/50 hover:shadow-[0_0_12px_rgba(154,255,141,0.3)] transition-all">
            {authContext.auth_method === 'wallet' ? (
              <svg className="w-5 h-5 text-[#9aff8d]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            ) : (
              <span>{authContext.display_name.charAt(0).toUpperCase()}</span>
            )}
          </div>
        </button>

        {/* Dropdown */}
        {isOpen && (
          <div className="absolute right-0 top-full mt-2 w-80 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl z-50 overflow-hidden">
            {!showSettings ? (
              // Main view
              <div className="p-4 space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between pb-3 border-b border-zinc-800">
                  <div>
                    <h3 className="text-lg font-bold text-white">Cuenta</h3>
                    <p className="text-xs text-zinc-400 mt-0.5">Sesión activa</p>
                  </div>
                  {isDemo && <StatusPill label="Modo Demo" variant="demo" size="sm" />}
                </div>

                {/* Chain change alert */}
                {chainChanged && (
                  <div className="bg-yellow-900/20 border border-yellow-800/50 rounded-lg p-3">
                    <p className="text-yellow-300 text-xs">
                      Cambio de red detectado. Verifica para continuar.
                    </p>
                  </div>
                )}

                {/* Section A - Access Method */}
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Método de acceso</label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">
                      {authContext.auth_method === 'wallet' ? 'Wallet' : 
                       authContext.auth_method === 'google' ? 'Google' : 
                       authContext.auth_method === 'email' ? 'Email' : 'Desconocido'}
                    </span>
                    <div className={`w-2 h-2 rounded-full ${authContext.status === 'connected' ? 'bg-[#9aff8d]' : 'bg-zinc-600'}`} />
                  </div>
                </div>

                {/* Section B - Identity */}
                <div>
                  {authContext.address && (
                    <>
                      <label className="text-xs text-zinc-500 mb-1 block">Wallet</label>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono text-white flex-1">
                          {formatAddress(authContext.address)}
                        </span>
                        <button
                          onClick={handleCopyAddress}
                          className="px-2 py-1 text-xs text-zinc-400 hover:text-white border border-zinc-700 rounded hover:border-zinc-600 transition-colors"
                        >
                          Copiar
                        </button>
                      </div>
                    </>
                  )}
                  {authContext.email && (
                    <>
                      <label className="text-xs text-zinc-500 mb-1 block mt-2">Email</label>
                      <span className="text-sm text-white">{formatEmail(authContext.email)}</span>
                    </>
                  )}
                </div>

                {/* Section C - Network (wallet only) */}
                {authContext.auth_method === 'wallet' && chainInfo && (
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">Red</label>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-white">{chainInfo.label}</span>
                        <StatusPill
                          label={chainSupported ? 'OK' : 'Red no soportada'}
                          variant={chainSupported ? 'success' : 'error'}
                          size="sm"
                        />
                      </div>
                      <p className="text-xs text-zinc-500">Chain ID: {chainInfo.chainId}</p>
                      <button
                        onClick={handleUpdateChain}
                        className="w-full px-3 py-1.5 text-xs text-zinc-400 hover:text-white border border-zinc-700 rounded hover:border-zinc-600 transition-colors"
                      >
                        Actualizar estado
                      </button>
                    </div>
                  </div>
                )}

                {/* Section D - Actions */}
                <div className="space-y-2 pt-2 border-t border-zinc-800">
                  {authContext.auth_method === 'wallet' && (
                    <button
                      onClick={handleManageConnection}
                      className="w-full px-3 py-2 text-sm text-white hover:bg-zinc-800 rounded-lg transition-colors text-left"
                    >
                      Gestionar conexión
                    </button>
                  )}
                  <button
                    onClick={() => setShowSettings(true)}
                    className="w-full px-3 py-2 text-sm text-white hover:bg-zinc-800 rounded-lg transition-colors text-left"
                  >
                    Configuración
                  </button>
                  <button
                    onClick={() => setShowLogoutModal(true)}
                    className="w-full px-3 py-2 text-sm text-red-300 hover:bg-red-900/20 rounded-lg transition-colors text-left"
                  >
                    Cerrar sesión
                  </button>
                </div>
              </div>
            ) : (
              // Settings view
              <div className="p-4 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                  <h3 className="text-lg font-bold text-white">Configuración</h3>
                  <button
                    onClick={() => setShowSettings(false)}
                    className="text-sm text-zinc-400 hover:text-white transition-colors"
                  >
                    ← Volver
                  </button>
                </div>

                {/* Preferences */}
                <div>
                  <h4 className="text-sm font-semibold text-white mb-3">Preferencias</h4>
                  <div className="space-y-3">
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-sm text-zinc-300">Modo Demo</span>
                      <input
                        type="checkbox"
                        checked={isDemo}
                        onChange={toggleDemoMode}
                        className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-[#9aff8d] focus:ring-[#9aff8d] focus:ring-offset-0"
                      />
                    </label>
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-sm text-zinc-300">Ocultar datos sensibles</span>
                      <input
                        type="checkbox"
                        checked={hideSensitiveData}
                        onChange={toggleHideSensitiveData}
                        className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-[#9aff8d] focus:ring-[#9aff8d] focus:ring-offset-0"
                      />
                    </label>
                  </div>
                </div>

                {/* Session */}
                <div>
                  <h4 className="text-sm font-semibold text-white mb-3">Sesión</h4>
                  <div className="space-y-2">
                    <button
                      onClick={() => {
                        const sessionData = {
                          auth_method: authContext.auth_method,
                          address: authContext.address,
                          email: authContext.email,
                          chain_id: authContext.chain_id,
                        };
                        alert(JSON.stringify(sessionData, null, 2));
                      }}
                      className="w-full px-3 py-2 text-sm text-white hover:bg-zinc-800 rounded-lg transition-colors text-left"
                    >
                      Ver detalle de sesión
                    </button>
                    <button
                      onClick={() => setShowLogoutModal(true)}
                      className="w-full px-3 py-2 text-sm text-red-300 hover:bg-red-900/20 rounded-lg transition-colors text-left"
                    >
                      Cerrar sesión
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Logout Modal */}
      <LogoutModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={handleLogout}
      />

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          variant={toast.variant}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
}





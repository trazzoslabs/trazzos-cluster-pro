'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import BrandLogo from './BrandLogo';
import UserMenu from '@/components/auth/UserMenu';
import FloatingActions from './FloatingActions';

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const isAuthPage = pathname === '/acceso' || pathname === '/login';

  // Si es una página de autenticación, no mostrar header ni wrapper
  if (isAuthPage) {
    return <>{children}</>;
  }

  const navLinks = [
    { href: '/', label: 'Inicio' },
    { href: '/ingestion', label: 'Cargas de Datos' },
    { href: '/synergies', label: 'Oportunidades Conjuntas' },
    { href: '/workbench', label: 'Gestión de Decisiones' },
    { href: '/audit', label: 'Trazabilidad' },
    { href: '/intelligence', label: 'Centro de Inteligencia Visual' },
  ];

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname?.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-app-background">
      {/* Fixed Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-header-background border-b border-white/5 shadow-sm">
        <div className="container mx-auto px-6 py-4 max-w-7xl">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link href="/" className="hover:opacity-90 transition-opacity">
              <BrandLogo />
            </Link>

            {/* Navigation + User Menu */}
            <div className="flex items-center gap-4">
              {/* Navigation */}
              <nav className="flex items-center gap-1">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`group relative px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive(link.href)
                        ? 'bg-[#9aff8d]/10 text-[#9aff8d] border border-[#9aff8d]/20'
                        : 'text-zinc-400 hover:text-white hover:bg-white/5'
                    }`}
                    title={link.label}
                  >
                    <span className="block truncate max-w-[120px]">{link.label}</span>
                    {/* Tooltip con texto completo */}
                    <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-1.5 bg-zinc-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 border border-zinc-800">
                      {link.label}
                      <span className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-zinc-900"></span>
                    </span>
                  </Link>
                ))}
              </nav>

              {/* User Menu */}
              <UserMenu />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content with padding for fixed header */}
      <main className="pt-20">
        <div className="container mx-auto px-6 py-8 max-w-7xl">
          {children}
        </div>
      </main>

      {/* Botones flotantes - Solo en páginas autenticadas */}
      {!isAuthPage && <FloatingActions />}
    </div>
  );
}

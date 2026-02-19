/**
 * Demo Mode utilities
 * Checks if the application is running in demo mode
 */

export function isDemoMode(): boolean {
  if (typeof window === 'undefined') {
    // Server-side: check env var
    return process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
  }
  
  // Client-side: check env var or localStorage
  const envDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
  const storageDemo = localStorage.getItem('trazzos_demo_mode') === 'true';
  
  return envDemo || storageDemo;
}

export function setDemoMode(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  
  if (enabled) {
    localStorage.setItem('trazzos_demo_mode', 'true');
  } else {
    localStorage.removeItem('trazzos_demo_mode');
  }
}


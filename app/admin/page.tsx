import PageTitle from '../components/ui/PageTitle';
import SectionCard from '../components/ui/SectionCard';

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <PageTitle
        title="Dashboard de Administrador"
        subtitle="Ruta protegida por rol en public.profiles (admin, cluster_admin, super_admin)."
      />
      <SectionCard title="Acceso" description="Si ves esta página, el middleware validó tu rol contra profiles.">
        <p className="text-sm text-zinc-400">
          Ajusta los valores de <code className="text-zinc-300">role</code> en la tabla{' '}
          <code className="text-zinc-300">profiles</code> para otorgar o revocar acceso.
        </p>
      </SectionCard>
    </div>
  );
}

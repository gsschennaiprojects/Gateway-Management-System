'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { getDefaultDashboardRoute } from '@/lib/rbac/permissions';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { Loader2 } from 'lucide-react';

export default function RootPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace('/login');
      return;
    }

    if (user.status === 'pending') {
      router.replace('/pending');
      return;
    }

    const route = getDefaultDashboardRoute(user.role);
    router.replace(route);
  }, [user, loading, router]);

  return (
    <div className="min-h-screen bg-[#0A0F1E] flex flex-col items-center justify-center text-[#F8FAFC]">
      <div className="flex flex-col items-center gap-4 animate-panel-entrance">
        <BrandLogo size="lg" showText={false} />
        <div className="flex items-center gap-2.5">
          <Loader2 className="w-5 h-5 animate-spin text-[#0093F7]" />
          <span className="font-semibold text-base text-slate-200 tracking-tight">
            Initializing GSS Management System...
          </span>
        </div>
      </div>
    </div>
  );
}

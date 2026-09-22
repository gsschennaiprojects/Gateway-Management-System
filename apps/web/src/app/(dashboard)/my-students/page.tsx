'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function MyStudentsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/students?tab=tracker');
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
      <Loader2 className="w-8 h-8 animate-spin text-[var(--brand-primary,#1A73E8)]" />
      <p className="text-xs text-[var(--text-secondary,#5F6368)] font-medium">
        Opening Student Attendance &amp; Task Tracker...
      </p>
    </div>
  );
}

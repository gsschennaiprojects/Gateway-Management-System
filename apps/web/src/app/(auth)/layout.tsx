import Link from 'next/link';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen w-full bg-[var(--bg-canvas)] text-[var(--text-primary)] flex flex-col justify-between transition-colors">

      {/* Main Sign-In Card Container */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        {children}
      </main>

      {/* Google Style Footer */}
      <footer className="w-full max-w-6xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between text-xs text-[var(--text-secondary)] gap-3">
        <div className="flex items-center gap-2">
          <span>English (United States)</span>
        </div>
        <div className="flex items-center gap-6 text-xs">
          <Link href="/help" className="hover:text-[var(--text-primary)] transition-colors">Help</Link>
          <Link href="/privacy" className="hover:text-[var(--text-primary)] transition-colors">Privacy</Link>
          <Link href="/terms" className="hover:text-[var(--text-primary)] transition-colors">Terms</Link>
        </div>
      </footer>
    </div>
  );
}

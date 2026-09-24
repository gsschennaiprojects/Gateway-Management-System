import type { Metadata, Viewport } from 'next';
import { Fraunces, Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { SidebarProvider } from '@/context/SidebarContext';
import { ToastProvider } from '@/components/ui/Toast';
import { PwaNotificationManager } from '@/components/pwa/PwaNotificationManager';
import { InspectorGuard } from '@/components/security/InspectorGuard';

const fraunces = Fraunces({
  variable: '--font-fraunces',
  subsets: ['latin'],
  display: 'swap',
});

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600'],
});

export const metadata: Metadata = {
  title: 'GSS Management System — Gateway Software Solutions',
  description: 'Enterprise operations, attendance tracking, student management, task delegation, and lead pipeline for Gateway Software Solutions.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'GSS Management System',
  },
  icons: {
    icon: [
      { url: '/brand/gss-liquid-icon.png', type: 'image/png' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    shortcut: '/brand/gss-liquid-icon.png',
    apple: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/brand/gss-liquid-icon.png' },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: '#1A73E8',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fraunces.variable} ${inter.variable} ${jetbrainsMono.variable} h-full`}
    >
      <body className="min-h-full font-sans antialiased">
        <ThemeProvider>
          <SidebarProvider>
            <AuthProvider>
              <ToastProvider>
                <InspectorGuard />
                {children}
                <PwaNotificationManager />
              </ToastProvider>
            </AuthProvider>
          </SidebarProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

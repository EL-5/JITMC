import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/lib/ThemeContext';
import { SyncProvider } from '@/lib/SyncContext';
import Header from '@/components/Header';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'MORS - Medical Outreach Record System',
  description: 'An offline-ready dynamic medical registry system for field healthcare outreaches.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`h-full scroll-smooth ${inter.className}`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col antialiased selection:bg-sky-500/20" suppressHydrationWarning>
        <ThemeProvider>
          <SyncProvider>
            {/* Header / Nav Navigation */}
            <Header />
            
            {/* Main Application Wrapper */}
            <main className="flex-1 pb-20 sm:pb-8 flex flex-col">
              {children}
            </main>
          </SyncProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

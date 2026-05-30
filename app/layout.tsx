import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/lib/ThemeContext';
import { SyncProvider } from '@/lib/SyncContext';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'JSC Medical Outreach - Patient Registry',
  description: 'Jesus Saves Crusade Medical Outreach — offline-ready dynamic patient registry system for field healthcare outreaches.',
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
      <body className="min-h-full flex flex-col antialiased selection:bg-slate-500/20" suppressHydrationWarning>
        <ThemeProvider>
          <SyncProvider>
            <div className="flex min-h-screen w-full">
              {/* Global Navigation Sidebar */}
              <Sidebar />
              
              <div className="flex-1 flex flex-col min-w-0">
                {/* Header (Logo & Controls) */}
                <Header />
                
                {/* Main Application Wrapper */}
                <main className="flex-1 pb-20 sm:pb-8 flex flex-col">
                  {children}
                </main>
              </div>
            </div>
          </SyncProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

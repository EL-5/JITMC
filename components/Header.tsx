'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSync } from '@/lib/SyncContext';
import { 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  LayoutDashboard, 
  FileText,
  Settings,
  BarChart3
} from 'lucide-react';

export default function Header() {
  const pathname = usePathname();
  const { isOnline, isSyncing, pendingCount, triggerSync } = useSync();

  const handleSyncClick = async () => {
    if (pendingCount > 0 && isOnline && !isSyncing) {
      await triggerSync();
    }
  };

  return (
    <header className="sticky top-0 z-50 glass-nav shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-14 items-center gap-4">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group shrink-0">
            <span className="font-bold text-base sm:text-lg tracking-tight text-[#1a3a5c] dark:text-sky-400">
              JSC
            </span>
            <span className="hidden lg:inline-block text-xs font-medium text-[#4a6580] dark:text-slate-400 border-l border-[#d1dce8] dark:border-slate-800 pl-3">
              Jesus Saves Crusade Medical Outreach
            </span>
          </Link>



          {/* Right Controls */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Online/Offline Status */}
            <div
              className={`hidden xs:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold select-none ${
                isOnline
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50'
                  : 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/50'
              }`}
            >
              {isOnline ? (
                <><Wifi className="h-3 w-3" /><span>Online</span></>
              ) : (
                <><WifiOff className="h-3 w-3 animate-pulse" /><span>Offline</span></>
              )}
            </div>

            {/* Sync Button */}
            {pendingCount > 0 && (
              <button
                onClick={handleSyncClick}
                disabled={!isOnline || isSyncing}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  isOnline
                    ? 'bg-slate-500 hover:bg-slate-600 text-white shadow-xs animate-bounce'
                    : 'bg-slate-200 text-slate-400 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed'
                }`}
                title={isOnline ? 'Sync pending records to cloud' : 'Go online to sync'}
              >
                <RefreshCw className={`h-3 w-3 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>Sync ({pendingCount})</span>
              </button>
            )}
          </div>
        </div>
      </div>


    </header>
  );
}

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  FileText,
  Settings,
  BarChart3,
  Menu,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Sidebar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { label: 'Patient Form', href: '/', icon: FileText },
    { label: 'Form Builder', href: '/admin/form-builder', icon: Settings },
    { label: 'Records', href: '/admin/dashboard', icon: LayoutDashboard },
    { label: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
  ];

  return (
    <>
      {/* SIDEBAR (Desktop) */}
      <aside className="hidden sm:flex flex-col w-64 bg-white dark:bg-slate-900 border-r dark:border-slate-800 shrink-0 min-h-screen sticky top-0">
        <div className="p-5 border-b border-[#d1dce8] dark:border-slate-800 flex items-center gap-3 bg-[#1a3a5c] dark:bg-slate-900">
          <div className="relative h-12 w-12 overflow-hidden rounded-lg bg-white shadow-sm flex items-center justify-center">
            <img src="/logo.jpeg" alt="JSC Logo" className="object-contain w-full h-full" />
          </div>
          <div>
            <h2 className="text-lg font-black text-white leading-none">
              JSC
            </h2>
            <span className="text-[10px] font-bold text-blue-200 dark:text-slate-400 tracking-wider">
              MEDICAL OUTREACH
            </span>
          </div>
        </div>

        <nav className="flex-1 p-4 flex flex-col gap-2">
          {navLinks.map(({ label, href, icon: Icon }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  isActive
                    ? 'bg-[#e8f0fa] dark:bg-slate-800 text-[#1a3a5c] dark:text-white shadow-sm'
                    : 'text-[#4a6580] dark:text-slate-400 hover:bg-[#e8f0fa] dark:hover:bg-slate-800/50 hover:text-[#1a3a5c] dark:hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* MOBILE BOTTOM NAV */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-50 glass-nav border-t border-[#d1dce8] dark:border-slate-800 shadow-lg py-1 px-2 flex justify-around bg-white/90 dark:bg-slate-950/80 backdrop-blur-md">
        {navLinks.map(({ label, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center gap-1 py-2 px-2 rounded-lg text-[10px] font-bold transition-all duration-200 ${
              pathname === href
                ? 'text-[#1a3a5c] dark:text-white'
                : 'text-[#4a6580] dark:text-slate-400'
            }`}
          >
            <Icon className="h-5 w-5" />
            <span>{label}</span>
          </Link>
        ))}
      </div>
    </>
  );
}

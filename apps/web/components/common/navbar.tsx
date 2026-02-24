'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessageSquare, LayoutDashboard, Users, Play, FileText, Settings, Sparkles } from 'lucide-react';

const navLinks = [
  { href: '/', label: 'الرئيسية', labelEn: 'Home', icon: LayoutDashboard },
  { href: '/conversation', label: 'المحادثات', labelEn: 'Conversations', icon: MessageSquare },
  { href: '/teams/new', label: 'فريق جديد', labelEn: 'New Team', icon: Users },
  { href: '/runs', label: 'التشغيلات', labelEn: 'Runs', icon: Play },
  { href: '/templates', label: 'القوالب', labelEn: 'Templates', icon: FileText },
  { href: '/settings', label: 'الإعدادات', labelEn: 'Settings', icon: Settings },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="nav">
      <Link href="/" className="nav-brand flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-blue-400" />
        Multi-Agent Platform
      </Link>

      <ul className="nav-links">
        {navLinks.map((link) => {
          const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
          const Icon = link.icon;
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                className={`nav-link flex items-center gap-1.5 ${isActive ? 'nav-active' : ''}`}
              >
                <Icon className="w-4 h-4" />
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

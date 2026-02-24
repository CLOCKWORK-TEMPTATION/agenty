import type { Metadata } from 'next';
import { Space_Grotesk } from 'next/font/google';
import './globals.css';
import { Navbar } from '@/components/common/navbar';
import { ThemeProvider } from '@/contexts/theme-context';
import { ToastProvider } from '@/components/common/toast';
import { GlobalShortcuts } from '@/components/common/global-shortcuts';

const font = Space_Grotesk({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'منصة فرق الوكلاء | Multi-Model Agent Teams',
  description: 'منصة تنسيق وكلاء متعددة النماذج جاهزة للإنتاج',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body className={font.className}>
        <ThemeProvider>
          <ToastProvider>
            <GlobalShortcuts />
            <Navbar />
            <div className="page-content">{children}</div>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

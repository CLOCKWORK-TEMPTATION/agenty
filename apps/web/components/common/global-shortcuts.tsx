'use client';

import { useRouter } from 'next/navigation';
import { useKeyboardShortcut } from '@/lib/hooks/use-keyboard-shortcut';
import { useToast } from '@/components/common/toast';

export function GlobalShortcuts() {
  const router = useRouter();
  const { showToast } = useToast();

  // Cmd/Ctrl + K to go to Command Palette (or just home/search for now)
  useKeyboardShortcut({ key: 'k', ctrlKey: true }, () => {
    showToast('تم تفعيل اختصار البحث (البحث الشامل)', 'info');
    // router.push('/search'); // or open modal
  });

  // Cmd/Ctrl + N to create new team
  useKeyboardShortcut({ key: 'n', ctrlKey: true }, () => {
    showToast('يتم الآن توجيهك لإنشاء فريق جديد', 'success');
    router.push('/teams/new');
  });

  // Alt + T to go to templates
  useKeyboardShortcut({ key: 't', altKey: true }, () => {
    router.push('/templates');
  });

  // Alt + H to go to home
  useKeyboardShortcut({ key: 'h', altKey: true }, () => {
    router.push('/');
  });

  // We render an invisible div or just null since this is a utility component
  return null;
}

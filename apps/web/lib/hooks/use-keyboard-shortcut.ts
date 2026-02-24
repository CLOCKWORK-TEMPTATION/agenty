'use client';

import { useEffect } from 'react';

type KeyCombo = {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
};

export function useKeyboardShortcut(
  combo: KeyCombo,
  callback: (e: KeyboardEvent) => void,
  disabled: boolean = false
) {
  useEffect(() => {
    if (disabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Check if the user is typing in an input or textarea
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      const matchKey = event.key.toLowerCase() === combo.key.toLowerCase();
      const matchCtrl = combo.ctrlKey ? event.ctrlKey : !event.ctrlKey;
      const matchMeta = combo.metaKey ? event.metaKey : !event.metaKey;
      const matchShift = combo.shiftKey ? event.shiftKey : !event.shiftKey;
      const matchAlt = combo.altKey ? event.altKey : !event.altKey;

      if (matchKey && (matchCtrl || matchMeta) === (combo.ctrlKey || combo.metaKey) && matchShift && matchAlt) {
        event.preventDefault();
        callback(event);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [combo, callback, disabled]);
}

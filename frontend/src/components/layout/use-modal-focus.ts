'use client';

import { useEffect } from 'react';

const MODAL = '[role="dialog"][aria-modal="true"]';
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** Focusable controls inside a dialog, skipping full-screen backdrop buttons. */
function focusable(root: HTMLElement) {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (element) => !element.classList.contains('inset-0') && (element.offsetParent !== null || element === document.activeElement),
  );
}

/**
 * App-wide modal behaviour: moves focus into a newly opened dialog, keeps Tab / Shift+Tab inside the
 * top-most dialog, closes it on Escape, and returns focus to the control that opened it.
 */
export function useModalFocus() {
  useEffect(() => {
    const stack: Array<{ element: HTMLElement; opener: HTMLElement | null }> = [];
    let frame = 0;

    const sync = () => {
      frame = 0;
      const open = Array.from(document.querySelectorAll<HTMLElement>(MODAL));
      for (let index = stack.length - 1; index >= 0; index -= 1) {
        if (open.includes(stack[index].element)) continue;
        const [{ opener }] = stack.splice(index, 1);
        if (opener && document.contains(opener)) opener.focus();
      }
      for (const element of open) {
        if (stack.some((entry) => entry.element === element)) continue;
        const active = document.activeElement;
        const opener = active instanceof HTMLElement && !element.contains(active) && active !== document.body ? active : null;
        stack.push({ element, opener });
        if (!element.contains(document.activeElement)) {
          const target = focusable(element)[0];
          if (target) target.focus();
          else {
            element.tabIndex = -1;
            element.focus();
          }
        }
      }
    };

    const observer = new MutationObserver(() => {
      if (!frame) frame = window.requestAnimationFrame(sync);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    const onKeyDown = (event: KeyboardEvent) => {
      const top = stack[stack.length - 1]?.element;
      if (!top) return;
      if (event.key === 'Escape' && !event.defaultPrevented) {
        const closer =
          top.querySelector<HTMLButtonElement>('button[aria-label^="Close"]') ??
          Array.from(top.querySelectorAll<HTMLButtonElement>('button')).find((button) => /^(cancel|close)$/i.test(button.textContent?.trim() ?? ''));
        closer?.click();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusable(top);
      if (!items.length) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (event.shiftKey && (active === first || !top.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !top.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    sync();

    return () => {
      observer.disconnect();
      window.removeEventListener('keydown', onKeyDown);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);
}

'use client';

import { CircleCheckIcon, InfoIcon, Loader2Icon, OctagonXIcon, TriangleAlertIcon } from 'lucide-react';
import { useEffect } from 'react';
import { Toaster as Sonner, toast } from 'sonner';

import type { ToasterProps } from 'sonner';

// Expose showToast globally for E2E testing
if (typeof window !== 'undefined') {
  (window as unknown as { showToast: typeof toast }).showToast = toast;
}

const Toaster = ({ ...props }: ToasterProps) => {
  // Add data-testid and data-type to toast elements for E2E testing
  useEffect(() => {
    const addToastAttributes = (toastElement: Element) => {
      if (!toastElement.hasAttribute('data-testid')) {
        toastElement.setAttribute('data-testid', 'toast');
      }
      // Determine toast type from data-type attribute or class names
      const typeAttr = toastElement.getAttribute('data-type');
      if (!typeAttr) {
        // Sonner adds data-type attribute with toast type
        // Also check for success/error/warning/info classes
        if (
          toastElement.classList.contains('success') ||
          toastElement.querySelector('[data-icon="success"]') ||
          toastElement.getAttribute('data-sonner-toast') === 'success'
        ) {
          toastElement.setAttribute('data-type', 'success');
        } else if (
          toastElement.classList.contains('error') ||
          toastElement.querySelector('[data-icon="error"]') ||
          toastElement.getAttribute('data-sonner-toast') === 'error'
        ) {
          toastElement.setAttribute('data-type', 'error');
        } else if (
          toastElement.classList.contains('warning') ||
          toastElement.querySelector('[data-icon="warning"]') ||
          toastElement.getAttribute('data-sonner-toast') === 'warning'
        ) {
          toastElement.setAttribute('data-type', 'warning');
        } else if (
          toastElement.classList.contains('info') ||
          toastElement.querySelector('[data-icon="info"]') ||
          toastElement.getAttribute('data-sonner-toast') === 'info'
        ) {
          toastElement.setAttribute('data-type', 'info');
        }
      }
    };

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) {
            // Check if this is a toast element (sonner uses data-sonner-toast)
            const toasts = node.querySelectorAll('[data-sonner-toast]');
            toasts.forEach(addToastAttributes);
            // Also check if the node itself is a toast
            if (node.hasAttribute && node.hasAttribute('data-sonner-toast')) {
              addToastAttributes(node);
            }
          }
        });
        // Also check for attribute changes to detect type updates
        if (mutation.type === 'attributes' && mutation.target instanceof HTMLElement) {
          if (mutation.target.hasAttribute('data-sonner-toast')) {
            addToastAttributes(mutation.target);
          }
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-sonner-toast', 'data-type'],
    });

    return () => observer.disconnect();
  }, []);

  return (
    <Sonner
      theme="light"
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      toastOptions={{
        duration: 5000,
        classNames: {
          toast: 'group toast',
          success: 'toast-success',
          error: 'toast-error',
          warning: 'toast-warning',
          info: 'toast-info',
        },
      }}
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
          '--border-radius': 'var(--radius)',
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };

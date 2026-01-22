import * as React from 'react';

const MOBILE_BREAKPOINT = 768;

/**
 * Hook to detect mobile viewport.
 * Returns `false` during SSR and initial hydration to ensure consistent server/client rendering.
 * Updates to actual value after hydration completes.
 */
export function useIsMobile() {
  // Start with false to match SSR output and avoid hydration mismatch
  const [isMobile, setIsMobile] = React.useState(false);
  const [hasMounted, setHasMounted] = React.useState(false);

  React.useEffect(() => {
    setHasMounted(true);
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener('change', onChange);
    // Set initial value on mount
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  // Return false during SSR/hydration to ensure consistent rendering
  return hasMounted ? isMobile : false;
}

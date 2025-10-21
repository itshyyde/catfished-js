'use client';

import { useEffect } from 'react';

export default function NoSSR({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Suppress hydration warnings for body element attributes added by browser extensions
    const originalError = console.error;
    console.error = (...args) => {
      if (
        typeof args[0] === 'string' &&
        args[0].includes('Warning: Extra attributes from the server') &&
        args[0].includes('data-new-gr-c-s-check-loaded')
      ) {
        return;
      }
      originalError.apply(console, args);
    };

    return () => {
      console.error = originalError;
    };
  }, []);

  return <>{children}</>;
}

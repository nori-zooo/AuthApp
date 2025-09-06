declare module '@gluestack-ui/themed' {
  // Minimal types for themed exports used by Gluestack UI v2 components
  import * as React from 'react';

  export type ThemedProps = {
    children?: React.ReactNode;
    [key: string]: any;
  };

  export const styled: <P = any>(comp: React.ComponentType<P>) => React.ComponentType<P>;

  const themed: {
    styled: typeof styled;
    // fallback for any other named exports
    [key: string]: any;
  };

  export default themed;
}

declare module 'tailwind-variants/dist/config' {
  // Minimal placeholder for TVConfig used by nativewind-utils
  export type TVConfig = any;
  const config: TVConfig;
  export default config;
}


import { createEnv } from '@t3-oss/env-nextjs';

export const clientEnv = createEnv({
  client: {
    // Add NEXT_PUBLIC_ prefixed environment variables here
  },
  runtimeEnv: {},
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});

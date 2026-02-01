import * as Sentry from "@sentry/react";

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],
    tracesSampleRate: Number(
      import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || 0.1
    ),
    replaysSessionSampleRate: Number(
      import.meta.env.VITE_SENTRY_REPLAY_SAMPLE_RATE || 0.1
    ),
    replaysOnErrorSampleRate: Number(
      import.meta.env.VITE_SENTRY_REPLAY_ERROR_SAMPLE_RATE || 1.0
    ),
    environment: import.meta.env.MODE,
  });
}

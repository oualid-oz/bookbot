/**
 * Runs once when the server starts. Node-only code lives in a separate module
 * so the Edge build never sees it.
 */
export async function register() {
  // `next build` also loads the app; it doesn't need runtime secrets
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.NEXT_PHASE !== 'phase-production-build') {
    await import('./instrumentation.node');
  }
}

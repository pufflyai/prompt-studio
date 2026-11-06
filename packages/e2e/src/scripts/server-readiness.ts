// Playwright accumulates stdout, so these independent completions can arrive in either order.
export const fixtureServerReady =
  /(?=[\s\S]*"event":"runtime.startup.phase","phase":"app_ready")(?=[\s\S]*"event":"runtime.setup.phase","phase":"default_extensions.register"[^\n]*"state":"completed")/;

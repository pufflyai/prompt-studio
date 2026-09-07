// The server binding, browser, API helpers, and terminal allowlist share this origin.
export const uiOrigin = `http://127.0.0.1:${Number(process.env.E2E_API_PORT ?? "3200")}`;

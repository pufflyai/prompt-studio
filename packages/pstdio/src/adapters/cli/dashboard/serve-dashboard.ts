export type DashboardConfig = {
  apiBaseUrl?: string;
  terminalWebSocketUrl?: string;
  version?: string;
};

export const injectConfig = (html: string, config: DashboardConfig) => {
  const metadata = `<meta name="pstdio-config" content="${encodeURIComponent(JSON.stringify(config))}">`;
  const headClose = "</head>";

  if (!html.includes(headClose)) {
    return html;
  }

  return html.replace(headClose, `${metadata}${headClose}`);
};

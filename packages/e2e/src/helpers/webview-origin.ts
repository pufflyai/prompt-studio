/** Places a webview resource on its extension's own origin, which shares the API's port. */
export const webviewUrl = (apiBaseUrl: string, originLabel: string, path: string) => {
  const api = new URL(apiBaseUrl);
  return `${api.protocol}//${originLabel}.localhost${api.port ? `:${api.port}` : ""}${path}`;
};

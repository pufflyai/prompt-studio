export const viteOrigins = {
  api: `http://127.0.0.1:${Number(process.env.E2E_API_PORT ?? "3400")}`,
  dev: `http://127.0.0.1:${Number(process.env.E2E_VITE_DEV_PORT ?? "5176")}`,
  preview: `http://127.0.0.1:${Number(process.env.E2E_VITE_PREVIEW_PORT ?? "4174")}`,
};

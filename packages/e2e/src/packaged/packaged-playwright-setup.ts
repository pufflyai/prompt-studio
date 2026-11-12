import { preparePackagedConsumers } from "./prepared-packaged-consumers";

export default async () => {
  const controller = new AbortController();
  const interrupt = () => controller.abort();
  for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, interrupt);
  try {
    const profile = await preparePackagedConsumers(controller.signal);
    // Playwright propagates global-setup environment changes to every worker.
    process.env.E2E_EXTENSION_SOURCES = profile.env.E2E_EXTENSION_SOURCES;
    process.env.E2E_HOME = profile.env.E2E_HOME;
    process.env.E2E_BUN_CACHE_DIR = profile.env.E2E_BUN_CACHE_DIR;
    process.env.BUN_INSTALL_CACHE_DIR = profile.env.BUN_INSTALL_CACHE_DIR;
    process.env.NPM_CONFIG_USERCONFIG = profile.env.NPM_CONFIG_USERCONFIG;
    return profile.close;
  } finally {
    for (const signal of ["SIGINT", "SIGTERM"] as const) process.off(signal, interrupt);
  }
};

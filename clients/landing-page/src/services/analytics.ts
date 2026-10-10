import { loadOnDemand } from "./deferred-module";

export const loadAnalytics = loadOnDemand(async () => {
  const { default: posthog } = await import("posthog-js");
  posthog.init("phc_CWtFFzVtjHocyACrXxJ3och8zJsJA3JjeqdViTWMN94H", {
    api_host: "https://eu.i.posthog.com",
    defaults: "2026-05-30",
  });
  return posthog;
});

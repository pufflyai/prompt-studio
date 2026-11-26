import { createSigner } from "./gcs";
import { createPreviewRoutes } from "./preview-resources";
import { controllerRequest, createPreviewOpener } from "./preview-route";
import { createWorkflowHandler } from "./routes";

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error("Set " + name + ".");
  return value;
}

const controller = required("CONTROLLER_ORIGIN");
const routes = createPreviewRoutes({
  project: required("GOOGLE_CLOUD_PROJECT"),
  namespace: required("KUBERNETES_NAMESPACE"),
  domain: required("PREVIEW_DOMAIN"),
  certificateMap: required("CERTIFICATE_MAP"),
  gateway: required("PREVIEW_GATEWAY"),
  securityPolicy: required("PREVIEW_SECURITY_POLICY"),
});
let cleaning = false;
async function cleanup() {
  if (cleaning) return;
  cleaning = true;
  try {
    await routes.cleanup();
  } catch (error) {
    console.error("Preview cleanup failed:", error instanceof Error ? error.message : "Unknown error");
  } finally {
    cleaning = false;
  }
}
void cleanup();
setInterval(cleanup, 30_000);
const handler = createWorkflowHandler({
  keyHash: required("WORKFLOW_KEY_HASH"),
  verifyKey: async (key) => {
    const response = await controllerRequest(controller, "/v1/templates?limit=1", key);
    await response.body?.cancel();
    if (response.status === 401 || response.status === 403) return false;
    if (!response.ok) throw new Error("Controller authentication HTTP " + response.status);
    return true;
  },
  sign: createSigner(required("STORAGE_BUCKET"), required("SIGNER_ACCOUNT")),
  openPreview: createPreviewOpener(controller, routes),
});

Bun.serve({ port: 8080, hostname: "0.0.0.0", maxRequestBodySize: 16 * 1024, idleTimeout: 60, fetch: handler });

import type { OpenAPIHono } from "@hono/zod-openapi";
import { getExtensionRuntimeScript, renderExtensionRuntimeHtml } from "pstdio-extensions/bridge/runtime";
import type { AppBindings } from "../../types";

export const EXTENSION_RUNTIME_PATH = "/extensions/runtime";
export const EXTENSION_RUNTIME_SCRIPT_PATH = "/extensions/runtime.js";
export const EXTENSION_RUNTIME_SCRIPT_URL = `/v1${EXTENSION_RUNTIME_SCRIPT_PATH}`;

export const registerExtensionRuntimeRoutes = (routes: OpenAPIHono<AppBindings>) => {
  routes.get(
    EXTENSION_RUNTIME_PATH,
    () =>
      new Response(renderExtensionRuntimeHtml(EXTENSION_RUNTIME_SCRIPT_URL), {
        headers: { "content-type": "text/html; charset=utf-8" },
      }),
  );
  routes.get(
    EXTENSION_RUNTIME_SCRIPT_PATH,
    () =>
      new Response(getExtensionRuntimeScript(), {
        headers: { "content-type": "application/javascript; charset=utf-8" },
      }),
  );
};

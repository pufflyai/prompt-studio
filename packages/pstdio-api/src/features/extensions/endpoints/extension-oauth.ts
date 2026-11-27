import { createRoute, z } from "@hono/zod-openapi";
import { extensionOAuthStatusSchema, startExtensionOAuthResponseSchema } from "pstdio-api-contracts";
import type { AppRouteHandler } from "../../../types";
import { OAUTH_CALLBACK_PATH } from "../connection-oauth/consent";
import { oauthUrl } from "../connection-oauth/provider";
import type { ExtensionsRouteDeps } from "../deps";
import { ConnectionInputError } from "../extension-connection-transport";

const location = "/projects/{projectId}/extension-connections/{extensionId}/{connectionId}/oauth";
const target = z.object({ projectId: z.string(), extensionId: z.string(), connectionId: z.string() }).strict();
const error = {
  description: "The OAuth connection operation could not be completed.",
  content: { "application/json": { schema: z.object({ error: z.string() }) } },
};

export const startExtensionOAuthRoute = createRoute({
  method: "post",
  path: location,
  tags: ["Extensions"],
  request: { params: target },
  responses: {
    200: {
      description: "Provider sign-in URL for the current host principal.",
      content: { "application/json": { schema: startExtensionOAuthResponseSchema } },
    },
    400: error,
  },
});

export const extensionOAuthStatusRoute = createRoute({
  method: "get",
  path: location,
  tags: ["Extensions"],
  request: { params: target },
  responses: {
    200: {
      description: "Redacted OAuth status for the current host principal.",
      content: { "application/json": { schema: extensionOAuthStatusSchema } },
    },
    400: error,
  },
});

export const disconnectExtensionOAuthRoute = createRoute({
  method: "delete",
  path: location,
  tags: ["Extensions"],
  request: { params: target },
  responses: { 204: { description: "The local OAuth grant was disconnected." }, 400: error },
});

const plainText = { "text/plain": { schema: z.string() } };

export const extensionOAuthCallbackRoute = createRoute({
  method: "get",
  path: OAUTH_CALLBACK_PATH.slice("/v1".length),
  tags: ["Extensions"],
  responses: {
    200: { description: "Browser sign-in completed.", content: plainText },
    400: { description: "The browser sign-in could not be completed.", content: plainText },
  },
});

const safeError = (error: unknown) =>
  error instanceof ConnectionInputError ? error.message : "The OAuth connection operation could not be completed.";

const redirectUriFor = (requestUrl: string) => new URL(OAUTH_CALLBACK_PATH, oauthUrl(requestUrl)).href;

export const startExtensionOAuthHandler =
  (deps: ExtensionsRouteDeps): AppRouteHandler<typeof startExtensionOAuthRoute> =>
  async (c) => {
    c.header("cache-control", "no-store");
    try {
      return c.json(
        await deps.extensionConnectionService.oauth.start(c.req.valid("param"), redirectUriFor(c.req.url)),
        200,
      );
    } catch (error) {
      return c.json({ error: safeError(error) }, 400);
    }
  };

export const extensionOAuthStatusHandler =
  (deps: ExtensionsRouteDeps): AppRouteHandler<typeof extensionOAuthStatusRoute> =>
  async (c) => {
    c.header("cache-control", "no-store");
    try {
      return c.json(await deps.extensionConnectionService.oauth.status(c.req.valid("param")), 200);
    } catch (error) {
      return c.json({ error: safeError(error) }, 400);
    }
  };

export const disconnectExtensionOAuthHandler =
  (deps: ExtensionsRouteDeps): AppRouteHandler<typeof disconnectExtensionOAuthRoute> =>
  async (c) => {
    try {
      await deps.extensionConnectionService.oauth.disconnect(c.req.valid("param"));
      return c.body(null, 204);
    } catch (error) {
      return c.json({ error: safeError(error) }, 400);
    }
  };

export const extensionOAuthCallbackHandler =
  (deps: ExtensionsRouteDeps): AppRouteHandler<typeof extensionOAuthCallbackRoute> =>
  async (c) => {
    c.header("cache-control", "no-store");
    c.header("referrer-policy", "no-referrer");
    try {
      const { searchParams } = new URL(c.req.url);
      const param = (key: string) => {
        const values = searchParams.getAll(key);
        if (values.length > 1 || (values[0]?.length ?? 0) > 8192) throw new Error("Invalid OAuth callback.");
        return values[0];
      };
      const state = param("state");
      if (!state) return c.text("This sign-in request is invalid or expired.", 400);
      await deps.extensionConnectionService.oauth.accept({
        redirectUri: redirectUriFor(c.req.url),
        state,
        code: param("code"),
        error: param("error"),
        issuer: param("iss"),
      });
      return c.text("Connection authorized. You can close this tab.", 200);
    } catch {
      return c.text("Sign-in could not be completed. Return to Prompt Studio to try again.", 400);
    }
  };

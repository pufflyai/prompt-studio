import { createRoute, z } from "@hono/zod-openapi";
import { ProjectNotFoundError } from "../../../services/extension-service";
import type { AppRouteHandler } from "../../../types";
import type { ExtensionsRouteDeps, ExtensionWebviewRouteDeps } from "../deps";
import {
  ARTIFACT_TEXT_LIMIT_BYTES,
  artifactImageMediaType,
  artifactMediaType,
  findArtifactFile,
  resolveExtensionArtifactMount,
  safeArtifactPath,
} from "../extension-artifact-assets";

type ExtensionArtifactRouteDeps = ExtensionsRouteDeps & ExtensionWebviewRouteDeps;

const errorSchema = z.object({ error: z.string() });

const artifactParamsSchema = z
  .object({
    projectId: z.string(),
    extensionInstanceId: z.string(),
    mountId: z.string(),
  })
  .strict();

const artifactFileSchema = z.object({
  path: z.string(),
  size: z.number(),
  mediaType: z.string(),
});

export const listExtensionArtifactsRoute = createRoute({
  method: "get",
  path: "/projects/{projectId}/extensions/{extensionInstanceId}/artifacts/{mountId}/files",
  description: "List artifact metadata in one declared mount of an enabled extension.",
  tags: ["Extensions"],
  request: {
    params: artifactParamsSchema,
    query: z.object({ prefix: z.string().optional() }).strict(),
  },
  responses: {
    200: {
      description: "Artifact files.",
      content: { "application/json": { schema: z.object({ files: z.array(artifactFileSchema) }) } },
    },
    400: {
      description: "The prefix escapes the mount.",
      content: { "application/json": { schema: errorSchema } },
    },
    404: {
      description: "Project, extension instance, or mount not found.",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});

export const readExtensionArtifactTextRoute = createRoute({
  method: "get",
  path: "/projects/{projectId}/extensions/{extensionInstanceId}/artifacts/{mountId}/text",
  description: "Read one text artifact from a declared mount of an enabled extension.",
  tags: ["Extensions"],
  request: {
    params: artifactParamsSchema,
    query: z.object({ path: z.string() }).strict(),
  },
  responses: {
    200: {
      description: "Artifact text content.",
      content: { "application/json": { schema: z.object({ content: z.string() }) } },
    },
    404: {
      description: "Project, extension instance, mount, or file not found.",
      content: { "application/json": { schema: errorSchema } },
    },
    413: {
      description: "Artifact exceeds the text read limit.",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});

export const getExtensionArtifactImageUrlRoute = createRoute({
  method: "get",
  path: "/projects/{projectId}/extensions/{extensionInstanceId}/artifacts/{mountId}/image-url",
  description: "Mint a short-lived, mount-scoped URL for one allowlisted raster image artifact.",
  tags: ["Extensions"],
  request: {
    params: artifactParamsSchema,
    query: z.object({ path: z.string(), webviewId: z.string() }).strict(),
  },
  responses: {
    200: {
      description: "Short-lived artifact image URL.",
      content: { "application/json": { schema: z.object({ url: z.string() }) } },
    },
    404: {
      description: "Project, extension instance, mount, or file not found.",
      content: { "application/json": { schema: errorSchema } },
    },
    415: {
      description: "Artifact media type is not an allowlisted raster image.",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});

const resolveMount = async (
  deps: ExtensionArtifactRouteDeps,
  input: { projectId: string; extensionInstanceId: string; mountId: string },
) => {
  try {
    return await resolveExtensionArtifactMount(deps, input);
  } catch (error) {
    if (error instanceof ProjectNotFoundError) return null;
    throw error;
  }
};

const mountNotFound = (input: { mountId: string }) => ({ error: `Artifact mount not found: ${input.mountId}` });

export const listExtensionArtifactsHandler = (
  deps: ExtensionArtifactRouteDeps,
): AppRouteHandler<typeof listExtensionArtifactsRoute> => {
  return async (c) => {
    const params = c.req.valid("param");
    const { prefix } = c.req.valid("query");

    const safePrefix = prefix ? safeArtifactPath(prefix) : undefined;
    if (prefix && !safePrefix) return c.json({ error: `Artifact prefix escapes the mount: ${prefix}` }, 400);

    const resolved = await resolveMount(deps, params);
    if (!resolved) return c.json(mountNotFound(params), 404);

    const files = await resolved.mount.list(safePrefix ? `${safePrefix}/**` : undefined);
    return c.json(
      {
        files: files.map((file) => ({
          path: file.path,
          size: file.size ?? 0,
          mediaType: artifactMediaType(file.path),
        })),
      },
      200,
    );
  };
};

export const readExtensionArtifactTextHandler = (
  deps: ExtensionArtifactRouteDeps,
): AppRouteHandler<typeof readExtensionArtifactTextRoute> => {
  return async (c) => {
    const params = c.req.valid("param");
    const { path } = c.req.valid("query");

    const safePath = safeArtifactPath(path);
    if (!safePath) return c.json({ error: `Artifact not found: ${path}` }, 404);

    const resolved = await resolveMount(deps, params);
    if (!resolved) return c.json(mountNotFound(params), 404);

    const file = await findArtifactFile(resolved.mount, safePath);
    if (!file) return c.json({ error: `Artifact not found: ${path}` }, 404);
    if (file.size !== undefined && file.size > ARTIFACT_TEXT_LIMIT_BYTES) {
      return c.json({ error: `Artifact exceeds the ${ARTIFACT_TEXT_LIMIT_BYTES.toString()} byte text limit` }, 413);
    }

    return c.json({ content: await resolved.mount.readText(safePath) }, 200);
  };
};

export const getExtensionArtifactImageUrlHandler = (
  deps: ExtensionArtifactRouteDeps,
): AppRouteHandler<typeof getExtensionArtifactImageUrlRoute> => {
  return async (c) => {
    const params = c.req.valid("param");
    const { path, webviewId } = c.req.valid("query");

    const safePath = safeArtifactPath(path);
    if (!safePath) return c.json({ error: `Artifact not found: ${path}` }, 404);

    const mediaType = artifactImageMediaType(safePath);
    if (!mediaType) {
      return c.json({ error: `Artifact media type is not an allowlisted raster image: ${path}` }, 415);
    }

    const resolved = await resolveMount(deps, params);
    if (!resolved) return c.json(mountNotFound(params), 404);

    const file = await findArtifactFile(resolved.mount, safePath);
    if (!file) return c.json({ error: `Artifact not found: ${path}` }, 404);

    const url = deps.extensionWebviewAccess.artifactUrl(
      { installName: resolved.installName, webviewId },
      { artifactPath: safePath, mountId: resolved.runtimeMount.localId, projectId: params.projectId },
    );
    return c.json({ url }, 200);
  };
};

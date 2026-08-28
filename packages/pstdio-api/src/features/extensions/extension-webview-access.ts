import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const WEBVIEW_PATH_PREFIX = "/v1/extensions/webviews/";
const READ_ONLY_METHODS = new Set(["GET", "HEAD"]);
const CAPABILITY_PATH = /\/v1\/extensions\/webviews\/[^/\s?#]+/g;

// Artifact URLs are short-lived: report pages re-request a URL from the bridge
// when one expires, so a leaked URL stops working quickly.
const ARTIFACT_URL_TTL_SECONDS = 10 * 60;

export interface ExtensionWebviewScope {
  installName: string;
  webviewId: string;
}

export interface ExtensionWebviewArtifactRequest {
  projectId: string;
  mountId: string;
  artifactPath: string;
}

export type AuthorizedExtensionWebviewRequest =
  | (ExtensionWebviewScope & { kind: "runtime" })
  | (ExtensionWebviewScope & { assetPath: string; kind: "asset" })
  | (ExtensionWebviewScope & ExtensionWebviewArtifactRequest & { kind: "artifact" });

export interface ExtensionWebviewAccess {
  artifactUrl: (scope: ExtensionWebviewScope, request: ExtensionWebviewArtifactRequest) => string;
  assetUrl: (scope: ExtensionWebviewScope, assetPath: string, revision?: string | null) => string;
  authorize: (request: Request) => AuthorizedExtensionWebviewRequest | null;
  redactPath: (path: string) => string;
  runtimeUrl: (scope: ExtensionWebviewScope) => string;
}

export type ExtensionWebviewUrlIssuer = Pick<ExtensionWebviewAccess, "assetUrl" | "runtimeUrl">;

interface CreateExtensionWebviewAccessInput {
  /** Deterministic test seam. Production callers must let the service create its key. */
  signingKey?: Uint8Array;
  /** Deterministic clock seam for artifact URL expiry tests. Returns epoch milliseconds. */
  now?: () => number;
}

const decodeRouteSegment = (segment: string) => {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
};

const capabilityMatches = (candidate: string, expected: string) => {
  const candidateBytes = Buffer.from(candidate);
  const expectedBytes = Buffer.from(expected);
  return candidateBytes.length === expectedBytes.length && timingSafeEqual(candidateBytes, expectedBytes);
};

const encodeAssetPath = (assetPath: string) =>
  assetPath.replace(/^\/+/, "").split("/").map(encodeURIComponent).join("/");

const parseRequestPath = (path: string) => {
  if (!path.startsWith(WEBVIEW_PATH_PREFIX)) return null;

  const [capability, encodedInstallName, encodedWebviewId, resource, ...rest] = path
    .slice(WEBVIEW_PATH_PREFIX.length)
    .split("/");
  if (!capability || !encodedInstallName || !encodedWebviewId || !resource) return null;

  const installName = decodeRouteSegment(encodedInstallName);
  const webviewId = decodeRouteSegment(encodedWebviewId);
  if (!installName || !webviewId) return null;

  return { capability, resource, rest, scope: { installName, webviewId } };
};

export const createExtensionWebviewAccess = (input: CreateExtensionWebviewAccessInput = {}): ExtensionWebviewAccess => {
  const signingKey = Buffer.from(input.signingKey ?? randomBytes(32));
  const now = input.now ?? Date.now;

  const capabilityFor = (scope: ExtensionWebviewScope) =>
    createHmac("sha256", signingKey).update(scope.installName).update("\0").update(scope.webviewId).digest("base64url");

  // Artifact capabilities sign the full grant (mount, path, project, expiry), so a
  // webview asset URL never authorizes artifact reads and the other way around.
  const artifactCapabilityFor = (
    scope: ExtensionWebviewScope,
    request: ExtensionWebviewArtifactRequest,
    expiresAt: number,
  ) =>
    createHmac("sha256", signingKey)
      .update("artifact")
      .update("\0")
      .update(scope.installName)
      .update("\0")
      .update(scope.webviewId)
      .update("\0")
      .update(String(expiresAt))
      .update("\0")
      .update(request.projectId)
      .update("\0")
      .update(request.mountId)
      .update("\0")
      .update(request.artifactPath)
      .digest("base64url");

  const scopePath = (scope: ExtensionWebviewScope) =>
    `${encodeURIComponent(scope.installName)}/${encodeURIComponent(scope.webviewId)}`;

  const basePath = (scope: ExtensionWebviewScope) =>
    `${WEBVIEW_PATH_PREFIX}${capabilityFor(scope)}/${scopePath(scope)}`;

  const authorizeArtifact = (
    capability: string,
    scope: ExtensionWebviewScope,
    segments: string[],
  ): AuthorizedExtensionWebviewRequest | null => {
    const [expiresAtText, encodedProjectId, encodedMountId, ...artifactPathParts] = segments;
    if (!expiresAtText || !encodedProjectId || !encodedMountId || artifactPathParts.length === 0) return null;

    const expiresAt = Number(expiresAtText);
    if (!Number.isInteger(expiresAt)) return null;

    const projectId = decodeRouteSegment(encodedProjectId);
    const mountId = decodeRouteSegment(encodedMountId);
    const artifactPath = decodeRouteSegment(artifactPathParts.join("/"));
    if (!projectId || !mountId || !artifactPath) return null;

    const request = { artifactPath, mountId, projectId };
    if (!capabilityMatches(capability, artifactCapabilityFor(scope, request, expiresAt))) return null;
    if (expiresAt * 1000 <= now()) return null;

    return { ...scope, ...request, kind: "artifact" as const };
  };

  const authorizeAsset = (
    capability: string,
    scope: ExtensionWebviewScope,
    resource: string,
    segments: string[],
  ): AuthorizedExtensionWebviewRequest | null => {
    if (!capabilityMatches(capability, capabilityFor(scope))) return null;

    if (resource === "runtime" && segments.length === 0) {
      return { ...scope, kind: "runtime" as const };
    }
    if (resource !== "assets" || segments.length === 0) return null;

    const assetPath = decodeRouteSegment(segments.join("/"));
    if (!assetPath) return null;
    return { ...scope, assetPath, kind: "asset" as const };
  };

  const authorize = (request: Request) => {
    if (!READ_ONLY_METHODS.has(request.method)) return null;

    const parsed = parseRequestPath(new URL(request.url).pathname);
    if (!parsed) return null;

    if (parsed.resource === "artifacts") return authorizeArtifact(parsed.capability, parsed.scope, parsed.rest);
    return authorizeAsset(parsed.capability, parsed.scope, parsed.resource, parsed.rest);
  };

  return {
    artifactUrl: (scope, request) => {
      const expiresAt = Math.floor(now() / 1000) + ARTIFACT_URL_TTL_SECONDS;
      const capability = artifactCapabilityFor(scope, request, expiresAt);
      const grantPath = `${expiresAt.toString()}/${encodeURIComponent(request.projectId)}/${encodeURIComponent(request.mountId)}`;
      return `${WEBVIEW_PATH_PREFIX}${capability}/${scopePath(scope)}/artifacts/${grantPath}/${encodeAssetPath(request.artifactPath)}`;
    },
    assetUrl: (scope, assetPath, revision) => {
      const url = `${basePath(scope)}/assets/${encodeAssetPath(assetPath)}`;
      return revision ? `${url}?h=${encodeURIComponent(revision)}` : url;
    },
    authorize,
    redactPath: (path) => path.replaceAll(CAPABILITY_PATH, "/v1/extensions/webviews/[Redacted]"),
    runtimeUrl: (scope) => `${basePath(scope)}/runtime`,
  };
};

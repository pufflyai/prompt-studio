import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const WEBVIEW_PATH_PREFIX = "/v1/extensions/webviews/";
const READ_ONLY_METHODS = new Set(["GET", "HEAD"]);
const CAPABILITY_PATH = /\/v1\/extensions\/webviews\/[^/\s?#]+/g;

export interface ExtensionWebviewScope {
  installName: string;
  webviewId: string;
}

export type AuthorizedExtensionWebviewRequest =
  | (ExtensionWebviewScope & { kind: "runtime" })
  | (ExtensionWebviewScope & { assetPath: string; kind: "asset" });

export interface ExtensionWebviewAccess {
  assetUrl: (scope: ExtensionWebviewScope, assetPath: string, revision?: string | null) => string;
  authorize: (request: Request) => AuthorizedExtensionWebviewRequest | null;
  redactPath: (path: string) => string;
  runtimeUrl: (scope: ExtensionWebviewScope) => string;
}

export type ExtensionWebviewUrlIssuer = Pick<ExtensionWebviewAccess, "assetUrl" | "runtimeUrl">;

interface CreateExtensionWebviewAccessInput {
  /** Deterministic test seam. Production callers must let the service create its key. */
  signingKey?: Uint8Array;
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

export const createExtensionWebviewAccess = (input: CreateExtensionWebviewAccessInput = {}): ExtensionWebviewAccess => {
  const signingKey = Buffer.from(input.signingKey ?? randomBytes(32));

  const capabilityFor = (scope: ExtensionWebviewScope) =>
    createHmac("sha256", signingKey).update(scope.installName).update("\0").update(scope.webviewId).digest("base64url");

  const basePath = (scope: ExtensionWebviewScope) =>
    `${WEBVIEW_PATH_PREFIX}${capabilityFor(scope)}/${encodeURIComponent(scope.installName)}/${encodeURIComponent(scope.webviewId)}`;

  const authorize = (request: Request) => {
    if (!READ_ONLY_METHODS.has(request.method)) return null;

    const path = new URL(request.url).pathname;
    if (!path.startsWith(WEBVIEW_PATH_PREFIX)) return null;

    const [capability, encodedInstallName, encodedWebviewId, resource, ...assetPathParts] = path
      .slice(WEBVIEW_PATH_PREFIX.length)
      .split("/");
    if (!capability || !encodedInstallName || !encodedWebviewId || !resource) return null;

    const installName = decodeRouteSegment(encodedInstallName);
    const webviewId = decodeRouteSegment(encodedWebviewId);
    if (!installName || !webviewId) return null;

    const scope = { installName, webviewId };
    if (!capabilityMatches(capability, capabilityFor(scope))) return null;

    if (resource === "runtime" && assetPathParts.length === 0) {
      return { ...scope, kind: "runtime" as const };
    }
    if (resource !== "assets" || assetPathParts.length === 0) return null;

    const assetPath = decodeRouteSegment(assetPathParts.join("/"));
    if (!assetPath) return null;
    return { ...scope, assetPath, kind: "asset" as const };
  };

  return {
    assetUrl: (scope, assetPath, revision) => {
      const url = `${basePath(scope)}/assets/${encodeAssetPath(assetPath)}`;
      return revision ? `${url}?h=${encodeURIComponent(revision)}` : url;
    },
    authorize,
    redactPath: (path) => path.replaceAll(CAPABILITY_PATH, "/v1/extensions/webviews/[Redacted]"),
    runtimeUrl: (scope) => `${basePath(scope)}/runtime`,
  };
};

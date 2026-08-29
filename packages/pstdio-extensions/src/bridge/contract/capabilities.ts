import type { HostCapabilityRequest } from "./index";

export const WEBVIEW_HOST_CAPABILITY_VERSION = 1;

// Capabilities a webview must declare in its manifest before the bridge will route them.
export const WEBVIEW_DECLARABLE_CAPABILITIES = [
  "commands.execute",
  "resource.open",
  "notification.show",
  "notification.action",
  "notification.resolve",
  "notification.dismiss",
  "preferences.get",
  "preferences.set",
  "extension.settings.all",
  "extension.settings.get",
  "extension.settings.set",
  "extension.settings.delete",
  "terminal.session",
  "files.upload",
  "files.list",
  "files.delete",
] as const;

// Capabilities that must be declared with a scope suffix (`name:scope`). Each
// declaration grants one scope; a bare declaration is invalid. For artifacts.read
// the scope is the local id of an artifact mount the extension defines.
export const WEBVIEW_SCOPED_DECLARABLE_CAPABILITIES = ["artifacts.read"] as const;

// Runtime plumbing the guest invokes on its own (e.g. keyboard forwarding). These are
// enabled whenever the host implements them, with no manifest declaration required.
export const ALWAYS_AVAILABLE_WEBVIEW_CAPABILITIES = ["host.dispatchKeyboardEvent"] as const;

export const WEBVIEW_HOST_CAPABILITIES = [
  ...WEBVIEW_DECLARABLE_CAPABILITIES,
  ...WEBVIEW_SCOPED_DECLARABLE_CAPABILITIES,
  ...ALWAYS_AVAILABLE_WEBVIEW_CAPABILITIES,
] as const;

export type WebviewHostCapability = (typeof WEBVIEW_HOST_CAPABILITIES)[number];
export type WebviewDeclarableCapability = (typeof WEBVIEW_DECLARABLE_CAPABILITIES)[number];
export type WebviewScopedDeclarableCapability = (typeof WEBVIEW_SCOPED_DECLARABLE_CAPABILITIES)[number];

export type WebviewCapabilityDiagnosticCode =
  | "undeclared_webview_capability"
  | "unsupported_webview_capability"
  | "unsupported_webview_capability_version";

export interface WebviewCapabilityDiagnostic {
  capability: string;
  code: WebviewCapabilityDiagnosticCode;
  message: string;
  severity: "error";
}

export type HostCapability<TParams = unknown, TResult = unknown> = (params: TParams) => Promise<TResult> | TResult;
export type HostCapabilityRegistry = Partial<Record<WebviewHostCapability, HostCapability>>;

interface CreateHostCapabilityGateInput {
  capabilities: HostCapabilityRegistry;
  declaredCapabilities?: readonly string[];
  onDiagnostic?: (diagnostic: WebviewCapabilityDiagnostic) => void;
}

const publicCapabilityNames = new Set<string>(WEBVIEW_HOST_CAPABILITIES);
const scopedCapabilityNames = new Set<string>(WEBVIEW_SCOPED_DECLARABLE_CAPABILITIES);

const isPublicCapability = (name: string): name is WebviewHostCapability => publicCapabilityNames.has(name);

const isScopedCapability = (name: string): name is WebviewScopedDeclarableCapability => scopedCapabilityNames.has(name);

export const parseWebviewCapabilityDeclaration = (capability: string) => {
  const [nameAndScope = "", versionText] = capability.split("@");
  const scopeIndex = nameAndScope.indexOf(":");
  const name = scopeIndex === -1 ? nameAndScope : nameAndScope.slice(0, scopeIndex);
  const scope = scopeIndex === -1 ? undefined : nameAndScope.slice(scopeIndex + 1);
  const version = versionText === undefined ? WEBVIEW_HOST_CAPABILITY_VERSION : Number(versionText);

  return { capability, name, scope, version };
};

// A scoped capability needs `name:scope`; every other capability must stay bare.
const validateDeclarationShape = (parsed: ReturnType<typeof parseWebviewCapabilityDeclaration>) => {
  if (isScopedCapability(parsed.name)) return Boolean(parsed.scope);
  return parsed.scope === undefined;
};

const unsupportedCapability = (capability: string): WebviewCapabilityDiagnostic => ({
  capability,
  code: "unsupported_webview_capability",
  message: `Unsupported webview capability: ${capability}`,
  severity: "error",
});

const unsupportedVersion = (capability: string, name: string, version: number): WebviewCapabilityDiagnostic => ({
  capability,
  code: "unsupported_webview_capability_version",
  message: `Unsupported webview capability version: ${name}@${version.toString()} (supported: ${WEBVIEW_HOST_CAPABILITY_VERSION.toString()})`,
  severity: "error",
});

const undeclaredCapability = (capability: string): WebviewCapabilityDiagnostic => ({
  capability,
  code: "undeclared_webview_capability",
  message: `Webview did not declare host capability: ${capability}`,
  severity: "error",
});

export const validateWebviewCapabilityDeclarations = (
  declaredCapabilities: readonly string[] | undefined,
  capabilities: HostCapabilityRegistry = {},
) => {
  const diagnostics: WebviewCapabilityDiagnostic[] = [];
  const allowed = new Set<WebviewHostCapability>();
  const allowedScopes = new Map<WebviewHostCapability, Set<string>>();

  // Always-available capabilities never need a declaration — enable them wherever the
  // host implements them.
  for (const name of ALWAYS_AVAILABLE_WEBVIEW_CAPABILITIES) {
    if (capabilities[name]) allowed.add(name);
  }

  for (const declaration of declaredCapabilities ?? []) {
    const parsed = parseWebviewCapabilityDeclaration(declaration);
    if (!isPublicCapability(parsed.name) || !validateDeclarationShape(parsed)) {
      diagnostics.push(unsupportedCapability(declaration));
      continue;
    }
    if (parsed.version !== WEBVIEW_HOST_CAPABILITY_VERSION) {
      diagnostics.push(unsupportedVersion(declaration, parsed.name, parsed.version));
      continue;
    }
    if (!capabilities[parsed.name]) {
      diagnostics.push(unsupportedCapability(declaration));
      continue;
    }
    if (parsed.scope === undefined) {
      allowed.add(parsed.name);
      continue;
    }
    const scopes = allowedScopes.get(parsed.name) ?? new Set<string>();
    scopes.add(parsed.scope);
    allowedScopes.set(parsed.name, scopes);
  }

  return { allowed, allowedScopes, diagnostics };
};

export const validateWebviewCapabilityNames = (declaredCapabilities: readonly string[] | undefined) => {
  const diagnostics: WebviewCapabilityDiagnostic[] = [];

  for (const declaration of declaredCapabilities ?? []) {
    const parsed = parseWebviewCapabilityDeclaration(declaration);
    if (!isPublicCapability(parsed.name) || !validateDeclarationShape(parsed)) {
      diagnostics.push(unsupportedCapability(declaration));
      continue;
    }
    if (parsed.version !== WEBVIEW_HOST_CAPABILITY_VERSION) {
      diagnostics.push(unsupportedVersion(declaration, parsed.name, parsed.version));
    }
  }

  return diagnostics;
};

// Scoped capabilities carry their grant in the params: artifacts.read names the
// mount it reads. The gate compares that value against the declared scopes.
const requestScope = (request: HostCapabilityRequest) => {
  const params = request.params as { mount?: unknown } | undefined;
  return typeof params?.mount === "string" && params.mount.length > 0 ? params.mount : undefined;
};

export const createHostCapabilityGate = (input: CreateHostCapabilityGateInput) => {
  const { allowed, allowedScopes, diagnostics } = validateWebviewCapabilityDeclarations(
    input.declaredCapabilities,
    input.capabilities,
  );

  const emit = (diagnostic: WebviewCapabilityDiagnostic) => {
    input.onDiagnostic?.(diagnostic);
  };

  const deny = (diagnostic: WebviewCapabilityDiagnostic) => {
    emit(diagnostic);
    return new Error(diagnostic.message);
  };

  return {
    diagnostics,

    async call(request: HostCapabilityRequest) {
      if (!isPublicCapability(request.method)) throw deny(unsupportedCapability(request.method));

      if (isScopedCapability(request.method)) {
        const scope = requestScope(request);
        if (!scope) throw deny(unsupportedCapability(request.method));
        // The denial names the exact declaration the webview is missing.
        if (!allowedScopes.get(request.method)?.has(scope)) {
          throw deny(undeclaredCapability(`${request.method}:${scope}`));
        }
      } else if (!allowed.has(request.method)) {
        throw deny(undeclaredCapability(request.method));
      }

      const handler = input.capabilities[request.method];
      if (!handler) throw deny(unsupportedCapability(request.method));

      return await handler(request.params);
    },
  };
};

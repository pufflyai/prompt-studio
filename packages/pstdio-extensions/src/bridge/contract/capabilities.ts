import type { HostCapabilityRequest } from "./index";

export const WEBVIEW_HOST_CAPABILITY_VERSION = 1;

// Capabilities a webview must declare in its manifest before the bridge will route them.
export const WEBVIEW_DECLARABLE_CAPABILITIES = [
  "commands.execute",
  "resource.open",
  "notification.show",
  "preferences.get",
  "preferences.set",
] as const;

// Runtime plumbing the guest invokes on its own (e.g. keyboard forwarding). These are
// enabled whenever the host implements them, with no manifest declaration required.
export const ALWAYS_AVAILABLE_WEBVIEW_CAPABILITIES = ["host.dispatchKeyboardEvent"] as const;

export const WEBVIEW_HOST_CAPABILITIES = [
  ...WEBVIEW_DECLARABLE_CAPABILITIES,
  ...ALWAYS_AVAILABLE_WEBVIEW_CAPABILITIES,
] as const;

export type WebviewHostCapability = (typeof WEBVIEW_HOST_CAPABILITIES)[number];
export type WebviewDeclarableCapability = (typeof WEBVIEW_DECLARABLE_CAPABILITIES)[number];

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

const isPublicCapability = (name: string): name is WebviewHostCapability => publicCapabilityNames.has(name);

const parseCapabilityDeclaration = (capability: string) => {
  const [name, versionText] = capability.split("@");
  const version = versionText === undefined ? WEBVIEW_HOST_CAPABILITY_VERSION : Number(versionText);

  return { capability, name: name ?? "", version };
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

  // Always-available capabilities never need a declaration — enable them wherever the
  // host implements them.
  for (const name of ALWAYS_AVAILABLE_WEBVIEW_CAPABILITIES) {
    if (capabilities[name]) allowed.add(name);
  }

  for (const declaration of declaredCapabilities ?? []) {
    const parsed = parseCapabilityDeclaration(declaration);
    if (!isPublicCapability(parsed.name)) {
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
    allowed.add(parsed.name);
  }

  return { allowed, diagnostics };
};

export const validateWebviewCapabilityNames = (declaredCapabilities: readonly string[] | undefined) => {
  const diagnostics: WebviewCapabilityDiagnostic[] = [];

  for (const declaration of declaredCapabilities ?? []) {
    const parsed = parseCapabilityDeclaration(declaration);
    if (!isPublicCapability(parsed.name)) {
      diagnostics.push(unsupportedCapability(declaration));
      continue;
    }
    if (parsed.version !== WEBVIEW_HOST_CAPABILITY_VERSION) {
      diagnostics.push(unsupportedVersion(declaration, parsed.name, parsed.version));
    }
  }

  return diagnostics;
};

export const createHostCapabilityGate = (input: CreateHostCapabilityGateInput) => {
  const { allowed, diagnostics } = validateWebviewCapabilityDeclarations(
    input.declaredCapabilities,
    input.capabilities,
  );

  const emit = (diagnostic: WebviewCapabilityDiagnostic) => {
    input.onDiagnostic?.(diagnostic);
  };

  return {
    diagnostics,

    async call(request: HostCapabilityRequest) {
      if (!isPublicCapability(request.method)) {
        const diagnostic = unsupportedCapability(request.method);
        emit(diagnostic);
        throw new Error(diagnostic.message);
      }
      if (!allowed.has(request.method)) {
        const diagnostic = undeclaredCapability(request.method);
        emit(diagnostic);
        throw new Error(diagnostic.message);
      }

      const handler = input.capabilities[request.method];
      if (!handler) {
        const diagnostic = unsupportedCapability(request.method);
        emit(diagnostic);
        throw new Error(diagnostic.message);
      }

      return await handler(request.params);
    },
  };
};

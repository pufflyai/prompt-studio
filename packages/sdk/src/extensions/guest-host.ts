import type {
  WebviewHostCapability,
  WebviewHostCapabilityParams,
  WebviewHostCapabilityResult,
} from "pstdio-api-contracts/extension-kernel";

export interface GuestHost {
  call<
    Capability extends WebviewHostCapability,
    const Params extends WebviewHostCapabilityParams[Capability] = WebviewHostCapabilityParams[Capability],
  >(
    method: Capability,
    ...args: {} extends WebviewHostCapabilityParams[Capability] ? [params?: Params] : [params: Params]
  ): Promise<WebviewHostCapabilityResult<Capability, Params>>;
  onEvent(scope: string, handler: (payload: unknown) => void): () => void;
  /** The extension that owns this webview. */
  extensionId?: string;
}

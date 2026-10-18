import type {
  WebviewHostCapability,
  WebviewHostCapabilityParams,
  WebviewHostCapabilityResult,
  WebviewHostProps,
} from "pstdio-api-contracts/extension-kernel";
import type { PropsStore } from "./webview-props-store";

export interface GuestHost {
  /** Current host context. Supplied by the webview runtime. */
  propsStore?: PropsStore<WebviewHostProps>;
  call<
    Capability extends WebviewHostCapability,
    const Params extends WebviewHostCapabilityParams[Capability] = WebviewHostCapabilityParams[Capability],
  >(
    method: Capability,
    ...args: Record<string, never> extends WebviewHostCapabilityParams[Capability]
      ? [params?: Params]
      : [params: Params]
  ): Promise<WebviewHostCapabilityResult<Capability, Params>>;
  onEvent(scope: string, handler: (payload: unknown) => void): () => void;
  /** The extension that owns this webview. */
  extensionId?: string;
}

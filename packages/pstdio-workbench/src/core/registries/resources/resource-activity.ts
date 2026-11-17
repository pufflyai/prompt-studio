import type { ResourceActivityApi, ResourceActivityCapabilities, ResourceRef } from "@pstdio/sdk/extensions";
export interface ActivityTarget {
  harnessId: string;
  modelId: string;
  label: string;
}
export interface ResourceActivityBinding {
  capabilities: ResourceActivityCapabilities;
  api: ResourceActivityApi;
  watch(resource: ResourceRef, input: { signal: AbortSignal; onChange(): void; onReady?(): void }): Promise<void>;
  targets?(): Promise<ActivityTarget[]>;
}

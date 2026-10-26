import { type createResourceCoordinator, extensionResources, type ResourceCost } from "./resource-coordinator";

export type ExtensionResourceCoordinator = ReturnType<typeof createResourceCoordinator>;
export const extensionWorkCosts = {
  initialization: { cpu: 1, memory: 64 },
  invocation: { cpu: 1, memory: 16 },
  preparation: { cpu: 1, memory: 64 },
  compiler: { cpu: 2, memory: 320 },
} satisfies Record<string, ResourceCost>;

// The measured four-compiler comparison stays separate from admission-policy calibration.
export const selectExtensionResources = (override?: ExtensionResourceCoordinator) =>
  override ??
  (process.env.PSTDIO_EXTENSION_PROCESS_OWNERS === "1" && process.env.PSTDIO_EXTENSION_RESOURCE_ADMISSION === "1"
    ? extensionResources
    : undefined);

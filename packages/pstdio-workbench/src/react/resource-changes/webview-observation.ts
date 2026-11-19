import { resourceKey } from "@pstdio/sdk/extensions";
import type { ExtensionFrameProps } from "pstdio-extensions/bridge/host";
import { useState } from "react";
import type { WorkbenchCore } from "../../core";
import { parseWebviewCapabilityParams } from "../../extensions/bridge/webview-capability-params";
import { useObservedResource } from "./activity-dot";

export const useWebviewObservation = (
  workbench: WorkbenchCore | undefined,
  resource: ExtensionFrameProps["props"]["resource"],
  capabilities: ExtensionFrameProps["capabilities"],
  visible: boolean,
) => {
  const [observation, setObservation] = useState<{ key: string; receipt: string | null }>();
  const key = resourceKey(resource);
  useObservedResource(workbench, resource, key === observation?.key ? observation?.receipt : undefined, visible);
  return {
    ...capabilities,
    "resources.changes.observed": (value: unknown) => {
      const { receipt } = parseWebviewCapabilityParams("resources.changes.observed", value);
      if (key) setObservation({ key, receipt });
    },
  };
};

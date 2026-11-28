import type { PlacementIdentity } from "@pstdio/sdk/extensions";
import { useEffect, useState } from "react";
import type { WorkbenchCore } from "../../../core";
import { currentViewerSource } from "../../../core/controllers/resource-viewers/viewer-source";
import { placementIdentityKey } from "../../../core/registries/layout/placement-reconciliation";

interface NativeChatTranscriptOptions {
  workbench?: WorkbenchCore;
  placementOpen?: boolean;
  placementSelected?: boolean;
  sourcePlacement?: PlacementIdentity;
}

export const useNativeChatTranscript = (props: NativeChatTranscriptOptions) => {
  const { workbench, sourcePlacement } = props;
  const active = props.placementOpen !== false && props.placementSelected !== false;
  const [transcript, setTranscript] = useState({ active, revision: 0 });
  if (transcript.active !== active) {
    // Retained sessions start at the tail when opened or selected again.
    setTranscript({ active, revision: transcript.revision + Number(active) });
  }
  useEffect(() => {
    if (!workbench || !sourcePlacement || !active) return;
    // Explicit navigation can reopen an already-selected viewer, including a hidden panel.
    const subscription = workbench.navigation.onDidOpenTarget((target, context) => {
      // A viewer target replaces only its caller. A sent draft that moved into its session page continues its transcript.
      if (
        target.kind === "viewer" &&
        (!context?.viewer || placementIdentityKey(context.viewer) !== placementIdentityKey(sourcePlacement))
      )
        return;
      const viewer = currentViewerSource(workbench, sourcePlacement);
      if (!viewer?.resource) return;
      const selected =
        workbench.pages.getContent()?.widgetId === viewer.widget.widgetId ||
        workbench.layout.getLayout().regions[viewer.region].activeWidgetId === viewer.widget.widgetId;
      if (!selected) return;
      const key = workbench.pages.resourceReferenceKey(viewer.resource);
      const targets = target.kind === "compound" ? target.targets : [target];
      const opened = targets.some(
        (item) =>
          (item.kind === "page" || item.kind === "panel" || item.kind === "viewer") &&
          item.resource &&
          workbench.pages.resourceReferenceKey(item.resource) === key &&
          (item.kind !== "viewer" && item.region
            ? item.region === viewer.region
            : workbench.focus.getActiveRegion() === viewer.region),
      );
      if (opened) setTranscript((current) => ({ ...current, revision: current.revision + 1 }));
    });
    return () => subscription.dispose();
  }, [active, sourcePlacement, workbench]);
  return transcript.revision;
};

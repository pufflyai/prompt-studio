import type { PlacementIdentity } from "@pstdio/sdk/extensions";
import { useEffect, useState } from "react";
import type { WorkbenchCore } from "../../../core";
import { currentViewerSource } from "../../../core/controllers/resource-viewers/viewer-source";

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
    const subscription = workbench.navigation.onDidOpenTarget((target) => {
      const viewer = currentViewerSource(workbench, sourcePlacement);
      if (!viewer?.resource) return;
      const selected =
        workbench.pages.getContent()?.widgetId === viewer.widget.widgetId ||
        workbench.layout.getLayout().regions[viewer.region].activeWidgetId === viewer.widget.widgetId;
      if (!selected) return;
      const key = workbench.pages.resourceReferenceKey(viewer.resource);
      const targets = target.kind === "compound" ? target.targets : [target];
      // A draft confirmation replaces its resource without reopening the visible transcript.
      const opened = targets.some(
        (item) =>
          (item.kind === "page" || item.kind === "panel" || (item.kind === "viewer" && item.operation !== "replace")) &&
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

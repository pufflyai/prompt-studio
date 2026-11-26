import type { ResourceRef } from "@pstdio/sdk/extensions";
import { useEffect, useState } from "react";
import type { WorkbenchModuleContext, WorkbenchPanelRegion } from "../../../core";

interface NativeChatTranscriptOptions {
  workbench?: WorkbenchModuleContext;
  resource?: ResourceRef;
  placementOpen?: boolean;
  placementSelected?: boolean;
  sourceRegion?: () => WorkbenchPanelRegion | undefined;
}

export const useNativeChatTranscript = (props: NativeChatTranscriptOptions) => {
  const { workbench, resource, sourceRegion } = props;
  const active = props.placementOpen !== false && props.placementSelected !== false;
  const [transcript, setTranscript] = useState({ active, revision: 0 });
  if (transcript.active !== active) {
    // Retained sessions start at the tail when opened or selected again.
    setTranscript({ active, revision: transcript.revision + Number(active) });
  }
  const key = resource && workbench?.pages.resourceReferenceKey(resource);
  useEffect(() => {
    if (!workbench || !key || !active || !sourceRegion) return;
    // Explicit navigation can reopen an already-selected viewer, including a hidden panel.
    const subscription = workbench.navigation.onDidOpenTarget((target) => {
      const region = sourceRegion();
      if (!region || workbench.focus.getActiveRegion() !== region) return;
      const targets = target.kind === "compound" ? target.targets : [target];
      const opened = targets.some(
        (item) =>
          (item.kind === "page" || item.kind === "panel" || item.kind === "viewer") &&
          item.resource &&
          workbench.pages.resourceReferenceKey(item.resource) === key,
      );
      if (opened) setTranscript((current) => ({ ...current, revision: current.revision + 1 }));
    });
    return () => subscription.dispose();
  }, [active, key, sourceRegion, workbench]);
  return transcript.revision;
};

import type { ResourceRef } from "@pstdio/sdk/extensions";
import type { MarkdownSelectionAnchor } from "@pstdio/ui/rich-text";
import { useEffect, useState } from "react";
import type { WorkbenchCore, WorkbenchPanelInstance } from "../../core";
import { openOwnedViewMenu } from "../../core/controllers/panel-menus/open-view-menu";

type Reveal = (anchor: MarkdownSelectionAnchor) => boolean;
const editors = new WeakMap<WorkbenchCore, Map<string, Reveal>>();

export const revealActivityPassage = (
  workbench: WorkbenchCore,
  owner: string | undefined,
  passage: Parameters<Reveal>[0] & { document: string },
) => Boolean(owner && editors.get(workbench)?.get(JSON.stringify([owner, passage.document]))?.(passage));

export const useMarkdownActivity = (
  workbench: WorkbenchCore,
  placement: WorkbenchPanelInstance | undefined,
  document: string,
  shared: boolean,
) => {
  const resource = placement?.resource;
  const viewId = placement?.viewId;
  const owner = placement?.instanceId;
  const menu =
    viewId &&
    workbench.viewMenus.listViewMenus().find((menu) => menu.ownerViewId === viewId && menu.purpose === "activity");
  const activity = shared && resource && workbench.resources.getKind(resource.type, resource.extensionId)?.activity;
  const [allowed, setAllowed] = useState<ResourceRef>();
  useEffect(() => {
    if (!activity || !menu || !resource) return;
    let current = true;
    void activity.api.capabilities(resource).then(
      (capabilities) => {
        if (current) setAllowed(capabilities?.comments ? resource : undefined);
      },
      () => {
        if (current) setAllowed(undefined);
      },
    );
    return () => {
      current = false;
    };
  }, [activity, menu, resource]);

  if (!owner || !menu || !activity || !resource || allowed !== resource) return;
  const key = JSON.stringify([owner, document]);
  return {
    async publish(input: { body: string; key: string; quote: string; anchor: MarkdownSelectionAnchor }) {
      await activity.api.publish(resource, {
        kind: "comment",
        key: input.key,
        body: input.body,
        quote: input.quote,
        passage: { document, ...input.anchor },
        attachmentIds: [],
      });
      openOwnedViewMenu(workbench, owner, menu.id);
    },
    registerReveal(reveal: Reveal) {
      let views = editors.get(workbench);
      if (!views) {
        views = new Map();
        editors.set(workbench, views);
      }
      views.set(key, reveal);
      return () => {
        if (views.get(key) === reveal) views.delete(key);
      };
    },
  };
};

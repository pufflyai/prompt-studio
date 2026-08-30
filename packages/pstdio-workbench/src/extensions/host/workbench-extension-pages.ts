import { text } from "pstdio-extensions/workbench";
import type { Disposable } from "../../core";
import type { InternalRegisterWorkbenchExtensionContributionsInput } from "./workbench-extension-host-types";
import { metadataRefId } from "./workbench-extension-metadata-ref";

// Registers an extension's pages with the workbench page registry. A page's URL is
// namespaced by its extension id (`/projects/{project}/{extension-id}/{path}`), so
// cross-extension collisions are unrepresentable; host pages own the reserved
// un-prefixed segments and register through the app, not here.
export const registerPages = (input: InternalRegisterWorkbenchExtensionContributionsInput): Disposable[] =>
  (input.metadata.pages ?? []).map((page) =>
    input.workbench.pages.registry.registerPage({
      id: page.id,
      extensionId: page.extensionId,
      title: text(page.title, page.id),
      icon: page.icon,
      urlPath: page.path === undefined ? undefined : `${page.extensionId}/${page.path}`,
      slots: page.slots.map((slot) => ({
        id: slot.id,
        region: slot.region,
        panelId: slot.view ? metadataRefId(slot.view) : undefined,
        cardinality: slot.cardinality,
        closable: slot.closable,
        defaultOpen: slot.defaultOpen,
        scope: slot.scope,
        follows: slot.follows,
        order: slot.order,
      })),
      bindings: (page.bindings ?? []).map((binding) => ({
        kind: binding.resourceKind.id,
        panelId: metadataRefId(binding.view),
        slot: binding.slot,
      })),
    }),
  );

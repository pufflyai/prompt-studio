import { expect, test } from "bun:test";
import { createWorkbench, workbenchCommandPaletteMenuPath } from "../../core";
import { createWorkbenchCommandPaletteEntries } from "../command-palette/command-palette";
import { createWorkbenchResourceLinksModule, resourceLinksCommandId } from "./resource-links-module";

test("the related resource picker is reachable from commands for the current resource", async () => {
  const workbench = createWorkbench();
  const resource = { type: "session", id: "session", projectId: "project", extensionId: "pstdio" };
  workbench.getPrimaryResource = () => ({ ...resource, type: "ticket", id: "main-ticket" });
  workbench.getActiveResource = () => resource;
  workbench.registerModule(
    createWorkbenchResourceLinksModule({
      canonicalize: (ref) => ref,
      createService: () => {
        throw new Error("Opening the overlay does not render its service yet");
      },
    }),
  );
  const entries = createWorkbenchCommandPaletteEntries({
    workbench,
    menuPath: workbenchCommandPaletteMenuPath,
    onClose: () => undefined,
  });
  expect(entries.some((entry) => entry.commandId === resourceLinksCommandId)).toBe(true);
  entries.find((entry) => entry.commandId === resourceLinksCommandId)?.onActivate?.();
  await Promise.resolve();
  expect(workbench.layout.getLayout().regions.overlay.widgets[0]?.resource).toEqual(resource);
  const explicit = { ...resource, id: "explicit-row" };
  await workbench.commands.executeCommand(resourceLinksCommandId, undefined, { resource: explicit });
  expect(workbench.layout.getLayout().regions.overlay.widgets.at(-1)?.resource).toEqual(explicit);
});

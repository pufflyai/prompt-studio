import { expect, test } from "bun:test";
import { createWorkbench, workbenchCommandPaletteMenuPath, workbenchTopHeaderTrailingMenuPath } from "../../core";
import { createWorkbenchCommandPaletteEntries } from "../command-palette/command-palette";
import { listWorkbenchMenuItems } from "../menus/menu-items";
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

test("the session header opens the focused session's related resources and toggles it closed", async () => {
  const workbench = createWorkbench();
  const session = { type: "session", id: "side-session", projectId: "project", extensionId: "pstdio" };
  const ticket = { ...session, type: "ticket", id: "main-ticket" };
  let active = session;
  workbench.getPrimaryResource = () => ticket;
  workbench.getActiveResource = () => active;
  workbench.registerModule(
    createWorkbenchResourceLinksModule({
      canonicalize: (resource) => resource,
      createService: () => {
        throw new Error("Not rendered");
      },
    }),
  );
  const header = () => listWorkbenchMenuItems(workbench, workbenchTopHeaderTrailingMenuPath, { resource: ticket });
  const button = header().find((item) => item.commandId === resourceLinksCommandId);
  expect(button).toBeDefined();
  if (!button) return;
  await workbench.commands.executeCommand(button.commandId, button.args, { resource: ticket });
  expect(workbench.layout.getLayout().regions.overlay.widgets.at(-1)?.resource).toEqual(session);
  await workbench.commands.executeCommand(button.commandId, button.args, { resource: ticket });
  expect(workbench.layout.getLayout().regions.overlay.widgets).toHaveLength(0);
  active = ticket;
  expect(header()).toHaveLength(0);
  workbench.dispose();
});

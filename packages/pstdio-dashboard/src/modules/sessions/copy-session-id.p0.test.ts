import { expect, test } from "bun:test";
import { createWorkbench, resourceContextMenuPath } from "@pstdio/workbench";
import { createSessionsModule } from "./module";

test("copy session ID preserves the full invoking ID and honors explicit targets", async () => {
  const workbench = createWorkbench();
  workbench.registerModule(createSessionsModule());
  const commandId = "dashboard.copySessionId";
  const sessionId = "019a6810-f835-7000-8000-000000000001";
  const previous = Object.getOwnPropertyDescriptor(navigator, "clipboard");
  const copied: string[] = [];
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: async (value: string) => {
        copied.push(value);
      },
    },
  });
  const context = { resource: { type: "session", id: sessionId, metadata: { status: "failed" } } };
  try {
    const action = workbench.layout
      .listMenuItems(resourceContextMenuPath("session"))
      .find((item) => item.commandId === commandId);
    expect(action).toBeDefined();
    workbench.context.set("workbench.resource.type", "session");
    workbench.context.set("workbench.resource.metadata.status", "failed");
    expect(workbench.context.matches(action?.when)).toBe(true);
    const location = workbench.pages.store.getState().location;
    expect(await workbench.commands.prepareCommandArgs(commandId, undefined, context)).toEqual({ sessionId });
    await workbench.commands.executeCommand(commandId, undefined, context);
    await workbench.commands.executeCommand(commandId, { sessionId: "explicit-session" }, context);
    expect(copied).toEqual([sessionId, "explicit-session"]);
    expect(workbench.pages.store.getState().location).toBe(location);
    await expect(
      workbench.commands.executeCommand(commandId, undefined, {
        resource: { type: "session-draft", id: "draft" },
      }),
    ).rejects.toThrow("Choose a saved session first.");
    expect(copied).toHaveLength(2);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error("Clipboard permission denied");
        },
      },
    });
    await expect(workbench.commands.executeCommand(commandId, undefined, context)).rejects.toThrow(
      "Clipboard permission denied",
    );
  } finally {
    if (previous) Object.defineProperty(navigator, "clipboard", previous);
    else Reflect.deleteProperty(navigator, "clipboard");
    workbench.dispose();
  }
});

import { describe, expect, test } from "bun:test";
import { createContextKeyService } from "../../shared/context/context-key-service";
import { createCommandRegistry } from "./command-registry";

describe("createCommandRegistry", () => {
  test("executes registered commands and exposes contribution metadata", async () => {
    const commands = createCommandRegistry();

    commands.registerCommand(
      {
        id: "sessions.open",
        label: "Open Session",
        category: "Sessions",
      },
      {
        execute: async (args: { id: string }) => `opened:${args.id}`,
        isEnabled: (args: { id: string }) => args.id.length > 0,
        isVisible: (args: { id: string }) => args.id !== "hidden",
      },
      { source: "module", ownerId: "pstdio.sessions", priority: 10 },
    );

    await expect(commands.executeCommand("sessions.open", { id: "abc" })).resolves.toBe("opened:abc");
    expect(commands.isCommandEnabled("sessions.open", { id: "" })).toBe(false);
    expect(commands.isCommandVisible("sessions.open", { id: "hidden" })).toBe(false);
    expect(commands.getCommand("sessions.open")).toMatchObject({
      command: { id: "sessions.open", label: "Open Session" },
      ownerId: "pstdio.sessions",
      source: "module",
    });
  });

  test("rejects duplicate command ids until a registration is disposed", async () => {
    const commands = createCommandRegistry();
    const first = commands.registerCommand({ id: "resource.open", label: "Open Resource" }, { execute: () => "first" });

    expect(() =>
      commands.registerCommand({ id: "resource.open", label: "Open Resource Again" }, { execute: () => "second" }),
    ).toThrow("Command already registered: resource.open");

    first.dispose();

    commands.registerCommand({ id: "resource.open", label: "Open Resource Again" }, { execute: () => "second" });
    await expect(commands.executeCommand("resource.open")).resolves.toBe("second");
  });

  test("filters command visibility through context keys", () => {
    const context = createContextKeyService();
    const commands = createCommandRegistry({ context });

    commands.registerCommand(
      { id: "project.close", label: "Close Project", when: "activeWorkbenchMode == project && !inputFocus" },
      { execute: () => undefined },
    );

    context.set("activeWorkbenchMode", "project");
    context.set("inputFocus", true);
    expect(commands.isCommandVisible("project.close")).toBe(false);

    context.set("inputFocus", false);
    expect(commands.isCommandVisible("project.close")).toBe(true);
  });
});

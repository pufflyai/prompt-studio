import { describe, expect, test } from "bun:test";
import { createNavigationRegistry, type NavigationDispatcherContext } from "./navigation-registry";

const page = { extensionId: "acme.planner", kind: "page" as const, id: "tickets" };
const panel = { extensionId: "acme.planner", kind: "page-slot" as const, page, id: "details" };

describe("createNavigationRegistry", () => {
  test("parses and opens an explicit page target", async () => {
    const calls: unknown[] = [];
    const dispatcher: NavigationDispatcherContext = {
      openPageTarget: (target) => calls.push(target),
      executeCommand: () => undefined,
    };
    const navigation = createNavigationRegistry({ resolveDispatcher: () => dispatcher });
    navigation.registerParser({
      id: "tickets",
      canParse: (location) => location === "/tickets",
      parse: () => ({ kind: "page", page }),
    });

    await navigation.navigate("/tickets");

    expect(calls).toEqual([{ kind: "page", page }]);
  });

  test("rolls back a compound target when a later item fails", async () => {
    const calls: string[] = [];
    const navigation = createNavigationRegistry({
      resolveDispatcher: () => ({
        canOpenPanel: () => true,
        canExecuteCommand: () => true,
        createCheckpoint: () => () => calls.splice(0),
        openPanelTarget: () => calls.push("panel"),
        executeCommand: () => {
          calls.push("command");
          throw new Error("boom");
        },
      }),
    });

    await expect(
      navigation.openTarget({
        kind: "compound",
        targets: [
          { kind: "panel", panel },
          { kind: "command", commandId: "boom" },
        ],
      }),
    ).rejects.toThrow("boom");
    expect(calls).toEqual([]);
  });

  test("rejects an unavailable panel before dispatching earlier items", async () => {
    const calls: string[] = [];
    const navigation = createNavigationRegistry({
      resolveDispatcher: () => ({
        canOpenPanel: () => false,
        openPageTarget: () => calls.push("page"),
        openPanelTarget: () => calls.push("panel"),
        executeCommand: () => undefined,
      }),
    });

    await expect(
      navigation.openTarget({
        kind: "compound",
        targets: [
          { kind: "page", page },
          { kind: "panel", panel },
        ],
      }),
    ).rejects.toThrow("Cannot open navigation panel target: details");
    expect(calls).toEqual([]);
  });

  test("throws when no parser handles a location", () => {
    const navigation = createNavigationRegistry();
    expect(() => navigation.resolveLocation("/missing")).toThrow("No navigation parser registered");
  });
});

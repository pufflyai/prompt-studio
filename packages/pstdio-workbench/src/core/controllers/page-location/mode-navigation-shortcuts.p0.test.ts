import { expect, test } from "bun:test";
import { createWorkbench } from "../../workbench-core";

const commandId = "workbench.action.navigateToRootLevel";
const fixture = (label = "Project") => {
  const page = (id: string) => ({ kind: "page" as const, extensionId: "test", id });
  const core = createWorkbench({ startPage: page("home") });
  core.modes.registerMode({ id: "project", label, activate() {} });
  core.views.registerView({ id: "content", title: "Content", body: { kind: "react", render: () => null } });
  for (const id of ["home", "tickets", "ticket", "sessions"]) {
    core.pages.registerPage({
      id,
      ref: page(id),
      path: id,
      modeId: "project",
      main: { kind: "view", view: { kind: "view", id: "content" }, cardinality: "one" },
      slots: [],
    });
  }
  for (const id of ["ticket", "sessions"]) {
    core.navigationTrees.registerContribution({
      id: `${id}-navigation`,
      owner: page(id),
      sourceExtensionId: "test",
      declarationIndex: 0,
      getSections: () => [],
    });
  }
  core.pageLocations.setProject("p1");
  const navigate = (id: string) => expect(core.pageLocations.navigate({ kind: "page", page: page(id) }).ok).toBe(true);
  const direct = () => core.keyboard.catalog(true).find((entry) => entry.binding.keybinding === "Alt+Shift+ArrowUp");
  return { core, navigate, direct };
};

test.each(["ticket", "sessions"])("the mode return chord leaves %s navigation for the last root page", async (id) => {
  const { core, navigate, direct } = fixture();
  navigate("tickets");
  navigate(id);
  const shortcut = direct();
  expect(shortcut).toBeDefined();
  expect(shortcut?.disabled).toBe(false);
  await core.keyboard.invoke(shortcut!.id);
  expect(core.pages.store.getState().activePageId).toBe("tickets");
  expect(direct()?.disabled).toBe(true);
});

test("Go to mode navigation skips nested levels and keeps keyboard mode active", async () => {
  const { core, navigate } = fixture();
  navigate("tickets");
  navigate("ticket");
  navigate("sessions");
  core.keyboard.open();
  await core.keyboard.press("g");
  await core.keyboard.press("p");
  expect(core.pages.store.getState().activePageId).toBe("tickets");
  expect(core.keyboard.store.getState().active).toBe(true);
});

test("mode return uses Home when a nested page was opened first", async () => {
  const { core, navigate } = fixture();
  navigate("sessions");
  core.keyboard.open();
  await core.keyboard.press("g");
  await core.keyboard.press("p");
  expect(core.pages.store.getState().activePageId).toBe("home");
});

test("mode return names the active mode and leaves direct editor chords alone", () => {
  const { core, navigate, direct } = fixture("Workspace");
  navigate("sessions");
  expect(direct()?.label).toBe("Back to workspace");
  core.context.set("inputFocus", true);
  expect(direct()?.disabled).toBe(true);
  const layered = core.keyboard
    .catalog()
    .find(
      (entry) =>
        entry.binding.layer === "go" &&
        entry.binding.action.kind === "command" &&
        entry.binding.action.commandId === commandId,
    );
  expect(layered?.disabled).toBe(false);
});

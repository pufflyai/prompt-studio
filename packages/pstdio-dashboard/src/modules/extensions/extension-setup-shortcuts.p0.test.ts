import { expect, test } from "bun:test";
import { createWorkbench } from "@pstdio/workbench";
import { dashboardCommandIds } from "@/shared/app/commands";
import { registerExtensionSetupShortcuts } from "./extension-setup-shortcuts";

test("shared setup shortcuts follow public contribution metadata and disappear on unload", async () => {
  const core = createWorkbench();
  let created: unknown;
  core.commands.registerCommand(
    { id: dashboardCommandIds.createSession, label: "New session" },
    {
      execute(args) {
        created = args;
      },
    },
  );
  core.commands.registerCommand({ id: "workbench.settings.open", label: "Settings" }, { execute() {} });
  const dispose = registerExtensionSetupShortcuts(core, {
    extensions: [
      { id: "acme.worker", name: "worker", displayName: "Worker", sourcePath: "" },
      { id: "acme.skills", name: "skills", displayName: "Skills", sourcePath: "" },
    ],
    harnesses: [
      { extensionId: "acme.worker", localId: "helper", id: "arbitrary.harness-id", label: "Worker" },
      { extensionId: "acme.worker", localId: "review", id: "another.id", label: "Reviewer" },
    ],
    skills: [{ extensionId: "acme.skills", localId: "build", id: "build" }],
    themes: [],
  });
  const shortcut = core.keyboard
    .catalog()
    .find((entry) => entry.binding.sourceExtensionId === "acme.worker" && entry.binding.layer === "create")!;
  await core.keyboard.invoke(shortcut.id);
  expect(created).toEqual({ harnessId: "arbitrary.harness-id" });
  expect(
    core.keyboard
      .catalog()
      .filter((entry) => entry.binding.sourceExtensionId === "acme.worker" && entry.binding.layer === "create")
      .map((entry) => entry.binding.label),
  ).toEqual(["New session with Worker (helper)", "New session with Reviewer (review)"]);
  expect(
    core.keyboard.catalog().find((entry) => entry.binding.id === "acme.worker.setup.configure-arbitrary.harness-id")
      ?.binding.action,
  ).toMatchObject({ args: { panelId: "runtime" } });
  expect(core.keyboard.catalog().some((entry) => entry.binding.sourceExtensionId === "acme.skills")).toBe(true);
  for (const registration of dispose) registration.dispose();
  expect(core.keyboard.catalog().some((entry) => entry.binding.sourceExtensionId === "acme.worker")).toBe(false);
});

test("session creation is grouped under C S and a provider is chosen by number", async () => {
  const core = createWorkbench();
  let created: unknown;
  core.commands.registerCommand(
    { id: dashboardCommandIds.createSession, label: "New session" },
    {
      execute: (args) => {
        created = args;
      },
    },
  );
  const registrations = registerExtensionSetupShortcuts(core, {
    extensions: [{ id: "agents", name: "agents", displayName: "Agents", sourcePath: "" }],
    harnesses: [
      { extensionId: "agents", localId: "codex", id: "codex", label: "Codex" },
      { extensionId: "agents", localId: "claude", id: "claude", label: "Claude Code" },
    ],
    themes: [],
    skills: [],
  });
  core.keyboard.open();
  await core.keyboard.press("c");
  await core.keyboard.press("s");
  const choice = core.keyboard.store.getState().selection?.choices.find((item) => item.label.includes("Codex"));
  expect(choice).toBeDefined();
  await core.keyboard.press(choice!.key);
  expect(created).toEqual({ harnessId: "codex" });
  for (const registration of registrations) registration.dispose();
});

test("all color theme providers share one Settings T shortcut", () => {
  const core = createWorkbench();
  registerExtensionSetupShortcuts(core, {
    extensions: [
      { id: "themes-a", name: "themes-a", displayName: "Themes A", sourcePath: "" },
      { id: "themes-b", name: "themes-b", displayName: "Themes B", sourcePath: "" },
    ],
    themes: [
      { extensionId: "themes-a", localId: "dark", id: "dark" },
      { extensionId: "themes-b", localId: "light", id: "light" },
    ],
    harnesses: [],
    skills: [],
  });
  const shortcuts = core.keyboard
    .catalog()
    .filter(
      (entry) =>
        entry.binding.action.kind === "command" && entry.binding.action.commandId === "workbench.action.changeTheme",
    );
  expect(shortcuts).toHaveLength(1);
  expect(shortcuts[0]?.keys).toEqual(["S", "T"]);
});

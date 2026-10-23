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
    .find((entry) => entry.binding.sourceExtensionId === "acme.worker" && entry.binding.keybinding === "N")!;
  await core.keyboard.invoke(shortcut.id);
  expect(created).toEqual({ harnessId: "arbitrary.harness-id" });
  expect(
    core.keyboard
      .catalog()
      .filter((entry) => entry.binding.sourceExtensionId === "acme.worker" && entry.binding.keybinding === "N")
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

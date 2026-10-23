import type { Disposable, Keybinding, WorkbenchModuleContributionContext } from "@pstdio/workbench";
import { WORKBENCH_SETTINGS_OPEN_COMMAND_ID } from "@pstdio/workbench/react";
import { dashboardCommandIds } from "@/shared/app/commands";
import type { ResolvedWorkbenchExtensionMetadata } from "@/shared/extensions/extension-localization";

type SetupMetadata = Pick<ResolvedWorkbenchExtensionMetadata, "extensions" | "harnesses" | "themes" | "skills">;

export const registerExtensionSetupShortcuts = (core: WorkbenchModuleContributionContext, metadata: SetupMetadata) => {
  const registrations: Disposable[] = [];
  const labels = new Map(
    metadata.extensions.map((extension) => [extension.id, extension.displayName || extension.name]),
  );
  const register = (extensionId: string, id: string, key: string, label: string, action: Keybinding["action"]) => {
    if (action.kind === "command" && !core.commands.getCommand(action.commandId)) return;
    registrations.push(
      core.keybindings.registerKeybinding({
        id: `${extensionId}.setup.${id}`,
        label,
        sourceExtensionId: extensionId,
        sourceExtensionLabel: labels.get(extensionId),
        layer: "extensions",
        keybinding: key,
        action,
      }),
    );
  };
  const settings = (panelId: string) => ({
    kind: "command" as const,
    commandId: WORKBENCH_SETTINGS_OPEN_COMMAND_ID,
    args: { panelId },
  });
  for (const extension of metadata.extensions)
    register(extension.id, "settings", "K", "Extension settings", settings("extensions"));
  for (const harness of metadata.harnesses ?? []) {
    const label = harness.label ?? harness.localId;
    const multiple = metadata.harnesses!.filter((entry) => entry.extensionId === harness.extensionId).length > 1;
    const title = multiple ? `${label} (${harness.localId})` : label;
    register(harness.extensionId, `new-${harness.id}`, "N", `New session with ${title}`, {
      kind: "command",
      commandId: dashboardCommandIds.createSession,
      args: { harnessId: harness.id },
    });
    register(harness.extensionId, `configure-${harness.id}`, "S", "Configure agent", settings("runtime"));
  }
  const skillOwners = new Set((metadata.skills ?? []).map((skill) => skill.extensionId));
  for (const extensionId of skillOwners) {
    register(extensionId, "skills", "O", "Inspect contributed skills", settings("skills"));
    register(extensionId, "skill-setup", "I", "Set up agent skills", settings("runtime"));
  }
  const themeOwners = new Set((metadata.themes ?? []).map((theme) => theme.extensionId));
  for (const extensionId of themeOwners) {
    register(extensionId, "theme", "T", "Choose color theme", {
      kind: "command",
      commandId: "workbench.action.changeTheme",
    });
    register(extensionId, "icons", "I", "Choose file icon theme", settings("appearance"));
  }
  return registrations;
};

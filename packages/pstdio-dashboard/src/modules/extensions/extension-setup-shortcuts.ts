import type { Disposable, Keybinding, WorkbenchModuleContributionContext } from "@pstdio/workbench";
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
        layer: "create",
        keybinding: key,
        action,
      }),
    );
  };
  for (const harness of metadata.harnesses ?? []) {
    const label = harness.label ?? harness.localId;
    const multiple = metadata.harnesses!.filter((entry) => entry.extensionId === harness.extensionId).length > 1;
    const title = multiple ? `${label} (${harness.localId})` : label;
    register(harness.extensionId, `new-${harness.id}`, "S", `New session with ${title}`, {
      kind: "command",
      commandId: dashboardCommandIds.createSession,
      args: { harnessId: harness.id },
    });
  }
  return registrations;
};

import { defineCommand, l10n, params } from "@pstdio/sdk/extensions";
import { openDeployed } from "./deployed-workbench";
import { labCommands } from "./lab-commands";

export const openCloudWorkspace = defineCommand({
  id: "workspaces.open",
  title: l10n("cloud-workspaces.open-workspace", "Open workspace"),
  params: {
    rowId: params.text({ label: l10n("cloud-workspaces.workspace-row", "Workspace row"), required: true }),
  },
  async run(ctx, input) {
    const rowId = input.rowId;
    if (rowId?.startsWith("local:")) return labCommands["lab.select"].run(ctx, { instance: rowId.slice(6) });
    if (rowId?.startsWith("deployed:")) return openDeployed.run(ctx, {});
    throw new Error("Choose a cloud workspace.");
  },
});

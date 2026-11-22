import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import type { ExtensionProcessEnvironmentPermission } from "@pstdio/sdk/api";
import { ExtensionEnvironmentAccess } from "./extension-environment-access";

const permission: ExtensionProcessEnvironmentPermission = {
  extensionId: "acme.claude-code",
  projectId: "project-1",
  sourceIdentity: "source-1",
  requested: ["ANTHROPIC_API_KEY", "GH_TOKEN"],
  granted: [],
  stale: false,
};
const noop = () => {};

const meta: CanvasMeta<typeof ExtensionEnvironmentAccess> = {
  title: "Product/Settings/Extensions/Environment access",
  component: ExtensionEnvironmentAccess,
  args: { permission, onAllow: noop, onRevoke: noop },
};
export default meta;
type Story = CanvasFrame<typeof ExtensionEnvironmentAccess>;

export const RequestedNotGranted: Story = {
  id: "projectsettings-extensionenvironmentaccess--requested-not-granted",
};
export const PartlyGranted: Story = {
  id: "projectsettings-extensionenvironmentaccess--partly-granted",
  args: { permission: { ...permission, granted: ["GH_TOKEN"] } },
};
export const Granted: Story = {
  id: "projectsettings-extensionenvironmentaccess--granted",
  args: { permission: { ...permission, granted: ["ANTHROPIC_API_KEY", "GH_TOKEN"] } },
};
// The source changed after the grant, so the old grant no longer applies.
export const StaleAfterSourceChange: Story = {
  id: "projectsettings-extensionenvironmentaccess--stale-after-source-change",
  args: { permission: { ...permission, sourceIdentity: "source-2", stale: true } },
};
export const Revoking: Story = {
  id: "projectsettings-extensionenvironmentaccess--revoking",
  args: { permission: { ...permission, granted: ["ANTHROPIC_API_KEY", "GH_TOKEN"] }, pending: "revoke" },
};

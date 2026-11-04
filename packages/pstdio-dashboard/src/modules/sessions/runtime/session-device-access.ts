import type { AccountDevice, Session } from "pstdio-api-contracts";
import { resolveRuntimeWorkspaceSelection } from "./session-runtime-selection";

export const sessionDeviceAccess = (owner: Session["device"], selectedDeviceId: string, devices: AccountDevice[]) => {
  const deviceId = owner?.id ?? (selectedDeviceId === "this-device" ? undefined : selectedDeviceId);
  const device = devices.find((item) => item.id === deviceId);
  return {
    deviceId,
    name: owner?.name ?? device?.name ?? selectedDeviceId,
    remote: Boolean(deviceId),
    unavailable: Boolean(deviceId && !device?.online),
  };
};

export const resolveDeviceWorkspaceSelection = (
  workspaces: { id: string; isDefault?: boolean }[],
  selectedWorkspaceId: string,
  boundWorkspaceId: string | null,
) =>
  resolveRuntimeWorkspaceSelection({
    workspaces,
    selectedWorkspaceId,
    fallbackWorkspaceId:
      workspaces.find((workspace) => workspace.id === boundWorkspaceId)?.id ??
      workspaces.find((workspace) => workspace.isDefault)?.id,
  });

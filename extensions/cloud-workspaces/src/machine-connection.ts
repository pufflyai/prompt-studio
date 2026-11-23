import { PocketCoderHttpError } from "./instances";

// The template decides how Prompt Studio talks to a machine. A template with a session adapter
// serves structured requests. A template without one reports no request support or refuses
// the route, so it can only use the relay.
const servesRequests = async (capabilities: () => Promise<{ requests: boolean }>) => {
  try {
    return (await capabilities()).requests;
  } catch (error) {
    if (error instanceof PocketCoderHttpError && error.code === "relay.route_not_allowed") return false;
    throw error;
  }
};

export async function machineConnection(
  capabilities: () => Promise<{ requests: boolean }>,
  metadata: Record<string, string>,
) {
  if (await servesRequests(capabilities)) return { kind: "session" as const };
  const deviceId = metadata["pstdio.device_id"];
  const workspaceId = metadata["pstdio.workspace_id"];
  if (!deviceId || !workspaceId)
    throw new Error(
      "This template connects through the Prompt Studio relay, which needs a device and workspace. Set pstdio.device_id and pstdio.workspace_id in the machine metadata after enrolling the machine with a workspace-scoped, expiring credential.",
    );
  return { kind: "relay" as const, deviceId, workspaceId };
}

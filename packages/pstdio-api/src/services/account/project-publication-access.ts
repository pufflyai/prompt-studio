import { ManagerRequestDenied } from "./manager-client";
import type { createNativeManagerCall } from "./native-manager-call";
import { type DeviceLogin, matchesDeviceLogin } from "./native-store";
import type { createProjectCopyStore } from "./project-copy-store";

export const canPublishProjectExtensions =
  (input: {
    copies: Pick<ReturnType<typeof createProjectCopyStore>, "teamProjects">;
    readLogin: () => Promise<DeviceLogin | null>;
    call: ReturnType<typeof createNativeManagerCall>;
  }) =>
  async (projectId: string, signal?: AbortSignal) => {
    const binding = (await input.copies.teamProjects()).find((project) => project.projectId === projectId);
    if (!binding) return true;
    const login = await input.readLogin();
    if (!login || binding.managerOrigin !== login.managerOrigin) return false;
    try {
      const permission = (await input.call(
        "/v1/environment-access",
        { accountId: binding.accountId, workbenchId: projectId },
        login.token,
        signal,
        login,
        true,
      )) as { canPublish?: unknown };
      return permission?.canPublish === true && matchesDeviceLogin(await input.readLogin(), login);
    } catch (error) {
      // A missing team grant can look like a device denial. Preserve the user's personal sign-in.
      if (signal?.aborted) throw error;
      if (error instanceof ManagerRequestDenied && error.status >= 500) throw error;
      return false;
    }
  };

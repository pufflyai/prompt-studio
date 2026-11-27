import { type DeviceLogin, matchesDeviceLogin } from "./native-store";
import type { createProjectCopyStore } from "./project-copy-store";

/** A historical team binding alone never admits a different user or a returned project grant. */
export const createManagedProjectCopies =
  (input: {
    copies: Pick<ReturnType<typeof createProjectCopyStore>, "teamProjects" | "teamAdmissions" | "forDevice">;
    login: () => Promise<DeviceLogin | null>;
    exists: (projectId: string) => Promise<unknown>;
  }) =>
  async () => {
    const login = await input.login();
    if (!login) return [];
    const [bindings, admissions, copies] = await Promise.all([
      input.copies.teamProjects(),
      input.copies.teamAdmissions(login),
      input.copies.forDevice(login.deviceId),
    ]);
    const withdrawn = new Set(
      copies
        .filter(
          (copy) =>
            copy.managerOrigin === login.managerOrigin &&
            (copy.userId ?? copy.accountId) === login.accountId &&
            copy.phase !== "downloading",
        )
        .map((copy) => copy.projectId),
    );
    const owners = new Map(bindings.map((row) => [row.projectId, row]));
    const projects: { projectId: string; scope: string }[] = [];
    for (const row of admissions) {
      const owner = owners.get(row.projectId);
      if (
        row.revoked ||
        withdrawn.has(row.projectId) ||
        owner?.managerOrigin !== login.managerOrigin ||
        owner.accountId !== row.accountId ||
        !(await input.exists(row.projectId))
      )
        continue;
      projects.push({
        projectId: row.projectId,
        scope: JSON.stringify([row.managerOrigin, row.accountId, row.userId, row.deviceId, row.grantId]),
      });
    }
    return matchesDeviceLogin(await input.login(), login) ? projects : [];
  };

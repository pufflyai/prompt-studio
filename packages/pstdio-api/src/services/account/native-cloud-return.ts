import type { ProjectReturnAction, ProjectSyncStatus } from "pstdio-api-contracts";
import type { RouteDeps } from "../../features/deps";
import { apiLogger } from "../../lib/logger";
import { AccountRequestError } from "./native-account";

/** The storage side of signing out and returning to Cloud. */
export type CloudReturn = RouteDeps["extensionStorageService"]["cloudReturn"];

/**
 * Signing out, a rejection or removing this device ends sync here: unsent saves fold and later saves
 * stop queuing. Once a signed-in account's project list loads, projects it does not sync stay local.
 */
export const createNativeCloudReturn = () => {
  let cloud: CloudReturn | undefined;
  return {
    connect(next: CloudReturn | undefined) {
      cloud = next;
    },
    /** Signed in, it waits until the account's project list is known. */
    async settle<Login>(login: Login | null, projectsFor: (login: Login) => string[] | undefined) {
      try {
        const projects = login ? projectsFor(login) : undefined;
        if (!login) await cloud?.signOut();
        else if (projects) await cloud?.release(projects);
      } catch (error) {
        apiLogger.warn(
          { event: "account.cloud_return.failed", error },
          "Cloud changes on this device will settle later",
        );
      }
    },
    async status(projectId: string): Promise<Pick<ProjectSyncStatus, "away" | "replaced">> {
      const returned = await cloud?.status(projectId).catch((error: unknown) => {
        apiLogger.warn(
          { event: "account.cloud_return.status_failed", error },
          "Changes from time away are unavailable",
        );
        return undefined;
      });
      if (!returned) return {};
      const { state, changed, replaced } = returned;
      return { ...(state ? { away: { state, ...changed } } : {}), ...(replaced.total ? { replaced } : {}) };
    },
    async resolve(
      projectId: string,
      action: ProjectReturnAction,
      projects: Pick<RouteDeps["projectService"], "get">,
      refresh: () => Promise<void>,
    ) {
      if (!(await projects.get(projectId))) throw new AccountRequestError("Unknown project");
      if (!cloud) throw new AccountRequestError("Cloud sync is starting. Try again shortly.");
      if (action === "dismiss") await cloud.dismissReplaced(projectId);
      else if (!(await cloud[action](projectId))) throw new AccountRequestError("No changes are held for review");
      // Held owners now upload or match Cloud; their connections wake on the storage change.
      void refresh();
      return { ok: true };
    },
  };
};

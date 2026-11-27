import type { ProjectExtensionInstance } from "pstdio-api-contracts";
import { AccountRequestError } from "../../services/account/account-errors";
import { ManagerRequestDenied } from "../../services/account/manager-client";
import type { ExtensionsRouteDeps } from "./deps";

type Choice = Pick<ProjectExtensionInstance, "choiceRestriction" | "sourceRestriction">;

/** Presentation follows native decisions; mutations still authorize again at their boundary. */
export const readProjectExtensionRestrictions = async (
  deps: Pick<ExtensionsRouteDeps, "accountService" | "extensionService">,
  projectId: string,
  sources: Array<{ id: string; extension_id: string }>,
) => {
  // One cached decision per project, even when several rows share a project or source.
  const policies = new Map<string, Promise<Set<string> | "policy-unavailable">>();
  const policy = (id: string) => {
    let pending = policies.get(id);
    if (!pending) {
      pending = deps.accountService
        .readCachedManagedProjectPolicy(id)
        .then((rows) => new Set(rows.filter((row) => row.required).map((row) => row.extensionId)))
        .catch((error: unknown) => {
          if (
            error instanceof AccountRequestError ||
            error instanceof ManagerRequestDenied ||
            error instanceof TypeError
          )
            return "policy-unavailable" as const;
          throw error;
        });
      policies.set(id, pending);
    }
    return pending;
  };
  const restriction = async (id: string, extensionId: string) => {
    const current = await policy(id);
    if (current === "policy-unavailable") return current;
    return current.has(extensionId) ? ("team-managed" as const) : undefined;
  };
  const result = new Map<string, Choice>();
  for (const source of sources) {
    const choiceRestriction = await restriction(projectId, source.extension_id);
    let sourceRestriction = choiceRestriction;
    // Disabled instances also protect a source, matching native source-mutation guards.
    for (const id of new Set(await deps.extensionService.installedSourceProjectIds(source.id))) {
      const candidate = await restriction(id, source.extension_id);
      if (candidate === "team-managed" || !sourceRestriction) sourceRestriction = candidate;
    }
    result.set(source.id, {
      ...(choiceRestriction && { choiceRestriction }),
      ...(sourceRestriction && { sourceRestriction }),
    });
  }
  return result;
};

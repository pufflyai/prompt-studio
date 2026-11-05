import type { WorkbenchModuleContribution } from "@pstdio/workbench";
import type { DashboardSessionDraftPersistence } from "@/shared/app/session-draft-persistence";
import { findDashboardSession } from "./data/dashboard-sessions";
import { subscribeSessionListData } from "./data/session-data-subscription";
import { registerSessionProviderCompatibility } from "./session-provider-compatibility";
import { registerSessionResourceRetention } from "./session-resource-retention";
import { registerSessionResourceSync } from "./session-resource-sync";

interface CreateSessionsModuleInput {
  sessionDraftPersistence?: DashboardSessionDraftPersistence;
}
/** Core owns canonical identity and resource lifetime; Sessions owns all presentation. */
export const createSessionsModule = (_input: CreateSessionsModuleInput = {}) =>
  ({
    id: "dashboard.sessions",
    activate(ctx) {
      ctx.resources.registerKind({
        kind: "session",
        label: "Session",
        icon: "MessageCircle",
        resolve: (resource) => findDashboardSession(resource.id)?.resource,
        subscribe: subscribeSessionListData,
      });
      ctx.resources.registerKind({ kind: "session-draft", label: "Session draft", icon: "message-circle" });
      const compatibility = registerSessionProviderCompatibility(ctx);
      const stopSync = registerSessionResourceSync(ctx);
      const stopRetention = registerSessionResourceRetention(ctx);
      return {
        dispose() {
          compatibility.dispose();
          stopSync();
          stopRetention();
        },
      };
    },
  }) satisfies WorkbenchModuleContribution;

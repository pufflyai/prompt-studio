import type { WorkbenchModuleContribution } from "@pstdio/workbench";
import { registerSessionProviderCompatibility } from "./session-provider-compatibility";
import { registerSessionResourceRetention } from "./session-resource-retention";
import { registerSessionResourceSync } from "./session-resource-sync";

/** Core owns canonical identity and resource lifetime; Sessions owns all presentation. */
export const createSessionsModule = () =>
  ({
    id: "dashboard.sessions",
    activate(ctx) {
      ctx.resources.registerKind({
        kind: "session",
        label: "Session",
        icon: "message-circle",
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

import { type NavigationTarget as AddTarget, contributionRefId } from "@pstdio/sdk/extensions";
import type { CommandNavigation, NavigationTargetPanel } from "../../registries/navigation/navigation-registry";
import type { WorkbenchCore } from "../../workbench-core-types";
import { prepareWorkbenchNavigation } from "../navigation/compound-navigation";
import { pageLocationTarget } from "../page-location/page-location-target";
import { resetOwnerScope } from "./reset-preset-bindings";

export const createResetPresetNavigation = (core: WorkbenchCore, owner: "page" | "mode") => {
  const initial = core.pages.store.getState();
  const scope = resetOwnerScope(core, owner);
  const origin = initial.location && pageLocationTarget(initial.location);
  const navigation: CommandNavigation = {
    async openTarget(target) {
      if (target.kind === "command") {
        return [
          await core.commands.executeCommand(target.commandId, target.args, {
            source: "panel-add",
            resource: initial.location?.resource,
            navigation,
          }),
        ];
      }
      if (target.kind === "href" || resetOwnerScope(core, owner) === scope) return core.navigation.openTarget(target);
      const current = core.pages.store.getState();
      if (!origin || !current.location || current.projectId !== initial.projectId) return [];
      // Prepare both owners atomically; the executor saves the inactive owner without changing the current page.
      return [
        prepareWorkbenchNavigation(core, [
          origin,
          ...(target.kind === "compound" ? target.targets : [target]),
          pageLocationTarget(current.location),
        ]).publish(),
      ];
    },
    openPage: (target) => navigation.openTarget({ ...target, kind: "page" }),
    openPanel: (target) => navigation.openTarget({ ...target, kind: "panel" } as NavigationTargetPanel),
    navigate: (location) => navigation.openTarget(core.navigation.resolveLocation(location)),
  };
  return (target: AddTarget) =>
    target.kind === "command"
      ? navigation.openTarget({
          kind: "command",
          commandId: contributionRefId(target.target.command),
          args: target.target.params,
        })
      : navigation.openTarget(target);
};

import { defineCommand, l10n, params } from "@pstdio/sdk/extensions";
import { readImplementationTargets, setImplementationTarget } from "../data/implementation-targets";

export const implementationTargetsCommand = defineCommand({
  id: "implementation-targets",
  title: l10n("commands.implementationTargets.title", "List implementation target branches"),
  cli: true,
  run: readImplementationTargets,
});

export const setImplementationTargetCommand = defineCommand({
  id: "set-implementation-target",
  title: l10n("commands.setImplementationTarget.title", "Set default target branch"),
  mutating: true,
  cli: true,
  params: {
    branch: params.text(),
  },
  run: setImplementationTarget,
});

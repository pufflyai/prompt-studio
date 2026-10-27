// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e } from "./navigation-oeGsFbYd.ts";
import { isNavigationTarget as t } from "@pstdio/sdk/extensions";
// packages/pstdio-workbench/src/extensions/host/extension-navigation-target.ts
var n = (e, t) => {
	let n = t.commandTargetOf?.(e);
	if (n) return {
		...n,
		...t.region ? { region: t.region } : {}
	};
	let r = e.target.command, i = r.extensionId ?? t.extensionId;
	return {
		kind: "command",
		commandId: t.commandIdOf?.(r) ?? (i && i !== "pstdio" ? `${i}.command.${r.id}` : r.id),
		args: e.target.params,
		...t.region ? { region: t.region } : {}
	};
};
function r(i, a = {}) {
	if (!t(i)) throw Error("Invalid navigation target.");
	return a.extensionId && (i = e(i, a.extensionId, a.projectId)), i.kind === "command" ? n(i, a) : i.kind === "href" || i.kind === "page" || i.kind === "viewer" ? i : i.kind === "panel" ? {
		...i,
		...a.region ? { region: a.region } : {}
	} : {
		kind: "compound",
		targets: i.targets.map((e) => r(e, a))
	};
}
export { r as t };

// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { g as e } from "./workbench-core-N58OeDyx.ts";
import { t } from "./use-workbench-store-BMaFgEbb.ts";
import { r as n } from "./command-menu-items-NsWn0jze.ts";
import { r, t as i } from "./resource-action-menu-C7it1uYl.ts";
import { useEffect as a, useState as o } from "react";
import { Icon as s } from "@chakra-ui/react";
import { jsx as c } from "react/jsx-runtime";
// packages/pstdio-workbench/src/react/menus/resource-actions.tsx
var l = (e) => ({
	key: e.id,
	label: e.label,
	commandId: e.commandId,
	icon: typeof e.icon == "function" ? /* @__PURE__ */ c(s, {
		as: e.icon,
		boxSize: "16px"
	}) : e.icon,
	endContent: e.endContent,
	isDisabled: e.disabled,
	separatorBefore: e.separatorBefore,
	onClick: () => e.onAction?.()
}), u = (e, t, r = {}) => {
	let a = i(e, t, r.onRequestParams);
	return a ? n({
		...a,
		context: {
			...r.context,
			resource: a.context.resource
		},
		onCommandError: r.onCommandError
	}).map((e) => ({
		...l(e),
		group: e.group ?? a.group
	})) : [];
}, d = (t, r) => n({
	menuPath: e,
	workbench: t,
	context: r ? { resource: r } : void 0,
	onRequestParams: ({ request: e }) => t.commandPalette.requestParams(e)
}).map(l), f = (e) => {
	t(e.resources.preview.store, (e) => e.changes);
	let n = t(e.resources.store, (e) => e.kinds), [, i] = o(0);
	return a(() => r(Object.values(n), () => i((e) => e + 1)), [n]), t(e.commands.store, (e) => e.commands), t(e.context.store, (e) => e.values), t(e.layout.menuStore, (e) => e.itemsByPath), (t) => u(e, t);
};
export { u as n, f as r, d as t };

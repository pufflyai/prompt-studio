// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { r as e } from "./resource-registry-CVuZngrt.ts";
import { l as t, r as n } from "./command-palette-params-BB-3_RFH.ts";
import { t as r } from "./menu-item-state-C3xsXmQe.ts";
// packages/pstdio-workbench/src/react/menus/menu-entries.ts
var i = (t, n) => n?.resource ? e(t.context.snapshot(), n.resource) : t.context.snapshot(), a = (e, t) => {
	if (!t || e.length === 0) return e;
	let [n, ...r] = e;
	return [{
		...n,
		separatorBefore: !0
	}, ...r];
}, o = (e) => {
	let { menuPath: a, onRequestParams: o, workbench: s } = e, c = s.viewers.captureContext(e.context?.placement), l = {
		projectId: c.projectId,
		removalVersion: c.removalVersion,
		isViewerCurrent: c.isViewerCurrent,
		...e.context
	}, u = i(s, l), d = new Map(s.keybindings.listCommandKeybindings().map((e) => [e.commandId, e.keybinding]));
	return s.layout.listMenuItems(a).flatMap((e) => {
		let i = s.commands.getCommand(e.commandId);
		if (!i) return [];
		let a = r(e, i, u, l);
		if (!a) return [];
		let { args: c } = e, f = e.label ?? i.command.label, p = n(i.command.params) && o ? () => o({
			request: {
				record: { command: i.command },
				label: f,
				args: c,
				context: l
			},
			run: async (e) => {
				await s.commands.executeCommand(i.command.id, e, l);
			}
		}) : void 0;
		return [{
			id: e.id,
			label: f,
			group: e.resourceGroup,
			commandId: e.sourceCommandId ?? i.command.id,
			description: a.description,
			icon: e.icon ?? i.command.icon,
			iconSrc: e.iconSrc,
			external: e.external,
			binding: d.get(i.command.id),
			kernel: e.group === "kernel",
			disabled: a.disabled,
			readOnly: a.readOnly,
			separatorBefore: e.separatorBefore,
			run: a.readOnly ? void 0 : async () => {
				if (p) {
					p();
					return;
				}
				let e = t(i.command.params, c, l), n = Object.keys(e).length ? {
					...typeof c == "object" && c ? c : {},
					...e
				} : c;
				await s.commands.executeCommand(i.command.id, n, l);
			}
		}];
	});
}, s = (e) => {
	let t = e.filter((e) => !e.kernel), n = e.filter((e) => e.kernel);
	return [...t, ...a(n, t.length > 0)];
};
export { o as n, a as r, s as t };

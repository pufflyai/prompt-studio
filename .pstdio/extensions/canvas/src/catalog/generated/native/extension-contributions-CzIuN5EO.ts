// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./param-schema-localization-Bo9iKWsO.ts";
import { isLocalizedString as t } from "@pstdio/sdk/extensions";
// packages/pstdio-workbench/src/extensions/contributions/extension-contributions.ts
var n = {
	first: 0,
	default: 1,
	last: 2
}, r = {
	commands: [],
	commandPaletteContributions: [],
	diagnostics: [],
	extensions: [],
	menuContributions: [],
	modes: [],
	pages: [],
	views: [],
	viewMenus: [],
	placements: [],
	resourceKinds: [],
	navigationItems: [],
	navigationTrees: [],
	statusBarItems: [],
	settingsPanels: [],
	settingsDefinitions: []
}, i = (e) => `workbench.extension.menu.${e.id}`, a = (e) => `workbench.extension.palette.${e.id}`, o = (e, t) => n[e.placement ?? "default"] * 1e3 + t, s = (e) => e === void 0 ? "" : t(e) ? e.default ?? e.$l10n : e, c = (e) => {
	let { commandId: t, contribution: n, index: r, resolveString: i, slot: a, when: s, disabledWhen: c } = e;
	return {
		commandId: t,
		id: n.id,
		sourceCommandId: n.commandId,
		label: i(n.label, n.extensionId),
		icon: n.icon,
		group: a.group ?? n.group,
		resourceGroup: a.resourceGroup,
		args: n.params,
		overflowLabel: a.overflowLabel,
		order: o(n, r),
		when: s,
		disabledWhen: c,
		disabledReason: i(n.disabledReason, n.extensionId)
	};
}, l = (e) => {
	let { commandId: t, contribution: n, index: r, resolveString: i } = e;
	return {
		commandId: t,
		sourceCommandId: n.commandId,
		label: i(n.label, n.extensionId),
		icon: n.icon,
		group: n.group,
		args: n.params,
		order: o(n, r)
	};
}, u = (t) => {
	let { createCommandId: n = i, createWhenExpression: r, menuSlotsById: a, menuTargetsById: o, metadata: l, resolveString: u = s } = t, d = [], f = [];
	return l.menuContributions.forEach((t, i) => {
		let s = t.target ? o?.get(t.target) : a.get(t.slotId);
		if (!s) {
			f.push({
				contribution: t,
				targetId: t.target ?? t.slotId
			});
			return;
		}
		let p = n(t), m = l.commands.find((e) => e.id === t.commandId);
		d.push({
			command: {
				id: p,
				label: u(t.label, t.extensionId),
				category: t.group,
				resourceMutation: m?.resourceMutation,
				description: m ? u(m.description, m.extensionId) : void 0,
				icon: t.icon,
				params: e(m?.params, (e) => u(e, m?.extensionId ?? t.extensionId), m?.extensionId)
			},
			contribution: t,
			menuItem: c({
				commandId: p,
				contribution: t,
				index: i,
				resolveString: u,
				slot: s,
				when: r?.(t),
				disabledWhen: t.disabledWhen ? r?.({
					...t,
					when: t.disabledWhen
				}) : void 0
			}),
			menuPath: s.menuPath,
			targetCommandId: t.commandId
		});
	}), {
		registrations: d,
		unresolved: f
	};
}, d = (t) => {
	let { createCommandId: n = a, metadata: r, resolveString: i = s } = t, o = [];
	return (r.commandPaletteContributions ?? []).forEach((t, a) => {
		let s = n(t), c = r.commands.find((e) => e.id === t.commandId);
		o.push({
			command: {
				id: s,
				label: i(t.label, t.extensionId),
				category: t.group,
				description: c ? i(c.description, c.extensionId) : void 0,
				icon: t.icon,
				params: e(c?.params, (e) => i(e, c?.extensionId ?? t.extensionId), c?.extensionId)
			},
			contribution: t,
			menuItem: l({
				commandId: s,
				contribution: t,
				index: a,
				resolveString: i
			}),
			targetCommandId: t.commandId
		});
	}), o;
};
export { u as n, r, d as t };

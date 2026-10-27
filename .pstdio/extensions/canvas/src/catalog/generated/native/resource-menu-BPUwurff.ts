// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { c as e } from "./resource-registry-CVuZngrt.ts";
import { c as t } from "./workbench-core-N58OeDyx.ts";
import { t as n } from "./icon-D3uE7jD-.ts";
import { r } from "./command-palette-params-BB-3_RFH.ts";
import { n as i } from "./resource-actions-B6hNjsqI.ts";
import { jsx as a } from "react/jsx-runtime";
// packages/pstdio-workbench/src/react/shared/run-placement-action.ts
var o = (e, n, i = (t) => e.commandPalette.requestParams(t), a, o, s = e.viewers.captureContext(o?.placement)) => {
	let c = {
		...o,
		resource: a,
		projectId: o?.projectId ?? s.projectId,
		removalVersion: s.removalVersion,
		isViewerCurrent: s.isViewerCurrent
	}, l = n.kind === "navigation" ? n.target : n;
	if (l.kind !== "command") {
		t(e, "Open", () => e.navigation.openTarget(l, {
			...s,
			projectId: o?.projectId ?? s.projectId
		}));
		return;
	}
	let u = e.commands.getCommand(l.commandId)?.command;
	u && r(u.params) ? i({
		record: { command: u },
		label: u.label,
		args: l.args,
		context: c
	}) : t(e, u?.label ?? "Command", () => e.commands.executeCommand(l.commandId, l.args, c));
}, s = (e, t, r, i, s) => {
	let c = t.action?.kind === "navigation" ? t.action.target : t.action;
	return {
		key: t.id,
		label: t.label,
		commandId: c?.kind === "command" ? c.commandId : void 0,
		icon: t.icon ? /* @__PURE__ */ a(n, {
			name: t.icon,
			size: 14,
			color: t.iconColor
		}) : void 0,
		isDisabled: t.disabled,
		isSelected: t.selected,
		onClick: () => {
			t.action && o(e, t.action, void 0, r, i, s);
		}
	};
}, c = (e, t, n, r) => {
	let i = {
		placement: r?.placementIdentity,
		projectId: e.pages.store.getState().projectId
	}, a = e.viewers.captureContext(r?.placementIdentity);
	return (t.menu ?? []).flatMap((t) => {
		let r = {
			id: `placement:${t.id}`,
			label: t.label
		};
		return t.rows.map((o) => ({
			...s(e, o, n, i, a),
			key: `${t.id}:${o.id}`,
			group: r
		}));
	});
}, l = (t, n, r, a) => {
	let o = n ? e(n, t.resources.preview.store.getState().changes) : void 0;
	return [...o ? i(t, o, { context: {
		placement: a?.placementIdentity,
		projectId: t.pages.store.getState().projectId
	} }) : [], ...c(t, r, o, a)];
};
export { c as n, l as t };

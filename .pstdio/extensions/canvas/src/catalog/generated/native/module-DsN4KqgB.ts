// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { _ as e } from "./workbench-core-kaLFKJEn.ts";
import { t } from "./widget-ids-CvvbLhYP.ts";
import { t as n } from "./resource-icons-CZFS6OM4.ts";
import { t as r } from "./use-workbench-store-BMaFgEbb.ts";
import { t as i } from "./extension-navigation-target-zjAG34BD.ts";
import { a, l as o, n as s, r as c } from "./collections-CVGR0OYX.ts";
import { n as l } from "./api-BQ3Fs8xe.ts";
import { n as u } from "./synced-settings-7p2HqHPp.ts";
import { i as d, n as f, s as p } from "./project-context-BR7AjHlE.ts";
import { n as m, t as h } from "./dashboard-navigation-contribution-CaGzI-cW.ts";
import { t as g } from "./commands-Bp5w85f4.ts";
import { t as _ } from "./use-action-error-DjeAuY1I.ts";
import { r as v } from "./api-D6GBehHi.ts";
import { t as y } from "./extension-webview-broadcast-B3i0Oe11.ts";
import { n as b, t as x } from "./resources-CR_Z7fRd.ts";
import { useSyncExternalStore as S } from "react";
import { Stack as ee, Text as C } from "@chakra-ui/react";
import { NotificationCenter as w } from "@pstdio/ui";
import { jsx as T, jsxs as E } from "react/jsx-runtime";
// packages/pstdio-dashboard/src/shared/extensions/command-outcome.ts
var D = (e, t = {}) => ({
	...t,
	commandId: e.commandId,
	extensionId: e.extensionId
}), O = (e) => {
	let { outcome: t } = e, n = [];
	for (let r of t.notices ?? []) n.push({
		level: r.type,
		title: r.title ?? "Extension notice",
		message: r.message,
		metadata: D(e, r.metadata)
	});
	return n;
}, k = /* @__PURE__ */ new Set(["open", "read"]), A = {
	urgent: 0,
	high: 1,
	normal: 2,
	low: 3
}, j = (e) => typeof e == "string" ? e : void 0, M = (e) => Array.isArray(e) ? e : [], N = (e) => e && typeof e == "object" && !Array.isArray(e) ? e : void 0, P = () => Array.from(s("notifications").state.values()), F = (e) => ({
	id: e.id,
	projectId: j(e.project_id) ?? "",
	title: j(e.title) ?? "Notification",
	body: j(e.body) ?? null,
	kind: j(e.kind) ?? "info",
	priority: j(e.priority) ?? "normal",
	status: j(e.status) ?? "open",
	source: j(e.source) ?? "api",
	origin: j(e.origin) ?? "core",
	sourceExtensionId: j(e.source_extension_id) ?? null,
	actorType: j(e.actor_type) ?? null,
	actorId: j(e.actor_id) ?? null,
	target: N(e.target_json) ?? null,
	related: M(e.related_json),
	actions: M(e.actions_json),
	dedupeKey: j(e.dedupe_key) ?? null,
	metadata: N(e.metadata_json) ?? null,
	createdAt: j(e.created_at) ?? "",
	updatedAt: j(e.updated_at) ?? "",
	readAt: j(e.read_at) ?? null,
	resolvedAt: j(e.resolved_at) ?? null,
	snoozedUntil: j(e.snoozed_until) ?? null,
	expiresAt: j(e.expires_at) ?? null
}), I = (e, t) => {
	let n = A[e.priority] - A[t.priority];
	return n === 0 ? t.updatedAt.localeCompare(e.updatedAt) : n;
}, L = (e) => P().map(F).filter((t) => t.projectId === e && k.has(t.status)).sort(I), R = (e) => L(e).length, z = (e, t) => e.type === "session" ? b(e.id, e.label ?? e.id, e.projectId ?? t, e.metadata) : x(e.type, e.id, e.label ?? e.id, e.type === "workspace" ? n.workspace : n.kanbanRenderer, e.projectId ?? t, e.metadata), B = (e) => {
	let t = new Date(e).getTime();
	if (!Number.isFinite(t)) return;
	let n = Date.now() - t, r = 6e4, i = 60 * r;
	return n < r ? "now" : n < i ? `${Math.floor(n / r)}m ago` : n < 864e5 ? `${Math.floor(n / i)}h ago` : new Date(t).toLocaleDateString();
}, V = (e) => e.origin === "extension" && e.sourceExtensionId ? e.sourceExtensionId : e.source, H = (e) => ({
	id: e.id,
	label: e.label,
	primary: e.primary,
	destructive: e.kind === "command" ? e.destructive : void 0
}), U = (e) => ({
	id: e.id,
	title: e.title,
	body: e.body,
	kind: e.kind,
	priority: e.priority,
	status: e.status,
	sourceLabel: V(e),
	targetLabel: e.target?.label ?? e.target?.id,
	timeLabel: B(e.updatedAt || e.createdAt),
	actions: e.actions.map(H),
	searchText: [
		e.dedupeKey,
		e.target?.type,
		e.target?.id
	].filter(Boolean).join(" ")
}), W = (e, t) => e.find((e) => e.id === t.id), G = (e, t) => e.actions.find((e) => e.id === t.id), K = (e) => e.actions.find((e) => e.primary) ?? e.actions[0], q = async (e) => {
	e.status === "open" && await l().notifications.markRead(e.projectId, e.id);
}, J = (e, t, n, r = a()) => {
	for (let n of O(t)) {
		if (n.level === "error") throw Error(n.message ?? n.title);
		e.workbench.notifications.show({
			level: n.level,
			title: n.title,
			message: n.message,
			metadata: n.metadata
		});
	}
	if (y(t, { projectId: n }, r), !t.outcome.ok) throw Error(t.outcome.error?.message ?? t.outcome.reason ?? "Notification action failed.");
}, Y = (e) => {
	let n = a(), { input: s } = e, { showError: u, errorNotice: d, clearError: p } = _();
	S(o, c, c);
	let m = r(s.workbench.context.store, (e) => {
		let t = e.values[f];
		return typeof t == "string" ? t : void 0;
	}), h = L(m), g = h.map(U), y = () => s.workbench.layout.closePanel(s.instance.instanceId), b = async (e, t) => {
		p();
		try {
			if (await q(e), !t) {
				y();
				return;
			}
			if (t.kind === "navigate") await s.workbench.navigation.openTarget(i(t.target, { extensionId: e.sourceExtensionId ?? void 0 }));
			else if (t.kind === "url") globalThis.open(t.href, "_blank", "noopener,noreferrer");
			else if (s.workbench.commands.getCommand(t.command)) await s.workbench.commands.executeCommand(t.command, t.params, { resource: e.target ? z(e.target, m) : void 0 });
			else {
				let r = await v(e.projectId, t.command, {
					params: t.params,
					resource: e.target ?? void 0,
					source: "dashboard"
				});
				J(s, r, e.projectId, n);
			}
			y();
		} catch (e) {
			u({
				title: "Notification action failed",
				description: e instanceof Error ? e.message : String(e)
			});
		}
	}, x = (e, t) => {
		let n = W(h, e), r = n ? G(n, t) : void 0;
		n && b(n, r);
	}, D = (e) => {
		let t = W(h, e);
		t && b(t, K(t));
	}, O = async (e) => {
		p();
		let t = W(h, e);
		if (t) try {
			await l().notifications.dismiss(t.projectId, t.id);
		} catch (e) {
			u({
				title: "Notification update failed",
				description: e instanceof Error ? e.message : String(e)
			});
		}
	};
	return /* @__PURE__ */ T(w, {
		autoFocus: !0,
		items: g,
		onActivateItem: D,
		onDismiss: (e) => void O(e),
		onEscape: y,
		onRunAction: x,
		footerStart: /* @__PURE__ */ E(ee, {
			gap: "xs",
			children: [d, /* @__PURE__ */ T(C, {
				textStyle: "label/XS",
				color: "fg.muted",
				children: g.length === 1 ? "1 pending notification" : `${g.length} pending notifications`
			})]
		}),
		emptyLabel: "No pending notifications."
	}, t.notificationsModal);
}, X = "Alt+Shift+N", Z = (e) => {
	let t = R(d(e));
	return {
		id: "dashboard.notifications.sidenav",
		label: "Notifications",
		icon: "Inbox",
		badge: t > 0 ? {
			label: String(t),
			color: "blue"
		} : void 0,
		target: {
			kind: "command",
			commandId: g.openNotifications
		}
	};
}, Q = (e) => {
	m(e, {
		id: "dashboard.notifications.sidenav-nav",
		modes: ["project"],
		getSections: () => u() ? [{
			...h.root,
			nodes: [Z(e)]
		}] : []
	});
}, $ = (e) => {
	e.views.getView(t.dashboardSidenav) && e.views.refreshView(t.dashboardSidenav);
}, te = (e) => [e.views.registerView({
	id: t.notificationsModal,
	title: "Notifications",
	body: {
		kind: "react",
		render: (e) => /* @__PURE__ */ T(Y, { input: e })
	}
}), e.overlays.registerOverlay({
	id: t.notificationsModal,
	viewId: t.notificationsModal,
	config: {
		size: "lg",
		placement: "center",
		scrollBehavior: "inside"
	}
})], ne = () => ({
	id: "dashboard.notifications",
	activate(n) {
		Q(n);
		let r = [], i = () => {
			for (let e of n.layout.getLayout().regions.overlay.widgets) e.viewId === t.notificationsModal && n.overlays.closeOverlay(e.widgetId);
			for (let e of [...r].reverse()) e.dispose();
			r = [];
		}, a = () => {
			u() && r.length === 0 ? r = [
				...te(n),
				n.commands.registerCommand({
					id: g.openNotifications,
					label: "Open notifications",
					category: "Dashboard",
					icon: "Inbox"
				}, { execute: () => n.overlays.openOverlay(t.notificationsModal, { title: "Notifications" }) }),
				n.keybindings.registerKeybinding({
					action: {
						kind: "command",
						commandId: g.openNotifications
					},
					keybinding: X,
					when: "!inputFocus"
				}),
				n.layout.registerMenuItem(e, {
					commandId: g.openNotifications,
					order: 32
				})
			] : u() || i(), $(n);
		}, s = o((e) => {
			e && e.table !== "settings" && e.table !== "notifications" || a();
		}), c = p(n, () => $(n));
		return a(), [
			{ dispose: s },
			{ dispose: c },
			{ dispose: i }
		];
	}
});
export { ne as t };

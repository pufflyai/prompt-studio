// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e } from "./collection-view-builtins-CQzYQ2MW.ts";
import { n as t, t as n } from "./workbench-resource-mutation-fSotiWIh.ts";
import { t as r } from "./icon-D3uE7jD-.ts";
import { l as i } from "./command-palette-params-BB-3_RFH.ts";
import { r as a } from "./workbench-BbqJVWhj.ts";
import { t as o } from "./extension-navigation-target-zjAG34BD.ts";
import { t as s } from "./param-schema-localization-Bo9iKWsO.ts";
import { t as c } from "./collection-badge-navigation-crrNWqHz.ts";
import { createElement as l } from "react";
import { getCommandValue as u } from "@pstdio/sdk/extensions";
import { renderBadgeListDisplay as d } from "@pstdio/ui/kanban-renderer";
// packages/pstdio-workbench/src/extensions/host/command-response.ts
var f = (e) => {
	let t = e;
	return t?.outcome ? u(t.outcome) : e;
}, p = (e) => ({
	id: e.id,
	kind: e.kind,
	context: {
		projectId: e.projectId,
		...e.context ?? {}
	}
}), m = async (e, t, n = {}) => {
	let r = n.resource, i = e.workbench.viewers.captureContext(n.placement), a = {
		...i,
		removalVersion: n.removalVersion ?? i.removalVersion,
		isViewerCurrent: n.isViewerCurrent ?? i.isViewerCurrent
	}, s = e.workbench.notifications.captureActionError("Open command result"), c = await e.executeCommand(t, {
		projectId: e.projectId,
		...n.workspaceId ? { workspaceId: n.workspaceId } : {},
		...n.params ? { params: n.params } : {},
		...r ? { resource: r } : {},
		...n.slot ? { slot: n.slot } : {},
		source: "dashboard",
		...n.metadata ? { metadata: n.metadata } : {}
	}, n.signal), l = c?.outcome;
	if (l?.status === "success" && !n.signal?.aborted) for (let t of l.navigationRequests ?? []) {
		if (n.signal?.aborted) break;
		try {
			await e.workbench.navigation.openTarget(o(t, { region: n.region }), {
				...a,
				projectId: e.projectId
			});
		} catch (e) {
			s(e);
		}
	}
	return c;
}, h = async (e, t, r = {}) => {
	let a = e.metadata?.commands.find((e) => e.id === t), o = a ? {
		...i(a.params, r.params, { resource: r.resource }),
		...r.params
	} : r.params, s = async () => f(await m(e, t, {
		...r,
		params: o
	}));
	return a ? n(e, a, o, { resource: r.resource }, s) : s();
}, g = (e) => e.toolbarActions?.map((n) => ({
	id: n.id,
	label: t(n.label, n.id),
	icon: n.icon,
	presentation: n.presentation,
	commandId: n.commandId,
	args: n.params,
	params: s(n.input, t, e.extensionId),
	submitLabel: n.submitLabel,
	disabled: n.disabled,
	when: n.when
})), _ = (e) => (t) => l(r, {
	name: e ?? "MoreHorizontal",
	...t
}), v = (e, t) => ({
	color: e?.color,
	canCreate: e?.canCreate,
	actions: e?.actions?.map((e) => ({
		id: e.id,
		label: t(e.label, e.id),
		icon: _(e.icon)
	}))
}), y = (e) => typeof e == "object" && !!e && !Array.isArray(e), b = (e, t, n, r, i) => (t ?? []).map((t) => {
	let a = t.display, o = a?.kind === "badge-list" && typeof a.itemsAttributeId == "string" ? {
		kind: "badge-list",
		itemsAttributeId: a.itemsAttributeId
	} : void 0;
	a && !o && i?.(t.id, a.kind);
	let s = () => {
		let { type: e } = t;
		return e.kind !== "enum" && e.kind !== "enum-multi" ? e : {
			...e,
			options: Array.isArray(e.options) ? e.options.map((e) => ({
				...e,
				label: n(e.label, e.value)
			})) : e.options
		};
	};
	return r(e, {
		...t,
		label: n(t.label, t.id),
		type: s(),
		display: o
	});
}), x = (e, t, n, r, i) => {
	let a = b(e, t, n, r, i), o = /* @__PURE__ */ new Set(), s = JSON.stringify(t);
	return {
		source: {
			getSnapshot: () => a,
			subscribe: (e) => (o.add(e), () => o.delete(e))
		},
		set(t) {
			let c = JSON.stringify(t);
			if (c !== s) {
				s = c, a = b(e, t, n, r, i);
				for (let e of o) e();
			}
		}
	};
}, S = (e) => !!(e && typeof e == "object" && typeof e.type == "string" && typeof e.id == "string"), C = (e, t) => {
	let { resource: n } = t;
	if (S(n)) return n;
}, w = (e, t) => {
	let n = C(e, t);
	if (n) return n;
	if (e.resourceKind) return {
		type: e.resourceKind,
		id: t.id,
		label: t.title
	};
}, T = (e, t) => {
	let n = e, r = t(n);
	return r === void 0 ? n : {
		...n,
		resource: r
	};
}, E = (...e) => Object.assign({}, ...e.filter((e) => !!e)), D = (e) => e && typeof e == "object" && !Array.isArray(e) ? e : void 0, O = (e) => Object.keys(e ?? {}).length > 0, k = /* @__PURE__ */ new Set([
	"text",
	"longtext",
	"markdown",
	"number",
	"boolean",
	"select",
	"multi-select",
	"files"
]), A = (e, t, n) => {
	if (!k.has(t.type)) return;
	let r = "options" in t && Array.isArray(t.options) ? t.options : [], i = t;
	return {
		id: e,
		label: n(t.label, e),
		description: t.description === void 0 ? void 0 : n(t.description),
		placeholder: i.placeholder === void 0 ? void 0 : n(i.placeholder),
		type: t.type,
		required: t.required === !0,
		defaultValue: t.defaultValue,
		options: t.type === "select" || t.type === "multi-select" ? r.map((e) => ({
			value: e.value,
			label: n(e.label, e.value),
			icon: e.icon
		})) : void 0,
		multiple: t.type === "files" ? i.multiple !== !1 : void 0,
		accept: t.type === "files" && typeof i.accept == "string" ? i.accept : void 0
	};
}, j = (e, t) => Object.entries(e.createRow?.params ?? {}).flatMap(([e, n]) => {
	let r = A(e, n, t);
	return r ? [r] : [];
}), M = (e, t) => p({
	id: t.id,
	kind: "kanbanRenderer",
	projectId: e.projectId,
	context: { kanbanRendererId: t.id }
}), N = (e, t, n, r, i, a, o) => {
	let s = i ?? e.workbench.getPrimaryResource();
	return h(e, n, {
		params: {
			renderer: {
				rendererId: t.id,
				...o ? { pageParams: o } : {},
				projectId: e.projectId,
				...s ? { resource: s } : {},
				invocation: { placement: "visible" }
			},
			...r
		},
		resource: s,
		signal: a,
		slot: M(e, t),
		metadata: { kanbanRendererId: t.id }
	});
}, P = (e, t) => `workbench.extension.kanbanRenderer.${e.id}.rowAction.${t.id}`, F = (e, t, n) => (t.rowActions ?? []).map((r) => {
	let i = e.workbench.commands.getCommand(r.commandId)?.command;
	return e.workbench.commands.registerCommand({
		id: P(t, r),
		label: n(r.label, r.id),
		icon: r.icon,
		params: i?.params
	}, { execute: (n, i) => N(e, t, r.commandId, E(D(n)), i?.resource) });
}), I = (e, t, n, r, i, a) => {
	let o = P(t, n), s = e.workbench.commands.getCommand(o), c = { rowId: r.id }, l = i ? { resource: i } : void 0, u = a(n.label, n.id);
	return s && O(s.command.params) ? (e.workbench.commandPalette.requestParams({
		record: s,
		label: u,
		args: c,
		context: l
	}), Promise.resolve()) : s ? e.workbench.commands.executeCommand(s.command.id, c, l).then(() => void 0) : N(e, t, n.commandId, c, i).then(() => void 0);
}, L = (e) => {
	let { context: t, record: n, rowResource: r, onMetadata: i } = e, a = /* @__PURE__ */ new WeakMap(), s = 0, c = /* @__PURE__ */ new Map();
	return {
		original: (e) => a.get(e) ?? e,
		read: async (e, l) => {
			let u = ++s, d = await N(t, n, n.queryHandlerId, {
				settings: e.settings,
				filter: e.filter,
				sorts: e.sorts,
				...e.page && { page: e.page }
			}, void 0, l, e.pageParams), f = [];
			Array.isArray(d) ? f = d : y(d) && (f = d.rows ?? []);
			let p = /* @__PURE__ */ new Map(), m = f.map((e) => {
				let i = e, s = JSON.stringify(e), l = c.get(i.id), u = e.target, d = l?.signature === s ? l.row : {
					...T(e, r),
					...u ? { target: o(u, {
						extensionId: n.extensionId,
						projectId: t.projectId
					}) } : {}
				};
				return a.set(d, i), p.set(d.id, {
					signature: s,
					row: d
				}), d;
			});
			return u === s && (c = p, y(d) && i(d)), {
				rows: m,
				page: y(d) ? d.page : void 0
			};
		}
	};
}, R = (e) => e ? l(r, {
	name: e,
	size: 16
}) : void 0, z = (e, t) => {
	if (e.createRow) return {
		title: t(e.createRow.title, "Create row"),
		submitLabel: t(e.createRow.submitLabel, "Create"),
		fields: j(e, t),
		labels: {
			cancel: t(e.createRow.labels?.cancel, "Cancel"),
			properties: t(e.createRow.labels?.properties, "Properties"),
			submitError: t(e.createRow.labels?.submitError, "Could not create resource."),
			removeFile: t(e.createRow.labels?.removeFile, "Remove file"),
			submitWithoutOpening: t(void 0, "Create without opening")
		}
	};
}, B = (e, t, n, r, i) => {
	if (t.rowActivationHandlerId) return async (n) => {
		let a = r(t, n);
		await N(e, t, t.rowActivationHandlerId, { row: i(n) }, a);
	};
	if (n.onRowClick) return (e) => n.onRowClick?.({
		record: t,
		row: e,
		resource: r(t, e)
	});
}, V = (e, t, n, r) => {
	let i = e.createRow;
	if (i) return async (a) => {
		let o = E(a.values, i.columnParam ? { [i.columnParam]: a.columnId } : void 0, i.attributesParam ? { [i.attributesParam]: a.attributeValues } : void 0), s = await n(e, i.commandId, o);
		if (await t.onAfterCreate?.({
			record: e,
			created: s,
			submission: a
		}), a.openCreatedRow === !1 || !r || typeof s != "object" || !s) return;
		let c = s;
		typeof c.id == "string" && typeof c.title == "string" && await r({
			...c,
			id: c.id,
			title: c.title,
			attributes: c.attributes ?? {}
		});
	};
}, H = (e, t, n, r, i) => {
	let a = t.rowActions;
	if (a?.length) return (o) => a.map((a) => {
		let s = i(t, o), c = () => I(e, t, a, o, s, r);
		return {
			key: a.id,
			label: r(a.label, a.id),
			commandId: a.commandId,
			icon: R(a.icon),
			onClick: () => n.executeRowAction ? n.executeRowAction({
				record: t,
				action: a,
				row: o,
				resource: s,
				runDefault: c
			}) : c()
		};
	});
}, U = (n, r, i = {}) => {
	let o = [], s = i.resolveLabel ?? ((e, n) => t(e, n)), l = (e, t) => {
		let r = t.display?.kind === "badge-list" ? {
			...t,
			render: (r, i) => d(t, r, i, void 0, (r) => {
				if (t.display?.kind !== "badge-list") return;
				let a = c(i, t.display.itemsAttributeId, r, e.extensionId, n.projectId);
				return a ? () => {
					n.workbench.navigation.openTarget(a);
				} : void 0;
			})
		} : t;
		return i.decorateAttribute?.(e, r) ?? r;
	}, u = i.resolveRowResource ?? C, f = i.resolveRowActionResource ?? w, p = i.onAfterMutation ?? (() => {}), m = (e, t, r) => N(n, e, t, r).then((t) => (p(e), t));
	for (let t of r) {
		let r = x(t, t.attributes, s, l, (e, r) => n.workbench.notifications.show({
			id: `workbench.extension.${t.extensionId}.kanban.${t.id}.display.${e}`,
			level: "error",
			title: "Extension display is not available",
			message: `Attribute "${e}" in renderer "${t.id}" uses unknown display kind "${r}".`
		})), c = t.attributes, d = e(t), p, h = L({
			context: n,
			record: t,
			rowResource: (e) => u(t, e),
			onMetadata: (e) => {
				c = e.attributes ?? c, r.set(c), p = e.boardColumnConfigs;
			}
		}), _ = h.original, y = B(n, t, i, u, _);
		o.push(...F(n, t, s)), o.push(n.workbench.views.registerView({
			id: t.id,
			title: s(t.title, t.id),
			icon: t.icon,
			body: {
				kind: "kanban",
				resourceKind: t.resourceKind,
				toolbarActions: g(t),
				listRowActions: () => (t.rowActions ?? []).map((e) => ({
					commandId: e.commandId,
					label: s(e.label, e.id)
				})),
				storageScope: n.projectId,
				attributes: r.source,
				defaultSettings: d.settings,
				defaultFilter: t.defaultFilter,
				defaultSorts: t.defaultSorts,
				viewsProvider: i.createViewsProvider?.(t),
				defaultViews: d.views.map((e) => ({
					...e,
					title: s(e.title, e.id)
				})),
				defaultActiveViewId: t.defaultActiveViewId,
				emptyTitle: s(t.emptyTitle, ""),
				emptyDescription: s(t.emptyDescription, ""),
				hideToolbar: t.hideToolbar,
				createRow: z(t, s),
				getBoardColumnConfig: (e) => v(p?.[e], s),
				onRowActivate: y,
				executeQuery: async (e, t) => (await h.read(e, t)).rows,
				executePage: t.queryMode === "paged" ? async (e, t) => a(await h.read(e, t), e.page) : void 0,
				onAttributeChange: t.attributeChangeHandlerId ? (e, n, r) => m(t, t.attributeChangeHandlerId, {
					rowId: e,
					attributeId: n,
					value: r
				}).then(() => void 0) : void 0,
				onMove: t.moveHandlerId ? (e) => m(t, t.moveHandlerId, { ...e }).then(() => void 0) : void 0,
				onCreateRow: V(t, i, m, t.rowActivationHandlerId ? y : void 0),
				onColumnAction: t.columnActionHandlerId ? async (e, n) => {
					await m(t, t.columnActionHandlerId, {
						columnId: e,
						actionId: n
					});
				} : void 0,
				getRowContextMenuActions: H(n, t, i, s, f)
			}
		}));
	}
	return { dispose() {
		for (let e = o.length - 1; e >= 0; --e) o[e]?.dispose();
	} };
};
export { m as a, h as i, g as n, f as o, p as r, U as t };

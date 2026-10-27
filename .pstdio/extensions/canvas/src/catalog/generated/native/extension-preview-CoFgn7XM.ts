// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e, o as t, p as n } from "./schemas-D84h_Ad-.ts";
import { t as r } from "./resource-ref-D_HHex4N.ts";
import { _ as i, f as a, t as o } from "./workbench-core-kaLFKJEn.ts";
import { n as s } from "./controls-view-ywasq8Ff.ts";
import { t as c } from "./collection-view-builtins-CQzYQ2MW.ts";
import { t as l } from "./webview-host-capabilities-BLbyfvWF.ts";
import { n as u } from "./workbench-resource-mutation-fSotiWIh.ts";
import { t as d } from "./navigation-level-composition-CFeKYFum.ts";
import { t as f } from "./icon-D3uE7jD-.ts";
import { r as ee } from "./workbench-BbqJVWhj.ts";
import { i as p, r as m } from "./file-renderer-view-BbUfkXgr.ts";
import { n as te, t as ne } from "./bridge-webview-renderer-C6odAKfW.ts";
import { t as h } from "./extension-navigation-target-zjAG34BD.ts";
import { a as g, i as _, n as re, o as v, r as y, t as ie } from "./kanban-renderer-contributions-Cws4IFXO.ts";
import { t as b } from "./param-schema-localization-Bo9iKWsO.ts";
import { n as ae, r as oe, t as se } from "./extension-contributions-CzIuN5EO.ts";
import { createElement as x } from "react";
import { commandRefId as S, contributionRefId as C, isNavigationTarget as ce, matchesResourceWhen as le, resourceKey as w } from "@pstdio/sdk/extensions";
// packages/pstdio-api-contracts/src/extension-kernel/types/composition.ts
var ue = [
	"main",
	"secondary",
	"side"
], de = (e) => ({
	defaultSettings: e.defaultSettings ?? {},
	defaultFilter: e.defaultFilter ?? {
		conjunction: "and",
		rules: []
	},
	defaultSorts: e.defaultSorts ?? [],
	defaultViews: e.defaultViews?.map((e) => ({
		...e,
		filter: e.filter ?? {
			conjunction: "and",
			rules: []
		},
		sorts: e.sorts ?? []
	}))
}), fe = n({
	resource: r,
	autoOpen: t().optional(),
	region: e(ue),
	open: e(["preview", "pin"]).optional()
}), pe = (e) => typeof e == "object" && !!e && !Array.isArray(e), me = (e, t) => `${e.extensionId ?? t}.command.${e.id}`, he = async (e, t, n) => {
	let { target: r } = n;
	r.kind === "command" ? (await _(e, me(r.target.command, t.extensionId), { params: r.target.params }), e.workbench.commandPaletteResources.refresh()) : await e.workbench.navigation.openTarget(h(r, { extensionId: t.extensionId }));
}, ge = (e) => {
	if (e.kind === "page" || e.kind === "panel") return e.resource;
	if (e.kind === "compound") return e.targets.find((e) => e.resource)?.resource;
}, _e = (e, t, n, r) => ({
	id: `${t.id}:${r.id}`,
	resource: (() => {
		let n = ge(r.target);
		return n ? {
			...n,
			projectId: n.projectId ?? e.projectId,
			extensionId: n.extensionId ?? t.extensionId
		} : void 0;
	})(),
	label: r.label,
	description: r.description,
	icon: r.icon,
	keywords: r.keywords,
	group: n,
	activate: () => he(e, t, r)
}), ve = (e, t) => {
	let n = [];
	for (let r of t) {
		let t = u(r.title, r.id);
		n.push(e.workbench.commandPaletteResources.registerProvider({
			id: r.id,
			title: t,
			refreshEventIds: r.refreshEventIds,
			query: async ({ query: n, limit: i, signal: a }) => {
				let o = e.workbench.getActiveResource(), s = await _(e, r.queryHandlerId, {
					signal: a,
					params: {
						projectId: e.projectId,
						modeId: e.workbench.modes.getActiveModeId(),
						activeResource: o,
						providerId: r.id,
						query: n,
						limit: i
					}
				});
				return pe(s) ? (s.items ?? []).map((n) => _e(e, r, t, n)) : [];
			}
		}));
	}
	return { dispose() {
		for (let e = n.length - 1; e >= 0; --e) n[e]?.dispose();
	} };
}, T = (e, t = "") => u(e, t), ye = (e, t, n) => {
	let r = y({
		id: t.id,
		kind: "renderer",
		projectId: e.projectId,
		context: { controlsRendererId: t.id }
	}), i = (n, i, a, o, s) => n ? _(e, n, {
		params: {
			renderer: {
				rendererId: t.id,
				...s ? { pageParams: s } : {},
				projectId: e.projectId,
				...a ? { resource: a } : {},
				invocation: { placement: "visible" }
			},
			...i
		},
		resource: a,
		signal: o,
		slot: r,
		metadata: { controlsRendererId: t.id }
	}) : Promise.resolve(void 0);
	return e.workbench.views.registerView({
		id: t.id,
		title: T(t.title, t.id),
		icon: t.icon,
		body: {
			kind: "controls",
			emptyTitle: T(t.emptyTitle, ""),
			emptyDescription: T(t.emptyDescription, ""),
			defaultValues: t.defaultValues,
			executeQuery: async (e, r, a) => {
				let o = await i(t.queryHandlerId, {}, e ?? n.resolveResource?.(t), r, a), c = s.safeParse(o);
				if (!c.success) {
					let e = c.error.issues.map((e) => `body.query.${e.path.join(".")}: ${e.message}`).join("; ");
					throw Error(`Extension "${t.extensionId}" view "${t.id}" has invalid controls. Expected serializable control declarations. ${e}`);
				}
				return c.data;
			},
			updateValue: t.valueChangeHandlerId ? ({ controlId: e, value: n, values: r, resource: a }) => i(t.valueChangeHandlerId, {
				controlId: e,
				value: n,
				values: r
			}, a).then(() => void 0) : void 0,
			apply: t.applyHandlerId ? ({ values: e, resource: n }) => i(t.applyHandlerId, { values: e }, n).then(() => void 0) : void 0,
			reset: t.resetHandlerId ? ({ controlIds: e, resource: n }) => i(t.resetHandlerId, { controlIds: e }, n).then(() => void 0) : void 0
		}
	});
}, be = (e, t, n = {}) => {
	let r = [];
	for (let i of t) r.push(ye(e, i, n));
	return { dispose() {
		for (let e = r.length - 1; e >= 0; --e) r[e]?.dispose();
	} };
}, E = (e, t = "") => u(e, t), D = (e) => ({
	...e,
	label: E(e.label, e.id),
	description: e.description ? E(e.description) : void 0,
	icon: e.icon ? x(f, {
		name: e.icon,
		size: 14
	}) : void 0
}), xe = (e) => !!(e && typeof e == "object" && Array.isArray(e.rows)), Se = (e) => ({
	id: e.id,
	values: e.values,
	resource: e.resource ? e.resource : void 0
}), Ce = (e, t, n) => {
	let r = c(t), i = /* @__PURE__ */ new WeakMap(), a = y({
		id: t.id,
		kind: "dataTableRenderer",
		projectId: e.projectId,
		context: { dataTableRendererId: t.id }
	}), o = (n, r, i, o, s, c) => _(e, n, {
		params: {
			renderer: {
				rendererId: t.id,
				...c ? { pageParams: c } : {},
				projectId: e.projectId,
				...o ? { modeId: o } : {},
				...i ? { resource: i } : {},
				invocation: { placement: "visible" }
			},
			...r
		},
		resource: i,
		signal: s,
		slot: a,
		metadata: { dataTableRendererId: t.id }
	});
	return e.workbench.views.registerView({
		id: t.id,
		title: E(t.title, t.id),
		icon: t.icon,
		body: {
			kind: "dataTable",
			queryMode: t.queryMode,
			resourceKind: t.resourceKind,
			toolbarActions: re(t),
			columns: t.columns?.map(D),
			initialPageSize: t.initialPageSize,
			pageSizeOptions: t.pageSizeOptions,
			defaultSettings: r.settings,
			defaultFilter: t.defaultFilter,
			defaultSorts: t.defaultSorts,
			defaultViews: r.views.map((e) => ({
				...e,
				title: E(e.title, e.id)
			})),
			defaultActiveViewId: t.defaultActiveViewId,
			viewsProvider: n.createViewsProvider?.(t),
			selectionMode: t.selectionMode,
			selectionActions: t.selectionActions?.map((e) => ({
				id: e.id,
				commandId: e.commandId,
				label: E(e.label, e.id),
				icon: e.icon ? x(f, {
					name: e.icon,
					size: 16
				}) : void 0,
				destructive: e.destructive,
				run: (t) => o(e.commandId, { rowIds: t.map((e) => e.id) }).then(() => void 0)
			})),
			emptyTitle: t.emptyTitle ? E(t.emptyTitle) : void 0,
			emptyDescription: t.emptyDescription ? E(t.emptyDescription) : void 0,
			executeQuery: async ({ resource: e, modeId: r, filter: a, sorts: s, settings: c, pageParams: l, page: u }, d) => {
				let f = await o(t.queryHandlerId, {
					filter: a,
					sorts: s,
					settings: c,
					...u && { page: u }
				}, e, r, d, l);
				if (!xe(f)) {
					if (t.queryMode === "paged") throw Error("A paged provider must return rows and page metadata");
					return { rows: [] };
				}
				let p = f.rows.map((e) => {
					let r = Se(e);
					return n.resolveRowResource && (r.resource = n.resolveRowResource(t, e)), i.set(r, e), r;
				});
				return {
					rows: p,
					columns: f.columns?.map(D),
					...t.queryMode === "paged" && u ? ee({
						rows: p,
						page: f.page
					}, u) : {}
				};
			},
			rowActions: t.rowActions?.map((n) => ({
				id: n.id,
				commandId: n.commandId,
				label: E(n.label, n.id),
				icon: n.icon ? x(f, {
					name: n.icon,
					size: 16
				}) : void 0,
				destructive: n.destructive,
				run: async (r) => {
					await o(n.commandId, { rowId: r.id }, r.resource), e.workbench.views.refreshView(t.id);
				}
			})),
			onRowActivate: t.rowActivationHandlerId ? async (e) => {
				await o(t.rowActivationHandlerId, { row: i.get(e) ?? e }, e.resource);
			} : void 0
		}
	});
}, we = (e, t, n = {}) => {
	let r = t.map((t) => Ce(e, t, n));
	return { dispose() {
		for (let e = r.length - 1; e >= 0; --e) r[e]?.dispose();
	} };
}, Te = (e) => ({
	id: e.rendererId,
	kind: "renderer",
	context: {
		projectId: e.projectId,
		...e.resource ? {
			resourceType: e.resource.type,
			resourceId: e.resource.id
		} : {}
	}
}), O = async (e, t, n, r, i = {}, a, o, s) => {
	let c = r;
	return g(e, n, {
		params: {
			renderer: {
				rendererId: t,
				...s ? { pageParams: s } : {},
				projectId: e.projectId,
				...c ? { resource: c } : {},
				invocation: { placement: "visible" }
			},
			...i
		},
		resource: c,
		signal: o,
		slot: Te({
			projectId: e.projectId,
			rendererId: t,
			resource: c
		}),
		...a ? { metadata: a } : {}
	});
}, Ee = (e) => {
	if (!e || typeof e != "object") return;
	let t = e.revision;
	return typeof t == "string" ? t : void 0;
}, De = (e, t) => e.workbench.views.registerView({
	id: t.id,
	title: u(t.title, t.id),
	icon: t.icon,
	body: {
		kind: "file",
		resourceKind: t.resourceKind,
		load: async (n, r, i) => {
			let a = await O(e, t.id, t.loadHandlerId, n, {}, { fileStorageVersions: {} }, r, i);
			return m(v(a) ?? {}, a);
		},
		save: t.saveHandlerId ? async (n, r, i, a) => {
			let o = await O(e, t.id, t.saveHandlerId, n, { content: r }, {
				fileStorageVersions: p(a),
				...i ? { fileRendererOrigin: i } : {},
				...w(n) ? { fileRendererResourceKey: w(n) } : {}
			}), s = Ee(v(o));
			return m(s ? { revision: s } : {}, o);
		} : void 0
	}
}), Oe = (e) => {
	let t = [];
	for (let n of e.metadata.fileRenderers ?? []) t.push(De(e, n));
	return { dispose() {
		for (let e = t.length - 1; e >= 0; --e) t[e]?.dispose();
	} };
}, k = (e) => ({
	id: e.treeId,
	kind: "renderer",
	context: {
		projectId: e.projectId,
		treeId: e.treeId,
		...e.modeId ? { modeId: e.modeId } : {},
		...e.resource ? {
			resourceType: e.resource.type,
			resourceId: e.resource.id
		} : {}
	}
}), A = (e, t, n, r) => {
	let i = n.resource, a = e.workbench.modes.getActiveModeId();
	return {
		renderer: {
			rendererId: t.id,
			...n.pageParams ? { pageParams: n.pageParams } : {},
			projectId: e.projectId,
			...a ? { modeId: a } : {},
			...i ? { resource: i } : {},
			invocation: { placement: "visible" }
		},
		state: n.state,
		...n.filter ? { filter: n.filter } : {},
		...r ? { node: r } : {}
	};
}, j = async (e, t, n, r, i) => {
	let a = r.renderer, o = a?.resource;
	return _(e, n, {
		params: r,
		signal: i,
		resource: o,
		slot: k({
			modeId: a?.modeId,
			projectId: e.projectId,
			resource: o,
			treeId: t.id
		})
	});
}, M = async (e, t, n, r, i) => {
	let a = e.workbench.modes.getActiveModeId(), o = {
		...r ?? {},
		renderer: {
			rendererId: t.id,
			projectId: e.projectId,
			...a ? { modeId: a } : {},
			...i ? { resource: i } : {},
			invocation: { placement: "visible" }
		}
	};
	return _(e, n, {
		params: o,
		resource: i,
		slot: k({
			modeId: a,
			projectId: e.projectId,
			resource: i,
			treeId: t.id
		}),
		metadata: { treeId: t.id }
	});
}, ke = (e, t) => e.panels.flatMap((e) => [e, ...e.panelMenus ?? []]).filter((e) => e.renderer?.kind === "tree" && e.renderer.id === t.id), N = (e, t) => t.viewId ? e.find((e) => e.id === t.viewId) : e.length === 1 ? e[0] : void 0, Ae = async (e) => {
	let { ctx: t, getHostTreeHeaderNodes: n, record: r, treeViews: i } = e, a = N(i, t);
	return !a || !("hostTreeHeader" in a) || a.hostTreeHeader !== "default" ? [] : await n?.({
		ctx: t,
		record: r,
		panel: a
	}) ?? [];
}, je = async (e) => {
	let { ctx: t, getHostTreeFooterNodes: n, record: r, treeViews: i } = e, a = N(i, t);
	return !a || !("hostTreeFooter" in a) || a.hostTreeFooter !== "default" ? [] : await n?.({
		ctx: t,
		record: r,
		panel: a
	}) ?? [];
}, Me = (e, t) => (e.structure ?? []).map((e) => ({
	id: e.id,
	label: u(e.label),
	collapsible: e.collapsible,
	hiddenByDefault: e.hiddenByDefault,
	canHide: e.canHide,
	loading: !e.resourceNode,
	nodes: e.resourceNode && t ? [{
		id: e.resourceNode.id,
		label: t.label ?? t.id ?? t.type,
		icon: e.resourceNode.icon,
		resource: t,
		selected: !0
	}] : []
})), Ne = (e, t) => e && typeof e == "object" && !Array.isArray(e) ? e : t, P = (e) => e && !Array.isArray(e) ? e : void 0, Pe = (e, t) => {
	let n = /* @__PURE__ */ new WeakMap(), r = `workbench.extensionTreeRenderer.${t.id}.command`, i = (t) => e.resolveNodeResource?.(t) ?? t, a = (e) => {
		if (e.emptyState) return {
			title: u(e.emptyState.title),
			description: u(e.emptyState.description),
			icon: e.emptyState.icon
		};
	}, o = (n, i, a) => n ? h(n, {
		commandTargetOf: (e) => ({
			kind: "command",
			commandId: r,
			args: {
				commandId: `${e.target.command.extensionId ?? t.extensionId}.command.${e.target.command.id}`,
				...i ? { nodeId: i.id } : {},
				params: e.target.params,
				resource: i?.resource ?? a.resource,
				treeId: t.id
			}
		}),
		extensionId: t.extensionId,
		projectId: e.projectId
	}) : void 0, s = (n, r, i) => {
		let a = n.command ? S({
			...n.command,
			extensionId: n.command.extensionId ?? t.extensionId
		}) : void 0;
		return {
			id: n.id,
			resourceMutation: e.metadata.commands.find((e) => e.id === a)?.resourceMutation,
			label: u(n.label),
			icon: n.icon,
			args: P(n.params),
			params: b(n.input, u, t.extensionId),
			submitLabel: n.submitLabel,
			when: n.when,
			disabled: n.disabled,
			run: a ? async (o) => {
				let s = Ne(o, P(n.params));
				n.command?.extensionId === "pstdio" ? await e.workbench.commands.executeCommand(a, s, { resource: r?.resource ?? i.resource }) : (await M(e, t, a, s, r?.resource ?? i.resource), i.refresh());
			} : void 0
		};
	}, c = (e, t) => {
		let r = {
			id: e.id,
			selected: e.selected,
			label: u(e.label),
			icon: e.icon,
			iconColor: e.iconColor,
			badge: e.badge,
			iconTooltip: e.iconTooltip,
			tooltip: e.tooltip,
			resource: e.resource ? i(e.resource) : void 0,
			target: o(e.target, e, t),
			rowVariant: e.rowVariant,
			actions: e.actions?.map((n) => s(n, e, t)),
			contextMenuActions: e.contextMenuActions?.map((n) => s(n, e, t)),
			collapsible: e.collapsible,
			disabled: e.disabled,
			children: e.children?.map((e) => c(e, t)),
			description: e.description,
			contextValue: e.contextValue,
			hiddenByDefault: e.hiddenByDefault,
			canHide: e.canHide,
			canDrag: e.canDrag,
			canDrop: e.canDrop
		};
		return n.set(r, e), r;
	};
	return {
		mapNodes: (e, t) => e.map((e) => c(e, t)),
		mapSections: (e, t) => e.map((e) => ({
			id: e.id,
			label: u(e.label),
			actions: e.actions?.map((e) => s(e, void 0, t)),
			collapsible: e.collapsible,
			emptyState: a(e),
			nodes: e.nodes.map((e) => c(e, t)),
			hiddenByDefault: e.hiddenByDefault,
			canHide: e.canHide
		})),
		originalNodes: n,
		runnerCommandId: r
	};
}, F = (e) => Array.isArray(e) && e.every((e) => e && typeof e == "object" && "nodes" in e), Fe = (e) => Array.isArray(e) && e.every((e) => e && typeof e == "object" && "id" in e), I = (e, t) => t.length > 0 ? [{
	id: e,
	nodes: t,
	canReorder: !1
}] : [], Ie = (e, t) => {
	let n = Pe(e, t), r = ke(e.metadata, t), i = e.workbench.commands.registerCommand({
		id: n.runnerCommandId,
		label: `${u(t.title, t.id)} tree command`
	}, { execute: async (n) => {
		let r = n, i = await M(e, t, r.commandId, r.params, r.resource);
		for (let t of e.workbench.views.listViews()) t.body.kind === "file" && e.workbench.views.refreshView(t.id);
		return i;
	} }), a = e.workbench.views.registerView({
		id: t.id,
		title: u(t.title, t.id),
		icon: t.icon,
		body: {
			kind: "tree",
			getStructure: t.structure ? (e) => Me(t, e.resource) : void 0,
			searchable: t.searchable,
			searchPlaceholder: u(t.searchPlaceholder, "Search files"),
			defaultExpandedNodeIds: t.defaultExpandedNodeIds,
			defaultExpandedSectionIds: t.defaultExpandedSectionIds,
			getHeader: async (i) => {
				let a = await Ae({
					ctx: i,
					getHostTreeHeaderNodes: e.getHostTreeHeaderNodes,
					record: t,
					treeViews: r
				});
				if (!t.headerHandlerId) return I(`${t.id}:host-header`, a);
				let o = await j(e, t, t.headerHandlerId, A(e, t, i), i.signal), s = F(o) ? n.mapSections(o, i) : [];
				return [...I(`${t.id}:host-header`, a), ...s];
			},
			getBody: async (r) => {
				let i = await j(e, t, t.bodyHandlerId, A(e, t, r), r.signal);
				return F(i) ? n.mapSections(i, r) : [];
			},
			getFooter: async (i) => {
				let a = await je({
					ctx: i,
					getHostTreeFooterNodes: e.getHostTreeFooterNodes,
					record: t,
					treeViews: r
				});
				if (!t.footerHandlerId) return I(`${t.id}:host-footer`, a);
				let o = await j(e, t, t.footerHandlerId, A(e, t, i), i.signal);
				return [...F(o) ? n.mapSections(o, i) : [], ...I(`${t.id}:host-footer`, a)];
			},
			moveNode: t.moveHandlerId ? async (r, i, a) => {
				let o = n.originalNodes.get(r), s = i ? n.originalNodes.get(i) : void 0;
				!o?.canDrag || i && !s?.canDrop || (await j(e, t, t.moveHandlerId, {
					...A(e, t, a),
					source: o,
					target: s,
					position: a.position ?? "inside"
				}), a.refresh());
			} : void 0,
			getChildren: async (r, i) => {
				if (!t.childrenHandlerId) return r.children ?? [];
				let a = n.originalNodes.get(r);
				if (!a) return r.children ?? [];
				let o = await j(e, t, t.childrenHandlerId, A(e, t, i, a), i.signal);
				return Fe(o) ? n.mapNodes(o, i) : [];
			}
		}
	});
	return { dispose() {
		a.dispose(), i.dispose();
	} };
}, Le = (e) => {
	let t = [];
	for (let n of e.metadata.treeRenderers ?? []) t.push(Ie(e, n));
	return { dispose() {
		for (let e = t.length - 1; e >= 0; --e) t[e]?.dispose();
	} };
}, L = (e) => ({
	kind: e.kind,
	id: C(e),
	extensionId: e.extensionId
}), Re = (e, t, n) => {
	let r = n?.(t.when);
	return !r || e.context.matches(r);
}, ze = (e) => ({
	id: e.id,
	label: u(e.label, e.id),
	icon: e.icon,
	canHide: !0,
	canReorder: !0,
	target: h(e.action, { extensionId: e.extensionId })
}), Be = (e, t, n) => {
	let r = /* @__PURE__ */ new Map();
	for (let i of t) {
		if (!Re(e, i, n)) continue;
		let t = i.group || void 0, o = t ? `${i.extensionId}:${t}` : a(i.slot), s = r.get(o) ?? {
			id: o,
			label: t,
			collapsible: !!t,
			canHide: !0,
			canReorder: !0,
			nodes: []
		};
		s.nodes.push(ze(i)), r.set(o, s);
	}
	return [...r.values()];
}, Ve = (e) => {
	let t = /* @__PURE__ */ new Map();
	for (let n of e) {
		let e = L(n.owner), r = `${n.extensionId}:${e.kind}:${e.id}:${n.slot}`;
		t.set(r, [...t.get(r) ?? [], n]);
	}
	return [...t.values()];
}, He = (e) => [...new Set(e.flatMap((e) => e.group ? [`${e.extensionId}:${e.group}`] : []))], Ue = (e) => Ve(e.metadata.navigationItems).map((t) => {
	let n = t[0], r = t.some((e) => e.when?.resourceType?.length || e.when?.metadata);
	return e.workbench.navigationTrees.registerContribution({
		id: `${n.extensionId}.navigation-items.${n.owner.kind}.${C(n.owner)}.${n.slot}`,
		owner: L(n.owner),
		sourceExtensionId: n.extensionId,
		declarationIndex: e.metadata.navigationItems.indexOf(n),
		slot: n.slot,
		defaultExpandedSectionIds: He(t),
		...r ? {} : { resolveResource: () => void 0 },
		getSections: () => Be(e.workbench, t, e.createWhenExpression),
		listActions: () => t.map((e) => ({
			label: u(e.label, e.id),
			category: e.group || void 0,
			action: h(e.action, { extensionId: e.extensionId })
		}))
	});
}), We = (e) => e.metadata.navigationTrees.map((t, n) => {
	let r = C(t.view);
	return e.workbench.navigationTrees.registerContribution({
		id: t.id,
		idScope: t.id,
		owner: L(t.owner),
		sourceExtensionId: t.extensionId,
		declarationIndex: e.metadata.navigationItems.length + n,
		slot: t.slot,
		viewId: r,
		...t.resourceScope === "project" ? { resolveResource: () => void 0 } : {}
	});
}), Ge = (e) => [...Ue(e), ...We(e)], Ke = (e) => e.metadata.resourceKinds.map((t) => e.workbench.resources.registerKind({
	kind: t.id,
	extensionId: t.extensionId,
	label: u(t.label, t.id),
	icon: t.icon ?? "FileText",
	relatedOpenings: t.relatedOpeningsCommand ? async (n, r) => {
		let i = await e.executeCommand(t.relatedOpeningsCommand, {
			projectId: e.projectId,
			resource: n,
			source: "dashboard"
		}, r);
		return r.throwIfAborted(), fe.array().parse(v(i)).map((n) => ({
			...n,
			resource: {
				...n.resource,
				projectId: n.resource.projectId ?? e.projectId,
				extensionId: n.resource.extensionId ?? t.extensionId
			}
		}));
	} : void 0
})), qe = () => {
	if (typeof navigator > "u") return;
	let e = `${navigator.platform} ${navigator.userAgent}`.toLowerCase();
	if (e.includes("mac")) return "mac";
	if (e.includes("win")) return "win";
	if (e.includes("linux")) return "linux";
}, Je = (e, t = qe()) => (t ? e.platformOverrides?.[t] : void 0) ?? e.key, Ye = (e) => e.bindings.map((t) => e.workbench.keybindings.registerKeybinding({
	sourceExtensionId: t.extensionId,
	action: h(t.action, { commandIdOf: (e) => e.extensionId ? S({
		extensionId: e.extensionId,
		id: e.id
	}) : void 0 }),
	keybinding: Je(t),
	when: e.createWhenExpression?.(t.when)
})), Xe = (e) => {
	if (!e) return;
	let t = (e) => {
		if (e) return Array.isArray(e) ? e.map((e) => C(e)) : C(e);
	};
	return {
		mode: t(e.mode),
		source: e.source,
		viewId: t(e.view),
		resourceType: e.resourceType?.map((e) => e.extensionId === "pstdio" ? e.id : `${e.extensionId}.${e.id}`),
		metadata: e.metadata
	};
}, R = (e) => !(!e || typeof e != "object" || Array.isArray(e)), Ze = (e, t, n) => ce(e) ? h(e, {
	extensionId: t,
	projectId: n
}) : void 0, Qe = (e, t, n) => Array.isArray(e) ? e.flatMap((e) => {
	if (!R(e) || typeof e.id != "string") return [];
	let r = Ze(e.action, t, n);
	return [{
		id: e.id,
		label: u(e.label, e.id),
		icon: typeof e.icon == "string" ? e.icon : void 0,
		iconColor: typeof e.iconColor == "string" ? e.iconColor : void 0,
		selected: e.selected === !0,
		disabled: e.disabled === !0,
		action: r ? {
			kind: "navigation",
			target: r
		} : void 0
	}];
}) : [], z = (e, t, n) => {
	if (!R(e)) return {};
	let r = R(e.indicator) ? {
		icon: String(e.indicator.icon ?? ""),
		color: typeof e.indicator.color == "string" ? e.indicator.color : void 0,
		label: u(e.indicator.label)
	} : void 0, i = Array.isArray(e.menu) ? e.menu.flatMap((e) => !R(e) || typeof e.id != "string" || !Array.isArray(e.rows) ? [] : [{
		id: e.id,
		label: u(e.label),
		rows: Qe(e.rows, t, n)
	}]) : void 0;
	return {
		label: u(e.label),
		icon: typeof e.icon == "string" ? e.icon : void 0,
		indicator: r?.icon ? r : void 0,
		menu: i
	};
}, $e = (e, t) => {
	let n = /* @__PURE__ */ new Map(), r = /* @__PURE__ */ new Map(), i = /* @__PURE__ */ new Map(), a = /* @__PURE__ */ new Set(), o = new Set(t.refreshEventIds ?? []), s = 0, c = (e) => JSON.stringify([e.instanceId, e.resource]), l = (o) => {
		r.set(o.instanceId, o);
		let u = c(o), d = i.get(u);
		if (d) return d;
		let f = o.resource, ee = s, p = Promise.resolve(_(e, t.queryHandlerId, {
			resource: f,
			params: { renderer: {
				rendererId: t.placementId,
				projectId: e.projectId,
				...f ? { resource: f } : {},
				invocation: { placement: "visible" }
			} }
		})).then(async (d) => {
			let f = r.get(o.instanceId);
			if (f && c(f) === u) {
				if (ee !== s) i.delete(u), await l(f);
				else {
					n.set(u, z(d, t.extensionId, e.projectId));
					for (let e of a) e();
				}
			}
		}).finally(() => {
			i.get(u) === p && i.delete(u);
		});
		return i.set(u, p), p;
	};
	return {
		refreshEvents: t.refreshEventIds,
		getSnapshot(e) {
			let t = r.get(e.instanceId), i = c(e);
			return t && c(t) !== i && n.delete(c(t)), r.set(e.instanceId, e), n.has(i) || l(e).catch(() => void 0), n.get(i) ?? {};
		},
		subscribe(t) {
			a.add(t);
			let n = e.workbench.resources.preview.subscribeRefresh(async (e) => {
				let t = [...r.values()].filter((t) => t.resource && w(t.resource) === w(e));
				t.length && (s++, await Promise.all(t.map(l)));
			}), i = e.subscribeRefreshEvents?.((e) => {
				if (o.has(e.id)) {
					s++;
					for (let e of r.values()) l(e).catch(() => void 0);
				}
			});
			return { dispose() {
				a.delete(t), i?.dispose(), n.dispose();
			} };
		}
	};
}, et = (e, t) => ({
	...e,
	tab: e.tab && t.createTab ? t.createTab({
		...e.tab,
		extensionId: t.extensionId,
		placementId: t.placementId
	}) : void 0
}), tt = (e, t) => {
	if (e.kind === "group") return e;
	let n = e.empty && "view" in e.empty ? {
		view: e.empty.view,
		breadcrumb: e.empty.breadcrumb ? z(e.empty.breadcrumb, t.extensionId, t.projectId) : void 0
	} : e.empty;
	return e.kind === "panels" ? {
		...e,
		empty: n
	} : {
		...e,
		empty: n,
		tab: e.tab && t.createTab ? t.createTab({
			...e.tab,
			extensionId: t.extensionId,
			placementId: t.placementId
		}) : void 0
	};
}, nt = (e, t = {}) => e.pages.map((e) => ({
	id: e.id,
	ref: {
		extensionId: e.extensionId,
		kind: "page",
		id: e.localId
	},
	title: e.title,
	path: e.path,
	document: e.document,
	params: e.params,
	regionSettings: e.regionSettings,
	modeId: C(e.mode),
	resource: e.resource,
	main: tt(e.main, {
		extensionId: e.extensionId,
		placementId: `${e.id}.$main`,
		...t
	}),
	panelView: e.panelView,
	slots: e.slots.map((n) => et(n, {
		extensionId: e.extensionId,
		placementId: `${e.id}.${n.id}`,
		...t
	})),
	...e.icon ? { icon: e.icon } : {},
	...e.parent ? { parentId: C(e.parent) } : {}
})), B = (e, t) => {
	let n = e.pages.flatMap((e) => [...e.main.kind === "view" && e.resource ? [{
		...e.resource,
		view: e.main.view
	}] : [], ...e.slots.flatMap((e) => e.item.kind === "binding" ? [e.item.binding] : [])]);
	return n.push(...e.placements.flatMap((e) => e.item.kind === "binding" ? [e.item.binding] : [])), n.find((e) => C(e.view) === t)?.kinds[0]?.id;
}, V = (e) => e.body.kind === "webview" ? { webview: e.body.webview } : { renderer: {
	kind: e.body.kind,
	id: e.id
} }, rt = (e, t) => e.viewMenus.flatMap((n) => {
	if (C(n.owner) !== t.id) return [];
	let r = e.views.find((e) => e.id === C(n.view));
	return r ? [{
		id: n.id,
		extensionId: n.extensionId,
		ownerPanelId: t.id,
		viewId: r.id,
		title: r.title,
		side: n.side,
		group: n.group,
		placement: n.placement,
		hostTreeHeader: n.hostTreeHeader,
		hostTreeFooter: n.hostTreeFooter,
		...V(r)
	}] : [];
}), it = (e) => e.views.map((t) => {
	let n = rt(e, t);
	return {
		id: t.id,
		extensionId: t.extensionId,
		title: t.title,
		icon: t.icon,
		panelMenus: n.length > 0 ? n : void 0,
		...V(t)
	};
}), H = (e) => e?.map(({ command: e, ...t }) => ({
	...t,
	commandId: S(e)
})), at = (e) => e.views.flatMap((t) => {
	let n = t.body;
	return n.kind === "kanban" ? [{
		...n,
		id: t.id,
		extensionId: t.extensionId,
		title: t.title,
		icon: t.icon,
		resourceKind: n.resourceKind ?? B(e, t.id),
		createRow: n.createRow ? {
			title: n.createRow.title,
			submitLabel: n.createRow.submitLabel,
			columnParam: n.createRow.columnParam,
			params: n.createRow.params,
			attributesParam: n.createRow.attributesParam,
			labels: n.createRow.labels,
			commandId: S(n.createRow.command),
			attachments: n.createRow.attachments ? {
				resourceParam: n.createRow.attachments.resourceParam,
				fileParam: n.createRow.attachments.fileParam,
				commandId: S(n.createRow.attachments.command)
			} : void 0
		} : void 0,
		rowActions: H(n.rowActions),
		toolbarActions: H(n.toolbarActions)
	}] : [];
}), ot = (e) => e.views.flatMap((t) => {
	let n = t.body;
	return n.kind === "dataTable" ? [{
		...n,
		id: t.id,
		extensionId: t.extensionId,
		title: t.title,
		icon: t.icon,
		resourceKind: n.resourceKind ?? B(e, t.id),
		selectionActions: H(n.selectionActions),
		rowActions: H(n.rowActions),
		toolbarActions: H(n.toolbarActions)
	}] : [];
}), st = (e) => e.views.flatMap((t) => t.body.kind === "tree" ? [{
	...t.body,
	id: t.id,
	extensionId: t.extensionId,
	title: t.title,
	icon: t.icon,
	resourceKind: t.body.resourceKind ?? B(e, t.id)
}] : []), ct = (e) => e.views.flatMap((t) => t.body.kind === "file" ? [{
	...t.body,
	id: t.id,
	extensionId: t.extensionId,
	title: t.title,
	icon: t.icon,
	resourceKind: t.body.resourceKind ?? B(e, t.id)
}] : []), lt = (e) => e.views.flatMap((t) => t.body.kind === "controls" ? [{
	...t.body,
	id: t.id,
	extensionId: t.extensionId,
	title: t.title,
	icon: t.icon,
	resourceKind: t.body.resourceKind ?? B(e, t.id)
}] : []), ut = (e) => e.modes.map((e) => ({
	id: e.id,
	extensionId: e.extensionId,
	modeId: e.id,
	label: e.label,
	icon: e.icon,
	panelRegions: e.regions,
	regionSettings: e.regionSettings,
	floatingPanels: e.floatingPanels,
	canFullscreen: e.canFullscreen,
	...e.defaultTheme ? { defaultTheme: C(e.defaultTheme) } : {},
	...e.chrome ? { chrome: Object.fromEntries(Object.entries(e.chrome).map(([e, t]) => [e, t !== !1 && C(t)])) } : {}
})), dt = (e, t = {}) => {
	let n = it(e);
	return {
		extensions: e.extensions,
		commands: e.commands,
		menuContributions: e.menuContributions,
		commandPaletteContributions: e.commandPaletteContributions,
		modes: ut(e),
		pages: nt(e, t),
		placements: e.placements.map((e) => ({
			id: e.id,
			ref: {
				extensionId: e.extensionId,
				kind: "placement",
				id: e.localId
			},
			modeId: C(e.mode),
			replaces: e.replaces,
			item: e.item,
			region: e.region,
			order: e.order,
			addableIn: e.addableIn,
			movableTo: e.movableTo,
			mountStrategy: e.mountStrategy,
			hiddenByDefault: e.hiddenByDefault,
			headerBorderBottom: e.headerBorderBottom,
			tab: e.tab && t.createTab ? t.createTab({
				...e.tab,
				extensionId: e.extensionId,
				placementId: e.id
			}) : void 0
		})),
		panels: n,
		resourceKinds: e.resourceKinds.map((e) => ({
			id: e.localId,
			relatedOpeningsCommand: e.relatedOpeningsCommand,
			extensionId: e.extensionId,
			label: e.label,
			icon: e.icon,
			menuSlots: Object.fromEntries((e.menuSlots ?? []).map((e) => [e.id, {
				placement: e.placement,
				label: e.label,
				external: e.access === "public",
				order: e.order
			}]))
		})),
		resourceHierarchyProviders: (e.resourceHierarchyProviders ?? []).map((e) => ({
			id: e.id,
			extensionId: e.extensionId,
			resourceKind: e.resourceKind.id
		})),
		settingsSections: e.settingsSections ?? [],
		settingsPanels: e.settingsPanels.flatMap((t) => {
			let n = e.views.find((e) => e.id === C(t.view));
			return n ? [{
				id: t.id,
				viewId: n.id,
				extensionId: t.extensionId,
				slotId: t.slot.id,
				scope: [
					"global.settings",
					"global.settingsPanels",
					"developer.settings"
				].includes(t.slot.id) ? "global" : "project",
				parentPanelId: t.slot.id === "developer.settings" ? "developer-tools" : void 0,
				title: n.title,
				icon: n.icon,
				section: t.section ? C(t.section) : void 0
			}] : [];
		}),
		kanbanRenderers: at(e),
		dataTableRenderers: ot(e),
		commandPaletteResources: e.commandPaletteResources ?? [],
		treeRenderers: st(e),
		fileRenderers: ct(e),
		controlsRenderers: lt(e),
		keybindings: e.keybindings ?? [],
		settingsDefinitions: e.settingsDefinitions ?? [],
		statusBarItems: e.statusBarItems.map((e) => ({
			id: e.id,
			extensionId: e.extensionId,
			viewId: C(e.view),
			slot: e.slot.id.endsWith("leading") ? "leading" : "trailing",
			order: e.order,
			when: Xe(e.when)
		})),
		diagnostics: e.diagnostics
	};
}, ft = (e, t, n = {}) => {
	e.views.refreshView(t.id, t.kind === "file" ? n : void 0);
}, pt = (e) => {
	let t = /* @__PURE__ */ new Map(), n = (e, n) => {
		for (let r of new Set(n.refreshEventIds ?? [])) {
			let i = t.get(r) ?? [];
			i.some((t) => t.kind === e && t.id === n.id) || i.push({
				id: n.id,
				kind: e
			}), t.set(r, i);
		}
	};
	for (let t of e.views) t.body.kind !== "webview" && n(t.body.kind, {
		id: t.id,
		refreshEventIds: t.body.refreshEventIds
	});
	return t;
}, mt = (e) => {
	let t = pt(e.metadata);
	return e.subscribe((n) => {
		let { id: r, ...i } = n;
		for (let n of t.get(r) ?? []) ft(e.workbench, n, i);
	});
}, ht = (e) => (t) => {
	let n = t.extensionId ?? e.extensionIdForWebview(t.webviewId);
	return {
		...l({
			...t,
			extensionId: n,
			projectId: e.projectId
		}),
		executeCommand: (n, r) => {
			let i = n.resource ?? t.placement.resource;
			return g({
				...e,
				workbench: t.workbench
			}, n.commandId, {
				params: n.params,
				workspaceId: n.workspaceId,
				metadata: n.metadata,
				resource: i,
				signal: r,
				slot: y({
					id: t.webviewId,
					kind: e.slotKind,
					projectId: e.projectId,
					context: { panelId: t.webviewId }
				})
			});
		},
		files: e.files,
		artifacts: e.artifacts ? { read: (n) => e.artifacts.read(n, { webviewId: t.webviewId }) } : void 0
	};
}, gt = (e) => ({
	title: u(e.title) || void 0,
	runtimeUrl: e.runtimeUrl,
	moduleUrl: e.moduleUrl,
	styles: e.styles,
	capabilities: e.capabilities
}), _t = "extensions", vt = 1e3, yt = (e) => e === void 0 ? void 0 : e, bt = (e) => e === "global" ? "user" : "project", xt = (e, t) => {
	let n = ht({
		artifacts: e.webviewArtifacts,
		executeCommand: e.executeCommand,
		extensionIdForWebview: (t) => e.metadata.panels.find((e) => e.id === t)?.extensionId,
		files: e.webviewFiles,
		projectId: e.projectId,
		slotKind: t
	});
	return (t) => ({
		...n(t),
		...e.createWebviewHostAdapters?.(t)
	});
}, St = (e) => e.metadata.panels.flatMap((t) => {
	if (!t.webview) return [];
	let n = gt(t.webview);
	return [e.workbench.views.registerView({
		id: t.id,
		title: u(t.title, t.id),
		icon: t.icon,
		body: {
			kind: "react",
			render: (r) => {
				let i = e.metadata.settingsPanels.some((e) => e.id === r.instance.panelId && e.parentPanelId), a;
				r.panel.region === "status" && (a = "content-width"), i && (a = "content-height");
				let o = e.metadata.settingsPanels.some((e) => e.id === r.instance.panelId && e.viewId === t.id) ? "settings" : "panel";
				return e.renderWebview?.(r) ?? te({
					sizing: a,
					context: {
						workbench: r.workbench,
						webviewId: t.id,
						placement: r.instance,
						hostEvents: ne(r.workbench, r.instance)
					},
					createHostAdapters: xt(e, o),
					createProps: e.createWebviewProps ?? (({ placement: e }) => ({
						placement: e,
						resource: e.resource
					})),
					createTheme: e.createWebviewTheme,
					ownerId: t.extensionId,
					title: u(t.title, t.id),
					webview: n
				});
			}
		}
	})];
}), Ct = {
	first: 1e6,
	default: 0,
	last: -1e6
}, wt = (e) => e.metadata.panels.flatMap((e) => e.panelMenus ?? []).map((t, n) => e.workbench.viewMenus.registerViewMenu({
	id: t.id,
	ownerViewId: t.ownerPanelId,
	viewId: t.viewId,
	side: t.side,
	priority: Ct[t.placement ?? "default"] - n
})), Tt = (e) => {
	let t = [], n = e.settingsSectionId ?? _t;
	e.workbench.settings.getSection(n) || t.push(e.workbench.settings.registerSection({
		id: n,
		title: e.settingsSectionTitle ?? "Extensions"
	}));
	let r = [...e.metadata.settingsSections].sort((e, t) => (e.order ?? 0) - (t.order ?? 0) || e.extensionId.localeCompare(t.extensionId) || e.id.localeCompare(t.id));
	for (let n of r) t.push(e.workbench.settings.registerSection({
		id: n.id,
		title: u(n.title, n.id),
		order: n.order,
		scope: n.scope
	}));
	let i = new Map(e.metadata.settingsDefinitions.map((e) => [e.key, e])), a = /* @__PURE__ */ new Map();
	for (let e of i.values()) {
		let t = a.get(e.extensionId) ?? Object.create(null);
		t[e.key] = {
			type: e.type,
			scope: bt(e.scope),
			default: yt(e.default),
			enum: e.enum,
			description: u(e.description)
		}, a.set(e.extensionId, t);
	}
	for (let [n, r] of a) t.push(e.workbench.preferences.registerSchema({ properties: r }, { ownerId: n }));
	let o = [...e.metadata.settingsPanels].sort((e, t) => e.extensionId.localeCompare(t.extensionId) || e.id.localeCompare(t.id));
	for (let [r, i] of o.entries()) i.slotId !== "extension.settings" && t.push(e.workbench.settings.registerPanel({
		id: i.id,
		title: u(i.title, i.id),
		icon: i.icon,
		kind: "view",
		order: vt + r,
		section: i.section ?? n,
		scope: i.scope,
		parentPanelId: i.parentPanelId,
		viewId: i.viewId
	}));
	return t;
}, U = (e) => {
	for (let t = e.length - 1; t >= 0; --t) e[t]?.dispose();
}, W = (e) => e && typeof e == "object" && !Array.isArray(e) ? e : void 0, G = (e, t, n, r, i) => e.prepareCommandArgs?.(t, n, r, i) ?? n, Et = (e, t) => t.commands.map((t) => e.workbench.commands.registerCommand({
	id: t.id,
	label: u(t.title, t.id),
	description: u(t.description),
	params: b(t.params, u, t.extensionId),
	resourceMutation: t.resourceMutation
}, {
	prepareArgs: (n, r, i) => G(e, t.id, n, r, i),
	execute: (n, r) => _(e, t.id, {
		...r,
		params: W(n),
		resource: r?.resource,
		signal: r?.signal,
		region: r?.region,
		placement: r?.placement
	})
})), K = (e, t) => t?.resource ?? e.workbench.getPrimaryResource(), Dt = (e, t) => {
	if (!e.menuSlotsById) return [];
	let { registrations: n } = ae({
		metadata: e.metadata,
		menuSlotsById: e.menuSlotsById,
		menuTargetsById: e.menuTargetsById,
		createWhenExpression: e.createMenuWhenExpression
	}), r = n.map(({ menuItem: e, menuPath: t, ...n }) => ({
		...n,
		menuItems: [{
			menuItem: e,
			menuPath: t
		}]
	}));
	return (e.menuRegistrations ?? r).flatMap((n) => [e.workbench.commands.registerCommand(n.command, {
		prepareArgs: (e, r, i) => G(t, n.targetCommandId, e, r, i),
		execute: (r, i) => _(t, n.targetCommandId, {
			...i,
			params: {
				...n.contribution.params ?? {},
				...W(r) ?? {}
			},
			resource: K(e, i),
			slot: y({
				id: n.contribution.slotId,
				kind: "menu",
				projectId: e.projectId,
				context: { panelId: n.contribution.id }
			})
		})
	}), ...n.menuItems.map(({ menuPath: t, menuItem: n }) => e.workbench.layout.registerMenuItem(t, n))]);
}, Ot = (e, t) => se({ metadata: e.metadata }).flatMap((n) => [e.workbench.commands.registerCommand(n.command, {
	prepareArgs: (e, r, i) => G(t, n.targetCommandId, e, r, i),
	execute: (r, i) => _(t, n.targetCommandId, {
		...i,
		params: {
			...n.contribution.params ?? {},
			...W(r) ?? {}
		},
		resource: K(e, i),
		slot: y({
			id: "workbench.commandPalette",
			kind: "menu",
			projectId: e.projectId,
			context: { panelId: n.contribution.id }
		})
	}),
	isVisible: () => le(n.contribution.when, e.workbench.getPrimaryResource()?.type)
}), e.workbench.layout.registerMenuItem(i, n.menuItem)]), kt = (e, t) => {
	let n = t?.mode;
	if (!n) return !0;
	let r = e.workbench.modes.getActiveModeId() ?? "";
	return Array.isArray(n) ? n.includes(r) : n === r;
}, At = (e) => (e.metadata.statusBarItems ?? []).map((t) => e.workbench.statusBar.registerItem({
	id: t.id,
	viewId: t.viewId,
	slot: t.slot,
	order: t.order,
	isVisible: () => kt(e, t.when)
})), jt = (e) => e.metadata.pages.map((t) => e.workbench.pages.registerPage(t)), Mt = (e) => e.metadata.modes.map((t) => e.workbench.modes.registerMode({
	id: t.modeId,
	label: u(t.label, t.modeId),
	panels: t.panelRegions,
	regionSettings: t.regionSettings,
	floatingPanels: t.floatingPanels,
	canFullscreen: t.canFullscreen,
	defaultTheme: t.defaultTheme,
	chrome: t.chrome,
	activate: () => void 0
})), Nt = (e) => e.metadata.placements.map((t) => e.workbench.modePlacements.registerPlacement(t)), Pt = (e) => {
	let t = {
		...e,
		metadata: dt(e.metadata, {
			projectId: e.projectId,
			createTab: (t) => $e(e, t)
		})
	}, n = [], r = t;
	try {
		return n.push(...Et(r, t.metadata)), n.push(...Ye({
			bindings: t.metadata.keybindings,
			createWhenExpression: t.createKeybindingWhenExpression,
			workbench: t.workbench
		})), n.push(...Dt(t, r)), n.push(...Ot(t, r)), n.push(Le({
			...t,
			resolveNodeResource: t.resolveTreeNodeResource
		})), n.push(Oe(t)), n.push(be(r, t.metadata.controlsRenderers ?? [])), n.push(...St(t)), n.push(...Tt(t)), n.push(ie(r, t.metadata.kanbanRenderers ?? [], t.kanbanAdapter)), n.push(we(r, t.metadata.dataTableRenderers ?? [], t.dataTableAdapter)), n.push(...wt(t)), n.push(ve(r, t.metadata.commandPaletteResources ?? [])), n.push(...Ge({
			createWhenExpression: e.createNavigationWhenExpression,
			metadata: e.metadata,
			workbench: e.workbench
		})), e.subscribeRefreshEvents && n.push(mt({
			metadata: e.metadata,
			subscribe: e.subscribeRefreshEvents,
			workbench: e.workbench
		})), n.push(...At(t)), n.push(...Ke(t)), n.push(...Mt(t)), n.push(...Nt(t)), n.push(...jt(t)), { dispose() {
			U(n);
		} };
	} catch (e) {
		throw U(n), e;
	}
}, q = "storybook.guide", J = (e) => ({
	...e,
	extensionId: e.extensionId ?? q
}), Y = (e) => ({
	...e,
	page: J(e.page),
	parent: e.parent ? Y(e.parent) : void 0
}), X = (e) => e.kind === "page" ? Y(e) : e.kind === "viewer" ? {
	...e,
	page: e.page ? J(e.page) : void 0
} : e.kind === "panel" ? {
	...e,
	panel: e.panel.kind === "page-slot" ? {
		...e.panel,
		page: J(e.panel.page)
	} : J(e.panel)
} : e.kind === "command" ? {
	kind: "command",
	target: {
		...e.target,
		command: J(e.target.command)
	}
} : e.kind === "href" ? e : {
	kind: "compound",
	targets: e.targets.map((e) => e.kind === "page" ? Y(e) : {
		...e,
		panel: e.panel.kind === "page-slot" ? {
			...e.panel,
			page: J(e.panel.page)
		} : J(e.panel)
	})
}, Ft = (e) => e.kind === "view" ? {
	...e,
	view: J(e.view)
} : {
	kind: "binding",
	binding: {
		...e.binding,
		kinds: e.binding.kinds.map(J),
		view: J(e.binding.view),
		add: e.binding.add ? X(e.binding.add) : void 0
	}
}, It = (e) => {
	if (e) return "view" in e ? {
		...e,
		view: J(e.view),
		breadcrumb: e.breadcrumb ? {
			...e.breadcrumb,
			menu: e.breadcrumb.menu?.map((e) => ({
				...e,
				rows: e.rows.map((e) => ({
					...e,
					action: e.action ? X(e.action) : void 0
				}))
			}))
		} : void 0
	} : J(e);
}, Lt = (e, t) => ({
	id: `${q}.page.${e.id}`,
	localId: e.id,
	extensionId: q,
	title: e.title,
	icon: e.icon,
	path: e.path,
	regionSettings: e.regionSettings,
	mode: J(e.mode),
	parent: e.parent ? J(e.parent) : void 0,
	resource: e.resource ? { kinds: e.resource.kinds.map(J) } : void 0,
	panelView: e.panelView ? J(e.panelView) : void 0,
	main: Rt(e.main, t, e.id),
	slots: e.slots.map((n) => ({
		...n,
		addableIn: n.addableIn ? [...n.addableIn] : void 0,
		movableTo: n.movableTo ? [...n.movableTo] : void 0,
		item: Ft(n.item),
		tab: t(`${e.id}.${n.id}`, n.tab)
	}))
}), Rt = (e, t, n) => e.kind === "group" ? {
	...e,
	default: J(e.default)
} : e.kind === "panels" ? {
	...e,
	empty: It(e.empty),
	landing: e.landing && typeof e.landing != "string" ? J(e.landing) : e.landing
} : {
	...e,
	view: J(e.view),
	empty: It(e.empty),
	tab: t(`${n}.$main`, e.tab)
}, zt = (e) => {
	let t = "storybook.navigation", n = d(e);
	e.views.registerView({
		id: t,
		title: "Learn",
		body: {
			kind: "tree",
			defaultExpandedSectionIds: n.getDefaultExpandedSectionIds(),
			getReadKey: () => n.getReadKey(),
			getHeader: (e) => n.getSections("header", e.signal, e.onProgress),
			getBody: (e) => n.getSections("content", e.signal, e.onProgress),
			getFooter: (e) => n.getSections("footer", e.signal, e.onProgress),
			getChildren: (t, n) => e.navigationTrees.getChildren(t, n)
		}
	}), e.pages.store.subscribeSelector((e) => e.location, () => e.views.refreshView(t)), e.shellPlacements.registerPlacement({
		id: t,
		item: {
			kind: "view",
			view: {
				kind: "view",
				id: t
			},
			presence: "fixed"
		},
		region: "sidenav"
	});
}, Z = "storybook.guide", Q = (e, t) => `${Z}.${e}.${t}`, $ = (e) => ({
	extensionId: e.extensionId ?? Z,
	kind: e.kind,
	id: e.id
}), Bt = (e) => {
	let t = /* @__PURE__ */ new Map(), n = (e, n, r, i) => {
		if (typeof i != "function") return;
		let a = `${e}.${n}.${r}`;
		return t.set(a, i), a;
	}, r = (e.views ?? []).map((e) => {
		let t = e.body, r = Q("view", e.id), i;
		if (t.kind === "tree") i = {
			kind: "tree",
			bodyHandlerId: n(r, "tree", "body", t.body),
			headerHandlerId: n(r, "tree", "header", t.header),
			childrenHandlerId: n(r, "tree", "children", t.children),
			footerHandlerId: n(r, "tree", "footer", t.footer),
			defaultExpandedSectionIds: t.defaultExpandedSectionIds,
			defaultExpandedNodeIds: t.defaultExpandedNodeIds,
			searchable: t.searchable,
			searchPlaceholder: t.searchPlaceholder
		};
		else if (t.kind === "dataTable") i = {
			kind: "dataTable",
			columns: t.columns,
			queryHandlerId: n(r, "dataTable", "query", t.query),
			rowActivationHandlerId: n(r, "dataTable", "onRowActivate", t.onRowActivate),
			selectionMode: t.selectionMode,
			initialPageSize: t.initialPageSize,
			pageSizeOptions: t.pageSizeOptions
		};
		else if (t.kind === "kanban") i = {
			kind: "kanban",
			attributes: t.attributes,
			queryHandlerId: n(r, "kanban", "query", t.query),
			attributeChangeHandlerId: n(r, "kanban", "onAttributeChange", t.onAttributeChange),
			moveHandlerId: n(r, "kanban", "onMove", t.onMove),
			...de(t),
			defaultActiveViewId: t.defaultActiveViewId,
			hideToolbar: t.hideToolbar
		};
		else if (t.kind === "file") i = {
			kind: "file",
			loadHandlerId: n(r, "file", "load", t.load),
			saveHandlerId: n(r, "file", "save", t.save)
		};
		else if (t.kind === "controls") i = {
			kind: "controls",
			queryHandlerId: n(r, "controls", "query", t.query),
			valueChangeHandlerId: n(r, "controls", "onValueChange", t.onValueChange),
			applyHandlerId: n(r, "controls", "onApply", t.onApply),
			resetHandlerId: n(r, "controls", "onReset", t.onReset),
			defaultValues: t.defaultValues,
			emptyTitle: t.emptyTitle,
			emptyDescription: t.emptyDescription
		};
		else throw Error(`The extension onboarding preview does not support ${t.kind} views`);
		return {
			id: r,
			localId: e.id,
			extensionId: Z,
			title: e.title,
			icon: e.icon,
			body: i
		};
	}), i = (e.pages ?? []).map((e) => Lt(e, (e, t) => t ? { queryHandlerId: n(e, "tab", "query", t.query) } : void 0)), a = (e.navigationItems ?? []).map((e) => ({
		id: Q("navigation-item", e.id),
		extensionId: Z,
		owner: $(e.owner),
		slot: e.slot ?? "content",
		label: e.label,
		icon: e.icon,
		group: e.group,
		action: X(e.action)
	})), o = (e.navigationTrees ?? []).map((e) => ({
		id: Q("navigation-tree", e.id),
		extensionId: Z,
		owner: $(e.owner),
		slot: e.slot ?? "content",
		view: $(e.view),
		...e.resourceScope ? { resourceScope: e.resourceScope } : {}
	})), s = (e.resourceKinds ?? []).map((e) => ({
		id: Q("resource-kind", e.id),
		localId: e.id,
		extensionId: Z,
		label: e.label,
		icon: e.icon,
		menuSlots: []
	}));
	return {
		handlers: t,
		metadata: {
			...oe,
			extensions: [{
				id: Z,
				name: "guide",
				displayName: "Guide",
				version: "1.0.0",
				sourcePath: "/storybook/guide/extension.ts"
			}],
			views: r,
			pages: i,
			navigationItems: a,
			navigationTrees: o,
			resourceKinds: s
		}
	};
}, Vt = (e, t) => {
	let { handlers: n, metadata: r } = Bt(e), i = {
		extensionId: Z,
		kind: "page",
		id: t
	}, a = o({ startPage: i });
	return a.modes.registerMode({
		id: "project",
		label: "Project",
		activate: () => void 0
	}), a.registerModule({
		id: "storybook.extension-preview",
		activate(e) {
			return Pt({
				metadata: r,
				projectId: "storybook",
				workbench: e,
				executeCommand: async (e, t) => {
					let r = n.get(e);
					if (!r) throw Error(`Story handler not found: ${e}`);
					return r({}, t.params ?? {});
				}
			});
		}
	}), a.pageLocations.setProject("storybook"), a.pageLocations.navigate({
		kind: "page",
		page: i
	}), (e.navigationItems?.length || e.navigationTrees?.length) && zt(a), a;
};
export { Vt as t };

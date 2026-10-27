// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { c as e } from "./resource-registry-CVuZngrt.ts";
import { D as t, E as n, h as r, n as i, p as a, s as o } from "./workbench-core-N58OeDyx.ts";
import { t as s } from "./use-workbench-store-BMaFgEbb.ts";
import { t as c } from "./icon-D3uE7jD-.ts";
import { n as l } from "./resource-actions-B6hNjsqI.ts";
import { t as u } from "./page-active-placement-CV13tWER.ts";
import { n as d } from "./workbench-theme-background-LZFbdbjE.ts";
import { n as f } from "./use-page-params-BMVjuYZ6.ts";
import { t as p } from "./renderer-read-notice-Ceo0RX8O.ts";
import { t as m } from "./use-renderer-read-CxbGovUR.ts";
import { n as h, r as g, t as _ } from "./tree-params-dialog-D1WOcCui.ts";
import { t as v } from "./use-tree-selection-BuV6mfak.ts";
import { useEffect as y, useRef as b, useState as x, useSyncExternalStore as S } from "react";
import { Badge as C, Box as w, Flex as T, Input as E, InputGroup as D, Skeleton as O, Spinner as k, Stack as A, Text as ee } from "@chakra-ui/react";
import { EmptyState as j, Header as M, ListRow as N, ScrollArea as P, Tooltip as F, TreeList as I, TreeListDragProvider as te, applyTreeListOrder as ne, buildTreeVisibilityMenuActions as L, filterVisibleSections as re, resolveVisibility as R, useTreeListOrderStore as z, useTreeListVisibilityStore as B } from "@pstdio/ui";
import { Fragment as ie, jsx as V, jsxs as ae } from "react/jsx-runtime";
import { resourceKey as H } from "@pstdio/sdk/extensions";
import { DiffBubble as oe } from "@pstdio/ui/diff";
// packages/pstdio-workbench/src/react/renderers/tree/tree-list-adapter.tsx
var U = (e, t, n) => {
	for (let r of e) {
		if (r.id === t) return r;
		let e = U([...r.children ?? [], ...n[r.id] ?? []], t, n);
		if (e) return e;
	}
	return null;
}, W = (e, t, n) => {
	for (let r of e) {
		let e = U(r.nodes, t, n);
		if (e) return e;
	}
	return null;
}, G = (e, t) => t ? /* @__PURE__ */ V(F, {
	content: t,
	children: /* @__PURE__ */ V(w, {
		as: "span",
		display: "inline-flex",
		alignItems: "center",
		justifyContent: "center",
		children: e
	})
}) : e, K = (e) => {
	let t;
	return e.iconElement === void 0 ? e.icon && (t = /* @__PURE__ */ V(c, { name: e.icon })) : t = e.iconElement, t === void 0 ? void 0 : G(t, e.iconTooltip);
}, se = (e) => {
	if (e.target) return {
		id: "target",
		payload: e.target
	};
	if (e.resource) return {
		id: "resource",
		payload: e.resource
	};
}, q = (e) => {
	if (e.resource) return e.resource;
}, J = (e, t) => {
	if (e.endContent !== void 0) return e.endContent;
	if (e.badge) return /* @__PURE__ */ V(C, {
		size: "sm",
		variant: "subtle",
		colorPalette: e.badge.color ?? "gray",
		flexShrink: 0,
		children: e.badge.label
	});
	let n = t?.metadata?.diffAdditions, r = t?.metadata?.diffDeletions;
	if (t?.type === "workspace" && typeof n == "number" && typeof r == "number") return /* @__PURE__ */ V(oe, {
		additions: n,
		deletions: r,
		variant: "ghost",
		size: "small"
	});
}, ce = (e) => {
	if (e.loading && e.nodes.length === 0) return {
		id: `${e.id}:loading`,
		label: "Loading…",
		icon: /* @__PURE__ */ V(k, { size: "xs" }),
		disabled: !0,
		rowVariant: "empty-state"
	};
	if (!(!e.emptyState || e.nodes.length > 0)) return {
		id: `${e.id}:empty`,
		label: e.emptyState.title,
		description: e.emptyState.description,
		icon: e.emptyState.icon ? /* @__PURE__ */ V(c, { name: e.emptyState.icon }) : void 0,
		disabled: !0,
		rowVariant: "empty-state"
	};
}, Y = (e, t, n) => {
	let i = se(e), a = q(e), o = a ? { resource: a } : void 0, s = e.contextMenuPath ?? e.menuPath, c = a ? r(a.type) : void 0, u, d = () => u || (u = [...a ? l(n.workbench, a, {
		onRequestParams: n.onRequestParams,
		onCommandError: n.onCommandError
	}).map((e) => ({
		id: e.key,
		label: e.label,
		commandId: e.commandId,
		icon: e.icon,
		group: e.group,
		disabled: e.isDisabled,
		endContent: e.endContent,
		separatorBefore: e.separatorBefore,
		onAction: () => {
			e.onClick?.();
		}
	})) : [], ...g({
		actions: e.contextMenuActions,
		menuPath: s?.join("/") === c?.join("/") ? void 0 : s,
		workbench: n.workbench,
		context: o,
		onCommandError: n.onCommandError,
		onRequestParams: n.onRequestParams
	})], u);
	return {
		id: e.id,
		moveScope: e.moveScope,
		label: e.label,
		description: e.description,
		icon: K(e),
		iconColor: e.iconColor,
		tooltip: e.tooltip,
		disabled: e.disabled,
		rowVariant: e.rowVariant,
		inlineInput: e.inlineInput,
		showContextMenuTrigger: e.showContextMenuTrigger,
		canHide: e.canHide,
		canReorder: e.canReorder,
		canDrag: e.canDrag,
		canDrop: e.canDrop,
		hiddenByDefault: e.hiddenByDefault,
		actions: h({
			actions: e.actions,
			workbench: n.workbench,
			context: o,
			onCommandError: n.onCommandError,
			onRequestParams: n.onRequestParams
		}),
		endContent: J(e, a),
		get menuItems() {
			if (!e.menuPath) return;
			let t = d();
			return t.length > 0 ? t : void 0;
		},
		get contextMenuItems() {
			let e = d();
			return e.length > 0 ? e : void 0;
		},
		...e.menuPlacement ? { menuPlacement: e.menuPlacement } : {},
		isContainer: e.collapsible,
		isNavigable: !!i,
		navigationIntent: i,
		children: [...e.children ?? [], ...t[e.id] ?? []].map((e) => Y(e, t, n))
	};
}, le = (e, t, n) => {
	let r = ce(e);
	return {
		id: e.id,
		moveScope: e.moveScope,
		label: e.label,
		menuLabel: e.menuLabel,
		actions: h({
			actions: e.actions,
			workbench: n.workbench,
			onCommandError: n.onCommandError,
			onRequestParams: n.onRequestParams
		}),
		collapsible: e.collapsible,
		canHide: e.canHide,
		canReorder: e.canReorder,
		hiddenByDefault: e.hiddenByDefault,
		nodes: r ? [r] : e.nodes.map((e) => Y(e, t, n))
	};
}, ue = (e) => {
	let { workbench: t } = e, r = s(t.pages.store, (e) => e), i = s(t.modes.store, (e) => e.activeModeId ? e.modes[e.activeModeId] : void 0);
	return !S((e) => {
		let n = t.navigationTrees.onDidChange(e);
		return () => n.dispose();
	}, () => n({
		location: r.location,
		pages: Object.values(r.pages),
		navigationTrees: t.navigationTrees
	}).length > 0) || !i ? null : /* @__PURE__ */ V(w, {
		pb: "1px",
		children: /* @__PURE__ */ V(N, {
			id: "workbench.navigation.root",
			role: "button",
			label: `Back to ${(i.label ?? i.id).toLocaleLowerCase()}`,
			icon: /* @__PURE__ */ V(c, {
				name: "ArrowLeft",
				size: 14
			}),
			variant: "compact",
			onActivate: () => t.pageLocations.navigateToRootLevel()
		})
	});
}, X = (e) => new Set(e.flatMap((e) => e.nodes.filter((e) => e.pinnedOnly).map((e) => e.id))), Z = (e, t) => t.size === 0 ? e : e.flatMap((e) => {
	let n = e.nodes.filter((e) => !t.has(e.id));
	return n.length === e.nodes.length ? [e] : n.length > 0 ? [{
		...e,
		nodes: n
	}] : [];
}), Q = [
	"70%",
	"50%",
	"82%",
	"60%",
	"44%",
	"76%"
], de = () => /* @__PURE__ */ V(A, {
	gap: "sm",
	px: "sm",
	py: "xs",
	"aria-hidden": !0,
	children: Q.map((e, t) => /* @__PURE__ */ V(O, {
		height: "4",
		width: e,
		borderRadius: "xs"
	}, `${e}-${t}`))
}), fe = (e) => {
	let { error: t, loading: n, moduleLoading: r, sections: i, leadingContent: a, backgroundContextActions: o, draggable: s, customizationAvailable: c, activeNodeId: l, expandedNodeIds: u, expandedSectionIds: d, scrollRef: f, onToggleSection: p, onToggleNode: m, onReorderSections: h, onReorderNodes: g, canMove: _, onMoveNode: v, onNavigate: y } = e;
	return (t || n) && i.length === 0 ? /* @__PURE__ */ V(I, {
		sections: [],
		leadingContent: a
	}) : r ? /* @__PURE__ */ V(I, {
		sections: [],
		leadingContent: /* @__PURE__ */ ae(ie, { children: [a, /* @__PURE__ */ V(de, {})] })
	}) : i.length === 0 && (o?.length ?? 0) === 0 && !c ? /* @__PURE__ */ V(j, {
		minH: "12rem",
		title: "No tree items"
	}) : /* @__PURE__ */ V(I, {
		sections: i,
		leadingContent: a,
		backgroundContextActions: o,
		draggable: s,
		expandedNodeIds: u,
		expandedSectionIds: d,
		activeNodeId: l,
		rowVariant: "compact",
		sectionGap: "md",
		nodeGap: "1px",
		virtualize: !0,
		scrollRef: f,
		onToggleSection: p,
		onToggleNode: m,
		onReorderSections: h,
		onReorderNodes: g,
		canMove: _,
		onMoveNode: v,
		onNavigate: y
	});
}, pe = (e) => (e.kind === "compound" ? e.targets : [e]).some((e) => e.kind === "page" || e.kind === "panel"), me = (e, t, n) => (r) => {
	i(e).setSectionExpanded(t, r, !n.includes(r));
}, he = (e) => {
	let { visible: t, placeholder: n = "Search files", value: r, onChange: i } = e;
	return t ? /* @__PURE__ */ V(M, {
		flexShrink: 0,
		borderBottomWidth: "1px",
		borderColor: "border.subtle",
		bg: "bg",
		children: /* @__PURE__ */ V(D, {
			startElement: /* @__PURE__ */ V(c, {
				name: "search",
				size: 14
			}),
			width: "full",
			children: /* @__PURE__ */ V(E, {
				size: "sm",
				variant: "borderless",
				"aria-label": n,
				placeholder: n,
				value: r,
				onChange: (e) => i(e.target.value)
			})
		})
	}) : null;
}, ge = (t, n, r) => {
	if (r.size === 0 && Object.keys(n).length === 0) return t;
	let i = (t) => t.flatMap((t) => {
		let a = t.resource ? e(t.resource, r) : void 0;
		if (t.resource && !a) return [];
		let o = n[t.id] ?? t.children;
		return [{
			...t,
			label: a && a !== t.resource ? a.label ?? t.label : t.label,
			...a ? { resource: a } : {},
			...o ? { children: i(o) } : {}
		}];
	});
	return t.map((e) => ({
		...e,
		nodes: i(e.nodes)
	}));
}, _e = (e, t, n) => n instanceof Error && n.message === `Tree renderer not registered: ${t}` && !e.getTreeRenderer(t), ve = (e, t) => ({
	header: e?.getHeaderStructure?.(t) ?? [],
	body: e?.getStructure?.(t) ?? [],
	footer: e?.getFooterStructure?.(t) ?? []
}), ye = (e) => [
	...e.header.flatMap((e) => e.nodes),
	...e.body.flatMap((e) => e.nodes),
	...e.footer.flatMap((e) => e.nodes)
], be = async (e, n, r, i, a = {}) => {
	let o = new Set(i), s = /* @__PURE__ */ new Set(), c = {}, l = ye(r);
	for (; l.length;) {
		a.signal?.throwIfAborted();
		let r = [];
		for (; l.length && r.length < 4;) {
			let e = l.shift();
			o.has(e.id) && !s.has(e.id) && (s.add(e.id), r.push(e));
		}
		let i = await t(r.map((t) => async (r) => {
			let i = t.children ?? await e.getChildren(n, t, {
				...a,
				signal: r
			});
			return t.children || (c[t.id] = i), i;
		}), a.signal);
		l.push(...i.flat());
	}
	return c;
}, xe = (e, t) => {
	let n = e.getTreeRenderer(t);
	if (n) for (let r of n.defaultExpandedSectionIds ?? []) e.setSectionExpanded(t, r, !0);
}, Se = async (e, n, r = {}, i) => {
	if (!e.getTreeRenderer(n)) return null;
	let a = ve(e.getTreeRenderer(n), r), o = async (t, o) => {
		let s = {
			...r,
			signal: o,
			onProgress: (e) => {
				o.aborted || (a = {
					...a,
					[t]: e
				}, i?.(a));
			}
		}, c = await {
			header: e.getHeader,
			body: e.getBody,
			footer: e.getFooter
		}[t](n, s);
		return o.throwIfAborted(), a = {
			...a,
			[t]: c
		}, i?.(a), c;
	};
	try {
		let [e, n, i] = await t([
			(e) => o("header", e),
			(e) => o("body", e),
			(e) => o("footer", e)
		], r.signal);
		return {
			header: e,
			body: n,
			footer: i
		};
	} catch (t) {
		if (_e(e, n, t)) return null;
		throw t;
	}
}, Ce = (e, t, n) => {
	let r = W(e.sections, t, e.childrenByNodeId), i = n ? W(e.sections, n, e.childrenByNodeId) : void 0;
	if (!r?.canDrag || t === n || n && !i?.canDrop) return !1;
	if (!i) return !0;
	let o = a(r), s = a(i);
	return o?.contribution === s?.contribution && o?.registryToken === s?.registryToken;
}, we = (e) => e.renderer.moveNode ? async (t, n, r) => {
	let a = W(e.sections, t, e.childrenByNodeId), s = n ? W(e.sections, n, e.childrenByNodeId) ?? void 0 : void 0;
	if (!a || !Ce(e, t, n)) return !1;
	let c = i(e.workbench);
	try {
		return await e.renderer.moveNode?.(a, s, {
			resource: e.resource,
			viewId: e.viewId,
			position: r,
			state: c.getTreeState(e.renderer.id),
			refresh: () => c.refresh(e.renderer.id),
			setSelectedNode: (t) => c.setSelectedNode(e.renderer.id, t)
		}), !0;
	} catch (t) {
		return e.onError ? e.onError(t) : o(e.workbench, "Move", t), !1;
	}
} : void 0, Te = (e, t, n) => {
	let r = (e) => e.children ?? t[e.id], i = (e, t) => {
		for (let n of e) {
			if (n.id === t) return n;
			let e = i(r(n) ?? [], t);
			if (e) return e;
		}
	}, a = e.flatMap((e) => e.nodes), o = i(a, n.sourceId), s = i(a, n.targetId);
	if (!o?.canDrag || !s?.canDrop || o === s || i(r(o) ?? [], s.id) || n.position === "inside" && !r(s) && !s.collapsible) return e;
	let c = (e) => {
		let t = r(e);
		return t ? {
			...e,
			children: t.map(c)
		} : e;
	}, l = c(o), u = (e) => e.flatMap((e) => {
		if (e.id === o.id) return [];
		let t = r(e), i = t ? {
			...e,
			children: u(t)
		} : e;
		return e.id === s.id ? n.position === "inside" ? [{
			...i,
			children: [...i.children ?? [], l]
		}] : n.position === "before" ? [l, i] : [i, l] : [i];
	});
	return e.map((e) => ({
		...e,
		nodes: u(e.nodes)
	}));
}, Ee = (e) => {
	let { scope: t, body: n, childrenByNodeId: r, persist: i, canMove: a, refresh: o } = e, [s, c] = x({
		scope: t,
		moves: []
	}), l = b(n);
	l.current = n;
	let u = b(Promise.resolve());
	y(() => {
		s.moves.some((e) => s.scope !== t || e.savedAfter !== void 0 && e.savedAfter !== n) && c((e) => {
			if (e.moves.length === 0) return e;
			if (e.scope !== t) return {
				scope: t,
				moves: []
			};
			let r = e.moves.filter((e) => !e.savedAfter || e.savedAfter === n);
			return r.length === e.moves.length ? e : {
				scope: t,
				moves: r
			};
		});
	}, [
		t,
		n,
		s
	]);
	let d = s.scope === t ? s.moves : [], f = d.reduce((e, t) => Te(e, r, t.intent), n);
	return {
		body: f,
		childrenByNodeId: d.length ? {} : r,
		moveNode: i ? (e, n, s = "inside") => {
			if (!a(e, n)) return;
			if (!n || Te(f, r, {
				sourceId: e,
				targetId: n,
				position: s
			}) === f) {
				u.current = u.current.then(async () => {
					await i(e, n, s), o();
				});
				return;
			}
			let d = {
				sourceId: e,
				targetId: n,
				position: s
			}, p = Symbol("tree move");
			c((e) => ({
				scope: t,
				moves: [...e.scope === t ? e.moves : [], {
					token: p,
					intent: d
				}]
			})), u.current = u.current.then(async () => {
				let r = await i(e, n, s);
				c((e) => e.scope === t ? {
					scope: t,
					moves: r ? e.moves.map((e) => e.token === p ? {
						...e,
						savedAfter: l.current
					} : e) : e.moves.filter((e) => e.token !== p)
				} : e), o();
			});
		} : void 0
	};
}, De = (e, t, r, a, o, c = JSON.stringify([
	"tree",
	t,
	a
]), l, u) => {
	let d = f(e, u), p = i(e), h = s(e.resources.preview.store, (e) => e.changes);
	s(p.treeStore, (e) => e.refreshKeysByTreeId[t]);
	let g = s(e.modes.store, (e) => e.activeModeId), _ = s(e.pages.store, (e) => e.location), v = s(e.pages.store, (e) => e.projectId), b = () => JSON.stringify(n({
		location: _,
		pages: Object.values(e.pages.store.getState().pages),
		navigationTrees: e.navigationTrees
	}).map(({ owner: e, location: t }) => [e, H(t.resource)])), C = S((t) => {
		let n = e.navigationTrees.onDidChange(t);
		return () => n.dispose();
	}, b, b), w = p.getTreeRenderer(t)?.getReadKey?.({
		resource: r,
		viewId: a,
		filter: o,
		pageParams: d
	}), T = JSON.stringify(w ?? [
		H(r),
		H(_?.resource),
		g,
		C
	]), E = JSON.stringify([
		t,
		a,
		v,
		H(r),
		o,
		d,
		g,
		C
	]), D = JSON.stringify([E, T]), O = p.getTreeRenderer(t), k = ve(O, {
		resource: r,
		viewId: a,
		filter: o,
		pageParams: d
	});
	y(() => xe(i(e), t), [e, t]);
	let [A, ee] = x({
		queryKey: D,
		byNodeId: {}
	}), j = m({
		workbench: e,
		ownerKey: c,
		queryKey: E,
		refreshKey: T,
		load: async (e, n) => {
			let i = {
				resource: r,
				viewId: a,
				filter: o,
				signal: e,
				pageParams: d
			}, s = await Se(p, t, i, (e) => n({
				...e,
				children: {}
			}));
			e.throwIfAborted();
			let c = s && p.getTreeRenderer(t) ? await be(p, t, s, p.getTreeState(t).expandedNodeIds, i) : {};
			return {
				header: s?.header ?? [],
				body: s?.body ?? [],
				footer: s?.footer ?? [],
				children: c
			};
		},
		subscribe: (e) => p.onDidRefresh((n) => {
			n.treeId === t && e();
		})
	}), M = (e) => {
		p.getChildren(t, e, {
			resource: r,
			viewId: a,
			filter: o,
			pageParams: d
		}).then((t) => {
			ee((n) => ({
				queryKey: D,
				byNodeId: {
					...n.queryKey === D ? n.byNodeId : {},
					[e.id]: t
				}
			}));
		});
	};
	y(() => {
		let t = e.resources.preview.subscribeRefresh(async (e) => {
			let t = (n) => n.some((n) => n.resource && H(n.resource) === H(e) || t(j.value?.children[n.id] ?? n.children ?? []));
			j.value?.body.some((e) => t(e.nodes)) && await j.retry();
		});
		return () => t.dispose();
	}, [
		e,
		j.retry,
		j.value
	]);
	let N = j.loading && !j.value?.body.length ? k.body : j.value?.body ?? [], P = {
		...A.queryKey === D ? A.byNodeId : {},
		...j.value?.children
	}, F = Ee({
		scope: D,
		body: N,
		childrenByNodeId: P,
		canMove: (e, t) => Ce({
			sections: N,
			childrenByNodeId: P
		}, e, t),
		persist: O ? we({
			workbench: e,
			renderer: O,
			resource: r,
			viewId: a,
			sections: N,
			childrenByNodeId: P,
			onError: l
		}) : void 0,
		refresh: j.retry
	});
	return {
		...F,
		body: ge(F.body, F.childrenByNodeId, h),
		childrenByNodeId: {},
		header: j.value?.header ?? k.header,
		footer: j.value?.footer ?? k.footer,
		loadChildren: M,
		error: j.error ?? null,
		loading: j.loading,
		retry: j.retry
	};
}, Oe = (e, t, n) => {
	let r = e.regions.overlay, i = (r.widgets.find((e) => e.widgetId === r.activeWidgetId) ?? r.widgets[0])?.resource;
	if (i) return i;
	let a = u(e, t);
	return a?.resource ? a.resource : n;
}, ke = (e) => {
	let t = s(e.pages.store, (e) => e.projectId), n = s(e.pages.store, (e) => e.location), r = s(e.pages.store, (e) => e.activePageId ? e.pages[e.activePageId] : void 0);
	return {
		projectId: t,
		activeLocation: n,
		activeResource: s(e.layout.store, (e) => Oe(e.layout, r, n?.resource))
	};
}, Ae = (e, t, n, r, i = /* @__PURE__ */ new Set()) => {
	let a = new Map(n.map((e) => [e.id, e])), o = new Set(e.filter((e) => e.nodes.some((e) => !i.has(e.id))).map((e) => e.id));
	return t.flatMap((e) => {
		let t = a.get(e.id);
		return t ? [t] : e.nodes.length === 0 && o.has(e.id) && R(r[e.id], e.hiddenByDefault) === "shown" ? [e] : [];
	});
}, je = (e, t, n) => {
	let r = new Set(e.map((e) => e.moveScope)), i = t.filter((e) => e.moveScope === void 0 || r.has(e.moveScope)), a = new Set(t.filter((e) => !i.includes(e)).map((e) => e.id));
	return {
		groups: i,
		nodeOrderBySection: Object.fromEntries(Object.entries(n).filter(([e]) => !a.has(e)))
	};
}, Me = (e, t, n, r) => {
	let i = z(e, (e) => e.groups), a = z(e, (e) => e.addGroup), o = z(e, (e) => e.renameGroup), s = z(e, (e) => e.removeGroup), [l, u] = x(null), d = l?.storageKey === e ? l : null, { groups: f, nodeOrderBySection: p } = je(t, i, n);
	d?.isNew && f.push(d.group);
	let m = (n = t[0]?.moveScope) => {
		u({
			storageKey: e,
			group: {
				id: `tree-list-group:${crypto.randomUUID()}`,
				label: "New group",
				moveScope: n
			},
			isNew: !0
		});
	};
	return {
		groups: f,
		nodeOrderBySection: p,
		withGroupControls: (t) => t.map((n) => {
			let r = f.find((e) => e.id === n.id);
			if (!r) return n;
			let i = [{
				id: "tree-group:rename",
				label: "Rename group",
				icon: /* @__PURE__ */ V(c, {
					name: "pencil",
					size: 14
				}),
				onAction: () => u({
					storageKey: e,
					group: r,
					isNew: !1
				})
			}, {
				id: "tree-group:remove",
				label: "Remove group",
				icon: /* @__PURE__ */ V(c, {
					name: "trash-2",
					size: 14
				}),
				onAction: () => s(r.id)
			}], l = d?.group.id === r.id;
			return {
				...n,
				canReorder: !l,
				contextMenuItems: i,
				actions: [{
					id: "tree-group:actions",
					label: "Group actions",
					icon: /* @__PURE__ */ V(c, {
						name: "ellipsis",
						size: 14
					}),
					menuItems: i
				}],
				inlineInput: l ? {
					ariaLabel: "Group name",
					placeholder: "New group",
					defaultValue: d.isNew ? "" : r.label,
					onCommit: (e) => {
						d.isNew ? a({
							...r,
							label: e
						}, t.map((e) => e.id)) : o(r.id, e), u(null);
					},
					onCancel: () => u(null)
				} : void 0
			};
		}),
		newGroupAction: r ? {
			key: "tree-group:new",
			label: "New group",
			icon: /* @__PURE__ */ V(c, {
				name: "folder-plus",
				size: 14
			}),
			closeOnSelect: !0,
			onClick: () => m()
		} : void 0
	};
}, $ = (e, t) => typeof e == "string" ? e : t, Ne = (e) => e.canHide === !0 || e.hiddenByDefault === !0, Pe = (e, t) => e === "shown" ? t.hiddenIcon : t.visibleIcon, Fe = (e, t, n, r) => {
	if (!Ne(e)) return;
	let i = e.hiddenByDefault === !0, a = R(t[e.id], i), o = $(e.label, e.id), s = e.contextMenuItems ?? [];
	return {
		id: `tree-visibility:${e.id}`,
		label: a === "shown" ? `Hide ${o}` : `Show ${o}`,
		icon: Pe(a, r),
		...s.length > 0 ? { separatorBefore: !0 } : {},
		onAction: () => n.onToggleNode(e.id, i)
	};
}, Ie = (e, t, n, r, i = !0) => {
	if (!i) return e;
	let a = !1, o = e.map((e) => {
		let i = Fe(e, t, n, r);
		return i ? (a = !0, {
			...e,
			contextMenuItems: [...e.contextMenuItems ?? [], i]
		}) : e;
	});
	return a ? o : e;
}, Le = (e, t, n, r, i) => {
	let a = !1, o = e.map((e) => {
		let o = Ie(e.nodes, t, n, r, i);
		return o === e.nodes ? e : (a = !0, {
			...e,
			nodes: o
		});
	});
	return a ? o : e;
}, Re = (e, t, n, r = {}) => {
	let i = B(e, (e) => e.sectionOverrides), a = B(e, (e) => e.nodeOverrides), o = B(e, (e) => e.toggleSection), s = B(e, (e) => e.toggleNode), c = B(e, (e) => e.reset), l = z(e, (e) => e.sectionOrder), u = z(e, (e) => e.nodeOrderBySection), d = z(e, (e) => e.sectionSlotById), f = z(e, (e) => e.setSectionOrder), p = z(e, (e) => e.setNodeOrder), m = z(e, (e) => e.setSectionSlot), h = z(e, (e) => e.reset), g = [
		...t.headerSections,
		...t.sections,
		...t.footerSections
	], { groups: _, nodeOrderBySection: v, withGroupControls: y, newGroupAction: b } = Me(e, g, u, r.allowGroups === !0), x = {
		onToggleSection: o,
		onToggleNode: s,
		onResetAll: () => {
			c(), h();
		}
	}, S = new Map([
		...t.headerSections.map((e) => [e.id, "header"]),
		...t.sections.map((e) => [e.id, "content"]),
		...t.footerSections.map((e) => [e.id, "footer"])
	]), C = {
		header: [],
		content: [],
		footer: []
	}, w = y(ne(g, l, v, _));
	for (let e of w) C[d[e.id] ?? S.get(e.id) ?? "content"].push(e);
	let T = C.header, E = Z(C.content, r.pinnedOnlyNodeIds ?? /* @__PURE__ */ new Set()), D = C.footer, O = r.suppressNodeContextMenus !== !0, k = Le(T, a, x, n, O), A = Le(E, a, x, n, O), ee = Le(D, a, x, n, O), j = (e) => Ae(g, e, re(e, i, a), i, r.pinnedOnlyNodeIds), M = j(k), N = j(A), P = j(ee), F = L({
		headerSections: T,
		sections: E,
		footerSections: D
	}, i, a, x, n), I = b ? [b] : [];
	return F.length > 0 && I.push({
		key: "tree-visibility",
		label: "Hide/show items",
		icon: n.visibleIcon,
		items: F.map((e) => ({
			...e,
			closeOnSelect: !1
		}))
	}), {
		visibleHeaderSections: M,
		visibleSections: N,
		visibleFooterSections: P,
		backgroundContextActions: I,
		customizationRevision: JSON.stringify({
			header: T.map((e) => [
				e.id,
				$(e.label, e.id),
				e.nodes.map((e) => [e.id, $(e.label, e.id)])
			]),
			main: E.map((e) => [
				e.id,
				$(e.label, e.id),
				e.nodes.map((e) => [e.id, $(e.label, e.id)])
			]),
			footer: D.map((e) => [
				e.id,
				$(e.label, e.id),
				e.nodes.map((e) => [e.id, $(e.label, e.id)])
			]),
			sectionOverrides: i,
			nodeOverrides: a,
			sectionOrder: l,
			nodeOrderBySection: u,
			sectionSlotById: d,
			groups: _
		}),
		onReorderSections: (e, t) => {
			let n = {
				header: T.map((e) => e.id),
				content: E.map((e) => e.id),
				footer: D.map((e) => e.id)
			};
			n[e] = t, f([
				...n.header,
				...n.content,
				...n.footer
			]);
		},
		onMoveSection: (e, t, n) => {
			let r = d[n] ?? S.get(n) ?? "content";
			m(t, r), f(e);
		},
		onReorderNodes: p
	};
}, ze = {
	expandedNodeIds: [],
	expandedSectionIds: []
}, Be = (e, t) => ({
	suppressNodeContextMenus: t,
	pinnedOnlyNodeIds: X(e),
	allowGroups: t
}), Ve = (e, t, n, r) => {
	let i = b(t);
	i.current = t, y(() => {
		r?.({
			ownerId: e,
			actions: i.current
		});
	}, [
		e,
		n,
		r
	]), y(() => () => {
		r?.({
			ownerId: e,
			actions: []
		});
	}, [e, r]);
}, He = (e, t, n) => {
	if (n?.id === "target") {
		let r = n.payload;
		pe(r) && i(e.workbench).setSelectedNode(e.treeViewId, t), e.workbench.navigation.openTarget(r).catch((t) => {
			e.onOpenResourceError ? e.onOpenResourceError(t) : o(e.workbench, "Open", t);
		});
	}
}, Ue = (e) => (t) => {
	let n = W(e.body, t, e.childrenByNodeId) ?? W([...e.header, ...e.footer], t, e.childrenByNodeId);
	if (!n) return;
	let r = e.expandedNodeIds.includes(t);
	i(e.workbench).setNodeExpanded(e.treeViewId, t, !r), !(r || e.childrenByNodeId[t] || n.children) && e.loadChildren(n);
}, We = (e) => {
	let { workbench: t, treeViewId: n, activeNodeId: r, resource: a, viewId: o, renderParamField: l, onOpenResourceError: u, onSidenavContextActionsChange: f } = e, m = !!f, h = b(null), g = i(t).getTreeRenderer(n), [y, S] = x(""), C = s(i(t).treeStore, (e) => e.statesByTreeId[n]) ?? ze, { projectId: E, activeLocation: D, activeResource: O } = ke(t), { body: k, childrenByNodeId: A, moveNode: j, error: M, footer: N, header: F, loadChildren: ne, loading: L, retry: re } = De(t, n, a, o, g?.searchable && y.trim() || void 0, e.readOwnerKey, u, e.placement), [R, z] = x(null), B = {
		workbench: t,
		onCommandError: u,
		onRequestParams: z
	}, ie = k.map((e) => le(e, A, B)), H = F.map((e) => le(e, A, B)), oe = N.map((e) => le(e, A, B)), { visibleHeaderSections: U, visibleSections: W, visibleFooterSections: G, backgroundContextActions: K, customizationRevision: se, onReorderSections: q, onReorderNodes: J, onMoveSection: ce } = Re(`${n}:${E ?? "global"}`, {
		headerSections: H,
		sections: ie,
		footerSections: oe
	}, {
		visibleIcon: /* @__PURE__ */ V(c, {
			name: "eye",
			size: 14
		}),
		hiddenIcon: /* @__PURE__ */ V(c, {
			name: "eye-off",
			size: 14
		}),
		resetIcon: /* @__PURE__ */ V(c, {
			name: "rotate-ccw",
			size: 14
		})
	}, Be(k, m));
	Ve(e.placement?.instanceId ?? n, K, se, f);
	let Y = v(t, n, {
		sections: [
			...F,
			...k,
			...N
		],
		childrenByNodeId: A,
		activeNodeId: r,
		activeLocation: D,
		activeResource: O,
		selectedNodeId: C.selectedNodeId
	});
	if (!g) return /* @__PURE__ */ V(ee, {
		textStyle: "paragraph/S/regular",
		color: "fg.muted",
		p: "sm",
		children: "Tree renderer is no longer registered."
	});
	let X = Ue({
		workbench: t,
		treeViewId: n,
		resource: a,
		viewId: o,
		body: k,
		header: F,
		footer: N,
		childrenByNodeId: A,
		expandedNodeIds: C.expandedNodeIds,
		loadChildren: ne
	}), Z = me(t, n, C.expandedSectionIds), Q = {
		workbench: t,
		treeViewId: n,
		onOpenResourceError: u
	};
	return /* @__PURE__ */ V(te, {
		sections: [
			...U,
			...W,
			...G
		],
		canMove: g.canMove,
		onReorderSections: ce,
		onReorderNodes: J,
		children: /* @__PURE__ */ ae(T, {
			as: "section",
			direction: "column",
			h: "full",
			minH: "0",
			minW: "0",
			"aria-label": g.title,
			"aria-busy": L,
			children: [
				U.length > 0 ? /* @__PURE__ */ V(T, {
					bg: d.sidenav,
					flexShrink: 0,
					children: /* @__PURE__ */ V(I, {
						sections: U,
						draggable: m,
						expandedNodeIds: C.expandedNodeIds,
						expandedSectionIds: C.expandedSectionIds,
						activeNodeId: Y,
						rowVariant: "compact",
						sectionGap: "1px",
						nodeGap: "1px",
						onToggleSection: Z,
						onToggleNode: X,
						onReorderSections: (e) => q("header", e),
						onReorderNodes: J,
						canMove: g.canMove,
						onNavigate: (e) => He(Q, e.nodeId, e.intent)
					})
				}) : null,
				/* @__PURE__ */ V(he, {
					visible: !!g.searchable,
					placeholder: g.searchPlaceholder,
					value: y,
					onChange: S
				}),
				M && !m ? /* @__PURE__ */ V(p, {
					error: M,
					retry: re
				}) : null,
				/* @__PURE__ */ V(P, {
					flex: "1",
					minH: "0",
					w: "full",
					viewportRef: h,
					viewportProps: {
						display: "block",
						style: { overflowX: "hidden" }
					},
					contentProps: { style: {
						minWidth: "100%",
						width: "100%",
						minHeight: "100%",
						display: "flex",
						flexDirection: "column"
					} },
					children: /* @__PURE__ */ V(w, {
						w: "full",
						minW: "0",
						flex: "1 0 auto",
						display: "flex",
						flexDirection: "column",
						children: /* @__PURE__ */ V(fe, {
							leadingContent: m ? /* @__PURE__ */ V(ue, { workbench: t }) : void 0,
							error: M,
							loading: L,
							moduleLoading: C.loading,
							sections: W,
							backgroundContextActions: m ? void 0 : K,
							draggable: m,
							customizationAvailable: m,
							activeNodeId: Y,
							expandedNodeIds: C.expandedNodeIds,
							expandedSectionIds: C.expandedSectionIds,
							scrollRef: h,
							onToggleSection: Z,
							onToggleNode: X,
							onReorderSections: (e) => q("content", e),
							onReorderNodes: J,
							canMove: g.canMove,
							onMoveNode: j,
							onNavigate: (e) => He(Q, e.nodeId, e.intent)
						})
					})
				}),
				G.length > 0 ? /* @__PURE__ */ V(T, {
					bg: d.sidenav,
					flexShrink: 0,
					children: /* @__PURE__ */ V(I, {
						sections: G,
						draggable: m,
						expandedNodeIds: C.expandedNodeIds,
						expandedSectionIds: C.expandedSectionIds,
						activeNodeId: Y,
						rowVariant: "compact",
						sectionGap: "md",
						nodeGap: "1px",
						onToggleSection: Z,
						onToggleNode: X,
						onReorderSections: (e) => q("footer", e),
						onReorderNodes: J,
						canMove: g.canMove,
						onNavigate: (e) => He(Q, e.nodeId, e.intent)
					})
				}) : null,
				/* @__PURE__ */ V(_, {
					request: R,
					renderParamField: l,
					workbench: t,
					onClose: () => z(null)
				})
			]
		})
	});
};
export { Te as n, We as t };

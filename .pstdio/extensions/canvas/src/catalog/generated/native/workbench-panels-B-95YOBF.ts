// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./triangle-alert-DcqN2fDE.ts";
import { c as t, o as n, r } from "./resource-registry-CVuZngrt.ts";
import { A as i, F as a, H as o, I as s, L as c, M as l, O as u, R as d, U as f, W as p, d as m, m as h, v as g, x as _, z as v } from "./workbench-core-kaLFKJEn.ts";
import { i as y, n as b, r as x, t as S } from "./mode-chrome-BfbQ4wE_.ts";
import { n as C, t as w } from "./use-workbench-store-BMaFgEbb.ts";
import { t as T } from "./icon-D3uE7jD-.ts";
import { t as E } from "./menu-item-state-C3xsXmQe.ts";
import { t as D } from "./action-errors-CACpJ-MK.ts";
import { t as O } from "./use-workbench-composition-panels-DWghJGTR.ts";
import { n as k, t as A } from "./workbench-theme-background-LZFbdbjE.ts";
import { n as j } from "./panel-widget-open-DyabfObf.ts";
import { t as M } from "./shallow-BYHDNLn2.ts";
import { n as N, r as P, t as F } from "./use-panel-policy-BALwJ9k6.ts";
import { t as ee } from "./use-page-params-B4PkHq0i.ts";
import { b as I, c as te, m as ne, n as re, o as ie, t as L, v as R, x as z, y as B } from "./core.esm-cje5eyjm.ts";
import { Activity as ae, createContext as oe, useContext as se, useEffect as V, useLayoutEffect as ce, useRef as le, useState as H } from "react";
import { Box as U, Button as W, Flex as ue, HStack as de, Icon as fe, Popover as G, Portal as pe, SimpleGrid as me, Stack as K, Tag as he, Text as q, mergeRefs as ge } from "@chakra-ui/react";
import { AlertMessage as _e, DropIndicator as ve, EmptyState as ye, Header as be, ResourceContextMenu as xe, ScrollArea as Se, SimpleCard as Ce, SimpleCardBody as we, filterVisibleTabs as Te, getTabVisibilityStore as Ee, useTabVisibilityStore as De } from "@pstdio/ui";
import { Fragment as Oe, jsx as J, jsxs as Y } from "react/jsx-runtime";
import { contributionRefId as ke, pagePlaceholderView as Ae } from "@pstdio/sdk/extensions";
import { createPortal as je } from "react-dom";
// packages/pstdio-workbench/src/react/focus/focus-region.tsx
var X = (e) => {
	let { workbench: t, region: n, children: r, ...i } = e, a = w(t.focus.store, (e) => e.activeRegion), o = le(null);
	return V(() => {
		let e = o.current;
		e && a === n && (e.contains(document.activeElement) || e.focus({ preventScroll: !0 }));
	}, [a, n]), /* @__PURE__ */ Y(U, {
		ref: o,
		tabIndex: -1,
		outline: "none",
		onFocusCapture: (e) => {
			e.currentTarget.contains(e.target) && t.focus.setActiveRegion(n);
		},
		...i,
		children: [/* @__PURE__ */ J(D, {
			workbench: t,
			target: `region:${n}`
		}), r]
	});
}, Me = (e) => e.join("/"), Ne = (e, t) => t ? r(e.contextValues, t.resource) : e.contextValues, Z = (e, t, r) => {
	let i = Ne(e, r);
	return [...e.itemsByPath[Me(t)] ?? []].sort((e, t) => (e.order ?? 0) - (t.order ?? 0) || n(e, t)).map((t) => {
		let n = e.commands[t.commandId];
		if (!n) return null;
		let a = t.args, o = E(t, n, i, r);
		return o ? {
			id: t.id,
			commandId: n.command.id,
			label: t.label ?? n.command.label,
			...o.description ? { description: o.description } : {},
			icon: t.icon ?? n.command.icon,
			...t.iconSrc ? { iconSrc: t.iconSrc } : {},
			...t.overflowLabel ? { overflowLabel: t.overflowLabel } : {},
			group: t.group,
			args: a,
			disabled: o.disabled,
			...o.readOnly ? { readOnly: !0 } : {}
		} : null;
	}).filter((e) => e !== null);
}, Pe = (e) => {
	let t = () => e.host.getOpenPlacementIds();
	return {
		getState: t,
		getInitialState: t,
		subscribe: (n) => {
			let r = t(), i = () => {
				let e = t(), i = r;
				r = e, n(e, i);
			}, a = e.layout.store.subscribe(i), o = e.pages.store.subscribe(i);
			return () => {
				a(), o();
			};
		}
	};
}, Fe = (e) => C(Pe(e), M((e) => e)), Ie = (e, t) => {
	let n = w(e.layout.store, (e) => e.layout), r = w(e.pages.store, m);
	return (t === "main" ? r : void 0) ?? a(n);
}, Le = (e) => {
	let { workbench: t, region: n } = e, r = P(t), i = O(t)[n].addable, { activeModeId: a, modes: o } = w(t.modes.store, (e) => e);
	return !a && Object.keys(o).length > 0 ? null : i.length ? /* @__PURE__ */ J(K, {
		flex: "1",
		p: "xl",
		children: /* @__PURE__ */ J(K, {
			w: "full",
			maxW: "lg",
			mx: "auto",
			children: /* @__PURE__ */ J(me, {
				role: "group",
				"aria-label": "Available tabs",
				gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, max(var(--chakra-sizes-3xs), calc((100% - var(--chakra-spacing-sm)) / 2))), 1fr))",
				gap: "sm",
				children: i.map((e) => /* @__PURE__ */ J(Ce, {
					variant: "action",
					asChild: !0,
					children: /* @__PURE__ */ J("button", {
						type: "button",
						onClick: () => j({
							workbench: t,
							widget: e.contribution,
							region: n,
							resource: r,
							pinned: e.pinned,
							open: e.open
						}),
						children: /* @__PURE__ */ J(we, { children: /* @__PURE__ */ Y(de, {
							gap: "xs",
							children: [e.contribution.icon ? /* @__PURE__ */ J(T, {
								name: e.contribution.icon,
								size: 14,
								color: "fg.muted"
							}) : null, /* @__PURE__ */ J(q, {
								textStyle: "label/M/regular",
								truncate: !0,
								children: e.contribution.title
							})]
						}) })
					})
				}, e.panelId))
			})
		})
	}) : /* @__PURE__ */ J(ye, { title: "No tabs available" });
}, Re = (e) => {
	let { workbench: t, region: n, fallback: r } = e, i = F(t, n), a = w(t.pages.store, (e) => e), o = a.activePageId ? a.pages[a.activePageId] : void 0, s = n === "main" ? Ae(o?.main.empty) : void 0;
	return s ? /* @__PURE__ */ J(ee, {
		value: a.activePageId,
		children: /* @__PURE__ */ J(x, {
			workbench: t,
			region: "main",
			placement: {
				widgetId: "workbench.empty-page",
				contributionId: "workbench.empty-page",
				viewId: ke(s),
				closable: !1,
				resource: a.location?.resource
			}
		})
	}) : r ?? (i.acceptsTabs ? /* @__PURE__ */ J(Le, {
		workbench: t,
		region: n
	}) : null);
}, ze = (e, t) => {
	t && e.parentNode !== t && (t.moveBefore && e.isConnected && t.isConnected ? t.moveBefore(e, null) : t.appendChild(e));
}, Be = {
	display: "flex",
	flexDirection: "column",
	minH: "100%",
	position: "relative"
}, Ve = {
	display: "flex",
	alignItems: "stretch",
	h: "full",
	minH: "100%",
	position: "relative"
}, Q = (e) => {
	let { children: t, horizontal: n = !1, hidden: r = !1 } = e;
	return /* @__PURE__ */ J(Se, {
		display: r ? "none" : "flex",
		flex: "1",
		minH: "0",
		minW: "0",
		w: "full",
		size: "xs",
		showVerticalScrollbar: !n,
		showHorizontalScrollbar: n,
		viewportProps: n ? { justifyContent: "center" } : void 0,
		contentProps: n ? Ve : Be,
		children: t
	});
}, He = (e, ...t) => t.every((t) => e.layout.getRegionCollapsible(t)), Ue = (e, t) => {
	if (e === 0) return t.map((e) => e.has && (e.open || !e.collapsible));
	let n = new Set(t.filter((e) => e.has && !e.collapsible)), r = e <= 580, i = (t) => {
		let i = [...n, t];
		return !r && e >= 120 + i.reduce((e, t) => e + t.minSize + 1, 0);
	};
	for (let e of t) e.has && e.open && !n.has(e) && i(e) && n.add(e);
	return t.map((e) => e.has && (n.has(e) || i(e)));
}, We = {
	defaultPx: 280,
	minPx: 144,
	maxPx: 320
}, Ge = {
	main: "Main",
	secondary: "Secondary",
	side: "Side"
}, Ke = (e) => ({
	defaultPx: e?.defaultPx ?? We.defaultPx,
	minPx: e?.minPx ?? We.minPx,
	maxPx: e ? e.maxPx : We.maxPx
}), qe = (e, t) => `${Ge[e]} ${t} menu`, $ = (e, t, n) => {
	let r = f[t][n], a = P(e), o = N(e), l = i(o ? e.modes.getMode(o) : void 0, t), u = w(e.layout.store, (e) => e.layout), p = w(e.layout.store, (e) => e.widgets), m = u.regions[r], h = s(u, t, a, { ignoreOwnerResourceKey: t === "side" }), g = Ie(e, t), _ = {
		...m,
		widgets: m.widgets.filter((e) => {
			let n = p[e.contributionId];
			return n ? (t === "side" ? d(n, o) : c(n, a, o, e, { location: g })) && v(n, {
				locationPanel: g,
				subPanel: h
			}) : !1;
		})
	}, y = _.widgets.find((e) => e.widgetId === _.activeWidgetId) ?? _.widgets[0], b = y ? p[y.contributionId] : void 0, x = w(e.layout.store, () => He(e, r)), S = y ? `panel-menu:${y.widgetId}` : r, C = w(e.panelMenuState.store, (e) => e.openByMenuId[S] ?? !0);
	return {
		region: r,
		side: n,
		label: qe(t, n),
		title: b?.title ?? qe(t, n),
		icon: b?.icon ?? (n === "left" ? "PanelLeft" : "PanelRight"),
		has: l && (_.widgets.length > 0 || !!e.layout.getPlaceholder(r)),
		collapsed: !C && x,
		collapsible: x,
		size: Ke(e.layout.getRegionSize(r)),
		onOpen: () => e.panelMenuState.setOpen(S, !0),
		onCollapsedChange: (t) => {
			(!t || x) && e.panelMenuState.setOpen(S, !t);
		}
	};
}, Je = (e, t) => {
	let n = Xe(t), r = [$(e, t, "left"), $(e, t, "right")], i = Ue(n, r.map((e) => ({
		has: e.has,
		open: !e.collapsed,
		collapsible: e.collapsible,
		minSize: e.size.minPx
	})));
	return r.map((e, t) => ({
		...e,
		canAttach: i[t],
		collapsed: e.collapsed || !i[t]
	}));
}, Ye = (e, t) => {
	let n = $(e, t, "left"), r = $(e, t, "right");
	return n.has || r.has;
}, Xe = (e) => {
	let [t, n] = H(0);
	return V(() => {
		let t = document.querySelector(`[data-workbench-panel="${e}"]`);
		if (!t) return;
		let r = () => n(t.clientWidth);
		r();
		let i = new ResizeObserver(r);
		return i.observe(t), () => i.disconnect();
	}, [e]), t;
}, Ze = (e, t) => `${e}:${t.contributionId}`, Qe = (e, t) => e === "sidenav", $e = (e, t, n) => {
	let r = e.resource?.icon ?? n;
	return e.role === "sub-panel" ? t?.icon ?? r : r ?? t?.icon;
}, et = (e, t) => t && e.some((e) => e.widgetId === t) ? t : e[0]?.widgetId, tt = (e) => p.some((t) => t === e), nt = (e) => e.length > 0, rt = (e) => e.hasTabs === !0 || e.hasPanelMenus === !0 || e.hasHeaderActions === !0, it = (e, t, n, r = e.getPrimaryResource(), i = e.modes.getActiveModeId()) => {
	if (n.resource && !e.resources.preview.resolve(n.resource)) return !1;
	let o = e.layout.getWidget(n.contributionId);
	return o ? c(o, r, i, n, {
		ignoreResourceLocation: t === "side" || t === "secondary",
		location: a(e.layout.getLayout())
	}) : !1;
}, at = (e, n, r) => {
	let i = w(e.resources.preview.store, (e) => e.changes), a = w(e.commands.store, (e) => e.commands), o = w(e.context.store, (e) => e.values), s = w(e.layout.menuStore, (e) => e.itemsByPath), c = w(e.layout.store, (e) => e), l = P(e), d = N(e), f = O(e), p = r ?? `${e.layout.getPersistenceScope() ?? "unscoped"}/${n}`, m = De(p, (e) => e);
	V(() => {
		let t = e.onDidResetLayout(() => Ee(p).getState().reset());
		return () => t.dispose();
	}, [e, p]);
	let v = c.layout.regions[n], y = w(e.pages.store, (e) => e), b = n === "main" && u(y.pages[y.activePageId ?? ""]), x = v.widgets.filter((r) => r.role === "sub-panel" && (!r.resource || !!t(r.resource, i)) && it(e, n, r, l, d)), S = Te(x, m.tabOverrides, (e) => Ze(n, e)), C = new Set(S.map((e) => e.widgetId)), T = v.widgets.filter((e) => (C.has(e.widgetId) || e.role === "location") && (!e.resource || !!t(e.resource, i))), E = Z({
		itemsByPath: s,
		commands: a,
		contextValues: o
	}, g(n)), D = tt(n) ? n : void 0, k = D ? f[D].addable : [], A = !b && !Qe(n, T) && nt(T), j = !b && (E.length > 0 || k.length > 0 && (T.length === 0 || A)), M = n === "main" && Z({
		itemsByPath: s,
		commands: a,
		contextValues: o
	}, h(n), { resource: _(c.layout, "primary") }).length > 0;
	return {
		commands: a,
		regionState: v,
		resource: l,
		tabStore: {
			tabOverrides: m.tabOverrides,
			toggleTab: m.toggleTab,
			reset: m.reset
		},
		subPanelPlacements: x,
		visiblePlacements: T,
		leadingItems: E,
		panelRegion: D,
		eligibleSubPanels: k,
		showTabs: A,
		hasActions: j,
		hasTrailingActions: M
	};
}, ot = (e, t, n) => {
	let [r, i] = Je(e, t), a = [r, i].some((e) => e.has && e.collapsed);
	return {
		...at(e, t, n),
		hasPanelMenus: a
	};
}, st = (e, t) => {
	let { showTabs: n, hasActions: r, hasTrailingActions: i, hasPanelMenus: a } = ot(e, t);
	return rt({
		hasTabs: n,
		hasHeaderActions: r || i,
		hasPanelMenus: a
	});
}, ct = (e, t) => {
	let { showTabs: n, hasActions: r } = ot(e, t);
	return n || r;
}, lt = oe(null), ut = (e) => {
	let t = se(lt), [n, r] = H(null);
	return ce(() => {
		if (e) return t?.register(e, n), () => t?.register(e, null);
	}, [
		t,
		e,
		n
	]), {
		enabled: !!(t && e),
		ref: r
	};
}, dt = (e) => {
	let { slotRef: t, hidden: n, placeholder: r } = e;
	return /* @__PURE__ */ Y(Oe, { children: [r ? /* @__PURE__ */ J(Q, {
		hidden: n,
		children: r
	}) : null, /* @__PURE__ */ J(U, {
		ref: t,
		display: n || r ? "none" : "flex",
		flexDirection: "column",
		flex: "1",
		minH: "0",
		w: "full",
		minW: "0"
	})] });
}, ft = (e) => {
	let { workbench: t, placement: n, slot: r, region: i, active: a } = e, o = n.viewId ? t.views.getView(n.viewId) : void 0, s = o?.body.kind === "dataTable" || o?.body.kind === "kanban", [c] = H(() => {
		let e = document.createElement("div");
		return e.style.display = "contents", e;
	});
	ce(() => {
		ze(c, r);
	}, [c, r]), V(() => () => {
		c.hasChildNodes() || c.remove();
	}, [c]);
	let l = () => {
		t.pages.getContent()?.widgetId === n.widgetId ? t.focus.setActiveRegion("main") : t.layout.getLayout().activeWidgetId !== n.widgetId && t.layout.activatePanel(n.widgetId);
	};
	return je(/* @__PURE__ */ J(U, {
		"data-workbench-instance": n.widgetId,
		display: a ? "flex" : "none",
		inert: !a,
		flex: "1",
		minW: "0",
		minH: "0",
		w: "full",
		overflow: "hidden",
		onPointerDown: l,
		onFocusCapture: (e) => {
			e.currentTarget.contains(e.target) && (l(), i && t.focus.setActiveRegion(i));
		},
		children: /* @__PURE__ */ J(Q, { children: /* @__PURE__ */ J(ae, {
			mode: a || !s ? "visible" : "hidden",
			children: /* @__PURE__ */ J(x, {
				workbench: t,
				placement: n,
				region: i
			})
		}) })
	}), c);
}, pt = (e) => {
	let { workbench: t, content: n, slot: r, open: i } = e;
	return y(t, n ? [n] : [], i).map((e) => /* @__PURE__ */ J(ft, {
		workbench: t,
		placement: e,
		region: "main",
		slot: r,
		active: n?.widgetId === e.widgetId
	}, e.widgetId));
}, mt = (e) => {
	let { workbench: n, slots: r } = e, i = w(n.resources.preview.store, (e) => e.changes), a = w(n.layout.store, (e) => e.layout), o = w(n.pages.store, (e) => e), s = m(o), c = Fe(n);
	w(n.modes.store, (e) => e.activeModeId);
	let l = p.flatMap((e) => {
		let r = a.regions[e], o = r.widgets.filter((r) => (!r.resource || !!t(r.resource, i)) && it(n, e, r)), s = o.find((e) => e.widgetId === r.activeWidgetId) ?? o[0];
		return o.filter((e) => e.widgetId === s?.widgetId || e.mountStrategy === "keep-mounted");
	}), u = y(n, l, c);
	return /* @__PURE__ */ Y(Oe, { children: [/* @__PURE__ */ J(pt, {
		workbench: n,
		content: s,
		slot: r.main,
		open: c
	}), u.map((e) => {
		let o = p.find((t) => a.regions[t].widgets.some((t) => t.widgetId === e.widgetId)), s = o ? a.regions[o].widgets.filter((e) => (!e.resource || !!t(e.resource, i)) && it(n, o, e)) : [], c = o ? s.find((e) => e.widgetId === a.regions[o].activeWidgetId) ?? s[0] : void 0;
		return /* @__PURE__ */ J(ft, {
			workbench: n,
			placement: e,
			region: o,
			slot: o ? r[o] : void 0,
			active: c?.widgetId === e.widgetId
		}, e.widgetId);
	})] });
}, ht = (e) => {
	let { workbench: t, children: n } = e, r = w(t.pages.store, (e) => e.projectId), [i, a] = H({}), [o] = H(() => ({ register: (e, t) => a((n) => n[e] === (t ?? void 0) ? n : {
		...n,
		[e]: t ?? void 0
	}) }));
	return /* @__PURE__ */ Y(lt, {
		value: o,
		children: [n, /* @__PURE__ */ J(mt, {
			workbench: t,
			slots: i
		}, r)]
	});
}, gt = /* @__PURE__ */ new Set([
	"nav",
	"main-header",
	"secondary-header",
	"side-header",
	"status"
]), _t = new Set(Object.values(f).flatMap((e) => Object.values(e))), vt = /* @__PURE__ */ new Set([
	"side",
	"side-header",
	"side-left-menu",
	"side-right-menu"
]), yt = (e, t, n) => n ?? e.find((e) => e.widgetId === t) ?? e[0], bt = (e, t, n) => {
	if (n === "sidenav") return e;
	let r = yt(e, t);
	return r ? e.filter((e) => e.widgetId === r.widgetId || e.mountStrategy === "keep-mounted") : [];
}, xt = (e, t, n) => {
	let r = e.widgetId === t, i = n === "sidenav";
	return {
		active: r,
		display: "flex",
		pointerEvents: r || i ? "auto" : "none",
		position: r || i ? "relative" : "absolute",
		visibility: r || i ? "visible" : "hidden"
	};
}, St = (e) => ({
	widgetId: e.id,
	contributionId: e.id,
	title: e.title,
	closable: !1
}), Ct = (e) => {
	let { workbench: t, placement: n, activeWidgetId: r, globalActiveWidgetId: i, region: a, visible: o, order: s } = e, c = xt(n, r, a), l = a === "sidenav", u = !c.active && !l, d;
	l ? d = "1 1 0" : c.active && (d = "1 0 auto");
	let f = () => {
		n.widgetId !== i && t.layout.activatePanel(n.widgetId);
	};
	return /* @__PURE__ */ J(U, {
		display: o ? c.display : "none",
		inert: !o || !c.active && !l,
		order: s,
		flex: d,
		h: u ? "full" : void 0,
		inset: u ? "0" : void 0,
		minH: "0",
		minW: "0",
		onPointerDown: l ? f : void 0,
		onFocusCapture: l ? f : void 0,
		overflow: "hidden",
		pointerEvents: c.pointerEvents,
		position: c.position,
		visibility: c.visibility,
		w: "full",
		children: /* @__PURE__ */ J(x, {
			workbench: t,
			placement: n
		})
	});
}, wt = (e, t) => {
	let n = w(e.pages.store, m);
	return t === "main" ? n : void 0;
}, Tt = (e) => {
	let { workbench: t, content: n } = e;
	return n ? /* @__PURE__ */ J(x, {
		workbench: t,
		placement: n,
		region: "main"
	}) : null;
}, Et = (e, t, n, r) => {
	t ? e.focus.setActiveRegion("main") : n && n.widgetId !== r && e.layout.activatePanel(n.widgetId);
}, Dt = (e) => {
	let { workbench: t, region: n, title: r, pointerEvents: i = "auto", transparent: a = !1 } = e, l = p.includes(n) ? n : void 0, u = ut(l), f = u.enabled, m = b(t, n), h = P(t), g = N(t), _ = w(t.layout.store, (e) => e.layout), C = wt(t, n), T = _.regions[n], E = w(t.layout.store, (e) => e.widgets), D = _t.has(n) ? s(_, o(n), h, { ignoreOwnerResourceKey: vt.has(n) }) : void 0, O = Ie(t, _t.has(n) ? o(n) : l), k = {
		...T,
		widgets: T.widgets.filter((e) => {
			let t = E[e.contributionId];
			return t ? (vt.has(n) ? d(t, g) : c(t, h, g, e, { location: O })) && v(t, {
				locationPanel: O,
				subPanel: D
			}) : !1;
		})
	}, j = w(t.layout.store, (e) => e.layout.activeWidgetId), M = yt(k.widgets, k.activeWidgetId, C), F = M ? void 0 : t.layout.getPlaceholder(n), ee = M ?? (F ? St(F) : void 0), I = M ? bt(k.widgets, M.widgetId, n) : [], te = Fe(t), ne = y(t, m !== void 0 || f ? [] : I, te), re = new Set(I.map((e) => e.widgetId)), ie = gt.has(n), L = (e) => Et(t, C, e, j), R = n === "sidenav", z = F && ee ? /* @__PURE__ */ J(x, {
		workbench: t,
		placement: ee,
		widget: F
	}) : null, B = !M && l ? /* @__PURE__ */ J(Re, {
		workbench: t,
		region: l,
		fallback: z
	}) : z;
	return /* @__PURE__ */ Y(ue, {
		as: "section",
		display: m === !1 ? "none" : "flex",
		direction: "column",
		h: "full",
		minH: "0",
		minW: "0",
		w: "full",
		bg: a ? "transparent" : A(n),
		overflow: "hidden",
		pointerEvents: i,
		"aria-label": r ?? n,
		onPointerDown: R ? void 0 : () => L(M),
		onFocusCapture: R ? void 0 : () => L(M),
		children: [/* @__PURE__ */ J(S, {
			workbench: t,
			region: n,
			viewId: m || void 0
		}), f ? /* @__PURE__ */ J(dt, {
			slotRef: u.ref,
			hidden: !!m,
			placeholder: B
		}) : /* @__PURE__ */ Y(Q, {
			hidden: !!m,
			horizontal: ie,
			children: [
				/* @__PURE__ */ J(Tt, {
					workbench: t,
					content: C
				}),
				B,
				ne.map((e) => /* @__PURE__ */ J(Ct, {
					visible: !m && re.has(e.widgetId),
					order: I.findIndex((t) => t.widgetId === e.widgetId),
					workbench: t,
					placement: e,
					activeWidgetId: M?.widgetId,
					globalActiveWidgetId: j,
					region: n
				}, e.widgetId))
			]
		})]
	});
}, Ot = (e, t) => (w(e.modes.store, (e) => e.activeModeId), w(e.layout.store, M(() => {
	let n = l(e.shell.getArrangement(), t);
	return e.shell.getPanelPositions(t).filter((e) => e !== n);
}))), kt = (e, t) => Ot(e, t).map((n) => ({
	key: `position-${n}`,
	label: `Move ${t === "activity" ? "action bar" : "panel"} to ${n}`,
	icon: /* @__PURE__ */ J(T, {
		name: {
			left: "PanelLeft",
			right: "PanelRight",
			top: "PanelTop",
			bottom: "PanelBottom"
		}[n],
		size: 14
	}),
	onClick: () => e.shell.repositionPanel(t, n)
})), At = "button,a,input,textarea,select,iframe,[role=\"tab\"],[role=\"treeitem\"],[role=\"button\"],[role=\"menuitem\"],[contenteditable=\"true\"],[data-workbench-tab],[data-tree-list-focus-id]", jt = (e, t) => {
	let n = Ot(e, t).length > 0, r = w(e.layout.store, () => t === "side" && e.sidePanel.getMode() === "floating"), i = w(e.fullscreen.store, (e) => t === "side" && e.active), a = !n || r || i, o = R({
		id: `panel:${t}`,
		data: { panelRegion: t },
		disabled: a
	}), s = (e) => !e.target.closest(At);
	return {
		ref: o.setNodeRef,
		tabIndex: 0,
		"aria-label": `Move ${t} panel`,
		"data-workbench-panel-drag": t,
		"data-panel-draggable": !a || void 0,
		"data-panel-dragging": o.isDragging || void 0,
		layerStyle: "panelDragSurface",
		onMouseDown: (e) => {
			s(e) && o.listeners?.onMouseDown?.(e);
		},
		onTouchStart: (e) => {
			s(e) && o.listeners?.onTouchStart?.(e);
		}
	};
}, Mt = (e) => {
	let { workbench: t, region: n, children: r, ref: i, ...a } = e, o = jt(t, n);
	return /* @__PURE__ */ J(be, {
		...o,
		...a,
		ref: ge(o.ref, i),
		children: r
	});
}, Nt = (e) => e.level === "error" && !e.inlineTarget, Pt = (e) => w(e.notifications.store, (e) => Object.values(e.notifications).some(Nt)), Ft = (t) => {
	let { workbench: n } = t, r = w(n.notifications.store, (e) => e.notifications), i = Object.values(r).filter(Nt).sort((e, t) => e.createdAt.localeCompare(t.createdAt));
	if (!i.length) return null;
	let a = i.at(-1);
	return /* @__PURE__ */ Y(G.Root, {
		positioning: {
			placement: "top-start",
			offset: { mainAxis: 4 }
		},
		children: [/* @__PURE__ */ J(G.Trigger, {
			asChild: !0,
			children: /* @__PURE__ */ Y(W, {
				size: "2xs",
				variant: "ghost",
				color: "fg.error",
				minW: "0",
				maxW: "full",
				justifyContent: "flex-start",
				"aria-label": `System errors: ${a.title}`,
				children: [/* @__PURE__ */ J(fe, {
					as: e,
					boxSize: "4"
				}), /* @__PURE__ */ J(q, {
					as: "span",
					textStyle: "label/XS/medium",
					maxW: "2xs",
					truncate: !0,
					role: "status",
					children: a.title
				})]
			})
		}), /* @__PURE__ */ J(pe, { children: /* @__PURE__ */ J(G.Positioner, { children: /* @__PURE__ */ J(G.Content, {
			width: "performance-popover",
			maxW: "calc(100vw - var(--chakra-spacing-md) * 2)",
			maxH: "70dvh",
			overflow: "hidden",
			children: /* @__PURE__ */ Y(G.Body, {
				display: "flex",
				flexDirection: "column",
				gap: "sm",
				minH: "0",
				children: [/* @__PURE__ */ Y(de, {
					gap: "xs",
					flexShrink: "0",
					children: [
						/* @__PURE__ */ J(fe, {
							as: e,
							boxSize: "4"
						}),
						/* @__PURE__ */ J(G.Title, { children: "System errors" }),
						/* @__PURE__ */ J(he.Root, {
							size: "sm",
							variant: "subtle",
							colorPalette: "red",
							"aria-label": `${i.length} system errors`,
							children: /* @__PURE__ */ J(he.Label, { children: i.length })
						}),
						/* @__PURE__ */ J(W, {
							size: "2xs",
							variant: "ghost",
							marginLeft: "auto",
							onClick: () => {
								for (let e of i) n.notifications.dismiss(e.id);
							},
							children: "Clear all"
						})
					]
				}), /* @__PURE__ */ J(Se, {
					minH: "0",
					viewportProps: {
						role: "region",
						"aria-label": "System error list",
						overscrollBehavior: "contain"
					},
					children: /* @__PURE__ */ J(K, {
						gap: "sm",
						minW: "0",
						children: [...i].reverse().map((e) => /* @__PURE__ */ J(_e, {
							status: "error",
							title: e.title,
							closeLabel: `Dismiss ${e.title}`,
							onClose: () => n.notifications.dismiss(e.id),
							endElement: e.actions?.map((t) => /* @__PURE__ */ J(W, {
								onClick: () => {
									let r = n.notifications.captureActionError(t.title, `system-errors.${e.id}`);
									n.commands.executeCommand(t.commandId, t.args).catch(r);
								},
								children: t.title
							}, t.commandId)),
							children: /* @__PURE__ */ Y(K, {
								gap: "xs",
								minW: "0",
								children: [/* @__PURE__ */ J(q, { children: e.message }), /* @__PURE__ */ J(D, {
									workbench: n,
									target: `system-errors.${e.id}`
								})]
							})
						}, e.id))
					})
				})]
			})
		}) }) })]
	});
}, It = "Drag to reorder. Alt+Left or Alt+Right to move.", Lt = (e) => {
	if (!e.over || e.over.id === e.active.id) return;
	let t = e.active.rect.current.translated;
	if (t) return {
		id: String(e.over.id),
		edge: t.left + t.width / 2 < e.over.rect.left + e.over.rect.width / 2 ? "before" : "after"
	};
}, Rt = (e) => {
	let { workbench: t, placement: n, ids: r, activeId: i, drop: a } = e, o = n.widgetId, s = r.indexOf(o), c = s >= 0 && r.length > 1, l = R({
		id: o,
		disabled: !c
	}), u = B({
		id: o,
		disabled: !c
	}), d = n.title ?? o;
	return /* @__PURE__ */ Y(U, {
		ref: (e) => {
			l.setNodeRef(e), u.setNodeRef(e);
		},
		...l.listeners,
		tabIndex: c ? 0 : void 0,
		role: "group",
		"aria-label": d,
		"aria-describedby": c ? l.attributes["aria-describedby"] : void 0,
		"aria-keyshortcuts": c ? "Alt+ArrowLeft Alt+ArrowRight" : void 0,
		"data-status-bar-item": o,
		"data-sortable": c || void 0,
		"data-dragging": i === o || void 0,
		layerStyle: "statusBarItem",
		alignItems: "stretch",
		display: s < 0 ? "none" : "flex",
		inert: s < 0,
		order: s,
		touchAction: c ? "pan-y" : void 0,
		onKeyDown: (e) => {
			if (!c || !e.altKey || !["ArrowLeft", "ArrowRight"].includes(e.key)) return;
			e.preventDefault(), e.stopPropagation();
			let n = e.key === "ArrowLeft", i = r[s + (n ? -1 : 1)];
			i && t.statusBar.reorderItem(o, n ? { beforeItemId: i } : { afterItemId: i });
		},
		children: [
			/* @__PURE__ */ J(x, {
				workbench: t,
				region: "status",
				placement: n
			}),
			i ? /* @__PURE__ */ J(U, {
				position: "absolute",
				inset: "0"
			}) : null,
			a?.id === o ? /* @__PURE__ */ J(ve, {
				orientation: "vertical",
				...a.edge === "before" ? { left: 0 } : { right: 0 }
			}) : null
		]
	});
}, zt = (e) => {
	let { slot: t, workbench: n } = e;
	w(n.statusBar.store, (e) => e);
	let r = N(n) === n.modes.getActiveModeId() ? n.statusBar.listVisibleItems(t) : [], i = r.map((e) => e.id), a = y(n, r.map((e) => ({
		widgetId: e.id,
		contributionId: e.viewId,
		viewId: e.viewId,
		title: n.views.getView(e.viewId)?.title,
		closable: !1
	}))), [o, s] = H(), [c, l] = H(), u = z(I(ie, { activationConstraint: { distance: 5 } }), I(te, { activationConstraint: { distance: 5 } })), d = () => {
		s(void 0), l(void 0);
	};
	return /* @__PURE__ */ Y(L, {
		sensors: u,
		accessibility: { screenReaderInstructions: { draggable: It } },
		collisionDetection: ne,
		onDragStart: (e) => s(String(e.active.id)),
		onDragOver: (e) => l(Lt(e)),
		onDragMove: (e) => l(Lt(e)),
		onDragCancel: d,
		onDragEnd: (e) => {
			let t = Lt(e);
			d(), t && n.statusBar.reorderItem(String(e.active.id), t.edge === "before" ? { beforeItemId: t.id } : { afterItemId: t.id });
		},
		children: [a.map((e) => /* @__PURE__ */ J(Rt, {
			workbench: n,
			placement: e,
			ids: i,
			activeId: o,
			drop: c
		}, e.widgetId)), /* @__PURE__ */ J(U, {
			asChild: !0,
			pointerEvents: "none",
			children: /* @__PURE__ */ J(re, {
				dropAnimation: null,
				children: o ? /* @__PURE__ */ J(U, {
					layerStyle: "floatingBar",
					textStyle: "label/XS/medium",
					children: a.find((e) => e.widgetId === o)?.title ?? o
				}) : null
			})
		})]
	});
}, Bt = (e) => {
	let { workbench: t, contextActions: n } = e, r = jt(t, "sidenav"), i = kt(t, "sidenav");
	return /* @__PURE__ */ J(xe, {
		actions: [...n, ...i],
		closeOnSelect: !1,
		keepMountedWhenEmpty: !0,
		children: /* @__PURE__ */ J(U, {
			...r,
			h: "full",
			minH: "0",
			minW: "0",
			w: "full",
			children: /* @__PURE__ */ J(X, {
				workbench: t,
				region: "sidenav",
				"data-workbench-region": "sidenav",
				as: "aside",
				bg: k.sidenav,
				layerStyle: "panel",
				display: "flex",
				flexDirection: "column",
				h: "full",
				minH: "0",
				minW: "0",
				overflow: "hidden",
				w: "full",
				children: /* @__PURE__ */ J(U, {
					flex: "1",
					minH: "0",
					minW: "0",
					overflow: "hidden",
					children: /* @__PURE__ */ J(Dt, {
						workbench: t,
						region: "sidenav",
						title: "Sidenav"
					})
				})
			})
		})
	});
}, Vt = "2rem", Ht = (e) => {
	let { workbench: t } = e, n = jt(t, "activity"), r = kt(t, "activity"), i = w(t.layout.store, () => t.shell.getArrangement().activity), a = i === "top" || i === "bottom";
	return /* @__PURE__ */ J(xe, {
		actions: r,
		children: /* @__PURE__ */ J(U, {
			...n,
			display: e.visible === !1 ? "none" : "block",
			flexShrink: 0,
			h: a ? "14" : "full",
			w: a ? "full" : "14",
			children: /* @__PURE__ */ J(X, {
				workbench: t,
				region: "activity",
				"data-workbench-region": "activity",
				display: e.visible === !1 ? "none" : "block",
				as: "nav",
				flexShrink: 0,
				h: "full",
				minH: "0",
				overflow: "hidden",
				w: "full",
				children: /* @__PURE__ */ J(Dt, {
					workbench: t,
					region: "activity",
					title: "Activity bar"
				})
			})
		})
	});
}, Ut = (e) => {
	let { workbench: t } = e, n = b(t, "status");
	return /* @__PURE__ */ J(X, {
		workbench: t,
		region: "status",
		"data-workbench-region": "status",
		display: e.visible === !1 ? "none" : "block",
		as: "footer",
		flexShrink: 0,
		h: Vt,
		minH: "0",
		minW: "0",
		overflow: "hidden",
		children: /* @__PURE__ */ Y(U, {
			display: "flex",
			alignItems: "stretch",
			justifyContent: "space-between",
			px: "sm",
			h: "full",
			minW: "0",
			w: "full",
			children: [
				/* @__PURE__ */ J(U, {
					display: "flex",
					alignItems: "center",
					minW: "0",
					children: /* @__PURE__ */ J(Ft, { workbench: t })
				}),
				/* @__PURE__ */ J(U, {
					flex: "1",
					minW: "0",
					h: "full",
					display: n ? "block" : "none",
					children: /* @__PURE__ */ J(S, {
						workbench: t,
						region: "status",
						viewId: n || void 0
					})
				}),
				/* @__PURE__ */ J(U, {
					display: n === void 0 ? "flex" : "none",
					alignItems: "stretch",
					minW: "0",
					h: "full",
					children: /* @__PURE__ */ J(zt, {
						workbench: t,
						slot: "leading"
					})
				}),
				/* @__PURE__ */ J(U, {
					display: n === void 0 ? "flex" : "none",
					alignItems: "stretch",
					minW: "0",
					h: "full",
					marginLeft: "auto",
					children: /* @__PURE__ */ J(zt, {
						workbench: t,
						slot: "trailing"
					})
				})
			]
		})
	});
};
export { X as S, Je as _, Pt as a, ze as b, Dt as c, ot as d, at as f, Ze as g, $e as h, Ut as i, ht as l, et as m, Ht as n, Mt as o, ct as p, Bt as r, kt as s, Vt as t, st as u, Ye as v, Z as x, He as y };

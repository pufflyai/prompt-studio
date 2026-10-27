// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./triangle-alert-DcqN2fDE.ts";
import { c as t, o as n, r } from "./resource-registry-CVuZngrt.ts";
import { A as i, F as a, H as o, I as s, L as c, M as l, O as u, R as d, U as f, W as p, d as m, m as h, v as g, x as _, z as v } from "./workbench-core-N58OeDyx.ts";
import { i as y, n as b, r as x, t as S } from "./mode-chrome-D8eccNh1.ts";
import { n as C, t as w } from "./use-workbench-store-BMaFgEbb.ts";
import { t as T } from "./icon-D3uE7jD-.ts";
import { t as E } from "./menu-item-state-BEhSPSZj.ts";
import { t as D } from "./action-errors-CACpJ-MK.ts";
import { t as O } from "./use-workbench-composition-panels-DWghJGTR.ts";
import { n as k, t as A } from "./workbench-theme-background-LZFbdbjE.ts";
import { n as j } from "./panel-widget-open-DNEH0WG4.ts";
import { t as M } from "./shallow-BYHDNLn2.ts";
import { n as N, r as P, t as F } from "./use-panel-policy-BALwJ9k6.ts";
import { t as I } from "./use-page-params-BMVjuYZ6.ts";
import { b as L, c as R, m as ee, n as te, o as ne, t as re, v as z, x as B, y as V } from "./core.esm-cje5eyjm.ts";
import { Activity as H, createContext as ie, useContext as ae, useEffect as U, useLayoutEffect as oe, useRef as se, useState as W } from "react";
import { Box as G, Button as K, Flex as ce, HStack as le, Icon as ue, Popover as q, Portal as de, SimpleGrid as fe, Stack as J, Tag as pe, Text as Y, mergeRefs as me } from "@chakra-ui/react";
import { AlertMessage as he, DropIndicator as ge, EmptyState as _e, Header as ve, ResourceContextMenu as ye, ScrollArea as be, SimpleCard as xe, SimpleCardBody as Se, filterVisibleTabs as Ce, getTabVisibilityStore as we, useTabVisibilityStore as Te } from "@pstdio/ui";
import { Fragment as Ee, jsx as X, jsxs as Z } from "react/jsx-runtime";
import { contributionRefId as De, pagePlaceholderView as Oe } from "@pstdio/sdk/extensions";
import { createPortal as ke } from "react-dom";
// packages/pstdio-workbench/src/react/focus/focus-region.tsx
var Q = (e) => {
	let { workbench: t, region: n, children: r, ...i } = e, a = w(t.focus.store, (e) => e.activeRegion), o = se(null);
	return U(() => {
		let e = o.current;
		e && a === n && (e.contains(document.activeElement) || e.focus({ preventScroll: !0 }));
	}, [a, n]), /* @__PURE__ */ Z(G, {
		ref: o,
		tabIndex: -1,
		outline: "none",
		onFocusCapture: (e) => {
			e.currentTarget.contains(e.target) && t.focus.setActiveRegion(n);
		},
		...i,
		children: [/* @__PURE__ */ X(D, {
			workbench: t,
			target: `region:${n}`
		}), r]
	});
}, Ae = (e) => e.join("/"), je = (e, t) => t ? r(e.contextValues, t.resource) : e.contextValues, Me = (e, t, r) => {
	let i = je(e, r);
	return [...e.itemsByPath[Ae(t)] ?? []].sort((e, t) => (e.order ?? 0) - (t.order ?? 0) || n(e, t)).map((t) => {
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
}, Ne = (e) => {
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
}, Pe = (e) => C(Ne(e), M((e) => e)), Fe = (e) => {
	let { workbench: t, region: n } = e, r = P(t), i = O(t)[n].addable, { activeModeId: a, modes: o } = w(t.modes.store, (e) => e);
	return !a && Object.keys(o).length > 0 ? null : i.length ? /* @__PURE__ */ X(J, {
		flex: "1",
		p: "xl",
		children: /* @__PURE__ */ X(J, {
			w: "full",
			maxW: "lg",
			mx: "auto",
			children: /* @__PURE__ */ X(fe, {
				role: "group",
				"aria-label": "Available tabs",
				gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, max(var(--chakra-sizes-3xs), calc((100% - var(--chakra-spacing-sm)) / 2))), 1fr))",
				gap: "sm",
				children: i.map((e) => /* @__PURE__ */ X(xe, {
					variant: "action",
					asChild: !0,
					children: /* @__PURE__ */ X("button", {
						type: "button",
						onClick: () => j({
							workbench: t,
							widget: e.contribution,
							region: n,
							resource: r,
							pinned: e.pinned,
							open: e.open
						}),
						children: /* @__PURE__ */ X(Se, { children: /* @__PURE__ */ Z(le, {
							gap: "xs",
							children: [e.contribution.icon ? /* @__PURE__ */ X(T, {
								name: e.contribution.icon,
								size: 14,
								color: "fg.muted"
							}) : null, /* @__PURE__ */ X(Y, {
								textStyle: "label/M/regular",
								truncate: !0,
								children: e.contribution.title
							})]
						}) })
					})
				}, e.panelId))
			})
		})
	}) : /* @__PURE__ */ X(_e, { title: "No tabs available" });
}, Ie = (e) => {
	let { workbench: t, region: n, fallback: r } = e, i = F(t, n), a = w(t.pages.store, (e) => e), o = a.activePageId ? a.pages[a.activePageId] : void 0, s = n === "main" ? Oe(o?.main.empty) : void 0;
	return s ? /* @__PURE__ */ X(I, {
		value: a.activePageId,
		children: /* @__PURE__ */ X(x, {
			workbench: t,
			region: "main",
			placement: {
				widgetId: "workbench.empty-page",
				contributionId: "workbench.empty-page",
				viewId: De(s),
				closable: !1,
				resource: a.location?.resource
			}
		})
	}) : r ?? (i.acceptsTabs ? /* @__PURE__ */ X(Fe, {
		workbench: t,
		region: n
	}) : null);
}, Le = (e, t) => {
	t && e.parentNode !== t && (t.moveBefore && e.isConnected && t.isConnected ? t.moveBefore(e, null) : t.appendChild(e));
}, Re = {
	display: "flex",
	flexDirection: "column",
	minH: "100%",
	position: "relative"
}, ze = {
	display: "flex",
	alignItems: "stretch",
	h: "full",
	minH: "100%",
	position: "relative"
}, Be = (e) => {
	let { children: t, horizontal: n = !1, hidden: r = !1 } = e;
	return /* @__PURE__ */ X(be, {
		display: r ? "none" : "flex",
		flex: "1",
		minH: "0",
		minW: "0",
		w: "full",
		size: "xs",
		showVerticalScrollbar: !n,
		showHorizontalScrollbar: n,
		viewportProps: n ? { justifyContent: "center" } : void 0,
		contentProps: n ? ze : Re,
		children: t
	});
}, Ve = (e, ...t) => t.every((t) => e.layout.getRegionCollapsible(t)), He = (e, t) => {
	if (e === 0) return t.map((e) => e.has && (e.open || !e.collapsible));
	let n = new Set(t.filter((e) => e.has && !e.collapsible)), r = e <= 580, i = (t) => {
		let i = [...n, t];
		return !r && e >= 120 + i.reduce((e, t) => e + t.minSize + 1, 0);
	};
	for (let e of t) e.has && e.open && !n.has(e) && i(e) && n.add(e);
	return t.map((e) => e.has && (n.has(e) || i(e)));
}, Ue = {
	defaultPx: 280,
	minPx: 144,
	maxPx: 320
}, We = {
	main: "Main",
	secondary: "Secondary",
	side: "Side"
}, Ge = (e) => ({
	defaultPx: e?.defaultPx ?? Ue.defaultPx,
	minPx: e?.minPx ?? Ue.minPx,
	maxPx: e ? e.maxPx : Ue.maxPx
}), Ke = (e, t) => `${We[e]} ${t} menu`, $ = (e, t, n) => {
	let r = f[t][n], o = P(e), l = N(e), u = i(l ? e.modes.getMode(l) : void 0, t), p = w(e.layout.store, (e) => e.layout), m = w(e.layout.store, (e) => e.widgets), h = p.regions[r], g = s(p, t, o, { ignoreOwnerResourceKey: t === "side" }), _ = a(p), y = {
		...h,
		widgets: h.widgets.filter((e) => {
			let n = m[e.contributionId];
			return n ? (t === "side" ? d(n, l) : c(n, o, l, e, { location: _ })) && v(n, {
				locationPanel: _,
				subPanel: g
			}) : !1;
		})
	}, b = y.widgets.find((e) => e.widgetId === y.activeWidgetId) ?? y.widgets[0], x = b ? m[b.contributionId] : void 0, S = w(e.layout.store, () => Ve(e, r)), C = b ? `panel-menu:${b.widgetId}` : r, T = w(e.panelMenuState.store, (e) => e.openByMenuId[C] ?? !0);
	return {
		region: r,
		side: n,
		label: Ke(t, n),
		title: x?.title ?? Ke(t, n),
		icon: x?.icon ?? (n === "left" ? "PanelLeft" : "PanelRight"),
		has: u && (y.widgets.length > 0 || !!e.layout.getPlaceholder(r)),
		collapsed: !T && S,
		collapsible: S,
		size: Ge(e.layout.getRegionSize(r)),
		onOpen: () => e.panelMenuState.setOpen(C, !0),
		onCollapsedChange: (t) => {
			(!t || S) && e.panelMenuState.setOpen(C, !t);
		}
	};
}, qe = (e, t) => {
	let n = Ye(t), r = [$(e, t, "left"), $(e, t, "right")], i = He(n, r.map((e) => ({
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
}, Je = (e, t) => {
	let n = $(e, t, "left"), r = $(e, t, "right");
	return n.has || r.has;
}, Ye = (e) => {
	let [t, n] = W(0);
	return U(() => {
		let t = document.querySelector(`[data-workbench-panel="${e}"]`);
		if (!t) return;
		let r = () => n(t.clientWidth);
		r();
		let i = new ResizeObserver(r);
		return i.observe(t), () => i.disconnect();
	}, [e]), t;
}, Xe = (e, t) => `${e}:${t.contributionId}`, Ze = (e, t) => e === "sidenav", Qe = (e, t, n) => {
	let r = e.resource?.icon ?? n;
	return e.role === "sub-panel" ? t?.icon ?? r : r ?? t?.icon;
}, $e = (e, t) => t && e.some((e) => e.widgetId === t) ? t : e[0]?.widgetId, et = (e) => p.some((t) => t === e), tt = (e) => e.length > 0, nt = (e) => e.hasTabs === !0 || e.hasPanelMenus === !0 || e.hasHeaderActions === !0, rt = (e, t, n, r = e.getPrimaryResource(), i = e.modes.getActiveModeId()) => {
	if (n.resource && !e.resources.preview.resolve(n.resource)) return !1;
	let o = e.layout.getWidget(n.contributionId);
	return o ? c(o, r, i, n, {
		ignoreResourceLocation: t === "side" || t === "secondary",
		location: a(e.layout.getLayout())
	}) : !1;
}, it = (e, n, r) => {
	let i = w(e.resources.preview.store, (e) => e.changes), a = w(e.commands.store, (e) => e.commands), o = w(e.context.store, (e) => e.values), s = w(e.layout.menuStore, (e) => e.itemsByPath), c = w(e.layout.store, (e) => e), l = P(e), d = N(e), f = O(e), p = r ?? `${e.layout.getPersistenceScope() ?? "unscoped"}/${n}`, m = Te(p, (e) => e);
	U(() => {
		let t = e.onDidResetLayout(() => we(p).getState().reset());
		return () => t.dispose();
	}, [e, p]);
	let v = c.layout.regions[n], y = w(e.pages.store, (e) => e), b = n === "main" && u(y.pages[y.activePageId ?? ""]), x = v.widgets.filter((r) => r.role === "sub-panel" && (!r.resource || !!t(r.resource, i)) && rt(e, n, r, l, d)), S = Ce(x, m.tabOverrides, (e) => Xe(n, e)), C = new Set(S.map((e) => e.widgetId)), T = v.widgets.filter((e) => (C.has(e.widgetId) || e.role === "location") && (!e.resource || !!t(e.resource, i))), E = Me({
		itemsByPath: s,
		commands: a,
		contextValues: o
	}, g(n)), D = et(n) ? n : void 0, k = D ? f[D].addable : [], A = !b && !Ze(n, T) && tt(T), j = !b && (E.length > 0 || k.length > 0 && (T.length === 0 || A)), M = n === "main" && Me({
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
}, at = (e, t, n) => {
	let [r, i] = qe(e, t), a = [r, i].some((e) => e.has && e.collapsed);
	return {
		...it(e, t, n),
		hasPanelMenus: a
	};
}, ot = (e, t) => {
	let { showTabs: n, hasActions: r, hasTrailingActions: i, hasPanelMenus: a } = at(e, t);
	return nt({
		hasTabs: n,
		hasHeaderActions: r || i,
		hasPanelMenus: a
	});
}, st = (e, t) => {
	let { showTabs: n, hasActions: r } = at(e, t);
	return n || r;
}, ct = ie(null), lt = (e) => {
	let t = ae(ct), [n, r] = W(null);
	return oe(() => {
		if (e) return t?.register(e, n), () => t?.register(e, null);
	}, [
		t,
		e,
		n
	]), {
		enabled: !!(t && e),
		ref: r
	};
}, ut = (e) => {
	let { slotRef: t, hidden: n, placeholder: r } = e;
	return /* @__PURE__ */ Z(Ee, { children: [r ? /* @__PURE__ */ X(Be, {
		hidden: n,
		children: r
	}) : null, /* @__PURE__ */ X(G, {
		ref: t,
		display: n || r ? "none" : "flex",
		flexDirection: "column",
		flex: "1",
		minH: "0",
		w: "full",
		minW: "0"
	})] });
}, dt = (e) => {
	let { workbench: t, placement: n, slot: r, region: i, active: a } = e, o = n.viewId ? t.views.getView(n.viewId) : void 0, s = o?.body.kind === "dataTable" || o?.body.kind === "kanban", [c] = W(() => {
		let e = document.createElement("div");
		return e.style.display = "contents", e;
	});
	oe(() => {
		Le(c, r);
	}, [c, r]), U(() => () => {
		c.hasChildNodes() || c.remove();
	}, [c]);
	let l = () => {
		t.pages.getContent()?.widgetId === n.widgetId ? t.focus.setActiveRegion("main") : t.layout.getLayout().activeWidgetId !== n.widgetId && t.layout.activatePanel(n.widgetId);
	};
	return ke(/* @__PURE__ */ X(G, {
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
		children: /* @__PURE__ */ X(Be, { children: /* @__PURE__ */ X(H, {
			mode: a || !s ? "visible" : "hidden",
			children: /* @__PURE__ */ X(x, {
				workbench: t,
				placement: n,
				region: i
			})
		}) })
	}), c);
}, ft = (e) => {
	let { workbench: t, content: n, slot: r, open: i } = e;
	return y(t, n ? [n] : [], i).map((e) => /* @__PURE__ */ X(dt, {
		workbench: t,
		placement: e,
		region: "main",
		slot: r,
		active: n?.widgetId === e.widgetId
	}, e.widgetId));
}, pt = (e) => {
	let { workbench: n, slots: r } = e, i = w(n.resources.preview.store, (e) => e.changes), a = w(n.layout.store, (e) => e.layout), o = w(n.pages.store, (e) => e), s = m(o), c = Pe(n);
	w(n.modes.store, (e) => e.activeModeId);
	let l = p.flatMap((e) => {
		let r = a.regions[e], o = r.widgets.filter((r) => (!r.resource || !!t(r.resource, i)) && rt(n, e, r)), s = o.find((e) => e.widgetId === r.activeWidgetId) ?? o[0];
		return o.filter((e) => e.widgetId === s?.widgetId || e.mountStrategy === "keep-mounted");
	}), u = y(n, l, c);
	return /* @__PURE__ */ Z(Ee, { children: [/* @__PURE__ */ X(ft, {
		workbench: n,
		content: s,
		slot: r.main,
		open: c
	}), u.map((e) => {
		let o = p.find((t) => a.regions[t].widgets.some((t) => t.widgetId === e.widgetId)), s = o ? a.regions[o].widgets.filter((e) => (!e.resource || !!t(e.resource, i)) && rt(n, o, e)) : [], c = o ? s.find((e) => e.widgetId === a.regions[o].activeWidgetId) ?? s[0] : void 0;
		return /* @__PURE__ */ X(dt, {
			workbench: n,
			placement: e,
			region: o,
			slot: o ? r[o] : void 0,
			active: c?.widgetId === e.widgetId
		}, e.widgetId);
	})] });
}, mt = (e) => {
	let { workbench: t, children: n } = e, r = w(t.pages.store, (e) => e.projectId), [i, a] = W({}), [o] = W(() => ({ register: (e, t) => a((n) => n[e] === (t ?? void 0) ? n : {
		...n,
		[e]: t ?? void 0
	}) }));
	return /* @__PURE__ */ Z(ct, {
		value: o,
		children: [n, /* @__PURE__ */ X(pt, {
			workbench: t,
			slots: i
		}, r)]
	});
}, ht = /* @__PURE__ */ new Set([
	"nav",
	"main-header",
	"secondary-header",
	"side-header",
	"status"
]), gt = new Set(Object.values(f).flatMap((e) => Object.values(e))), _t = /* @__PURE__ */ new Set([
	"side",
	"side-header",
	"side-left-menu",
	"side-right-menu"
]), vt = (e, t, n) => n ?? e.find((e) => e.widgetId === t) ?? e[0], yt = (e, t, n) => {
	if (n === "sidenav") return e;
	let r = vt(e, t);
	return r ? e.filter((e) => e.widgetId === r.widgetId || e.mountStrategy === "keep-mounted") : [];
}, bt = (e, t, n) => {
	let r = e.widgetId === t, i = n === "sidenav";
	return {
		active: r,
		display: "flex",
		pointerEvents: r || i ? "auto" : "none",
		position: r || i ? "relative" : "absolute",
		visibility: r || i ? "visible" : "hidden"
	};
}, xt = (e) => ({
	widgetId: e.id,
	contributionId: e.id,
	title: e.title,
	closable: !1
}), St = (e) => {
	let { workbench: t, placement: n, activeWidgetId: r, globalActiveWidgetId: i, region: a, visible: o, order: s } = e, c = bt(n, r, a), l = a === "sidenav", u = !c.active && !l, d;
	l ? d = "1 1 0" : c.active && (d = "1 0 auto");
	let f = () => {
		n.widgetId !== i && t.layout.activatePanel(n.widgetId);
	};
	return /* @__PURE__ */ X(G, {
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
		children: /* @__PURE__ */ X(x, {
			workbench: t,
			placement: n
		})
	});
}, Ct = (e, t) => {
	let n = w(e.pages.store, m);
	return t === "main" ? n : void 0;
}, wt = (e) => {
	let { workbench: t, content: n } = e;
	return n ? /* @__PURE__ */ X(x, {
		workbench: t,
		placement: n,
		region: "main"
	}) : null;
}, Tt = (e, t, n, r) => {
	t ? e.focus.setActiveRegion("main") : n && n.widgetId !== r && e.layout.activatePanel(n.widgetId);
}, Et = (e) => {
	let { workbench: t, region: n, title: r, pointerEvents: i = "auto", transparent: l = !1 } = e, u = p.includes(n) ? n : void 0, f = lt(u), m = f.enabled, h = b(t, n), g = P(t), _ = N(t), C = w(t.layout.store, (e) => e.layout), T = Ct(t, n), E = C.regions[n], D = w(t.layout.store, (e) => e.widgets), O = gt.has(n) ? s(C, o(n), g, { ignoreOwnerResourceKey: _t.has(n) }) : void 0, k = a(C), j = {
		...E,
		widgets: E.widgets.filter((e) => {
			let t = D[e.contributionId];
			return t ? (_t.has(n) ? d(t, _) : c(t, g, _, e, { location: k })) && v(t, {
				locationPanel: k,
				subPanel: O
			}) : !1;
		})
	}, M = w(t.layout.store, (e) => e.layout.activeWidgetId), F = vt(j.widgets, j.activeWidgetId, T), I = F ? void 0 : t.layout.getPlaceholder(n), L = F ?? (I ? xt(I) : void 0), R = F ? yt(j.widgets, F.widgetId, n) : [], ee = Pe(t), te = y(t, h !== void 0 || m ? [] : R, ee), ne = new Set(R.map((e) => e.widgetId)), re = ht.has(n), z = (e) => Tt(t, T, e, M), B = n === "sidenav", V = I && L ? /* @__PURE__ */ X(x, {
		workbench: t,
		placement: L,
		widget: I
	}) : null, H = !F && u ? /* @__PURE__ */ X(Ie, {
		workbench: t,
		region: u,
		fallback: V
	}) : V;
	return /* @__PURE__ */ Z(ce, {
		as: "section",
		display: h === !1 ? "none" : "flex",
		direction: "column",
		h: "full",
		minH: "0",
		minW: "0",
		w: "full",
		bg: l ? "transparent" : A(n),
		overflow: "hidden",
		pointerEvents: i,
		"aria-label": r ?? n,
		onPointerDown: B ? void 0 : () => z(F),
		onFocusCapture: B ? void 0 : () => z(F),
		children: [/* @__PURE__ */ X(S, {
			workbench: t,
			region: n,
			viewId: h || void 0
		}), m ? /* @__PURE__ */ X(ut, {
			slotRef: f.ref,
			hidden: !!h,
			placeholder: H
		}) : /* @__PURE__ */ Z(Be, {
			hidden: !!h,
			horizontal: re,
			children: [
				/* @__PURE__ */ X(wt, {
					workbench: t,
					content: T
				}),
				H,
				te.map((e) => /* @__PURE__ */ X(St, {
					visible: !h && ne.has(e.widgetId),
					order: R.findIndex((t) => t.widgetId === e.widgetId),
					workbench: t,
					placement: e,
					activeWidgetId: F?.widgetId,
					globalActiveWidgetId: M,
					region: n
				}, e.widgetId))
			]
		})]
	});
}, Dt = (e, t) => (w(e.modes.store, (e) => e.activeModeId), w(e.layout.store, M(() => {
	let n = l(e.shell.getArrangement(), t);
	return e.shell.getPanelPositions(t).filter((e) => e !== n);
}))), Ot = (e, t) => Dt(e, t).map((n) => ({
	key: `position-${n}`,
	label: `Move ${t === "activity" ? "action bar" : "panel"} to ${n}`,
	icon: /* @__PURE__ */ X(T, {
		name: {
			left: "PanelLeft",
			right: "PanelRight",
			top: "PanelTop",
			bottom: "PanelBottom"
		}[n],
		size: 14
	}),
	onClick: () => e.shell.repositionPanel(t, n)
})), kt = "button,a,input,textarea,select,iframe,[role=\"tab\"],[role=\"treeitem\"],[role=\"button\"],[role=\"menuitem\"],[contenteditable=\"true\"],[data-workbench-tab],[data-tree-list-focus-id]", At = (e, t) => {
	let n = Dt(e, t).length > 0, r = w(e.layout.store, () => t === "side" && e.sidePanel.getMode() === "floating"), i = w(e.fullscreen.store, (e) => t === "side" && e.active), a = !n || r || i, o = z({
		id: `panel:${t}`,
		data: { panelRegion: t },
		disabled: a
	}), s = (e) => !e.target.closest(kt);
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
}, jt = (e) => {
	let { workbench: t, region: n, children: r, ref: i, ...a } = e, o = At(t, n);
	return /* @__PURE__ */ X(ve, {
		...o,
		...a,
		ref: me(o.ref, i),
		children: r
	});
}, Mt = (e) => e.level === "error" && !e.inlineTarget, Nt = (e) => w(e.notifications.store, (e) => Object.values(e.notifications).some(Mt)), Pt = (t) => {
	let { workbench: n } = t, r = w(n.notifications.store, (e) => e.notifications), i = Object.values(r).filter(Mt).sort((e, t) => e.createdAt.localeCompare(t.createdAt));
	if (!i.length) return null;
	let a = i.at(-1);
	return /* @__PURE__ */ Z(q.Root, {
		positioning: {
			placement: "top-start",
			offset: { mainAxis: 4 }
		},
		children: [/* @__PURE__ */ X(q.Trigger, {
			asChild: !0,
			children: /* @__PURE__ */ Z(K, {
				size: "2xs",
				variant: "ghost",
				color: "fg.error",
				minW: "0",
				maxW: "full",
				justifyContent: "flex-start",
				"aria-label": `System errors: ${a.title}`,
				children: [/* @__PURE__ */ X(ue, {
					as: e,
					boxSize: "4"
				}), /* @__PURE__ */ X(Y, {
					as: "span",
					textStyle: "label/XS/medium",
					maxW: "2xs",
					truncate: !0,
					role: "status",
					children: a.title
				})]
			})
		}), /* @__PURE__ */ X(de, { children: /* @__PURE__ */ X(q.Positioner, { children: /* @__PURE__ */ X(q.Content, {
			width: "performance-popover",
			maxW: "calc(100vw - var(--chakra-spacing-md) * 2)",
			maxH: "70dvh",
			overflow: "hidden",
			children: /* @__PURE__ */ Z(q.Body, {
				display: "flex",
				flexDirection: "column",
				gap: "sm",
				minH: "0",
				children: [/* @__PURE__ */ Z(le, {
					gap: "xs",
					flexShrink: "0",
					children: [
						/* @__PURE__ */ X(ue, {
							as: e,
							boxSize: "4"
						}),
						/* @__PURE__ */ X(q.Title, { children: "System errors" }),
						/* @__PURE__ */ X(pe.Root, {
							size: "sm",
							variant: "subtle",
							colorPalette: "red",
							"aria-label": `${i.length} system errors`,
							children: /* @__PURE__ */ X(pe.Label, { children: i.length })
						}),
						/* @__PURE__ */ X(K, {
							size: "2xs",
							variant: "ghost",
							marginLeft: "auto",
							onClick: () => {
								for (let e of i) n.notifications.dismiss(e.id);
							},
							children: "Clear all"
						})
					]
				}), /* @__PURE__ */ X(be, {
					minH: "0",
					viewportProps: {
						role: "region",
						"aria-label": "System error list",
						overscrollBehavior: "contain"
					},
					children: /* @__PURE__ */ X(J, {
						gap: "sm",
						minW: "0",
						children: [...i].reverse().map((e) => /* @__PURE__ */ X(he, {
							status: "error",
							title: e.title,
							closeLabel: `Dismiss ${e.title}`,
							onClose: () => n.notifications.dismiss(e.id),
							endElement: e.actions?.map((t) => /* @__PURE__ */ X(K, {
								onClick: () => {
									let r = n.notifications.captureActionError(t.title, `system-errors.${e.id}`);
									n.commands.executeCommand(t.commandId, t.args).catch(r);
								},
								children: t.title
							}, t.commandId)),
							children: /* @__PURE__ */ Z(J, {
								gap: "xs",
								minW: "0",
								children: [/* @__PURE__ */ X(Y, { children: e.message }), /* @__PURE__ */ X(D, {
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
}, Ft = "Drag to reorder. Alt+Left or Alt+Right to move.", It = (e) => {
	if (!e.over || e.over.id === e.active.id) return;
	let t = e.active.rect.current.translated;
	if (t) return {
		id: String(e.over.id),
		edge: t.left + t.width / 2 < e.over.rect.left + e.over.rect.width / 2 ? "before" : "after"
	};
}, Lt = (e) => {
	let { workbench: t, placement: n, ids: r, activeId: i, drop: a } = e, o = n.widgetId, s = r.indexOf(o), c = s >= 0 && r.length > 1, l = z({
		id: o,
		disabled: !c
	}), u = V({
		id: o,
		disabled: !c
	}), d = n.title ?? o;
	return /* @__PURE__ */ Z(G, {
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
			/* @__PURE__ */ X(x, {
				workbench: t,
				region: "status",
				placement: n
			}),
			i ? /* @__PURE__ */ X(G, {
				position: "absolute",
				inset: "0"
			}) : null,
			a?.id === o ? /* @__PURE__ */ X(ge, {
				orientation: "vertical",
				...a.edge === "before" ? { left: 0 } : { right: 0 }
			}) : null
		]
	});
}, Rt = (e) => {
	let { slot: t, workbench: n } = e;
	w(n.statusBar.store, (e) => e);
	let r = N(n) === n.modes.getActiveModeId() ? n.statusBar.listVisibleItems(t) : [], i = r.map((e) => e.id), a = y(n, r.map((e) => ({
		widgetId: e.id,
		contributionId: e.viewId,
		viewId: e.viewId,
		title: n.views.getView(e.viewId)?.title,
		closable: !1
	}))), [o, s] = W(), [c, l] = W(), u = B(L(ne, { activationConstraint: { distance: 5 } }), L(R, { activationConstraint: { distance: 5 } })), d = () => {
		s(void 0), l(void 0);
	};
	return /* @__PURE__ */ Z(re, {
		sensors: u,
		accessibility: { screenReaderInstructions: { draggable: Ft } },
		collisionDetection: ee,
		onDragStart: (e) => s(String(e.active.id)),
		onDragOver: (e) => l(It(e)),
		onDragMove: (e) => l(It(e)),
		onDragCancel: d,
		onDragEnd: (e) => {
			let t = It(e);
			d(), t && n.statusBar.reorderItem(String(e.active.id), t.edge === "before" ? { beforeItemId: t.id } : { afterItemId: t.id });
		},
		children: [a.map((e) => /* @__PURE__ */ X(Lt, {
			workbench: n,
			placement: e,
			ids: i,
			activeId: o,
			drop: c
		}, e.widgetId)), /* @__PURE__ */ X(G, {
			asChild: !0,
			pointerEvents: "none",
			children: /* @__PURE__ */ X(te, {
				dropAnimation: null,
				children: o ? /* @__PURE__ */ X(G, {
					layerStyle: "floatingBar",
					textStyle: "label/XS/medium",
					children: a.find((e) => e.widgetId === o)?.title ?? o
				}) : null
			})
		})]
	});
}, zt = (e) => {
	let { workbench: t, contextActions: n } = e, r = At(t, "sidenav"), i = Ot(t, "sidenav");
	return /* @__PURE__ */ X(ye, {
		actions: [...n, ...i],
		closeOnSelect: !1,
		keepMountedWhenEmpty: !0,
		children: /* @__PURE__ */ X(G, {
			...r,
			h: "full",
			minH: "0",
			minW: "0",
			w: "full",
			children: /* @__PURE__ */ X(Q, {
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
				children: /* @__PURE__ */ X(G, {
					flex: "1",
					minH: "0",
					minW: "0",
					overflow: "hidden",
					children: /* @__PURE__ */ X(Et, {
						workbench: t,
						region: "sidenav",
						title: "Sidenav"
					})
				})
			})
		})
	});
}, Bt = "2rem", Vt = (e) => {
	let { workbench: t } = e, n = At(t, "activity"), r = Ot(t, "activity"), i = w(t.layout.store, () => t.shell.getArrangement().activity), a = i === "top" || i === "bottom";
	return /* @__PURE__ */ X(ye, {
		actions: r,
		children: /* @__PURE__ */ X(G, {
			...n,
			display: e.visible === !1 ? "none" : "block",
			flexShrink: 0,
			h: a ? "14" : "full",
			w: a ? "full" : "14",
			children: /* @__PURE__ */ X(Q, {
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
				children: /* @__PURE__ */ X(Et, {
					workbench: t,
					region: "activity",
					title: "Activity bar"
				})
			})
		})
	});
}, Ht = (e) => {
	let { workbench: t } = e, n = b(t, "status");
	return /* @__PURE__ */ X(Q, {
		workbench: t,
		region: "status",
		"data-workbench-region": "status",
		display: e.visible === !1 ? "none" : "block",
		as: "footer",
		flexShrink: 0,
		h: Bt,
		minH: "0",
		minW: "0",
		overflow: "hidden",
		children: /* @__PURE__ */ Z(G, {
			display: "flex",
			alignItems: "stretch",
			justifyContent: "space-between",
			px: "sm",
			h: "full",
			minW: "0",
			w: "full",
			children: [
				/* @__PURE__ */ X(G, {
					display: "flex",
					alignItems: "center",
					minW: "0",
					children: /* @__PURE__ */ X(Pt, { workbench: t })
				}),
				/* @__PURE__ */ X(G, {
					flex: "1",
					minW: "0",
					h: "full",
					display: n ? "block" : "none",
					children: /* @__PURE__ */ X(S, {
						workbench: t,
						region: "status",
						viewId: n || void 0
					})
				}),
				/* @__PURE__ */ X(G, {
					display: n === void 0 ? "flex" : "none",
					alignItems: "stretch",
					minW: "0",
					h: "full",
					children: /* @__PURE__ */ X(Rt, {
						workbench: t,
						slot: "leading"
					})
				}),
				/* @__PURE__ */ X(G, {
					display: n === void 0 ? "flex" : "none",
					alignItems: "stretch",
					minW: "0",
					h: "full",
					marginLeft: "auto",
					children: /* @__PURE__ */ X(Rt, {
						workbench: t,
						slot: "trailing"
					})
				})
			]
		})
	});
};
export { Q as S, qe as _, Nt as a, Le as b, Et as c, at as d, it as f, Xe as g, Qe as h, Ht as i, mt as l, $e as m, Vt as n, jt as o, st as p, zt as r, Ot as s, Bt as t, ot as u, Je as v, Me as x, Ve as y };

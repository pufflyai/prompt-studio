// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { A as e, F as t, L as n, R as r, d as i, j as a, k as o } from "./workbench-core-N58OeDyx.ts";
import { n as s } from "./mode-chrome-D8eccNh1.ts";
import { t as c } from "./use-workbench-store-BMaFgEbb.ts";
import { t as l } from "./icon-D3uE7jD-.ts";
import { t as u } from "./use-workbench-composition-panels-DWghJGTR.ts";
import { n as d, r as f, t as p } from "./use-panel-policy-BALwJ9k6.ts";
import { useLayoutEffect as m, useRef as h } from "react";
import { HStack as g, IconButton as _ } from "@chakra-ui/react";
import { PANEL_HEADER_CONTROL_SIZE as v, Tooltip as y } from "@pstdio/ui";
import { jsx as b } from "react/jsx-runtime";
// packages/pstdio-workbench/src/react/workbench/use-workbench-region-content.ts
var x = (a, l, u = {}) => {
	let p = s(a, l), m = f(a), h = d(a), g = c(a.pages.store, (e) => {
		let t = e.pages[e.activePageId ?? ""];
		return l === "main" && !!(i(e) || t?.main.empty);
	}), _ = o(l), v = !_ || e(h ? a.modes.getMode(h) : void 0, _);
	return c(a.layout.store, (e) => p === void 0 ? v ? g || e.placeholders[l] ? !0 : u.locationScoped ? e.layout.regions[l].widgets.some((i) => {
		let a = e.widgets[i.contributionId];
		return a ? l === "side" ? r(a, h) : n(a, m, h, i, { location: t(e.layout) }) : !1;
	}) : e.layout.regions[l].widgets.length > 0 : !1 : p !== !1);
}, S = (e) => {
	let { workbench: t } = e, n = c(t.fullscreen.store, (e) => e.active), r = c(t.modes.store, () => t.fullscreen.canEnter()), i = x(t, "main", { locationScoped: !0 }), a = h(null), o = h(n);
	if (m(() => {
		o.current && !n && a.current?.focus({ preventScroll: !0 }), o.current = n;
	}, [n]), !n && (!r || !i)) return null;
	let s = n ? "Exit Main fullscreen" : "Enter Main fullscreen";
	return /* @__PURE__ */ b(y, {
		content: s,
		children: /* @__PURE__ */ b(_, {
			ref: a,
			size: v,
			variant: "ghost",
			"aria-label": s,
			"aria-pressed": n,
			onClick: () => t.commands.executeCommand(n ? "workbench.exitMainFullscreen" : "workbench.enterMainFullscreen"),
			children: /* @__PURE__ */ b(l, {
				name: n ? "Minimize" : "Maximize",
				size: 14
			})
		})
	});
}, C = (e) => {
	let { workbench: t } = e;
	return m(() => {
		let e = (e) => {
			if (e.key !== "Escape" || e.defaultPrevented || !t.fullscreen.store.getState().active || t.commandPalette.store.getState().open || (e.target instanceof Element ? e.target : void 0)?.closest("[role=\"menu\"], [role=\"listbox\"], [role=\"dialog\"]:not([data-workbench-panel=\"side\"])")) return;
			e.preventDefault();
			let { sideOpen: n } = t.fullscreen.store.getState();
			n && t.shell.getPanelPolicy("side").canClose ? t.fullscreen.hideSide() : t.fullscreen.exit();
		};
		return document.addEventListener("keydown", e), () => document.removeEventListener("keydown", e);
	}, [t]), null;
}, w = (e) => {
	let t = c(e.layout.store, (e) => e.layout.arrangement), n = a(t), r = p(e, "sidenav"), i = p(e, "secondary"), o = p(e, "side"), s = x(e, "sidenav"), l = u(e), d = x(e, "side") || l.side.addable.length > 0, f = x(e, "secondary") || l.secondary.addable.length > 0;
	return [
		{
			region: "sidenav",
			label: "Sidenav",
			icon: "ListTree",
			policy: r,
			provided: s
		},
		{
			region: "secondary",
			label: "Bottom Panel",
			icon: n.secondary === "top" ? "PanelTop" : "PanelBottom",
			policy: i,
			provided: f
		},
		{
			region: "side",
			label: "Side Panel",
			icon: n.side === "left" ? "PanelLeft" : "PanelRight",
			policy: o,
			provided: d
		}
	].filter(({ policy: e, provided: t }) => t && e.provided && (e.open ? e.canClose : e.canOpen)).map((e) => ({
		...e,
		position: n[e.region]
	}));
}, T = (e) => {
	let { workbench: t, regions: n } = e, r = w(t).filter(({ region: e }) => !n || n.includes(e));
	return r.length ? /* @__PURE__ */ b(g, {
		role: "group",
		"aria-label": n?.length === 1 && n[0] === "sidenav" ? "Sidenav controls" : "Panel controls",
		gap: "2xs",
		flexShrink: 0,
		children: r.map(({ region: e, label: n, icon: r, policy: i, position: a }) => {
			let o = `${i.open ? "Hide" : "Show"} ${n}`;
			return /* @__PURE__ */ b(y, {
				content: o,
				children: /* @__PURE__ */ b(_, {
					size: v,
					variant: "ghost",
					"aria-label": o,
					"aria-pressed": i.canToggle ? i.open : void 0,
					onClick: () => t.shell.setRegionOpen(e, !i.open),
					children: /* @__PURE__ */ b(l, {
						name: r,
						size: 14,
						layerStyle: e === "sidenav" && a === "right" ? "mirroredIcon" : void 0
					})
				})
			}, e);
		})
	}) : null;
};
export { x as i, S as n, C as r, T as t };

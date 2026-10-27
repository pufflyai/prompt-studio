// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { N as e, P as t, n } from "./workbench-core-N58OeDyx.ts";
import { t as r } from "./use-workbench-store-BMaFgEbb.ts";
import { t as i } from "./icon-D3uE7jD-.ts";
import { t as a } from "./action-errors-CACpJ-MK.ts";
import { startTransition as o, useEffect as s, useState as c } from "react";
import { Box as l, Center as u } from "@chakra-ui/react";
import { jsx as d, jsxs as f } from "react/jsx-runtime";
// packages/pstdio-workbench/src/react/region/retained-view-placements.ts
var p = (e, t, n, r) => {
	let i = new Map(e.filter((e) => e.viewId && n.has(e.viewId) && (!r || r.has(e.widgetId))).map((e) => [e.widgetId, e]));
	for (let n of t) {
		let t = e.find((e) => e.widgetId === n.widgetId), r = t && Object.keys(t).length === Object.keys(n).length && Object.entries(n).every(([e, n]) => Reflect.get(t, e) === n);
		i.set(n.widgetId, r ? t : n);
	}
	let a = [...i.values()];
	return a.length === e.length && a.every((t, n) => t === e[n]) ? e : a;
}, m = (e, t, n, r, i) => {
	let a = /* @__PURE__ */ new Map(), o = new Set(t.map((e) => e.widgetId)), s = r ? /* @__PURE__ */ new Set([...r, ...o]) : void 0;
	for (let t of e.placements) {
		if (!t.viewId || !n.has(t.viewId)) continue;
		let c = t.widgetId;
		if (!s || r?.has(c) || o.has(c)) continue;
		let l = e.expires.get(c) ?? i + 18e5;
		l <= i || (a.set(c, l), s.add(c));
	}
	let c = p(e.placements, t, n, s), l = a.size === e.expires.size && [...a].every(([t, n]) => e.expires.get(t) === n);
	return c === e.placements && l ? e : {
		placements: c,
		expires: a
	};
}, h = (e, t, n) => {
	let i = r(e.views.store, (e) => e.views), [a, o] = c(() => ({
		placements: t,
		expires: /* @__PURE__ */ new Map()
	})), l = m(a, t, new Set(Object.keys(i)), n, Date.now());
	a !== l && o(l);
	let u = Math.min(...l.expires.values());
	return s(() => {
		if (!Number.isFinite(u)) return;
		let e = setTimeout(() => o((e) => ({ ...e })), Math.max(0, u - Date.now()));
		return () => clearTimeout(e);
	}, [u]), l.placements;
}, g = (e) => new Promise((t, n) => {
	e.throwIfAborted();
	let r = 0, i = () => {
		cancelAnimationFrame(r), n(e.reason);
	};
	e.addEventListener("abort", i, { once: !0 }), r = requestAnimationFrame(() => {
		r = requestAnimationFrame(() => {
			e.removeEventListener("abort", i), t();
		});
	});
}), _ = (e) => {
	let { input: t, renderer: n, defer: r } = e, [i, a] = c(!r || typeof requestAnimationFrame != "function");
	return s(() => {
		if (i) return;
		let e = new AbortController();
		return g(e.signal).then(() => o(() => a(!0)), () => void 0), () => e.abort();
	}, [i]), i ? n.render(t) : null;
}, v = (e) => {
	let { label: t } = e;
	return /* @__PURE__ */ d(u, {
		h: "full",
		w: "full",
		color: "fg.muted",
		p: "md",
		"aria-label": t,
		children: /* @__PURE__ */ d(i, {
			name: "circle-alert",
			size: 20
		})
	});
}, y = (e) => {
	let { children: t } = e;
	return /* @__PURE__ */ d(l, {
		flex: "1",
		minW: "0",
		minH: "0",
		w: "full",
		h: "full",
		overflow: "hidden",
		display: e.status ? "flex" : void 0,
		alignItems: e.status ? "center" : void 0,
		children: t
	});
}, b = () => void 0, x = (t) => {
	if (t.view) return {
		id: t.placement.contributionId,
		title: t.placement.title ?? t.view.title,
		icon: t.view.icon,
		region: t.region ?? t.widget?.region ?? "main",
		rendererId: t.view.id
	};
	if (t.widget) return "singleton" in t.widget ? e(t.widget) : t.widget;
}, S = (e) => {
	let { workbench: i, placement: o } = e, s = e.widget ?? i.layout.getWidget(o.contributionId), c = o.viewId ? i.views.getView(o.viewId) : void 0, u = c?.id ?? s?.rendererId ?? "", p = b, m = r(n(i).store, (e) => e.renderers[u]) ?? n(i).getRenderer(u);
	if (r(n(i).store, (e) => e.refreshKeys[u] ?? 0), !s && !c) return /* @__PURE__ */ d(v, { label: "Widget contribution is no longer registered." });
	let h = x({
		placement: o,
		region: e.region,
		view: c,
		widget: s
	});
	if (!h) return /* @__PURE__ */ d(v, { label: "View contribution is no longer registered." });
	let g = t(o);
	return /* @__PURE__ */ f(l, {
		"data-workbench-view": c?.id ?? o.contributionId,
		"data-workbench-renderer": m ? "mounted" : "missing",
		display: "flex",
		flexDirection: "column",
		flex: "1 0 auto",
		minW: "0",
		minH: "0",
		w: "full",
		overflow: "hidden",
		children: [/* @__PURE__ */ d(a, {
			workbench: i,
			target: o.widgetId
		}), m ? /* @__PURE__ */ d(y, {
			status: e.region === "status",
			children: /* @__PURE__ */ d(_, {
				renderer: m,
				input: {
					workbench: i,
					panel: h,
					instance: g,
					refresh: p
				},
				defer: c?.body.kind !== "file" && [
					"main",
					"side",
					"bottom"
				].includes(h.region)
			})
		}) : /* @__PURE__ */ d(v, { label: `No renderer registered for ${u}.` })]
	});
}, C = (e, t) => r(e.modes.store, (e) => {
	let n = e.activeModeId ? e.modes[e.activeModeId] : void 0;
	if (t === "nav" || t === "sidenav" || t === "activity" || t === "status") return n?.chrome?.[t];
}), w = (e) => {
	let { workbench: t, viewId: n, region: r } = e, i = h(t, n ? [{
		widgetId: n,
		contributionId: n,
		viewId: n,
		closable: !1
	}] : []);
	return /* @__PURE__ */ d(l, {
		h: "full",
		w: "full",
		minH: "0",
		position: "relative",
		display: n ? "block" : "none",
		children: i.map((e) => /* @__PURE__ */ d(l, {
			position: "absolute",
			inset: "0",
			display: e.viewId === n ? "flex" : "none",
			inert: e.viewId !== n,
			children: /* @__PURE__ */ d(S, {
				workbench: t,
				region: r,
				placement: e
			})
		}, e.widgetId))
	});
};
export { h as i, C as n, S as r, w as t };

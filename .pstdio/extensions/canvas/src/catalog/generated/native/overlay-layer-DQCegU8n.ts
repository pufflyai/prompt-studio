// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { N as e, P as t, n } from "./workbench-core-kaLFKJEn.ts";
import { t as r } from "./use-workbench-store-BMaFgEbb.ts";
import { t as i } from "./icon-D3uE7jD-.ts";
import { useEffect as a, useState as o } from "react";
import { Center as s, CloseButton as c, Dialog as l, Portal as u } from "@chakra-ui/react";
import { jsx as d, jsxs as f } from "react/jsx-runtime";
// packages/pstdio-workbench/src/react/workbench/overlay-layer.tsx
var p = (e) => typeof e == "object" && !!e && !Array.isArray(e), m = (e, t) => {
	let n = e[t];
	return typeof n == "string" ? n : void 0;
}, h = (e, t) => {
	let n = e[t];
	return typeof n == "boolean" ? n : void 0;
}, g = (e) => {
	if (!p(e)) return {};
	let t = {}, n = m(e, "size"), r = m(e, "placement"), i = m(e, "scrollBehavior"), a = h(e, "closeOnEscape"), o = h(e, "closeOnInteractOutside"), s = h(e, "modal"), c = h(e, "preventScroll"), l = h(e, "trapFocus"), u = m(e, "motionPreset"), d = m(e, "role"), f = m(e, "contentHeight"), g = m(e, "contentMaxHeight"), _ = m(e, "contentMinHeight"), v = m(e, "contentWidth"), y = m(e, "contentMaxWidth");
	return n && (t.size = n), r && (t.placement = r), i && (t.scrollBehavior = i), a !== void 0 && (t.closeOnEscape = a), o !== void 0 && (t.closeOnInteractOutside = o), s !== void 0 && (t.modal = s), c !== void 0 && (t.preventScroll = c), l !== void 0 && (t.trapFocus = l), u && (t.motionPreset = u), d && (t.role = d), f && (t.contentHeight = f), g && (t.contentMaxHeight = g), _ && (t.contentMinHeight = _), v && (t.contentWidth = v), y && (t.contentMaxWidth = y), t;
}, _ = (e, t) => {
	let n = e.closable === !0, r = g(t);
	return {
		size: "xl",
		scrollBehavior: "inside",
		modal: !0,
		preventScroll: !0,
		trapFocus: !0,
		...r,
		closeOnEscape: n && (r.closeOnEscape ?? !0),
		closeOnInteractOutside: n && (r.closeOnInteractOutside ?? !0)
	};
}, v = (e, t) => e.find((e) => e.widgetId === t) ?? e[0], y = (e, t) => {
	if (e) return {
		open: !0,
		placement: e
	};
	if (t) return {
		open: !1,
		placement: t
	};
}, b = (e) => /* @__PURE__ */ d(s, {
	h: "full",
	w: "full",
	color: "fg.muted",
	p: "md",
	"aria-label": e.label,
	children: /* @__PURE__ */ d(i, {
		name: "circle-alert",
		size: 20
	})
}), x = (i) => {
	let { workbench: s } = i, p = r(s.layout.store, (e) => e.layout.regions.overlay), m = r(n(s).store, (e) => e.renderers);
	r(n(s).store, (e) => e.refreshKeys);
	let [h, g] = o(), x = v(p.widgets, p.activeWidgetId), S = y(x, h);
	if (a(() => {
		x && g(void 0);
	}, [x]), !S) return null;
	let { open: C, placement: w } = S, T = s.layout.getWidget(w.contributionId), { contentHeight: E, contentMaxHeight: D, contentMinHeight: O, contentWidth: k, contentMaxWidth: A, ...j } = _(w, T?.config), M = T ? m[T.rendererId] : void 0, N = C && w.closable === !0, P = w.title ?? T?.title ?? "overlay", F = T && M ? M.render({
		workbench: s,
		panel: e(T),
		instance: t(w),
		refresh: () => void 0
	}) : /* @__PURE__ */ d(b, { label: T ? `No renderer registered for ${T.rendererId}.` : "Widget contribution is no longer registered." }), I = (e) => {
		!e.open && N && (g(w), s.layout.closePanel(w.widgetId));
	}, L = () => {
		g((e) => e?.widgetId === w.widgetId ? void 0 : e);
	}, R = (e) => {
		let t = e.detail.originalEvent?.target;
		t instanceof Element && t.closest("[data-part=\"content\"]") && e.preventDefault();
	};
	return /* @__PURE__ */ d(l.Root, {
		...j,
		open: C,
		onExitComplete: L,
		onOpenChange: I,
		onInteractOutside: R,
		children: /* @__PURE__ */ f(u, { children: [/* @__PURE__ */ d(l.Backdrop, {
			position: "fixed",
			inset: "0",
			pointerEvents: "auto"
		}), /* @__PURE__ */ d(l.Positioner, {
			position: "fixed",
			inset: "0",
			overflow: j.scrollBehavior === "outside" ? "auto" : "hidden",
			pointerEvents: "auto",
			children: /* @__PURE__ */ f(l.Content, {
				position: "relative",
				overflow: "hidden",
				borderWidth: "1px",
				borderColor: "border.subtle",
				h: E,
				maxH: D,
				minH: O,
				w: k,
				maxW: A,
				children: [F, N ? /* @__PURE__ */ d(l.CloseTrigger, {
					asChild: !0,
					children: /* @__PURE__ */ d(c, {
						size: "sm",
						"aria-label": `Close ${P}`
					})
				}) : null]
			})
		})] })
	});
};
export { x as t };

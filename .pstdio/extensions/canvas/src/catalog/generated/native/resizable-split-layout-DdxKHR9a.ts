// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./split-panel-motion-context-CMeFPHB2.ts";
import { useEffect as t, useId as n, useRef as r, useState as i } from "react";
import { Box as a, Flex as o, useSlotRecipe as s } from "@chakra-ui/react";
import { Fragment as c, jsx as l, jsxs as u } from "react/jsx-runtime";
import { flushSync as d } from "react-dom";
// packages/ui/src/components/layout/resizable-split-layout.geometry.ts
var f = {
	width: 1200,
	height: 720
}, p = 72, m = 160, h = 72, g = (e, t, n) => Math.min(Math.max(e, t), n), _ = {
	left: {
		rootDirection: "row",
		dimension: "width",
		separatorOrientation: "vertical",
		cursor: "col-resize",
		pointerCoordinate: "clientX",
		deltaDirection: 1,
		panelFirst: !0
	},
	right: {
		rootDirection: "row",
		dimension: "width",
		separatorOrientation: "vertical",
		cursor: "col-resize",
		pointerCoordinate: "clientX",
		deltaDirection: -1,
		panelFirst: !1
	},
	top: {
		rootDirection: "column",
		dimension: "height",
		separatorOrientation: "horizontal",
		cursor: "row-resize",
		pointerCoordinate: "clientY",
		deltaDirection: 1,
		panelFirst: !0
	},
	bottom: {
		rootDirection: "column",
		dimension: "height",
		separatorOrientation: "horizontal",
		cursor: "row-resize",
		pointerCoordinate: "clientY",
		deltaDirection: -1,
		panelFirst: !1
	}
}, v = (e) => _[e], y = (e) => {
	let t = e.rootSize > 0 ? e.rootSize : e.fallbackRootSize, n = Math.max(0, t - e.separatorSize - e.contentMinSize), r = e.maxSize ?? n, i = Math.max(0, Math.min(r, n));
	return {
		minSize: Math.min(e.minSize, i),
		maxSize: i
	};
}, b = (e, t) => e === "top" || e === "bottom" ? h : g(t / 2, p, m), x = (e) => {
	let t = v(e.side), n = e.startSize + e.pointerDelta * t.deltaDirection, r = e.collapsible && n <= b(e.side, e.minSize);
	return {
		rawSize: n,
		size: r ? 0 : g(n, e.minSize, e.maxSize),
		collapsed: r
	};
}, S = 250, C = [
	0,
	1,
	2
], w = (e) => e ? {
	hitArea: {
		top: 0,
		bottom: 0,
		insetInlineStart: "-1",
		insetInlineEnd: "-1"
	},
	gripDirection: "column",
	bar: {
		top: "0",
		bottom: "0",
		insetInlineStart: "50%",
		w: "0.5",
		transform: "translateX(-50%)"
	}
} : {
	hitArea: {
		insetInline: 0,
		top: "-1",
		bottom: "-1"
	},
	gripDirection: "row",
	bar: {
		top: "50%",
		insetInline: "0",
		h: "0.5",
		transform: "translateY(-50%)"
	}
}, T = (e) => {
	let { active: t, layout: n } = e;
	return /* @__PURE__ */ l(o, {
		"data-part": "grip",
		direction: n.gripDirection,
		gap: "3xs",
		opacity: +!t,
		transition: "opacity 120ms ease",
		children: C.map((e) => /* @__PURE__ */ l(a, {
			boxSize: "0.5",
			borderRadius: "full",
			bg: "border"
		}, e))
	});
}, E = (e) => {
	let { active: t, layout: n } = e;
	return /* @__PURE__ */ l(a, {
		"data-part": "bar",
		position: "absolute",
		borderRadius: "xs",
		bg: "fg.info",
		opacity: +!!t,
		transition: "opacity 120ms ease",
		pointerEvents: "none",
		...n.bar
	});
}, D = (e) => {
	let { css: n, axis: o, bounds: s, collapsed: c, collapsible: d, contentPanelId: f, dragging: p, resizablePanelId: m, resizeLabel: h, resolvedPanelSize: g, separator: _, separatorRef: v, onCollapse: y, onResizeKeyDown: b, onResizeStart: x } = e, C = _ === "line", D = w(o.separatorOrientation === "vertical"), [O, k] = i(!1), A = r(0), j = O || p, M = c ? {
		"aria-hidden": !0,
		tabIndex: -1
	} : { tabIndex: 0 };
	t(() => () => window.clearTimeout(A.current), []);
	let N = () => {
		A.current = window.setTimeout(() => k(!0), S);
	}, P = () => {
		window.clearTimeout(A.current), k(!1);
	};
	return /* @__PURE__ */ u(a, {
		css: n,
		ref: v,
		"data-collapsed": c,
		inert: c,
		role: "separator",
		"aria-label": h,
		"aria-orientation": o.separatorOrientation,
		"aria-controls": `${m} ${f}`,
		"aria-valuemin": d ? 0 : Math.round(s.minSize),
		"aria-valuemax": Math.round(s.maxSize),
		"aria-valuenow": Math.round(g),
		...M,
		position: "relative",
		zIndex: "docked",
		alignItems: "center",
		justifyContent: "center",
		flexShrink: 0,
		bg: C ? "border.subtle" : void 0,
		cursor: o.cursor,
		touchAction: "none",
		outline: "none",
		_before: {
			content: "\"\"",
			position: "absolute",
			...D.hitArea
		},
		_focusVisible: {
			"& [data-part=bar]": { opacity: 1 },
			"& [data-part=grip]": { opacity: 0 }
		},
		onPointerEnter: N,
		onPointerLeave: P,
		onPointerDown: x,
		onDoubleClick: d ? y : void 0,
		onKeyDown: b,
		children: [C ? null : /* @__PURE__ */ l(T, {
			active: j,
			layout: D
		}), /* @__PURE__ */ l(E, {
			active: j,
			layout: D
		})]
	});
}, O = (t) => {
	let { styles: n, axis: r, bounds: i, collapsed: o, collapsible: s, resizable: d, contentPanel: f, contentPanelId: p, contentPanelRef: m, resizablePanel: h, resizablePanelId: g, resizablePanelRef: _, rootRef: v, dragging: y, resizeLabel: b, resolvedPanelSize: x, separator: S, separatorRef: C, onCollapse: w, onResizeKeyDown: T, onResizeStart: E } = t, O = /* @__PURE__ */ l(a, {
		id: g,
		ref: _,
		css: n.resizablePanel,
		"data-collapsed": o,
		"aria-hidden": o ? !0 : void 0,
		inert: o,
		children: /* @__PURE__ */ l(a, {
			css: n.panelContent,
			"data-split-panel-content": "",
			children: /* @__PURE__ */ l(e, {
				value: v,
				children: h
			})
		})
	}, "resizable-panel"), k = /* @__PURE__ */ l(a, {
		id: p,
		ref: m,
		css: n.contentPanel,
		children: f
	}, "content-panel"), A = d ? /* @__PURE__ */ l(D, {
		css: n.separator,
		axis: r,
		bounds: i,
		collapsed: o,
		collapsible: s,
		contentPanelId: p,
		resizablePanelId: g,
		dragging: y,
		resizeLabel: b,
		resolvedPanelSize: x,
		separator: S,
		separatorRef: C,
		onCollapse: w,
		onResizeKeyDown: T,
		onResizeStart: E
	}, "resize-handle") : /* @__PURE__ */ l(a, {
		css: n.separator,
		"aria-hidden": "true"
	});
	return r.panelFirst ? /* @__PURE__ */ u(c, { children: [
		O,
		A,
		k
	] }) : /* @__PURE__ */ u(c, { children: [
		k,
		A,
		O
	] });
}, k = (e, n, r) => {
	let [a, o] = i({
		rootSize: 0,
		separatorSize: 0
	});
	return t(() => {
		let t = e.current;
		if (!t) return;
		let i = () => {
			o({
				rootSize: t.getBoundingClientRect()[r],
				separatorSize: n.current?.getBoundingClientRect()[r] ?? 0
			});
		};
		if (i(), typeof ResizeObserver > "u") return;
		let a = new ResizeObserver(i);
		return a.observe(t), n.current && a.observe(n.current), () => {
			a.disconnect();
		};
	}, [
		e,
		n,
		r
	]), a;
}, A = (e, t, n) => Math.min(Math.max(e, t), n), j = (e, t) => e?.getBoundingClientRect()[t] ?? 0, M = (e) => {
	let { axis: t, resizableSide: n, collapsed: r, collapsible: i, resolvedPanelSize: a, minSizePx: o, maxSizePx: s, contentMinSizePx: c, rootRef: l, resizablePanelRef: u, contentPanelRef: p, separatorRef: m, cleanupDragRef: h, lastSizeRef: g, applyPanelSize: _, commitPanelSize: v, setCollapsed: b, setDragging: S } = e;
	return (e) => {
		if (e.button !== 0 || r && !i) return;
		e.preventDefault(), h.current();
		let C = e.currentTarget, w = y({
			rootSize: j(l.current, t.dimension),
			fallbackRootSize: f[t.dimension],
			minSize: o,
			maxSize: s,
			contentMinSize: c,
			separatorSize: j(m.current, t.dimension)
		}), T = e[t.pointerCoordinate], E = r ? 0 : j(u.current, t.dimension) || g.current, D = document.body.style.cursor, O = document.body.style.userSelect, k = E === 0 ? 0 : A(E, w.minSize, w.maxSize), M = r, N = 0, P = !1, F = (e) => {
			u.current && (u.current.style.pointerEvents = e), p.current && (p.current.style.pointerEvents = e);
		}, I = () => {
			N ||= window.requestAnimationFrame(() => {
				N = 0, _(k);
			});
		}, L = (e) => {
			P ||= e[t.pointerCoordinate] !== T;
			let r = x({
				side: n,
				startSize: E,
				pointerDelta: e[t.pointerCoordinate] - T,
				minSize: w.minSize,
				maxSize: w.maxSize,
				collapsible: i
			});
			M = r.collapsed, k = r.size, I();
		}, R = () => {
			window.removeEventListener("pointermove", L), window.removeEventListener("pointerup", R), window.removeEventListener("pointercancel", R), window.removeEventListener("blur", R), document.body.style.cursor = D, document.body.style.userSelect = O, C.hasPointerCapture(e.pointerId) && C.releasePointerCapture(e.pointerId), F(""), N &&= (window.cancelAnimationFrame(N), 0), h.current = () => void 0, P ? (M ? (_(0), d(() => b(!0)), u.current?.getBoundingClientRect()) : (b(!1), v(k)), S(!1)) : (d(() => S(!1)), l.current?.getBoundingClientRect(), _(a));
		};
		h.current = R, C.setPointerCapture(e.pointerId), document.body.style.cursor = t.cursor, document.body.style.userSelect = "none", F("none"), l.current?.style.setProperty("--split-size", `${E}px`), S(!0), window.addEventListener("pointermove", L), window.addEventListener("pointerup", R, { once: !0 }), window.addEventListener("pointercancel", R, { once: !0 }), window.addEventListener("blur", R, { once: !0 });
	};
}, N = (e) => (t) => {
	let { dimension: n, deltaDirection: r, collapsed: i, collapsible: a, minSize: o, maxSize: s, getSize: c, setCollapsed: l, commitSize: u } = e, d = n === "width" ? "ArrowLeft" : "ArrowUp", f = n === "width" ? "ArrowRight" : "ArrowDown", p = c();
	i && (t.key === d || t.key === f || t.key === "End") ? (t.preventDefault(), l(!1), u(p)) : t.key === d ? (t.preventDefault(), u(p - 24 * r)) : t.key === f ? (t.preventDefault(), u(p + 24 * r)) : t.key === "Home" ? (t.preventDefault(), a ? l(!0) : u(o)) : t.key === "End" && (t.preventDefault(), u(s));
}, P = (e, t, n) => Math.min(Math.max(e, t), n), F = (e, t) => e?.getBoundingClientRect()[t] ?? 0, I = (e) => {
	let { resizablePanel: a, contentPanel: c, resizableSide: u = "left", defaultSizePx: d = 240, minSizePx: p = 200, maxSizePx: m, contentMinSizePx: h = 0, collapsed: g, collapsible: _ = !0, resizable: b = !0, resizeLabel: x = "Resize panel", separator: S = "gap", layout: C = "split", onSizeChange: w, onCollapsedChange: T, ...E } = e, D = v(u), A = D.dimension === "width" ? "horizontal" : "vertical", j = s({ key: "resizableSplitLayout" })({
		orientation: A,
		layout: C,
		separator: S
	}), I = n(), L = r(null), R = r(null), z = r(null), B = r(null), V = r(() => void 0), { rootSize: H, separatorSize: U } = k(L, B, D.dimension), W = r(d), [G, K] = i(d), [ee, te] = i(!1), [q, ne] = i(!1), J = g ?? ee, Y = y({
		rootSize: H,
		fallbackRootSize: f[D.dimension],
		minSize: p,
		maxSize: m,
		contentMinSize: h,
		separatorSize: U
	}), X = J ? 0 : P(G, Y.minSize, Y.maxSize), re = `${I}-content`, ie = `${I}-resizable`, ae = {
		...E.style,
		"--split-size": `${X}px`,
		"--split-stored-size": `${P(G, Y.minSize, Y.maxSize)}px`
	};
	t(() => {
		W.current = d, K(d);
	}, [d]), t(() => () => V.current(), []);
	let Z = (e) => {
		L.current?.style.setProperty("--split-size", `${e}px`);
	}, Q = (e) => {
		let t = y({
			rootSize: F(L.current, D.dimension),
			fallbackRootSize: f[D.dimension],
			minSize: p,
			maxSize: m,
			contentMinSize: h,
			separatorSize: F(B.current, D.dimension)
		}), n = P(e, t.minSize, t.maxSize);
		W.current = n, K(n), Z(n), w?.(n);
	}, $ = (e) => {
		g === void 0 && te(e), T?.(e);
	}, oe = M({
		axis: D,
		resizableSide: u,
		collapsed: J,
		collapsible: _,
		resolvedPanelSize: X,
		minSizePx: p,
		maxSizePx: m,
		contentMinSizePx: h,
		rootRef: L,
		resizablePanelRef: R,
		contentPanelRef: z,
		separatorRef: B,
		cleanupDragRef: V,
		lastSizeRef: W,
		applyPanelSize: Z,
		commitPanelSize: Q,
		setCollapsed: $,
		setDragging: ne
	}), se = () => {
		_ && $(!0);
	}, ce = N({
		dimension: D.dimension,
		deltaDirection: D.deltaDirection,
		collapsed: J,
		collapsible: _,
		minSize: Y.minSize,
		maxSize: Y.maxSize,
		getSize: () => W.current,
		setCollapsed: $,
		commitSize: Q
	});
	return /* @__PURE__ */ l(o, {
		ref: L,
		css: j.root,
		...E,
		style: ae,
		"data-collapsed": J,
		"data-dragging": q,
		children: /* @__PURE__ */ l(O, {
			resizable: b,
			styles: j,
			axis: D,
			bounds: Y,
			collapsed: J,
			collapsible: _,
			contentPanel: c,
			contentPanelId: re,
			contentPanelRef: z,
			resizablePanel: a,
			resizablePanelId: ie,
			resizablePanelRef: R,
			rootRef: L,
			dragging: q,
			resizeLabel: x,
			resolvedPanelSize: X,
			separator: S,
			separatorRef: B,
			onCollapse: se,
			onResizeKeyDown: ce,
			onResizeStart: oe
		})
	});
};
export { I as t };

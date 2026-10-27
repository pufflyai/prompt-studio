// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./minus-BdT0RA0-.ts";
import { t } from "./plus-CYkLGSPS.ts";
import { t as n } from "./tooltip-BweQW627.ts";
import { useImperativeHandle as r, useLayoutEffect as i, useRef as a } from "react";
import { Box as o, Button as s, Flex as c, IconButton as l, defineRecipe as u, useRecipe as d } from "@chakra-ui/react";
import { jsx as f, jsxs as p } from "react/jsx-runtime";
// packages/ui/src/theme/recipes/canvas.ts
var m = u({ base: {
	"--canvas-dot-color": {
		base: "{colors.blacks.300}",
		_dark: "{colors.blacks.800}"
	},
	"--canvas-dot-radius": "1px",
	position: "relative",
	height: "full",
	minHeight: "0",
	minWidth: "0",
	overflow: "hidden",
	bg: "bg",
	color: "fg",
	backgroundImage: "radial-gradient(circle, var(--canvas-dot-color) var(--canvas-dot-radius), transparent var(--canvas-dot-radius))",
	backgroundSize: "{spacing.lg} {spacing.lg}"
} }), h = u({ base: {
	position: "absolute",
	left: "50%",
	transform: "translateX(-50%)",
	bottom: "sm",
	zIndex: "10",
	display: "flex",
	alignItems: "center",
	gap: "2xs",
	p: "2xs",
	bg: "bg",
	color: "fg",
	borderWidth: "1px",
	borderColor: "border",
	borderRadius: "md"
} }), g = u({
	className: "pstdio-canvas",
	base: {
		position: "absolute",
		inset: "0",
		isolation: "isolate",
		height: "full",
		minHeight: "0",
		minWidth: "0",
		overflow: "hidden",
		overscrollBehavior: "none",
		color: "fg",
		_focusVisible: {
			outline: "2px solid",
			outlineColor: "border.accent",
			outlineOffset: "-2px"
		},
		"&[data-panning]": { userSelect: "none" },
		"& [data-canvas-control]": { cursor: "auto" }
	},
	variants: { variant: {
		plain: { cursor: "default" },
		pan: {
			cursor: "grab",
			"&[data-panning]": { cursor: "grabbing" }
		}
	} },
	defaultVariants: { variant: "plain" }
}), _ = {
	minZoom: .25,
	maxZoom: 1
}, v = (e, t) => Math.min(t.maxZoom, Math.max(t.minZoom, e)), y = (e, t, n) => {
	if (!Number.isFinite(e) || e <= 0 || !Number.isFinite(t.factor) || t.factor <= 0) return;
	let r = v(e * t.factor, n);
	return {
		zoom: r,
		change: {
			...t,
			factor: r / e
		}
	};
}, b = (e, t, n = _) => {
	let r = y(e.zoom, t, n);
	if (!r) return e;
	let { zoom: i } = r, a = r.change.factor, o = t.targetAnchor ?? t.anchor;
	return {
		x: o.x - (t.anchor.x - e.x) * a,
		y: o.y - (t.anchor.y - e.y) * a,
		zoom: i
	};
}, x = /* @__PURE__ */ new WeakMap(), S = (e) => {
	let t = [e.documentElement, e.body], n = x.get(e) ?? {
		count: 0,
		previous: t.map((e) => e.style.overscrollBehaviorX)
	};
	if (!n.count) {
		x.set(e, n);
		for (let e of t) e.style.overscrollBehaviorX = "none";
	}
	return n.count += 1, () => {
		if (--n.count, !n.count) {
			for (let [e, r] of t.entries()) r.style.overscrollBehaviorX = n.previous[e];
			x.delete(e);
		}
	};
}, C = (e, t, n) => {
	if (e.target !== t) return !1;
	let r = e.shiftKey ? 320 : 80, i = {
		ArrowLeft: {
			x: r,
			y: 0
		},
		ArrowRight: {
			x: -r,
			y: 0
		},
		ArrowUp: {
			x: 0,
			y: r
		},
		ArrowDown: {
			x: 0,
			y: -r
		}
	}, a = (e) => () => n.onZoom({
		factor: e,
		anchor: {
			x: t.clientWidth / 2,
			y: t.clientHeight / 2
		}
	}), o = {
		"+": a(1.2),
		"=": a(1.2),
		"-": a(1 / 1.2),
		f: n.onFit,
		0: n.onReset
	}, s = i[e.key], c = s ? () => n.onPan(s) : o[e.key.toLowerCase()];
	return c ? (c(), e.preventDefault(), !0) : !1;
}, w = "[data-canvas-control],button,input,textarea,select,summary,a[href],[contenteditable]:not([contenteditable=false]),[role=button],[role=slider],[role=spinbutton],[role=combobox],[role=textbox],[role=menuitem]", T = (e) => e instanceof Element && !!e.closest(w), E = (e, t, n, r) => {
	let i = e instanceof Element ? e : null;
	for (; i && i !== t;) {
		let e = getComputedStyle(i), t = /auto|scroll/.test(e.overflowX) && (n < 0 && i.scrollLeft > 0 || n > 0 && i.scrollLeft + i.clientWidth < i.scrollWidth - 1), a = /auto|scroll/.test(e.overflowY) && (r < 0 && i.scrollTop > 0 || r > 0 && i.scrollTop + i.clientHeight < i.scrollHeight - 1);
		if (t || a) return !0;
		i = i.parentElement;
	}
	return !1;
}, D = (e) => {
	let { viewport: t, navigation: n, pan: r, markMoved: i, finish: a } = e, o, s = {
		left: 0,
		top: 0
	}, c = (e) => ({
		center: {
			x: (e[0].clientX + e[1].clientX) / 2 - s.left,
			y: (e[0].clientY + e[1].clientY) / 2 - s.top
		},
		distance: Math.hypot(e[0].clientX - e[1].clientX, e[0].clientY - e[1].clientY)
	}), l = () => {
		o && a(), o = void 0;
	}, u = (e) => {
		if (!e.defaultPrevented && e.cancelable) {
			if (e.touches.length === 1) {
				if (T(e.target)) return;
				let n = e.touches[0];
				o = {
					kind: "pan",
					point: {
						x: n.clientX,
						y: n.clientY
					}
				}, t.focus({
					preventScroll: !0,
					focusVisible: !1
				}), e.preventDefault();
			} else e.touches.length === 2 ? [...e.touches].every((e) => e.target instanceof Node && t.contains(e.target)) && (s = t.getBoundingClientRect(), o = {
				kind: "pinch",
				...c(e.touches)
			}, e.preventDefault()) : l();
		}
	}, d = (e) => {
		if (e.defaultPrevented || !o) return;
		if (!e.cancelable) {
			l();
			return;
		}
		if (e.preventDefault(), o.kind === "pan") {
			let t = e.touches[0], n = {
				x: t.clientX - o.point.x,
				y: t.clientY - o.point.y
			};
			r(n) && (o.point = {
				x: t.clientX,
				y: t.clientY
			});
			return;
		}
		let t = c(e.touches);
		i(), n().onZoom({
			factor: t.distance / Math.max(1, o.distance),
			anchor: o.center,
			targetAnchor: t.center
		}), o = {
			kind: "pinch",
			...t
		};
	}, f = (e) => {
		if (o) {
			if (o.kind === "pinch" && e.touches.length === 1) {
				let t = e.touches[0];
				o = {
					kind: "pan",
					point: {
						x: t.clientX,
						y: t.clientY
					}
				};
			} else l();
		}
	};
	return t.addEventListener("touchstart", u, { passive: !1 }), t.addEventListener("touchmove", d, { passive: !1 }), t.addEventListener("touchend", f), t.addEventListener("touchcancel", l), {
		cancel: l,
		dispose: () => {
			l(), t.removeEventListener("touchstart", u), t.removeEventListener("touchmove", d), t.removeEventListener("touchend", f), t.removeEventListener("touchcancel", l);
		}
	};
}, O = (e, t) => {
	let n = e.ownerDocument, r = n.defaultView, i = !1, a, o = !1, s = 0, c, l = (t) => t instanceof Node && e.contains(t), u = () => {
		o || (o = !0, e.setAttribute("data-panning", ""));
	}, d = (e) => !o && Math.hypot(e.x, e.y) < 4 ? !1 : (u(), t().onPan(e), !0), f = () => {
		e.removeAttribute("data-panning"), o && (s = performance.now() + 500), o = !1, clearTimeout(c), c = void 0, t().onNavigationEnd?.();
	}, p = () => {
		if (!a) return;
		let t = a.id;
		a = void 0, e.hasPointerCapture(t) && e.releasePointerCapture(t), f();
	}, m = () => {
		clearTimeout(c), c = setTimeout(() => {
			c = void 0, t().onNavigationEnd?.();
		}, 150);
	}, h = D({
		viewport: e,
		navigation: t,
		pan: d,
		markMoved: u,
		finish: f
	}), g = () => {
		i = !1, p(), h.cancel();
	}, _ = () => {
		n.hidden && g();
	}, v = (e) => {
		e.code === "Space" && (i = !1);
	}, y = (n) => {
		n.defaultPrevented || n.ctrlKey || n.metaKey || n.altKey || (n.code === "Space" && !T(n.target) && (i = !0, n.preventDefault()), C(n, e, t()) && m());
	}, b = (n) => {
		if (n.defaultPrevented) return;
		let r = [
			1,
			16,
			e.clientHeight
		][n.deltaMode] ?? 1, i = n.deltaX * r, a = n.deltaY * r;
		if (n.ctrlKey || n.metaKey) {
			let r = e.getBoundingClientRect();
			t().onZoom({
				factor: Math.exp(-a / 1e3),
				anchor: {
					x: n.clientX - r.left,
					y: n.clientY - r.top
				}
			});
		} else {
			if (E(n.target, e, i, a)) return;
			t().onPan({
				x: -i,
				y: -a
			});
		}
		n.preventDefault(), m();
	};
	e.addEventListener("wheel", b, { passive: !1 }), e.addEventListener("keydown", y), r.addEventListener("keyup", v), r.addEventListener("blur", g), n.addEventListener("visibilitychange", _);
	let x = S(n);
	return {
		pointerDown: (t) => {
			a || !l(t.target) || t.button !== 0 && t.button !== 1 || (s = 0, t.pointerType !== "touch" && (t.button === 1 || i && !T(n.activeElement) || !T(t.target)) && (t.preventDefault(), t.stopPropagation(), a = {
				id: t.pointerId,
				x: t.clientX,
				y: t.clientY
			}, e.focus({
				preventScroll: !0,
				focusVisible: !1
			}), e.setPointerCapture(t.pointerId)));
		},
		pointerMove: (e) => {
			if (!a || a.id !== e.pointerId) return;
			let t = {
				x: e.clientX - a.x,
				y: e.clientY - a.y
			};
			d(t) && (a.x = e.clientX, a.y = e.clientY, e.preventDefault(), e.stopPropagation());
		},
		pointerEnd: (e) => {
			a?.id === e.pointerId && (p(), e.preventDefault(), e.stopPropagation());
		},
		pointerLost: (t) => {
			t.target === e && a?.id === t.pointerId && p();
		},
		click: (e) => {
			l(e.target) && (e.button === 1 || e.detail > 0 && performance.now() < s) && (e.preventDefault(), e.stopPropagation());
		},
		dispose: () => {
			g(), h.dispose(), c && (clearTimeout(c), t().onNavigationEnd?.()), e.removeEventListener("wheel", b), e.removeEventListener("keydown", y), r.removeEventListener("keyup", v), r.removeEventListener("blur", g), n.removeEventListener("visibilitychange", _), x();
		}
	};
}, k = (r) => {
	let { zoom: i, minZoom: a, maxZoom: o, resetZoom: u, onChange: m, onStep: g } = r, _ = d({ recipe: h })(), v = Math.round(u * 100);
	return /* @__PURE__ */ p(c, {
		role: "group",
		"aria-label": "Canvas zoom",
		css: _,
		"data-canvas-control": !0,
		children: [
			/* @__PURE__ */ f(n, {
				content: "Zoom out",
				children: /* @__PURE__ */ f(l, {
					size: "xs",
					variant: "ghost",
					"aria-label": "Zoom out",
					disabled: i <= a,
					onClick: () => g(-.1),
					children: /* @__PURE__ */ f(e, {})
				})
			}),
			/* @__PURE__ */ f(n, {
				content: `Reset to ${v}%`,
				children: /* @__PURE__ */ p(s, {
					size: "xs",
					variant: "ghost",
					"aria-label": `Reset zoom to ${v}%, current zoom ${Math.round(i * 100)}%`,
					onClick: () => m(u),
					children: [Math.round(i * 100), "%"]
				})
			}),
			/* @__PURE__ */ f(n, {
				content: "Zoom in",
				children: /* @__PURE__ */ f(l, {
					size: "xs",
					variant: "ghost",
					"aria-label": "Zoom in",
					disabled: i >= o,
					onClick: () => g(.1),
					children: /* @__PURE__ */ f(t, {})
				})
			})
		]
	});
}, A = (e, t) => {
	let { zoom: n, minZoom: r = _.minZoom, maxZoom: o = _.maxZoom } = e, s = a(n), c = a(e), l = {
		minZoom: r,
		maxZoom: o
	}, u = (e) => {
		let t = y(s.current, e, l);
		t && (s.current = t.zoom, c.current.onZoom(t.change));
	}, d = (e) => {
		u({
			factor: e / s.current,
			anchor: {
				x: t.current.clientWidth / 2,
				y: t.current.clientHeight / 2
			}
		}), c.current.onNavigationEnd?.();
	}, f = a({
		...e,
		onZoom: u
	});
	return i(() => {
		c.current = e, f.current = {
			...e,
			onZoom: u
		};
	}), i(() => {
		s.current = n;
		let e = v(n, {
			minZoom: r,
			maxZoom: o
		});
		if (e === n) return;
		let i = y(n, {
			factor: e / n,
			anchor: {
				x: t.current.clientWidth / 2,
				y: t.current.clientHeight / 2
			}
		}, {
			minZoom: r,
			maxZoom: o
		});
		i && (s.current = i.zoom, c.current.onZoom(i.change), c.current.onNavigationEnd?.());
	}, [
		n,
		r,
		o,
		t
	]), {
		navigation: f,
		zoomTo: d,
		zoomBy: (e) => d(s.current + e),
		resetZoom: v(1, l)
	};
}, j = (e) => {
	let { ref: t, children: n, onPan: s, onZoom: c, onNavigationEnd: l, onFit: u, onReset: h, variant: v, zoom: y, minZoom: b = _.minZoom, maxZoom: x = _.maxZoom, "aria-label": S = "Canvas", ...C } = e, w = a(null), { navigation: T, zoomTo: E, zoomBy: D, resetZoom: j } = A(e, w), M = {}, N = {};
	for (let [e, t] of Object.entries(C)) e.startsWith("on") || e.startsWith("aria-") || e.startsWith("data-") || [
		"id",
		"role",
		"tabIndex",
		"title"
	].includes(e) ? M[e] = t : N[e] = t;
	let P = a(void 0), F = d({ recipe: g })({ variant: v }), I = d({ recipe: m })();
	return r(t, () => w.current, []), i(() => {
		let e = O(w.current, () => T.current);
		return P.current = e, () => {
			e.dispose(), P.current = void 0;
		};
	}, [T]), /* @__PURE__ */ p(o, {
		css: I,
		...N,
		"data-canvas-frame": !0,
		children: [/* @__PURE__ */ p(o, {
			ref: w,
			css: F,
			role: "region",
			"aria-label": S,
			tabIndex: 0,
			...M,
			"data-canvas-viewport": !0,
			onPointerDownCapture: (e) => P.current?.pointerDown(e),
			onPointerMoveCapture: (e) => P.current?.pointerMove(e),
			onPointerUpCapture: (e) => P.current?.pointerEnd(e),
			onPointerCancelCapture: (e) => P.current?.pointerEnd(e),
			onLostPointerCapture: (e) => P.current?.pointerLost(e),
			onClickCapture: (e) => P.current?.click(e),
			onAuxClickCapture: (e) => P.current?.click(e),
			children: [/* @__PURE__ */ f(o, {
				position: "absolute",
				inset: "0",
				zIndex: "-1",
				touchAction: "none",
				"data-canvas-background": !0
			}), n]
		}), /* @__PURE__ */ f(k, {
			zoom: y,
			minZoom: b,
			maxZoom: x,
			resetZoom: j,
			onChange: E,
			onStep: D
		})]
	});
};
export { b as n, j as t };

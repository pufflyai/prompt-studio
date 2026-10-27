// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import e, { cloneElement as t, createContext as n, forwardRef as r, memo as i, useCallback as a, useContext as o, useEffect as s, useLayoutEffect as c, useMemo as l, useReducer as u, useRef as d, useState as f } from "react";
import { createPortal as p, unstable_batchedUpdates as m } from "react-dom";
// node_modules/.bun/@dnd-kit+utilities@3.2.2+b1ab299f0a400331/node_modules/@dnd-kit/utilities/dist/utilities.esm.js
function h() {
	var e = [...arguments];
	return l(() => (t) => {
		e.forEach((e) => e(t));
	}, e);
}
var g = typeof window < "u" && window.document !== void 0 && window.document.createElement !== void 0;
function _(e) {
	let t = Object.prototype.toString.call(e);
	return t === "[object Window]" || t === "[object global]";
}
function v(e) {
	return "nodeType" in e;
}
function y(e) {
	return e ? _(e) ? e : v(e) ? e.ownerDocument?.defaultView ?? window : window : window;
}
function b(e) {
	let { Document: t } = y(e);
	return e instanceof t;
}
function x(e) {
	return !_(e) && e instanceof y(e).HTMLElement;
}
function S(e) {
	return e instanceof y(e).SVGElement;
}
function C(e) {
	return e ? _(e) ? e.document : v(e) ? b(e) ? e : x(e) || S(e) ? e.ownerDocument : document : document : document;
}
var w = g ? c : s;
function T(e) {
	let t = d(e);
	return w(() => {
		t.current = e;
	}), a(function() {
		var e = [...arguments];
		return t.current == null ? void 0 : t.current(...e);
	}, []);
}
function E() {
	let e = d(null);
	return [a((t, n) => {
		e.current = setInterval(t, n);
	}, []), a(() => {
		e.current !== null && (clearInterval(e.current), e.current = null);
	}, [])];
}
function D(e, t) {
	t === void 0 && (t = [e]);
	let n = d(e);
	return w(() => {
		n.current !== e && (n.current = e);
	}, t), n;
}
function O(e, t) {
	let n = d();
	return l(() => {
		let t = e(n.current);
		return n.current = t, t;
	}, [...t]);
}
function k(e) {
	let t = T(e), n = d(null);
	return [n, a((e) => {
		e !== n.current && t?.(e, n.current), n.current = e;
	}, [])];
}
function A(e) {
	let t = d();
	return s(() => {
		t.current = e;
	}, [e]), t.current;
}
var j = {};
function ee(e, t) {
	return l(() => {
		if (t) return t;
		let n = j[e] == null ? 0 : j[e] + 1;
		return j[e] = n, e + "-" + n;
	}, [e, t]);
}
function te(e) {
	return function(t) {
		return [...arguments].slice(1).reduce((t, n) => {
			let r = Object.entries(n);
			for (let [n, i] of r) {
				let r = t[n];
				r != null && (t[n] = r + e * i);
			}
			return t;
		}, { ...t });
	};
}
var ne = /*#__PURE__*/ te(1), M = /*#__PURE__*/ te(-1);
function N(e) {
	return "clientX" in e && "clientY" in e;
}
function P(e) {
	if (!e) return !1;
	let { KeyboardEvent: t } = y(e.target);
	return t && e instanceof t;
}
function re(e) {
	if (!e) return !1;
	let { TouchEvent: t } = y(e.target);
	return t && e instanceof t;
}
function ie(e) {
	if (re(e)) {
		if (e.touches && e.touches.length) {
			let { clientX: t, clientY: n } = e.touches[0];
			return {
				x: t,
				y: n
			};
		}
		if (e.changedTouches && e.changedTouches.length) {
			let { clientX: t, clientY: n } = e.changedTouches[0];
			return {
				x: t,
				y: n
			};
		}
	}
	return N(e) ? {
		x: e.clientX,
		y: e.clientY
	} : null;
}
var F = /*#__PURE__*/ Object.freeze({
	Translate: { toString(e) {
		if (!e) return;
		let { x: t, y: n } = e;
		return "translate3d(" + (t ? Math.round(t) : 0) + "px, " + (n ? Math.round(n) : 0) + "px, 0)";
	} },
	Scale: { toString(e) {
		if (!e) return;
		let { scaleX: t, scaleY: n } = e;
		return "scaleX(" + t + ") scaleY(" + n + ")";
	} },
	Transform: { toString(e) {
		if (e) return [F.Translate.toString(e), F.Scale.toString(e)].join(" ");
	} },
	Transition: { toString(e) {
		let { property: t, duration: n, easing: r } = e;
		return t + " " + n + "ms " + r;
	} }
}), I = "a,frame,iframe,input:not([type=hidden]):not(:disabled),select:not(:disabled),textarea:not(:disabled),button:not(:disabled),*[tabindex]";
function ae(e) {
	return e.matches(I) ? e : e.querySelector(I);
}
// node_modules/.bun/@dnd-kit+accessibility@3.1.1+b1ab299f0a400331/node_modules/@dnd-kit/accessibility/dist/accessibility.esm.js
var L = { display: "none" };
function oe(t) {
	let { id: n, value: r } = t;
	return e.createElement("div", {
		id: n,
		style: L
	}, r);
}
function se(t) {
	let { id: n, announcement: r, ariaLiveType: i = "assertive" } = t;
	return e.createElement("div", {
		id: n,
		style: {
			position: "fixed",
			top: 0,
			left: 0,
			width: 1,
			height: 1,
			margin: -1,
			border: 0,
			padding: 0,
			overflow: "hidden",
			clip: "rect(0 0 0 0)",
			clipPath: "inset(100%)",
			whiteSpace: "nowrap"
		},
		role: "status",
		"aria-live": i,
		"aria-atomic": !0
	}, r);
}
function R() {
	let [e, t] = f("");
	return {
		announce: a((e) => {
			e != null && t(e);
		}, []),
		announcement: e
	};
}
// node_modules/.bun/@dnd-kit+core@6.3.1+bf16f8eded5e12ee/node_modules/@dnd-kit/core/dist/core.esm.js
var ce = /*#__PURE__*/ n(null);
function z(e) {
	let t = o(ce);
	s(() => {
		if (!t) throw Error("useDndMonitor must be used within a children of <DndContext>");
		return t(e);
	}, [e, t]);
}
function le() {
	let [e] = f(() => /* @__PURE__ */ new Set()), t = a((t) => (e.add(t), () => e.delete(t)), [e]);
	return [a((t) => {
		let { type: n, event: r } = t;
		e.forEach((e) => e[n]?.call(e, r));
	}, [e]), t];
}
var ue = { draggable: "\n    To pick up a draggable item, press the space bar.\n    While dragging, use the arrow keys to move the item.\n    Press space again to drop the item in its new position, or press escape to cancel.\n  " }, de = {
	onDragStart(e) {
		let { active: t } = e;
		return "Picked up draggable item " + t.id + ".";
	},
	onDragOver(e) {
		let { active: t, over: n } = e;
		return n ? "Draggable item " + t.id + " was moved over droppable area " + n.id + "." : "Draggable item " + t.id + " is no longer over a droppable area.";
	},
	onDragEnd(e) {
		let { active: t, over: n } = e;
		return n ? "Draggable item " + t.id + " was dropped over droppable area " + n.id : "Draggable item " + t.id + " was dropped.";
	},
	onDragCancel(e) {
		let { active: t } = e;
		return "Dragging was cancelled. Draggable item " + t.id + " was dropped.";
	}
};
function fe(t) {
	let { announcements: n = de, container: r, hiddenTextDescribedById: i, screenReaderInstructions: a = ue } = t, { announce: o, announcement: c } = R(), u = ee("DndLiveRegion"), [d, m] = f(!1);
	if (s(() => {
		m(!0);
	}, []), z(l(() => ({
		onDragStart(e) {
			let { active: t } = e;
			o(n.onDragStart({ active: t }));
		},
		onDragMove(e) {
			let { active: t, over: r } = e;
			n.onDragMove && o(n.onDragMove({
				active: t,
				over: r
			}));
		},
		onDragOver(e) {
			let { active: t, over: r } = e;
			o(n.onDragOver({
				active: t,
				over: r
			}));
		},
		onDragEnd(e) {
			let { active: t, over: r } = e;
			o(n.onDragEnd({
				active: t,
				over: r
			}));
		},
		onDragCancel(e) {
			let { active: t, over: r } = e;
			o(n.onDragCancel({
				active: t,
				over: r
			}));
		}
	}), [o, n])), !d) return null;
	let h = e.createElement(e.Fragment, null, e.createElement(oe, {
		id: i,
		value: a.draggable
	}), e.createElement(se, {
		id: u,
		announcement: c
	}));
	return r ? p(h, r) : h;
}
var B;
(function(e) {
	e.DragStart = "dragStart", e.DragMove = "dragMove", e.DragEnd = "dragEnd", e.DragCancel = "dragCancel", e.DragOver = "dragOver", e.RegisterDroppable = "registerDroppable", e.SetDroppableDisabled = "setDroppableDisabled", e.UnregisterDroppable = "unregisterDroppable";
})(B ||= {});
function V() {}
function pe(e, t) {
	return l(() => ({
		sensor: e,
		options: t ?? {}
	}), [e, t]);
}
function me() {
	var e = [...arguments];
	return l(() => [...e].filter((e) => e != null), [...e]);
}
var H = /*#__PURE__*/ Object.freeze({
	x: 0,
	y: 0
});
function U(e, t) {
	return Math.sqrt((e.x - t.x) ** 2 + (e.y - t.y) ** 2);
}
function he(e, t) {
	let n = ie(e);
	if (!n) return "0 0";
	let r = {
		x: (n.x - t.left) / t.width * 100,
		y: (n.y - t.top) / t.height * 100
	};
	return r.x + "% " + r.y + "%";
}
function W(e, t) {
	let { data: { value: n } } = e, { data: { value: r } } = t;
	return n - r;
}
function ge(e, t) {
	let { data: { value: n } } = e, { data: { value: r } } = t;
	return r - n;
}
function G(e) {
	let { left: t, top: n, height: r, width: i } = e;
	return [
		{
			x: t,
			y: n
		},
		{
			x: t + i,
			y: n
		},
		{
			x: t,
			y: n + r
		},
		{
			x: t + i,
			y: n + r
		}
	];
}
function _e(e, t) {
	if (!e || e.length === 0) return null;
	let [n] = e;
	return t ? n[t] : n;
}
function ve(e, t, n) {
	return t === void 0 && (t = e.left), n === void 0 && (n = e.top), {
		x: t + e.width * .5,
		y: n + e.height * .5
	};
}
var K = (e) => {
	let { collisionRect: t, droppableRects: n, droppableContainers: r } = e, i = ve(t, t.left, t.top), a = [];
	for (let e of r) {
		let { id: t } = e, r = n.get(t);
		if (r) {
			let n = U(ve(r), i);
			a.push({
				id: t,
				data: {
					droppableContainer: e,
					value: n
				}
			});
		}
	}
	return a.sort(W);
}, ye = (e) => {
	let { collisionRect: t, droppableRects: n, droppableContainers: r } = e, i = G(t), a = [];
	for (let e of r) {
		let { id: t } = e, r = n.get(t);
		if (r) {
			let n = G(r), o = i.reduce((e, t, r) => e + U(n[r], t), 0), s = Number((o / 4).toFixed(4));
			a.push({
				id: t,
				data: {
					droppableContainer: e,
					value: s
				}
			});
		}
	}
	return a.sort(W);
};
function be(e, t) {
	let n = Math.max(t.top, e.top), r = Math.max(t.left, e.left), i = Math.min(t.left + t.width, e.left + e.width), a = Math.min(t.top + t.height, e.top + e.height), o = i - r, s = a - n;
	if (r < i && n < a) {
		let n = t.width * t.height, r = e.width * e.height, i = o * s, a = i / (n + r - i);
		return Number(a.toFixed(4));
	}
	return 0;
}
var xe = (e) => {
	let { collisionRect: t, droppableRects: n, droppableContainers: r } = e, i = [];
	for (let e of r) {
		let { id: r } = e, a = n.get(r);
		if (a) {
			let n = be(a, t);
			n > 0 && i.push({
				id: r,
				data: {
					droppableContainer: e,
					value: n
				}
			});
		}
	}
	return i.sort(ge);
};
function Se(e, t) {
	let { top: n, left: r, bottom: i, right: a } = t;
	return n <= e.y && e.y <= i && r <= e.x && e.x <= a;
}
var q = (e) => {
	let { droppableContainers: t, droppableRects: n, pointerCoordinates: r } = e;
	if (!r) return [];
	let i = [];
	for (let e of t) {
		let { id: t } = e, a = n.get(t);
		if (a && Se(r, a)) {
			let n = G(a).reduce((e, t) => e + U(r, t), 0), o = Number((n / 4).toFixed(4));
			i.push({
				id: t,
				data: {
					droppableContainer: e,
					value: o
				}
			});
		}
	}
	return i.sort(W);
};
function Ce(e, t, n) {
	return {
		...e,
		scaleX: t && n ? t.width / n.width : 1,
		scaleY: t && n ? t.height / n.height : 1
	};
}
function we(e, t) {
	return e && t ? {
		x: e.left - t.left,
		y: e.top - t.top
	} : H;
}
function Te(e) {
	return function(t) {
		return [...arguments].slice(1).reduce((t, n) => ({
			...t,
			top: t.top + e * n.y,
			bottom: t.bottom + e * n.y,
			left: t.left + e * n.x,
			right: t.right + e * n.x
		}), { ...t });
	};
}
var Ee = /*#__PURE__*/ Te(1);
function De(e) {
	if (e.startsWith("matrix3d(")) {
		let t = e.slice(9, -1).split(/, /);
		return {
			x: +t[12],
			y: +t[13],
			scaleX: +t[0],
			scaleY: +t[5]
		};
	}
	if (e.startsWith("matrix(")) {
		let t = e.slice(7, -1).split(/, /);
		return {
			x: +t[4],
			y: +t[5],
			scaleX: +t[0],
			scaleY: +t[3]
		};
	}
	return null;
}
function Oe(e, t, n) {
	let r = De(t);
	if (!r) return e;
	let { scaleX: i, scaleY: a, x: o, y: s } = r, c = e.left - o - (1 - i) * parseFloat(n), l = e.top - s - (1 - a) * parseFloat(n.slice(n.indexOf(" ") + 1)), u = i ? e.width / i : e.width, d = a ? e.height / a : e.height;
	return {
		width: u,
		height: d,
		top: l,
		right: c + u,
		bottom: l + d,
		left: c
	};
}
var ke = { ignoreTransform: !1 };
function J(e, t) {
	t === void 0 && (t = ke);
	let n = e.getBoundingClientRect();
	if (t.ignoreTransform) {
		let { transform: t, transformOrigin: r } = y(e).getComputedStyle(e);
		t && (n = Oe(n, t, r));
	}
	let { top: r, left: i, width: a, height: o, bottom: s, right: c } = n;
	return {
		top: r,
		left: i,
		width: a,
		height: o,
		bottom: s,
		right: c
	};
}
function Y(e) {
	return J(e, { ignoreTransform: !0 });
}
function Ae(e) {
	let t = e.innerWidth, n = e.innerHeight;
	return {
		top: 0,
		left: 0,
		right: t,
		bottom: n,
		width: t,
		height: n
	};
}
function je(e, t) {
	return t === void 0 && (t = y(e).getComputedStyle(e)), t.position === "fixed";
}
function Me(e, t) {
	t === void 0 && (t = y(e).getComputedStyle(e));
	let n = /(auto|scroll|overlay)/;
	return [
		"overflow",
		"overflowX",
		"overflowY"
	].some((e) => {
		let r = t[e];
		return typeof r == "string" && n.test(r);
	});
}
function X(e, t) {
	let n = [];
	function r(i) {
		if (t != null && n.length >= t || !i) return n;
		if (b(i) && i.scrollingElement != null && !n.includes(i.scrollingElement)) return n.push(i.scrollingElement), n;
		if (!x(i) || S(i) || n.includes(i)) return n;
		let a = y(e).getComputedStyle(i);
		return i !== e && Me(i, a) && n.push(i), je(i, a) ? n : r(i.parentNode);
	}
	return e ? r(e) : n;
}
function Ne(e) {
	let [t] = X(e, 1);
	return t ?? null;
}
function Pe(e) {
	return !g || !e ? null : _(e) ? e : v(e) ? b(e) || e === C(e).scrollingElement ? window : x(e) ? e : null : null;
}
function Fe(e) {
	return _(e) ? e.scrollX : e.scrollLeft;
}
function Ie(e) {
	return _(e) ? e.scrollY : e.scrollTop;
}
function Le(e) {
	return {
		x: Fe(e),
		y: Ie(e)
	};
}
var Z;
(function(e) {
	e[e.Forward = 1] = "Forward", e[e.Backward = -1] = "Backward";
})(Z ||= {});
function Re(e) {
	return !g || !e ? !1 : e === document.scrollingElement;
}
function ze(e) {
	let t = {
		x: 0,
		y: 0
	}, n = Re(e) ? {
		height: window.innerHeight,
		width: window.innerWidth
	} : {
		height: e.clientHeight,
		width: e.clientWidth
	}, r = {
		x: e.scrollWidth - n.width,
		y: e.scrollHeight - n.height
	};
	return {
		isTop: e.scrollTop <= t.y,
		isLeft: e.scrollLeft <= t.x,
		isBottom: e.scrollTop >= r.y,
		isRight: e.scrollLeft >= r.x,
		maxScroll: r,
		minScroll: t
	};
}
var Be = {
	x: .2,
	y: .2
};
function Ve(e, t, n, r, i) {
	let { top: a, left: o, right: s, bottom: c } = n;
	r === void 0 && (r = 10), i === void 0 && (i = Be);
	let { isTop: l, isBottom: u, isLeft: d, isRight: f } = ze(e), p = {
		x: 0,
		y: 0
	}, m = {
		x: 0,
		y: 0
	}, h = {
		height: t.height * i.y,
		width: t.width * i.x
	};
	return !l && a <= t.top + h.height ? (p.y = Z.Backward, m.y = r * Math.abs((t.top + h.height - a) / h.height)) : !u && c >= t.bottom - h.height && (p.y = Z.Forward, m.y = r * Math.abs((t.bottom - h.height - c) / h.height)), !f && s >= t.right - h.width ? (p.x = Z.Forward, m.x = r * Math.abs((t.right - h.width - s) / h.width)) : !d && o <= t.left + h.width && (p.x = Z.Backward, m.x = r * Math.abs((t.left + h.width - o) / h.width)), {
		direction: p,
		speed: m
	};
}
function He(e) {
	if (e === document.scrollingElement) {
		let { innerWidth: e, innerHeight: t } = window;
		return {
			top: 0,
			left: 0,
			right: e,
			bottom: t,
			width: e,
			height: t
		};
	}
	let { top: t, left: n, right: r, bottom: i } = e.getBoundingClientRect();
	return {
		top: t,
		left: n,
		right: r,
		bottom: i,
		width: e.clientWidth,
		height: e.clientHeight
	};
}
function Ue(e) {
	return e.reduce((e, t) => ne(e, Le(t)), H);
}
function We(e) {
	return e.reduce((e, t) => e + Fe(t), 0);
}
function Ge(e) {
	return e.reduce((e, t) => e + Ie(t), 0);
}
function Ke(e, t) {
	if (t === void 0 && (t = J), !e) return;
	let { top: n, left: r, bottom: i, right: a } = t(e);
	Ne(e) && (i <= 0 || a <= 0 || n >= window.innerHeight || r >= window.innerWidth) && e.scrollIntoView({
		block: "center",
		inline: "center"
	});
}
var qe = [[
	"x",
	["left", "right"],
	We
], [
	"y",
	["top", "bottom"],
	Ge
]], Je = class {
	constructor(e, t) {
		this.rect = void 0, this.width = void 0, this.height = void 0, this.top = void 0, this.bottom = void 0, this.right = void 0, this.left = void 0;
		let n = X(t), r = Ue(n);
		this.rect = { ...e }, this.width = e.width, this.height = e.height;
		for (let [e, t, i] of qe) for (let a of t) Object.defineProperty(this, a, {
			get: () => {
				let t = i(n), o = r[e] - t;
				return this.rect[a] + o;
			},
			enumerable: !0
		});
		Object.defineProperty(this, "rect", { enumerable: !1 });
	}
}, Ye = class {
	constructor(e) {
		this.target = void 0, this.listeners = [], this.removeAll = () => {
			this.listeners.forEach((e) => this.target?.removeEventListener(...e));
		}, this.target = e;
	}
	add(e, t, n) {
		var r;
		(r = this.target) == null || r.addEventListener(e, t, n), this.listeners.push([
			e,
			t,
			n
		]);
	}
};
function Xe(e) {
	let { EventTarget: t } = y(e);
	return e instanceof t ? e : C(e);
}
function Ze(e, t) {
	let n = Math.abs(e.x), r = Math.abs(e.y);
	return typeof t == "number" ? Math.sqrt(n ** 2 + r ** 2) > t : "x" in t && "y" in t ? n > t.x && r > t.y : "x" in t ? n > t.x : "y" in t && r > t.y;
}
var Q;
(function(e) {
	e.Click = "click", e.DragStart = "dragstart", e.Keydown = "keydown", e.ContextMenu = "contextmenu", e.Resize = "resize", e.SelectionChange = "selectionchange", e.VisibilityChange = "visibilitychange";
})(Q ||= {});
function Qe(e) {
	e.preventDefault();
}
function $e(e) {
	e.stopPropagation();
}
var $;
(function(e) {
	e.Space = "Space", e.Down = "ArrowDown", e.Right = "ArrowRight", e.Left = "ArrowLeft", e.Up = "ArrowUp", e.Esc = "Escape", e.Enter = "Enter", e.Tab = "Tab";
})($ ||= {});
var et = {
	start: [$.Space, $.Enter],
	cancel: [$.Esc],
	end: [
		$.Space,
		$.Enter,
		$.Tab
	]
}, tt = (e, t) => {
	let { currentCoordinates: n } = t;
	switch (e.code) {
		case $.Right: return {
			...n,
			x: n.x + 25
		};
		case $.Left: return {
			...n,
			x: n.x - 25
		};
		case $.Down: return {
			...n,
			y: n.y + 25
		};
		case $.Up: return {
			...n,
			y: n.y - 25
		};
	}
}, nt = class {
	constructor(e) {
		this.props = void 0, this.autoScrollEnabled = !1, this.referenceCoordinates = void 0, this.listeners = void 0, this.windowListeners = void 0, this.props = e;
		let { event: { target: t } } = e;
		this.props = e, this.listeners = new Ye(C(t)), this.windowListeners = new Ye(y(t)), this.handleKeyDown = this.handleKeyDown.bind(this), this.handleCancel = this.handleCancel.bind(this), this.attach();
	}
	attach() {
		this.handleStart(), this.windowListeners.add(Q.Resize, this.handleCancel), this.windowListeners.add(Q.VisibilityChange, this.handleCancel), setTimeout(() => this.listeners.add(Q.Keydown, this.handleKeyDown));
	}
	handleStart() {
		let { activeNode: e, onStart: t } = this.props, n = e.node.current;
		n && Ke(n), t(H);
	}
	handleKeyDown(e) {
		if (P(e)) {
			let { active: t, context: n, options: r } = this.props, { keyboardCodes: i = et, coordinateGetter: a = tt, scrollBehavior: o = "smooth" } = r, { code: s } = e;
			if (i.end.includes(s)) {
				this.handleEnd(e);
				return;
			}
			if (i.cancel.includes(s)) {
				this.handleCancel(e);
				return;
			}
			let { collisionRect: c } = n.current, l = c ? {
				x: c.left,
				y: c.top
			} : H;
			this.referenceCoordinates ||= l;
			let u = a(e, {
				active: t,
				context: n.current,
				currentCoordinates: l
			});
			if (u) {
				let t = M(u, l), r = {
					x: 0,
					y: 0
				}, { scrollableAncestors: i } = n.current;
				for (let n of i) {
					let i = e.code, { isTop: a, isRight: s, isLeft: c, isBottom: l, maxScroll: d, minScroll: f } = ze(n), p = He(n), m = {
						x: Math.min(i === $.Right ? p.right - p.width / 2 : p.right, Math.max(i === $.Right ? p.left : p.left + p.width / 2, u.x)),
						y: Math.min(i === $.Down ? p.bottom - p.height / 2 : p.bottom, Math.max(i === $.Down ? p.top : p.top + p.height / 2, u.y))
					}, h = i === $.Right && !s || i === $.Left && !c, g = i === $.Down && !l || i === $.Up && !a;
					if (h && m.x !== u.x) {
						let e = n.scrollLeft + t.x, a = i === $.Right && e <= d.x || i === $.Left && e >= f.x;
						if (a && !t.y) {
							n.scrollTo({
								left: e,
								behavior: o
							});
							return;
						}
						r.x = a ? n.scrollLeft - e : i === $.Right ? n.scrollLeft - d.x : n.scrollLeft - f.x, r.x && n.scrollBy({
							left: -r.x,
							behavior: o
						});
						break;
					}
					if (g && m.y !== u.y) {
						let e = n.scrollTop + t.y, a = i === $.Down && e <= d.y || i === $.Up && e >= f.y;
						if (a && !t.x) {
							n.scrollTo({
								top: e,
								behavior: o
							});
							return;
						}
						r.y = a ? n.scrollTop - e : i === $.Down ? n.scrollTop - d.y : n.scrollTop - f.y, r.y && n.scrollBy({
							top: -r.y,
							behavior: o
						});
						break;
					}
				}
				this.handleMove(e, ne(M(u, this.referenceCoordinates), r));
			}
		}
	}
	handleMove(e, t) {
		let { onMove: n } = this.props;
		e.preventDefault(), n(t);
	}
	handleEnd(e) {
		let { onEnd: t } = this.props;
		e.preventDefault(), this.detach(), t();
	}
	handleCancel(e) {
		let { onCancel: t } = this.props;
		e.preventDefault(), this.detach(), t();
	}
	detach() {
		this.listeners.removeAll(), this.windowListeners.removeAll();
	}
};
nt.activators = [{
	eventName: "onKeyDown",
	handler: (e, t, n) => {
		let { keyboardCodes: r = et, onActivation: i } = t, { active: a } = n, { code: o } = e.nativeEvent;
		if (r.start.includes(o)) {
			let t = a.activatorNode.current;
			return t && e.target !== t ? !1 : (e.preventDefault(), i?.({ event: e.nativeEvent }), !0);
		}
		return !1;
	}
}];
function rt(e) {
	return !!(e && "distance" in e);
}
function it(e) {
	return !!(e && "delay" in e);
}
var at = class {
	constructor(e, t, n) {
		n === void 0 && (n = Xe(e.event.target)), this.props = void 0, this.events = void 0, this.autoScrollEnabled = !0, this.document = void 0, this.activated = !1, this.initialCoordinates = void 0, this.timeoutId = null, this.listeners = void 0, this.documentListeners = void 0, this.windowListeners = void 0, this.props = e, this.events = t;
		let { event: r } = e, { target: i } = r;
		this.props = e, this.events = t, this.document = C(i), this.documentListeners = new Ye(this.document), this.listeners = new Ye(n), this.windowListeners = new Ye(y(i)), this.initialCoordinates = ie(r) ?? H, this.handleStart = this.handleStart.bind(this), this.handleMove = this.handleMove.bind(this), this.handleEnd = this.handleEnd.bind(this), this.handleCancel = this.handleCancel.bind(this), this.handleKeydown = this.handleKeydown.bind(this), this.removeTextSelection = this.removeTextSelection.bind(this), this.attach();
	}
	attach() {
		let { events: e, props: { options: { activationConstraint: t, bypassActivationConstraint: n } } } = this;
		if (this.listeners.add(e.move.name, this.handleMove, { passive: !1 }), this.listeners.add(e.end.name, this.handleEnd), e.cancel && this.listeners.add(e.cancel.name, this.handleCancel), this.windowListeners.add(Q.Resize, this.handleCancel), this.windowListeners.add(Q.DragStart, Qe), this.windowListeners.add(Q.VisibilityChange, this.handleCancel), this.windowListeners.add(Q.ContextMenu, Qe), this.documentListeners.add(Q.Keydown, this.handleKeydown), t) {
			if (n != null && n({
				event: this.props.event,
				activeNode: this.props.activeNode,
				options: this.props.options
			})) return this.handleStart();
			if (it(t)) {
				this.timeoutId = setTimeout(this.handleStart, t.delay), this.handlePending(t);
				return;
			}
			if (rt(t)) {
				this.handlePending(t);
				return;
			}
		}
		this.handleStart();
	}
	detach() {
		this.listeners.removeAll(), this.windowListeners.removeAll(), setTimeout(this.documentListeners.removeAll, 50), this.timeoutId !== null && (clearTimeout(this.timeoutId), this.timeoutId = null);
	}
	handlePending(e, t) {
		let { active: n, onPending: r } = this.props;
		r(n, e, this.initialCoordinates, t);
	}
	handleStart() {
		let { initialCoordinates: e } = this, { onStart: t } = this.props;
		e && (this.activated = !0, this.documentListeners.add(Q.Click, $e, { capture: !0 }), this.removeTextSelection(), this.documentListeners.add(Q.SelectionChange, this.removeTextSelection), t(e));
	}
	handleMove(e) {
		let { activated: t, initialCoordinates: n, props: r } = this, { onMove: i, options: { activationConstraint: a } } = r;
		if (!n) return;
		let o = ie(e) ?? H, s = M(n, o);
		if (!t && a) {
			if (rt(a)) {
				if (a.tolerance != null && Ze(s, a.tolerance)) return this.handleCancel();
				if (Ze(s, a.distance)) return this.handleStart();
			}
			if (it(a) && Ze(s, a.tolerance)) return this.handleCancel();
			this.handlePending(a, s);
		} else e.cancelable && e.preventDefault(), i(o);
	}
	handleEnd() {
		let { onAbort: e, onEnd: t } = this.props;
		this.detach(), this.activated || e(this.props.active), t();
	}
	handleCancel() {
		let { onAbort: e, onCancel: t } = this.props;
		this.detach(), this.activated || e(this.props.active), t();
	}
	handleKeydown(e) {
		e.code === $.Esc && this.handleCancel();
	}
	removeTextSelection() {
		var e;
		(e = this.document.getSelection()) == null || e.removeAllRanges();
	}
}, ot = {
	cancel: { name: "pointercancel" },
	move: { name: "pointermove" },
	end: { name: "pointerup" }
}, st = class extends at {
	constructor(e) {
		let { event: t } = e, n = C(t.target);
		super(e, ot, n);
	}
};
st.activators = [{
	eventName: "onPointerDown",
	handler: (e, t) => {
		let { nativeEvent: n } = e, { onActivation: r } = t;
		return !n.isPrimary || n.button !== 0 ? !1 : (r?.({ event: n }), !0);
	}
}];
var ct = {
	move: { name: "mousemove" },
	end: { name: "mouseup" }
}, lt;
(function(e) {
	e[e.RightClick = 2] = "RightClick";
})(lt ||= {});
var ut = class extends at {
	constructor(e) {
		super(e, ct, C(e.event.target));
	}
};
ut.activators = [{
	eventName: "onMouseDown",
	handler: (e, t) => {
		let { nativeEvent: n } = e, { onActivation: r } = t;
		return n.button !== lt.RightClick && (r?.({ event: n }), !0);
	}
}];
var dt = {
	cancel: { name: "touchcancel" },
	move: { name: "touchmove" },
	end: { name: "touchend" }
}, ft = class extends at {
	constructor(e) {
		super(e, dt);
	}
	static setup() {
		return window.addEventListener(dt.move.name, e, {
			capture: !1,
			passive: !1
		}), function() {
			window.removeEventListener(dt.move.name, e);
		};
		function e() {}
	}
};
ft.activators = [{
	eventName: "onTouchStart",
	handler: (e, t) => {
		let { nativeEvent: n } = e, { onActivation: r } = t, { touches: i } = n;
		return i.length > 1 ? !1 : (r?.({ event: n }), !0);
	}
}];
var pt;
(function(e) {
	e[e.Pointer = 0] = "Pointer", e[e.DraggableRect = 1] = "DraggableRect";
})(pt ||= {});
var mt;
(function(e) {
	e[e.TreeOrder = 0] = "TreeOrder", e[e.ReversedTreeOrder = 1] = "ReversedTreeOrder";
})(mt ||= {});
function ht(e) {
	let { acceleration: t, activator: n = pt.Pointer, canScroll: r, draggingRect: i, enabled: o, interval: c = 5, order: u = mt.TreeOrder, pointerCoordinates: f, scrollableAncestors: p, scrollableAncestorRects: m, delta: h, threshold: g } = e, _ = _t({
		delta: h,
		disabled: !o
	}), [v, y] = E(), b = d({
		x: 0,
		y: 0
	}), x = d({
		x: 0,
		y: 0
	}), S = l(() => {
		switch (n) {
			case pt.Pointer: return f ? {
				top: f.y,
				bottom: f.y,
				left: f.x,
				right: f.x
			} : null;
			case pt.DraggableRect: return i;
		}
	}, [
		n,
		i,
		f
	]), C = d(null), w = a(() => {
		let e = C.current;
		if (!e) return;
		let t = b.current.x * x.current.x, n = b.current.y * x.current.y;
		e.scrollBy(t, n);
	}, []), T = l(() => u === mt.TreeOrder ? [...p].reverse() : p, [u, p]);
	s(() => {
		if (!o || !p.length || !S) y();
		else {
			for (let e of T) {
				if (r?.(e) === !1) continue;
				let n = p.indexOf(e), i = m[n];
				if (!i) continue;
				let { direction: a, speed: o } = Ve(e, i, S, t, g);
				for (let e of ["x", "y"]) _[e][a[e]] || (o[e] = 0, a[e] = 0);
				if (o.x > 0 || o.y > 0) {
					y(), C.current = e, v(w, c), b.current = o, x.current = a;
					return;
				}
			}
			b.current = {
				x: 0,
				y: 0
			}, x.current = {
				x: 0,
				y: 0
			}, y();
		}
	}, [
		t,
		w,
		r,
		y,
		o,
		c,
		JSON.stringify(S),
		JSON.stringify(_),
		v,
		p,
		T,
		m,
		JSON.stringify(g)
	]);
}
var gt = {
	x: {
		[Z.Backward]: !1,
		[Z.Forward]: !1
	},
	y: {
		[Z.Backward]: !1,
		[Z.Forward]: !1
	}
};
function _t(e) {
	let { delta: t, disabled: n } = e, r = A(t);
	return O((e) => {
		if (n || !r || !e) return gt;
		let i = {
			x: Math.sign(t.x - r.x),
			y: Math.sign(t.y - r.y)
		};
		return {
			x: {
				[Z.Backward]: e.x[Z.Backward] || i.x === -1,
				[Z.Forward]: e.x[Z.Forward] || i.x === 1
			},
			y: {
				[Z.Backward]: e.y[Z.Backward] || i.y === -1,
				[Z.Forward]: e.y[Z.Forward] || i.y === 1
			}
		};
	}, [
		n,
		t,
		r
	]);
}
function vt(e, t) {
	let n = t == null ? void 0 : e.get(t), r = n ? n.node.current : null;
	return O((e) => t == null ? null : r ?? e ?? null, [r, t]);
}
function yt(e, t) {
	return l(() => e.reduce((e, n) => {
		let { sensor: r } = n, i = r.activators.map((e) => ({
			eventName: e.eventName,
			handler: t(e.handler, n)
		}));
		return [...e, ...i];
	}, []), [e, t]);
}
var bt;
(function(e) {
	e[e.Always = 0] = "Always", e[e.BeforeDragging = 1] = "BeforeDragging", e[e.WhileDragging = 2] = "WhileDragging";
})(bt ||= {});
var xt;
(function(e) {
	e.Optimized = "optimized";
})(xt ||= {});
var St = /*#__PURE__*/ new Map();
function Ct(e, t) {
	let { dragging: n, dependencies: r, config: i } = t, [o, c] = f(null), { frequency: l, measure: u, strategy: p } = i, m = d(e), h = b(), g = D(h), _ = a(function(e) {
		e === void 0 && (e = []), !g.current && c((t) => t === null ? e : t.concat(e.filter((e) => !t.includes(e))));
	}, [g]), v = d(null), y = O((t) => {
		if (h && !n) return St;
		if (!t || t === St || m.current !== e || o != null) {
			let t = /* @__PURE__ */ new Map();
			for (let n of e) {
				if (!n) continue;
				if (o && o.length > 0 && !o.includes(n.id) && n.rect.current) {
					t.set(n.id, n.rect.current);
					continue;
				}
				let e = n.node.current, r = e ? new Je(u(e), e) : null;
				n.rect.current = r, r && t.set(n.id, r);
			}
			return t;
		}
		return t;
	}, [
		e,
		o,
		n,
		h,
		u
	]);
	return s(() => {
		m.current = e;
	}, [e]), s(() => {
		h || _();
	}, [n, h]), s(() => {
		o && o.length > 0 && c(null);
	}, [JSON.stringify(o)]), s(() => {
		h || typeof l != "number" || v.current !== null || (v.current = setTimeout(() => {
			_(), v.current = null;
		}, l));
	}, [
		l,
		h,
		_,
		...r
	]), {
		droppableRects: y,
		measureDroppableContainers: _,
		measuringScheduled: o != null
	};
	function b() {
		switch (p) {
			case bt.Always: return !1;
			case bt.BeforeDragging: return n;
			default: return !n;
		}
	}
}
function wt(e, t) {
	return O((n) => e ? n || (typeof t == "function" ? t(e) : e) : null, [t, e]);
}
function Tt(e, t) {
	return wt(e, t);
}
function Et(e) {
	let { callback: t, disabled: n } = e, r = T(t), i = l(() => {
		if (n || typeof window > "u" || window.MutationObserver === void 0) return;
		let { MutationObserver: e } = window;
		return new e(r);
	}, [r, n]);
	return s(() => () => i?.disconnect(), [i]), i;
}
function Dt(e) {
	let { callback: t, disabled: n } = e, r = T(t), i = l(() => {
		if (n || typeof window > "u" || window.ResizeObserver === void 0) return;
		let { ResizeObserver: e } = window;
		return new e(r);
	}, [n]);
	return s(() => () => i?.disconnect(), [i]), i;
}
function Ot(e) {
	return new Je(J(e), e);
}
function kt(e, t, n) {
	t === void 0 && (t = Ot);
	let [r, i] = f(null);
	function a() {
		i((r) => {
			if (!e) return null;
			if (e.isConnected === !1) return r ?? n ?? null;
			let i = t(e);
			return JSON.stringify(r) === JSON.stringify(i) ? r : i;
		});
	}
	let o = Et({ callback(t) {
		if (e) for (let n of t) {
			let { type: t, target: r } = n;
			if (t === "childList" && r instanceof HTMLElement && r.contains(e)) {
				a();
				break;
			}
		}
	} }), s = Dt({ callback: a });
	return w(() => {
		a(), e ? (s?.observe(e), o?.observe(document.body, {
			childList: !0,
			subtree: !0
		})) : (s?.disconnect(), o?.disconnect());
	}, [e]), r;
}
function At(e) {
	return we(e, wt(e));
}
var jt = [];
function Mt(e) {
	let t = d(e), n = O((n) => e ? n && n !== jt && e && t.current && e.parentNode === t.current.parentNode ? n : X(e) : jt, [e]);
	return s(() => {
		t.current = e;
	}, [e]), n;
}
function Nt(e) {
	let [t, n] = f(null), r = d(e), i = a((e) => {
		let t = Pe(e.target);
		t && n((e) => e ? (e.set(t, Le(t)), new Map(e)) : null);
	}, []);
	return s(() => {
		let t = r.current;
		if (e !== t) {
			a(t);
			let o = e.map((e) => {
				let t = Pe(e);
				return t ? (t.addEventListener("scroll", i, { passive: !0 }), [t, Le(t)]) : null;
			}).filter((e) => e != null);
			n(o.length ? new Map(o) : null), r.current = e;
		}
		return () => {
			a(e), a(t);
		};
		function a(e) {
			e.forEach((e) => {
				Pe(e)?.removeEventListener("scroll", i);
			});
		}
	}, [i, e]), l(() => e.length ? t ? Array.from(t.values()).reduce((e, t) => ne(e, t), H) : Ue(e) : H, [e, t]);
}
function Pt(e, t) {
	t === void 0 && (t = []);
	let n = d(null);
	return s(() => {
		n.current = null;
	}, t), s(() => {
		let t = e !== H;
		t && !n.current && (n.current = e), !t && n.current && (n.current = null);
	}, [e]), n.current ? M(e, n.current) : H;
}
function Ft(e) {
	s(() => {
		if (!g) return;
		let t = e.map((e) => {
			let { sensor: t } = e;
			return t.setup == null ? void 0 : t.setup();
		});
		return () => {
			for (let e of t) e?.();
		};
	}, e.map((e) => {
		let { sensor: t } = e;
		return t;
	}));
}
function It(e, t) {
	return l(() => e.reduce((e, n) => {
		let { eventName: r, handler: i } = n;
		return e[r] = (e) => {
			i(e, t);
		}, e;
	}, {}), [e, t]);
}
function Lt(e) {
	return l(() => e ? Ae(e) : null, [e]);
}
var Rt = [];
function zt(e, t) {
	t === void 0 && (t = J);
	let [n] = e, r = Lt(n ? y(n) : null), [i, a] = f(Rt);
	function o() {
		a(() => e.length ? e.map((e) => Re(e) ? r : new Je(t(e), e)) : Rt);
	}
	let s = Dt({ callback: o });
	return w(() => {
		s?.disconnect(), o(), e.forEach((e) => s?.observe(e));
	}, [e]), i;
}
function Bt(e) {
	if (!e) return null;
	if (e.children.length > 1) return e;
	let t = e.children[0];
	return x(t) ? t : e;
}
function Vt(e) {
	let { measure: t } = e, [n, r] = f(null), i = Dt({ callback: a((e) => {
		for (let { target: n } of e) if (x(n)) {
			r((e) => {
				let r = t(n);
				return e ? {
					...e,
					width: r.width,
					height: r.height
				} : r;
			});
			break;
		}
	}, [t]) }), [o, s] = k(a((e) => {
		let n = Bt(e);
		i?.disconnect(), n && i?.observe(n), r(n ? t(n) : null);
	}, [t, i]));
	return l(() => ({
		nodeRef: o,
		rect: n,
		setRef: s
	}), [
		n,
		o,
		s
	]);
}
var Ht = [{
	sensor: st,
	options: {}
}, {
	sensor: nt,
	options: {}
}], Ut = { current: {} }, Wt = {
	draggable: { measure: Y },
	droppable: {
		measure: Y,
		strategy: bt.WhileDragging,
		frequency: xt.Optimized
	},
	dragOverlay: { measure: J }
}, Gt = class extends Map {
	get(e) {
		return e == null ? void 0 : super.get(e) ?? void 0;
	}
	toArray() {
		return Array.from(this.values());
	}
	getEnabled() {
		return this.toArray().filter((e) => {
			let { disabled: t } = e;
			return !t;
		});
	}
	getNodeFor(e) {
		return this.get(e)?.node.current ?? void 0;
	}
}, Kt = {
	activatorEvent: null,
	active: null,
	activeNode: null,
	activeNodeRect: null,
	collisions: null,
	containerNodeRect: null,
	draggableNodes: /*#__PURE__*/ new Map(),
	droppableRects: /*#__PURE__*/ new Map(),
	droppableContainers: /*#__PURE__*/ new Gt(),
	over: null,
	dragOverlay: {
		nodeRef: { current: null },
		rect: null,
		setRef: V
	},
	scrollableAncestors: [],
	scrollableAncestorRects: [],
	measuringConfiguration: Wt,
	measureDroppableContainers: V,
	windowRect: null,
	measuringScheduled: !1
}, qt = {
	activatorEvent: null,
	activators: [],
	active: null,
	activeNodeRect: null,
	ariaDescribedById: { draggable: "" },
	dispatch: V,
	draggableNodes: /*#__PURE__*/ new Map(),
	over: null,
	measureDroppableContainers: V
}, Jt = /*#__PURE__*/ n(qt), Yt = /*#__PURE__*/ n(Kt);
function Xt() {
	return {
		draggable: {
			active: null,
			initialCoordinates: {
				x: 0,
				y: 0
			},
			nodes: /* @__PURE__ */ new Map(),
			translate: {
				x: 0,
				y: 0
			}
		},
		droppable: { containers: new Gt() }
	};
}
function Zt(e, t) {
	switch (t.type) {
		case B.DragStart: return {
			...e,
			draggable: {
				...e.draggable,
				initialCoordinates: t.initialCoordinates,
				active: t.active
			}
		};
		case B.DragMove: return e.draggable.active == null ? e : {
			...e,
			draggable: {
				...e.draggable,
				translate: {
					x: t.coordinates.x - e.draggable.initialCoordinates.x,
					y: t.coordinates.y - e.draggable.initialCoordinates.y
				}
			}
		};
		case B.DragEnd:
		case B.DragCancel: return {
			...e,
			draggable: {
				...e.draggable,
				active: null,
				initialCoordinates: {
					x: 0,
					y: 0
				},
				translate: {
					x: 0,
					y: 0
				}
			}
		};
		case B.RegisterDroppable: {
			let { element: n } = t, { id: r } = n, i = new Gt(e.droppable.containers);
			return i.set(r, n), {
				...e,
				droppable: {
					...e.droppable,
					containers: i
				}
			};
		}
		case B.SetDroppableDisabled: {
			let { id: n, key: r, disabled: i } = t, a = e.droppable.containers.get(n);
			if (!a || r !== a.key) return e;
			let o = new Gt(e.droppable.containers);
			return o.set(n, {
				...a,
				disabled: i
			}), {
				...e,
				droppable: {
					...e.droppable,
					containers: o
				}
			};
		}
		case B.UnregisterDroppable: {
			let { id: n, key: r } = t, i = e.droppable.containers.get(n);
			if (!i || r !== i.key) return e;
			let a = new Gt(e.droppable.containers);
			return a.delete(n), {
				...e,
				droppable: {
					...e.droppable,
					containers: a
				}
			};
		}
		default: return e;
	}
}
function Qt(e) {
	let { disabled: t } = e, { active: n, activatorEvent: r, draggableNodes: i } = o(Jt), a = A(r), c = A(n?.id);
	return s(() => {
		if (!t && !r && a && c != null) {
			if (!P(a) || document.activeElement === a.target) return;
			let e = i.get(c);
			if (!e) return;
			let { activatorNode: t, node: n } = e;
			if (!t.current && !n.current) return;
			requestAnimationFrame(() => {
				for (let e of [t.current, n.current]) {
					if (!e) continue;
					let t = ae(e);
					if (t) {
						t.focus();
						break;
					}
				}
			});
		}
	}, [
		r,
		t,
		i,
		c,
		a
	]), null;
}
function $t(e, t) {
	let { transform: n, ...r } = t;
	return e != null && e.length ? e.reduce((e, t) => t({
		transform: e,
		...r
	}), n) : n;
}
function en(e) {
	return l(() => ({
		draggable: {
			...Wt.draggable,
			...e?.draggable
		},
		droppable: {
			...Wt.droppable,
			...e?.droppable
		},
		dragOverlay: {
			...Wt.dragOverlay,
			...e?.dragOverlay
		}
	}), [
		e?.draggable,
		e?.droppable,
		e?.dragOverlay
	]);
}
function tn(e) {
	let { activeNode: t, measure: n, initialRect: r, config: i = !0 } = e, a = d(!1), { x: o, y: s } = typeof i == "boolean" ? {
		x: i,
		y: i
	} : i;
	w(() => {
		if (!o && !s || !t) {
			a.current = !1;
			return;
		}
		if (a.current || !r) return;
		let e = t?.node.current;
		if (!e || e.isConnected === !1) return;
		let i = we(n(e), r);
		if (o || (i.x = 0), s || (i.y = 0), a.current = !0, Math.abs(i.x) > 0 || Math.abs(i.y) > 0) {
			let t = Ne(e);
			t && t.scrollBy({
				top: i.y,
				left: i.x
			});
		}
	}, [
		t,
		o,
		s,
		r,
		n
	]);
}
var nn = /*#__PURE__*/ n({
	...H,
	scaleX: 1,
	scaleY: 1
}), rn;
(function(e) {
	e[e.Uninitialized = 0] = "Uninitialized", e[e.Initializing = 1] = "Initializing", e[e.Initialized = 2] = "Initialized";
})(rn ||= {});
var an = /*#__PURE__*/ i(function(t) {
	let { id: n, accessibility: r, autoScroll: i = !0, children: o, sensors: c = Ht, collisionDetection: p = xe, measuring: h, modifiers: g, ..._ } = t, [v, b] = u(Zt, void 0, Xt), [x, S] = le(), [C, T] = f(rn.Uninitialized), E = C === rn.Initialized, { draggable: { active: O, nodes: k, translate: A }, droppable: { containers: j } } = v, te = O == null ? null : k.get(O), M = d({
		initial: null,
		translated: null
	}), N = l(() => O == null ? null : {
		id: O,
		data: te?.data ?? Ut,
		rect: M
	}, [O, te]), P = d(null), [re, F] = f(null), [I, ae] = f(null), L = D(_, Object.values(_)), oe = ee("DndDescribedBy", n), se = l(() => j.getEnabled(), [j]), R = en(h), { droppableRects: z, measureDroppableContainers: ue, measuringScheduled: de } = Ct(se, {
		dragging: E,
		dependencies: [A.x, A.y],
		config: R.droppable
	}), V = vt(k, O), pe = l(() => I ? ie(I) : null, [I]), me = ze(), H = Tt(V, R.draggable.measure);
	tn({
		activeNode: O == null ? null : k.get(O),
		config: me.layoutShiftCompensation,
		initialRect: H,
		measure: R.draggable.measure
	});
	let U = kt(V, R.draggable.measure, H), he = kt(V ? V.parentElement : null), W = d({
		activatorEvent: null,
		active: null,
		activeNode: V,
		collisionRect: null,
		collisions: null,
		droppableRects: z,
		draggableNodes: k,
		draggingNode: null,
		draggingNodeRect: null,
		droppableContainers: j,
		over: null,
		scrollableAncestors: [],
		scrollAdjustedTranslate: null
	}), ge = j.getNodeFor(W.current.over?.id), G = Vt({ measure: R.dragOverlay.measure }), ve = G.nodeRef.current ?? V, K = E ? G.rect ?? U : null, ye = !!(G.nodeRef.current && G.rect), be = At(ye ? null : U), Se = Lt(ve ? y(ve) : null), q = Mt(E ? ge ?? V : null), we = zt(q), Te = $t(g, {
		transform: {
			x: A.x - be.x,
			y: A.y - be.y,
			scaleX: 1,
			scaleY: 1
		},
		activatorEvent: I,
		active: N,
		activeNodeRect: U,
		containerNodeRect: he,
		draggingNodeRect: K,
		over: W.current.over,
		overlayNodeRect: G.rect,
		scrollableAncestors: q,
		scrollableAncestorRects: we,
		windowRect: Se
	}), De = pe ? ne(pe, A) : null, Oe = Nt(q), ke = Pt(Oe), J = Pt(Oe, [U]), Y = ne(Te, ke), Ae = K ? Ee(K, Te) : null, je = N && Ae ? p({
		active: N,
		collisionRect: Ae,
		droppableRects: z,
		droppableContainers: se,
		pointerCoordinates: De
	}) : null, Me = _e(je, "id"), [X, Ne] = f(null), Pe = Ce(ye ? Te : ne(Te, J), X?.rect ?? null, U), Fe = d(null), Ie = a((e, t) => {
		let { sensor: n, options: r } = t;
		if (P.current == null) return;
		let i = k.get(P.current);
		if (!i) return;
		let a = e.nativeEvent, o = new n({
			active: P.current,
			activeNode: i,
			event: a,
			options: r,
			context: W,
			onAbort(e) {
				if (!k.get(e)) return;
				let { onDragAbort: t } = L.current, n = { id: e };
				t?.(n), x({
					type: "onDragAbort",
					event: n
				});
			},
			onPending(e, t, n, r) {
				if (!k.get(e)) return;
				let { onDragPending: i } = L.current, a = {
					id: e,
					constraint: t,
					initialCoordinates: n,
					offset: r
				};
				i?.(a), x({
					type: "onDragPending",
					event: a
				});
			},
			onStart(e) {
				let t = P.current;
				if (t == null) return;
				let n = k.get(t);
				if (!n) return;
				let { onDragStart: r } = L.current, i = {
					activatorEvent: a,
					active: {
						id: t,
						data: n.data,
						rect: M
					}
				};
				m(() => {
					r?.(i), T(rn.Initializing), b({
						type: B.DragStart,
						initialCoordinates: e,
						active: t
					}), x({
						type: "onDragStart",
						event: i
					}), F(Fe.current), ae(a);
				});
			},
			onMove(e) {
				b({
					type: B.DragMove,
					coordinates: e
				});
			},
			onEnd: s(B.DragEnd),
			onCancel: s(B.DragCancel)
		});
		Fe.current = o;
		function s(e) {
			return async function() {
				let { active: t, collisions: n, over: r, scrollAdjustedTranslate: i } = W.current, o = null;
				if (t && i) {
					let { cancelDrop: s } = L.current;
					o = {
						activatorEvent: a,
						active: t,
						collisions: n,
						delta: i,
						over: r
					}, e === B.DragEnd && typeof s == "function" && await Promise.resolve(s(o)) && (e = B.DragCancel);
				}
				P.current = null, m(() => {
					b({ type: e }), T(rn.Uninitialized), Ne(null), F(null), ae(null), Fe.current = null;
					let t = e === B.DragEnd ? "onDragEnd" : "onDragCancel";
					if (o) {
						let e = L.current[t];
						e?.(o), x({
							type: t,
							event: o
						});
					}
				});
			};
		}
	}, [k]), Le = yt(c, a((e, t) => (n, r) => {
		let i = n.nativeEvent, a = k.get(r);
		if (P.current !== null || !a || i.dndKit || i.defaultPrevented) return;
		let o = { active: a };
		e(n, t.options, o) === !0 && (i.dndKit = { capturedBy: t.sensor }, P.current = r, Ie(n, t));
	}, [k, Ie]));
	Ft(c), w(() => {
		U && C === rn.Initializing && T(rn.Initialized);
	}, [U, C]), s(() => {
		let { onDragMove: e } = L.current, { active: t, activatorEvent: n, collisions: r, over: i } = W.current;
		if (!t || !n) return;
		let a = {
			active: t,
			activatorEvent: n,
			collisions: r,
			delta: {
				x: Y.x,
				y: Y.y
			},
			over: i
		};
		m(() => {
			e?.(a), x({
				type: "onDragMove",
				event: a
			});
		});
	}, [Y.x, Y.y]), s(() => {
		let { active: e, activatorEvent: t, collisions: n, droppableContainers: r, scrollAdjustedTranslate: i } = W.current;
		if (!e || P.current == null || !t || !i) return;
		let { onDragOver: a } = L.current, o = r.get(Me), s = o && o.rect.current ? {
			id: o.id,
			rect: o.rect.current,
			data: o.data,
			disabled: o.disabled
		} : null, c = {
			active: e,
			activatorEvent: t,
			collisions: n,
			delta: {
				x: i.x,
				y: i.y
			},
			over: s
		};
		m(() => {
			Ne(s), a?.(c), x({
				type: "onDragOver",
				event: c
			});
		});
	}, [Me]), w(() => {
		W.current = {
			activatorEvent: I,
			active: N,
			activeNode: V,
			collisionRect: Ae,
			collisions: je,
			droppableRects: z,
			draggableNodes: k,
			draggingNode: ve,
			draggingNodeRect: K,
			droppableContainers: j,
			over: X,
			scrollableAncestors: q,
			scrollAdjustedTranslate: Y
		}, M.current = {
			initial: K,
			translated: Ae
		};
	}, [
		N,
		V,
		je,
		Ae,
		k,
		ve,
		K,
		z,
		j,
		X,
		q,
		Y
	]), ht({
		...me,
		delta: A,
		draggingRect: Ae,
		pointerCoordinates: De,
		scrollableAncestors: q,
		scrollableAncestorRects: we
	});
	let Z = l(() => ({
		active: N,
		activeNode: V,
		activeNodeRect: U,
		activatorEvent: I,
		collisions: je,
		containerNodeRect: he,
		dragOverlay: G,
		draggableNodes: k,
		droppableContainers: j,
		droppableRects: z,
		over: X,
		measureDroppableContainers: ue,
		scrollableAncestors: q,
		scrollableAncestorRects: we,
		measuringConfiguration: R,
		measuringScheduled: de,
		windowRect: Se
	}), [
		N,
		V,
		U,
		I,
		je,
		he,
		G,
		k,
		j,
		z,
		X,
		ue,
		q,
		we,
		R,
		de,
		Se
	]), Re = l(() => ({
		activatorEvent: I,
		activators: Le,
		active: N,
		activeNodeRect: U,
		ariaDescribedById: { draggable: oe },
		dispatch: b,
		draggableNodes: k,
		over: X,
		measureDroppableContainers: ue
	}), [
		I,
		Le,
		N,
		U,
		b,
		oe,
		k,
		X,
		ue
	]);
	return e.createElement(ce.Provider, { value: S }, e.createElement(Jt.Provider, { value: Re }, e.createElement(Yt.Provider, { value: Z }, e.createElement(nn.Provider, { value: Pe }, o)), e.createElement(Qt, { disabled: r?.restoreFocus === !1 })), e.createElement(fe, {
		...r,
		hiddenTextDescribedById: oe
	}));
	function ze() {
		let e = re?.autoScrollEnabled === !1, t = typeof i == "object" ? i.enabled === !1 : i === !1, n = E && !e && !t;
		return typeof i == "object" ? {
			...i,
			enabled: n
		} : { enabled: n };
	}
}), on = /*#__PURE__*/ n(null), sn = "button", cn = "Draggable";
function ln(e) {
	let { id: t, data: n, disabled: r = !1, attributes: i } = e, a = ee(cn), { activators: s, activatorEvent: c, active: u, activeNodeRect: d, ariaDescribedById: f, draggableNodes: p, over: m } = o(Jt), { role: h = sn, roleDescription: g = "draggable", tabIndex: _ = 0 } = i ?? {}, v = u?.id === t, y = o(v ? nn : on), [b, x] = k(), [S, C] = k(), T = It(s, t), E = D(n);
	return w(() => (p.set(t, {
		id: t,
		key: a,
		node: b,
		activatorNode: S,
		data: E
	}), () => {
		let e = p.get(t);
		e && e.key === a && p.delete(t);
	}), [p, t]), {
		active: u,
		activatorEvent: c,
		activeNodeRect: d,
		attributes: l(() => ({
			role: h,
			tabIndex: _,
			"aria-disabled": r,
			"aria-pressed": v && h === sn ? !0 : void 0,
			"aria-roledescription": g,
			"aria-describedby": f.draggable
		}), [
			r,
			h,
			_,
			v,
			g,
			f.draggable
		]),
		isDragging: v,
		listeners: r ? void 0 : T,
		node: b,
		over: m,
		setNodeRef: x,
		setActivatorNodeRef: C,
		transform: y
	};
}
function un() {
	return o(Yt);
}
var dn = "Droppable", fn = { timeout: 25 };
function pn(e) {
	let { data: t, disabled: n = !1, id: r, resizeObserverConfig: i } = e, c = ee(dn), { active: l, dispatch: u, over: f, measureDroppableContainers: p } = o(Jt), m = d({ disabled: n }), h = d(!1), g = d(null), _ = d(null), { disabled: v, updateMeasurementsFor: y, timeout: b } = {
		...fn,
		...i
	}, x = D(y ?? r), S = Dt({
		callback: a(() => {
			h.current ? (_.current != null && clearTimeout(_.current), _.current = setTimeout(() => {
				p(Array.isArray(x.current) ? x.current : [x.current]), _.current = null;
			}, b)) : h.current = !0;
		}, [b]),
		disabled: v || !l
	}), [C, w] = k(a((e, t) => {
		S && (t && (S.unobserve(t), h.current = !1), e && S.observe(e));
	}, [S])), T = D(t);
	return s(() => {
		S && C.current && (S.disconnect(), h.current = !1, S.observe(C.current));
	}, [C, S]), s(() => (u({
		type: B.RegisterDroppable,
		element: {
			id: r,
			key: c,
			disabled: n,
			node: C,
			rect: g,
			data: T
		}
	}), () => u({
		type: B.UnregisterDroppable,
		key: c,
		id: r
	})), [r]), s(() => {
		n !== m.current.disabled && (u({
			type: B.SetDroppableDisabled,
			id: r,
			key: c,
			disabled: n
		}), m.current.disabled = n);
	}, [
		r,
		c,
		n,
		u
	]), {
		active: l,
		rect: g,
		isOver: f?.id === r,
		node: C,
		over: f,
		setNodeRef: w
	};
}
function mn(n) {
	let { animation: r, children: i } = n, [a, o] = f(null), [s, c] = f(null), l = A(i);
	return !i && !a && l && o(l), w(() => {
		if (!s) return;
		let e = a?.key, t = a?.props.id;
		e == null || t == null ? o(null) : Promise.resolve(r(t, s)).then(() => {
			o(null);
		});
	}, [
		r,
		a,
		s
	]), e.createElement(e.Fragment, null, i, a ? t(a, { ref: c }) : null);
}
var hn = {
	x: 0,
	y: 0,
	scaleX: 1,
	scaleY: 1
};
function gn(t) {
	let { children: n } = t;
	return e.createElement(Jt.Provider, { value: qt }, e.createElement(nn.Provider, { value: hn }, n));
}
var _n = {
	position: "fixed",
	touchAction: "none"
}, vn = (e) => P(e) ? "transform 250ms ease" : void 0, yn = /*#__PURE__*/ r((t, n) => {
	let { as: r, activatorEvent: i, adjustScale: a, children: o, className: s, rect: c, style: l, transform: u, transition: d = vn } = t;
	if (!c) return null;
	let f = a ? u : {
		...u,
		scaleX: 1,
		scaleY: 1
	}, p = {
		..._n,
		width: c.width,
		height: c.height,
		top: c.top,
		left: c.left,
		transform: F.Transform.toString(f),
		transformOrigin: a && i ? he(i, c) : void 0,
		transition: typeof d == "function" ? d(i) : d,
		...l
	};
	return e.createElement(r, {
		className: s,
		style: p,
		ref: n
	}, o);
}), bn = {
	duration: 250,
	easing: "ease",
	keyframes: (e) => {
		let { transform: { initial: t, final: n } } = e;
		return [{ transform: F.Transform.toString(t) }, { transform: F.Transform.toString(n) }];
	},
	sideEffects: /*#__PURE__*/ ((e) => (t) => {
		let { active: n, dragOverlay: r } = t, i = {}, { styles: a, className: o } = e;
		if (a != null && a.active) for (let [e, t] of Object.entries(a.active)) t !== void 0 && (i[e] = n.node.style.getPropertyValue(e), n.node.style.setProperty(e, t));
		if (a != null && a.dragOverlay) for (let [e, t] of Object.entries(a.dragOverlay)) t !== void 0 && r.node.style.setProperty(e, t);
		return o != null && o.active && n.node.classList.add(o.active), o != null && o.dragOverlay && r.node.classList.add(o.dragOverlay), function() {
			for (let [e, t] of Object.entries(i)) n.node.style.setProperty(e, t);
			o != null && o.active && n.node.classList.remove(o.active);
		};
	})({ styles: { active: { opacity: "0" } } })
};
function xn(e) {
	let { config: t, draggableNodes: n, droppableContainers: r, measuringConfiguration: i } = e;
	return T((e, a) => {
		if (t === null) return;
		let o = n.get(e);
		if (!o) return;
		let s = o.node.current;
		if (!s) return;
		let c = Bt(a);
		if (!c) return;
		let { transform: l } = y(a).getComputedStyle(a), u = De(l);
		if (!u) return;
		let d = typeof t == "function" ? t : Sn(t);
		return Ke(s, i.draggable.measure), d({
			active: {
				id: e,
				data: o.data,
				node: s,
				rect: i.draggable.measure(s)
			},
			draggableNodes: n,
			dragOverlay: {
				node: a,
				rect: i.dragOverlay.measure(c)
			},
			droppableContainers: r,
			measuringConfiguration: i,
			transform: u
		});
	});
}
function Sn(e) {
	let { duration: t, easing: n, sideEffects: r, keyframes: i } = {
		...bn,
		...e
	};
	return (e) => {
		let { active: a, dragOverlay: o, transform: s, ...c } = e;
		if (!t) return;
		let l = {
			x: o.rect.left - a.rect.left,
			y: o.rect.top - a.rect.top
		}, u = {
			scaleX: s.scaleX === 1 ? 1 : a.rect.width * s.scaleX / o.rect.width,
			scaleY: s.scaleY === 1 ? 1 : a.rect.height * s.scaleY / o.rect.height
		}, d = {
			x: s.x - l.x,
			y: s.y - l.y,
			...u
		}, f = i({
			...c,
			active: a,
			dragOverlay: o,
			transform: {
				initial: s,
				final: d
			}
		}), [p] = f, m = f[f.length - 1];
		if (JSON.stringify(p) === JSON.stringify(m)) return;
		let h = r?.({
			active: a,
			dragOverlay: o,
			...c
		}), g = o.node.animate(f, {
			duration: t,
			easing: n,
			fill: "forwards"
		});
		return new Promise((e) => {
			g.onfinish = () => {
				h?.(), e();
			};
		});
	};
}
var Cn = 0;
function wn(e) {
	return l(() => {
		if (e != null) return Cn++, Cn;
	}, [e]);
}
var Tn = /*#__PURE__*/ e.memo((t) => {
	let { adjustScale: n = !1, children: r, dropAnimation: i, style: a, transition: s, modifiers: c, wrapperElement: l = "div", className: u, zIndex: d = 999 } = t, { activatorEvent: f, active: p, activeNodeRect: m, containerNodeRect: h, draggableNodes: g, droppableContainers: _, dragOverlay: v, over: y, measuringConfiguration: b, scrollableAncestors: x, scrollableAncestorRects: S, windowRect: C } = un(), w = o(nn), T = wn(p?.id), E = $t(c, {
		activatorEvent: f,
		active: p,
		activeNodeRect: m,
		containerNodeRect: h,
		draggingNodeRect: v.rect,
		over: y,
		overlayNodeRect: v.rect,
		scrollableAncestors: x,
		scrollableAncestorRects: S,
		transform: w,
		windowRect: C
	}), D = wt(m), O = xn({
		config: i,
		draggableNodes: g,
		droppableContainers: _,
		measuringConfiguration: b
	}), k = D ? v.setRef : void 0;
	return e.createElement(gn, null, e.createElement(mn, { animation: O }, p && T ? e.createElement(yn, {
		key: T,
		id: p.id,
		ref: k,
		as: l,
		activatorEvent: f,
		adjustScale: n,
		className: u,
		transition: s,
		rect: D,
		style: {
			zIndex: d,
			...a
		},
		transform: E
	}, r) : null));
});
export { P as C, ee as D, w as E, F as S, h as T, z as _, bt as a, pe as b, ft as c, J as d, _e as f, un as g, xe as h, nt as i, K as l, q as m, Tn as n, ut as o, X as p, $ as r, st as s, an as t, ye as u, ln as v, M as w, me as x, pn as y };

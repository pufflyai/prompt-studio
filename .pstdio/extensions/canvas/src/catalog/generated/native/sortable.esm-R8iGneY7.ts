// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { C as e, D as t, E as n, S as r, T as i, d as a, f as o, g as s, p as c, r as l, u, v as d, w as f, y as p } from "./core.esm-cje5eyjm.ts";
import m, { useContext as h, useEffect as g, useMemo as _, useRef as v, useState as y } from "react";
// node_modules/.bun/@dnd-kit+sortable@10.0.0+1837e25b928635ba/node_modules/@dnd-kit/sortable/dist/sortable.esm.js
function b(e, t, n) {
	let r = e.slice();
	return r.splice(n < 0 ? r.length + n : n, 0, r.splice(t, 1)[0]), r;
}
function x(e, t) {
	return e.reduce((e, n, r) => {
		let i = t.get(n);
		return i && (e[r] = i), e;
	}, Array(e.length));
}
function S(e) {
	return e !== null && e >= 0;
}
function C(e, t) {
	if (e === t) return !0;
	if (e.length !== t.length) return !1;
	for (let n = 0; n < e.length; n++) if (e[n] !== t[n]) return !1;
	return !0;
}
function w(e) {
	return typeof e == "boolean" ? {
		draggable: e,
		droppable: e
	} : e;
}
var T = (e) => {
	let { rects: t, activeIndex: n, overIndex: r, index: i } = e, a = b(t, r, n), o = t[i], s = a[i];
	return !s || !o ? null : {
		x: s.left - o.left,
		y: s.top - o.top,
		scaleX: s.width / o.width,
		scaleY: s.height / o.height
	};
}, E = {
	scaleX: 1,
	scaleY: 1
}, D = (e) => {
	let { activeIndex: t, activeNodeRect: n, index: r, rects: i, overIndex: a } = e, o = i[t] ?? n;
	if (!o) return null;
	if (r === t) {
		let e = i[a];
		return e ? {
			x: 0,
			y: t < a ? e.top + e.height - (o.top + o.height) : e.top - o.top,
			...E
		} : null;
	}
	let s = O(i, r, t);
	return r > t && r <= a ? {
		x: 0,
		y: -o.height - s,
		...E
	} : r < t && r >= a ? {
		x: 0,
		y: o.height + s,
		...E
	} : {
		x: 0,
		y: 0,
		...E
	};
};
function O(e, t, n) {
	let r = e[t], i = e[t - 1], a = e[t + 1];
	return r ? n < t ? i ? r.top - (i.top + i.height) : a ? a.top - (r.top + r.height) : 0 : a ? a.top - (r.top + r.height) : i ? r.top - (i.top + i.height) : 0 : 0;
}
var k = "Sortable", A = /*#__PURE__*/ m.createContext({
	activeIndex: -1,
	containerId: k,
	disableTransforms: !1,
	items: [],
	overIndex: -1,
	useDragOverlay: !1,
	sortedRects: [],
	strategy: T,
	disabled: {
		draggable: !1,
		droppable: !1
	}
});
function j(e) {
	let { children: r, id: i, items: a, strategy: o = T, disabled: c = !1 } = e, { active: l, dragOverlay: u, droppableRects: d, over: f, measureDroppableContainers: p } = s(), h = t(k, i), y = u.rect !== null, b = _(() => a.map((e) => typeof e == "object" && "id" in e ? e.id : e), [a]), S = l != null, E = l ? b.indexOf(l.id) : -1, D = f ? b.indexOf(f.id) : -1, O = v(b), j = !C(b, O.current), M = D !== -1 && E === -1 || j, N = w(c);
	n(() => {
		j && S && p(b);
	}, [
		j,
		b,
		S,
		p
	]), g(() => {
		O.current = b;
	}, [b]);
	let P = _(() => ({
		activeIndex: E,
		containerId: h,
		disabled: N,
		disableTransforms: M,
		items: b,
		overIndex: D,
		useDragOverlay: y,
		sortedRects: x(b, d),
		strategy: o
	}), [
		E,
		h,
		N.draggable,
		N.droppable,
		M,
		b,
		D,
		d,
		y,
		o
	]);
	return m.createElement(A.Provider, { value: P }, r);
}
var M = (e) => {
	let { id: t, items: n, activeIndex: r, overIndex: i } = e;
	return b(n, r, i).indexOf(t);
}, N = (e) => {
	let { containerId: t, isSorting: n, wasDragging: r, index: i, items: a, newIndex: o, previousItems: s, previousContainerId: c, transition: l } = e;
	return !l || !r || s !== a && i === o ? !1 : n ? !0 : o !== i && t === c;
}, P = {
	duration: 200,
	easing: "ease"
}, F = "transform", I = /*#__PURE__*/ r.Transition.toString({
	property: F,
	duration: 0,
	easing: "linear"
}), ee = { roleDescription: "sortable" };
function te(e) {
	let { disabled: t, index: r, node: i, rect: o } = e, [s, c] = y(null), l = v(r);
	return n(() => {
		if (!t && r !== l.current && i.current) {
			let e = o.current;
			if (e) {
				let t = a(i.current, { ignoreTransform: !0 }), n = {
					x: e.left - t.left,
					y: e.top - t.top,
					scaleX: e.width / t.width,
					scaleY: e.height / t.height
				};
				(n.x || n.y) && c(n);
			}
		}
		r !== l.current && (l.current = r);
	}, [
		t,
		r,
		i,
		o
	]), g(() => {
		s && c(null);
	}, [s]), s;
}
function L(t) {
	let { animateLayoutChanges: n = N, attributes: a, disabled: o, data: s, getNewIndex: c = M, id: l, strategy: u, resizeObserverConfig: f, transition: m = P } = t, { items: y, containerId: b, activeIndex: x, disabled: C, disableTransforms: w, sortedRects: T, overIndex: E, useDragOverlay: D, strategy: O } = h(A), k = ne(o, C), j = y.indexOf(l), L = _(() => ({
		sortable: {
			containerId: b,
			index: j,
			items: y
		},
		...s
	}), [
		b,
		s,
		j,
		y
	]), R = _(() => y.slice(y.indexOf(l)), [y, l]), { rect: z, node: B, isOver: V, setNodeRef: H } = p({
		id: l,
		data: L,
		disabled: k.droppable,
		resizeObserverConfig: {
			updateMeasurementsFor: R,
			...f
		}
	}), { active: U, activatorEvent: re, activeNodeRect: ie, attributes: ae, setNodeRef: W, listeners: oe, isDragging: G, over: se, setActivatorNodeRef: ce, transform: le } = d({
		id: l,
		data: L,
		attributes: {
			...ee,
			...a
		},
		disabled: k.draggable
	}), ue = i(H, W), K = !!U, q = K && !w && S(x) && S(E), J = !D && G, de = q ? (J && q ? le : null) ?? (u ?? O)({
		rects: T,
		activeNodeRect: ie,
		activeIndex: x,
		overIndex: E,
		index: j
	}) : null, Y = S(x) && S(E) ? c({
		id: l,
		items: y,
		activeIndex: x,
		overIndex: E
	}) : j, X = U?.id, Z = v({
		activeId: X,
		items: y,
		newIndex: Y,
		containerId: b
	}), fe = y !== Z.current.items, Q = n({
		active: U,
		containerId: b,
		isDragging: G,
		isSorting: K,
		id: l,
		index: j,
		items: y,
		newIndex: Z.current.newIndex,
		previousItems: Z.current.items,
		previousContainerId: Z.current.containerId,
		transition: m,
		wasDragging: Z.current.activeId != null
	}), $ = te({
		disabled: !Q,
		index: j,
		node: B,
		rect: z
	});
	return g(() => {
		K && Z.current.newIndex !== Y && (Z.current.newIndex = Y), b !== Z.current.containerId && (Z.current.containerId = b), y !== Z.current.items && (Z.current.items = y);
	}, [
		K,
		Y,
		b,
		y
	]), g(() => {
		if (X === Z.current.activeId) return;
		if (X != null && Z.current.activeId == null) {
			Z.current.activeId = X;
			return;
		}
		let e = setTimeout(() => {
			Z.current.activeId = X;
		}, 50);
		return () => clearTimeout(e);
	}, [X]), {
		active: U,
		activeIndex: x,
		attributes: ae,
		data: L,
		rect: z,
		index: j,
		newIndex: Y,
		items: y,
		isOver: V,
		isSorting: K,
		isDragging: G,
		listeners: oe,
		node: B,
		overIndex: E,
		over: se,
		setNodeRef: ue,
		setActivatorNodeRef: ce,
		setDroppableNodeRef: H,
		setDraggableNodeRef: W,
		transform: $ ?? de,
		transition: pe()
	};
	function pe() {
		if ($ || fe && Z.current.newIndex === j) return I;
		if (!(J && !e(re) || !m) && (K || Q)) return r.Transition.toString({
			...m,
			property: F
		});
	}
}
function ne(e, t) {
	return typeof e == "boolean" ? {
		draggable: e,
		droppable: !1
	} : {
		draggable: e?.draggable ?? t.draggable,
		droppable: e?.droppable ?? t.droppable
	};
}
function R(e) {
	if (!e) return !1;
	let t = e.data.current;
	return !!(t && "sortable" in t && typeof t.sortable == "object" && "containerId" in t.sortable && "items" in t.sortable && "index" in t.sortable);
}
var z = [
	l.Down,
	l.Right,
	l.Up,
	l.Left
], B = (e, t) => {
	let { context: { active: n, collisionRect: r, droppableRects: i, droppableContainers: a, over: s, scrollableAncestors: d } } = t;
	if (z.includes(e.code)) {
		if (e.preventDefault(), !n || !r) return;
		let t = [];
		a.getEnabled().forEach((n) => {
			if (!n || n != null && n.disabled) return;
			let a = i.get(n.id);
			if (a) switch (e.code) {
				case l.Down:
					r.top < a.top && t.push(n);
					break;
				case l.Up:
					r.top > a.top && t.push(n);
					break;
				case l.Left:
					r.left > a.left && t.push(n);
					break;
				case l.Right: r.left < a.left && t.push(n);
			}
		});
		let p = u({
			active: n,
			collisionRect: r,
			droppableRects: i,
			droppableContainers: t,
			pointerCoordinates: null
		}), m = o(p, "id");
		if (m === s?.id && p.length > 1 && (m = p[1].id), m != null) {
			let e = a.get(n.id), t = a.get(m), o = t ? i.get(t.id) : null, s = t?.node.current;
			if (s && o && e && t) {
				let n = c(s).some((e, t) => d[t] !== e), i = V(e, t), a = H(e, t), l = n || !i ? {
					x: 0,
					y: 0
				} : {
					x: a ? r.width - o.width : 0,
					y: a ? r.height - o.height : 0
				}, u = {
					x: o.left,
					y: o.top
				};
				return l.x && l.y ? u : f(u, l);
			}
		}
	}
};
function V(e, t) {
	return !R(e) || !R(t) ? !1 : e.data.current.sortable.containerId === t.data.current.sortable.containerId;
}
function H(e, t) {
	return !R(e) || !R(t) || !V(e, t) ? !1 : e.data.current.sortable.index < t.data.current.sortable.index;
}
export { D as a, L as i, b as n, B as r, j as t };

// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./x-DqEAa6-d.ts";
import { b as t, i as n, l as r, m as i, n as a, s as o, t as s, x as c } from "./core.esm-cje5eyjm.ts";
import { t as l } from "./scroll-area-I7hjn89T.ts";
import { t as u } from "./tooltip-BweQW627.ts";
import { t as d } from "./drop-indicator-Bqz21pYA.ts";
import { i as f, r as p, t as m } from "./sortable.esm-R8iGneY7.ts";
import { t as h } from "./window-title-bar-hwilC3c8.ts";
import { useEffect as g, useRef as _, useState as v } from "react";
import { Box as y, createSlotRecipeContext as b } from "@chakra-ui/react";
import { jsx as x, jsxs as S } from "react/jsx-runtime";
// packages/ui/src/components/tab-strip/window-tabs.tsx
var { withProvider: C, withContext: w } = b({ recipe: h }), T = C("div", "list"), E = w("div", "tab"), D = w("button", "trigger"), O = w("span", "label"), k = w("button", "close"), A = (t) => {
	let { tab: n, selected: r, tabIndex: i, reorderable: a, dropEdge: o, onSelect: s, onClose: c, onKeyDown: l } = t, p = _(null), { attributes: m, listeners: h, setNodeRef: g, setActivatorNodeRef: v, isDragging: y, isSorting: b } = f({
		id: n.id,
		disabled: !a
	});
	return /* @__PURE__ */ S(E, {
		ref: g,
		role: "presentation",
		"data-selected": r ? "" : void 0,
		"data-dragging": y ? "" : void 0,
		children: [
			/* @__PURE__ */ x(u, {
				content: n.label,
				open: !b && void 0,
				overflowRef: p,
				closeDelay: 150,
				positioning: { placement: "bottom" },
				children: /* @__PURE__ */ S(D, {
					...a ? m : {},
					...h,
					ref: v,
					type: "button",
					role: "tab",
					"aria-selected": r,
					"aria-label": n.label,
					"aria-keyshortcuts": a ? "Alt+ArrowLeft Alt+ArrowRight" : void 0,
					tabIndex: i,
					onClick: s,
					onKeyDown: (e) => {
						h?.onKeyDown?.(e), !b && !e.defaultPrevented && l(e);
					},
					children: [n.icon, /* @__PURE__ */ x(O, {
						ref: p,
						children: n.label
					})]
				})
			}),
			/* @__PURE__ */ x(k, {
				type: "button",
				"aria-label": `Close ${n.label}`,
				title: `Close ${n.label}`,
				onClick: c,
				children: /* @__PURE__ */ x(e, { "aria-hidden": "true" })
			}),
			o ? /* @__PURE__ */ x(d, {
				"data-window-tab-drop": o,
				orientation: "vertical",
				left: o === "before" ? "0" : void 0,
				right: o === "after" ? "0" : void 0
			}) : null
		]
	});
}, j = (e) => {
	let { tabs: u, selectedId: d, onSelect: f, onClose: h, onReorder: b, "aria-label": C } = e, w = _(null), E = _(null), [D, O] = v(), [k, j] = v(), M = c(t(o, { activationConstraint: { distance: 6 } }), t(n, { coordinateGetter: p })), N = (e) => {
		if (!e.over || e.active.id === e.over.id) return;
		let t = String(e.active.id), n = String(e.over.id), r = u.findIndex((e) => e.id === t), i = u.filter((e) => e.id !== t), a = e.active.rect.current.translated, o = u.findIndex((e) => e.id === n) < r;
		if (a && e.activatorEvent.type !== "keydown") {
			let t = a.left + a.width / 2, n = e.over.rect.left + e.over.rect.width / 2;
			t !== n && (o = t < n);
		}
		let s = i.findIndex((e) => e.id === n) + +!o;
		if (s !== r) return {
			id: String(e.over.id),
			targetId: u[s].id,
			edge: o ? "before" : "after"
		};
	}, P = () => {
		O(void 0), j(void 0);
	};
	g(() => {
		d && !D && w.current?.querySelector("[aria-selected=\"true\"]")?.scrollIntoView({
			block: "nearest",
			inline: "nearest"
		});
	}, [d, D]);
	let F = (e) => {
		let t = w.current?.querySelectorAll("[role=\"tab\"]"), n = t?.[e + 1] ?? t?.[e - 1];
		h(u[e].id), n?.focus();
	}, I = (e, t) => {
		if (e.altKey && b && ["ArrowLeft", "ArrowRight"].includes(e.key)) {
			e.preventDefault();
			let n = u[t + (e.key === "ArrowLeft" ? -1 : 1)];
			n && b(u[t].id, n.id);
			let r = e.currentTarget;
			requestAnimationFrame(() => r.scrollIntoView({
				block: "nearest",
				inline: "nearest"
			}));
			return;
		}
		let n = t;
		if (e.key === "ArrowRight") n = (t + 1) % u.length;
		else if (e.key === "ArrowLeft") n = (t - 1 + u.length) % u.length;
		else if (e.key === "Home") n = 0;
		else if (e.key === "End") n = u.length - 1;
		else if (e.key === "Delete") {
			e.preventDefault(), F(t);
			return;
		} else return;
		e.preventDefault(), w.current?.querySelectorAll("[role=\"tab\"]")[n]?.focus(), f(u[n].id);
	};
	return /* @__PURE__ */ S(s, {
		sensors: M,
		collisionDetection: (e) => {
			let t = e.pointerCoordinates;
			if (!t) return r(e);
			let n = E.current?.getBoundingClientRect();
			return !n || t.x < n.left || t.x > n.right || t.y < n.top || t.y > n.bottom ? [] : i(e);
		},
		onDragStart: ({ active: e }) => O(String(e.id)),
		onDragOver: (e) => j(N(e)),
		onDragMove: (e) => j(N(e)),
		onDragCancel: P,
		onDragEnd: (e) => {
			let t = N(e);
			P(), t && b?.(String(e.active.id), t.targetId);
		},
		children: [/* @__PURE__ */ x(m, {
			items: u.map((e) => e.id),
			strategy: () => null,
			children: /* @__PURE__ */ x(l, {
				viewportRef: E,
				width: "fit-content",
				minW: "0",
				maxW: "full",
				height: "window-tab",
				showVerticalScrollbar: !1,
				showHorizontalScrollbar: !0,
				contentProps: {
					h: "full",
					w: "full",
					minW: "0!"
				},
				children: /* @__PURE__ */ x(T, {
					ref: w,
					role: "tablist",
					"aria-label": C,
					children: u.map((e, t) => /* @__PURE__ */ x(A, {
						tab: e,
						selected: e.id === d,
						tabIndex: e.id === (d ?? u[0]?.id) ? 0 : -1,
						reorderable: !!b,
						dropEdge: k?.id === e.id ? k.edge : void 0,
						onSelect: () => f(e.id),
						onClose: () => F(t),
						onKeyDown: (e) => I(e, t)
					}, e.id))
				})
			})
		}), /* @__PURE__ */ x(y, {
			asChild: !0,
			pointerEvents: "none",
			children: /* @__PURE__ */ x(a, {
				dropAnimation: null,
				modifiers: [({ transform: e, activeNodeRect: t }) => {
					let n = E.current?.getBoundingClientRect();
					return !n || !t ? e : {
						...e,
						x: Math.max(n.left - t.left, Math.min(e.x, n.right - t.right)),
						y: 0
					};
				}],
				children: D ? /* @__PURE__ */ x(y, {
					layerStyle: "floatingBar",
					textStyle: "label/XS/medium",
					maxW: "full",
					truncate: !0,
					children: u.find((e) => e.id === D)?.label
				}) : null
			})
		})]
	});
};
export { j as t };

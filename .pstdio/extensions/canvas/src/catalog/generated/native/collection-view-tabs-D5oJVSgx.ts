// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./copy-COTDVt4R.ts";
import { t } from "./layers-plus-DtKZFhst.ts";
import { t as n } from "./pencil-DsB6zW8x.ts";
import { t as r } from "./trash-2-C03vrbuo.ts";
import { b as i, c as a, m as o, n as s, o as c, t as l, v as u, x as d, y as f } from "./core.esm-cje5eyjm.ts";
import { t as p } from "./scroll-area-I7hjn89T.ts";
import { t as m } from "./tooltip-BweQW627.ts";
import { c as h } from "./list-row-BhxGCvIh.ts";
import { t as g } from "./drop-indicator-Bqz21pYA.ts";
import { useRef as _, useState as v } from "react";
import { Box as y, Button as b, Dialog as x, Icon as S, IconButton as C, Input as w, Tabs as T, Text as E } from "@chakra-ui/react";
import { Fragment as D, jsx as O, jsxs as k } from "react/jsx-runtime";
// packages/ui/src/components/collection-view/collection-view-tab.tsx
var A = (e) => {
	let { id: t, title: n, dirty: r, actions: i, reorderable: a, dropEdge: o, onMove: s } = e, c = _(null), l = u({
		id: t,
		disabled: !a
	}), d = f({
		id: t,
		disabled: !a
	});
	return /* @__PURE__ */ O(h, {
		actions: i,
		positioning: { placement: "bottom-start" },
		children: /* @__PURE__ */ k(y, {
			position: "relative",
			flexShrink: "0",
			ref: (e) => {
				l.setNodeRef(e), d.setNodeRef(e);
			},
			children: [/* @__PURE__ */ O(T.Context, { children: (e) => /* @__PURE__ */ O(m, {
				content: n,
				overflowRef: c,
				closeDelay: 150,
				positioning: { placement: "bottom" },
				children: /* @__PURE__ */ k(T.Trigger, {
					id: e.getTriggerProps({ value: t }).id,
					value: t,
					"data-reorderable": a || void 0,
					"data-dragging": l.isDragging || void 0,
					"aria-keyshortcuts": a ? "Alt+ArrowLeft Alt+ArrowRight" : void 0,
					...l.listeners,
					onKeyDown: (e) => {
						if (!a || !e.altKey || !["ArrowLeft", "ArrowRight"].includes(e.key)) return;
						e.preventDefault(), e.stopPropagation();
						let t = e.currentTarget;
						s(e.key === "ArrowLeft" ? "left" : "right"), requestAnimationFrame(() => t.scrollIntoView({
							block: "nearest",
							inline: "nearest"
						}));
					},
					children: [/* @__PURE__ */ O(E, {
						asChild: !0,
						children: /* @__PURE__ */ O("span", {
							ref: c,
							"data-tab-label": !0,
							children: n
						})
					}), r ? /* @__PURE__ */ O(y, {
						"aria-label": "Unsaved view changes",
						width: "0.375rem",
						height: "0.375rem",
						flexShrink: 0,
						borderRadius: "full",
						bg: "fg.warning"
					}) : null]
				})
			}) }), o ? /* @__PURE__ */ O(g, {
				orientation: "vertical",
				left: o === "before" ? "0" : void 0,
				right: o === "after" ? "0" : void 0
			}) : null]
		})
	});
}, j = (e) => {
	let { title: t, onClose: n, onRename: r } = e, [i, a] = v(t);
	return /* @__PURE__ */ k(x.Root, {
		open: !0,
		onOpenChange: (e) => !e.open && n(),
		children: [/* @__PURE__ */ O(x.Backdrop, {}), /* @__PURE__ */ O(x.Positioner, { children: /* @__PURE__ */ O(x.Content, {
			asChild: !0,
			children: /* @__PURE__ */ k("form", {
				onSubmit: (e) => {
					e.preventDefault();
					let t = i.trim();
					t && (r(t), n());
				},
				children: [
					/* @__PURE__ */ O(x.Header, { children: /* @__PURE__ */ O(x.Title, { children: "Rename view" }) }),
					/* @__PURE__ */ O(x.Body, { children: /* @__PURE__ */ O(w, {
						autoFocus: !0,
						"aria-label": "View name",
						value: i,
						onChange: (e) => a(e.target.value)
					}) }),
					/* @__PURE__ */ k(x.Footer, { children: [/* @__PURE__ */ O(b, {
						variant: "ghost",
						onClick: n,
						children: "Cancel"
					}), /* @__PURE__ */ O(b, {
						type: "submit",
						variant: "primary",
						disabled: !i.trim(),
						children: "Rename"
					})] })
				]
			})
		}) })]
	});
}, M = (e) => {
	let t = e.length + 1;
	for (; e.some((e) => e.title === `View ${t}`);) t += 1;
	return `View ${t}`;
}, N = (u) => {
	let { views: f, activeViewId: h, viewsSource: g, dirty: _, busy: b, state: x, onActivate: w, run: E, createView: N } = u, [P, F] = v(), [I, L] = v(), [R, z] = v(), B = !!(g?.onReorderViews && !b && f.length > 1), V = d(i(c, { activationConstraint: { distance: 5 } }), i(a, { activationConstraint: { distance: 5 } })), H = (e) => {
		if (!e.over || e.active.id === e.over.id) return;
		let t = e.active.rect.current.translated, n = t && t.left + t.width / 2 < e.over.rect.left + e.over.rect.width / 2;
		return {
			id: String(e.over.id),
			edge: n ? "before" : "after"
		};
	}, U = (e, t, n) => {
		if (!B || e === t) return;
		let r = f.map((e) => e.id), i = r.filter((t) => t !== e), a = i.indexOf(t);
		a !== -1 && r.includes(e) && (i.splice(a + +(n === "after"), 0, e), !i.every((e, t) => e === r[t]) && E(() => g.onReorderViews(i)));
	}, W = () => {
		L(void 0), z(void 0);
	}, G = (t) => g ? [
		{
			key: "rename",
			label: "Rename",
			isDisabled: b,
			icon: /* @__PURE__ */ O(S, {
				as: n,
				boxSize: "0.875rem"
			}),
			onClick: () => F(t)
		},
		{
			key: "duplicate",
			label: "Duplicate",
			icon: /* @__PURE__ */ O(S, {
				as: e,
				boxSize: "0.875rem"
			}),
			isDisabled: b,
			onClick: () => E(() => N({
				settings: t.settings,
				filter: t.filter,
				sorts: t.sorts,
				title: `${t.title} copy`,
				copyFrom: t.id
			}))
		},
		{
			key: "delete",
			label: "Delete view",
			icon: /* @__PURE__ */ O(S, {
				as: r,
				boxSize: "0.875rem"
			}),
			isDisabled: f.length === 1 || b,
			separatorBefore: !0,
			onClick: () => E(() => g.onDeleteView(t.id))
		}
	] : [];
	return /* @__PURE__ */ k(D, { children: [
		/* @__PURE__ */ O(T.Root, {
			value: h,
			size: "sm",
			variant: "subtle",
			minW: "0",
			overflow: "hidden",
			onValueChange: (e) => {
				let t = f.find((t) => t.id === e.value);
				t && w(t);
			},
			children: /* @__PURE__ */ k(l, {
				sensors: V,
				collisionDetection: o,
				onDragStart: ({ active: e }) => L(String(e.id)),
				onDragOver: (e) => z(H(e)),
				onDragMove: (e) => z(H(e)),
				onDragCancel: W,
				onDragEnd: (e) => {
					let t = H(e);
					W(), t && U(String(e.active.id), t.id, t.edge);
				},
				children: [/* @__PURE__ */ O(p, {
					height: "auto",
					showHorizontalScrollbar: !0,
					showVerticalScrollbar: !1,
					children: /* @__PURE__ */ O(T.List, {
						width: "max-content",
						children: f.map((e, t) => /* @__PURE__ */ O(A, {
							id: e.id,
							title: e.title,
							actions: G(e),
							dirty: _ && e.id === h,
							reorderable: B,
							dropEdge: R?.id === e.id ? R.edge : void 0,
							onMove: (n) => {
								let r = f[t + (n === "left" ? -1 : 1)];
								r && U(e.id, r.id, n === "left" ? "before" : "after");
							}
						}, e.id))
					})
				}), /* @__PURE__ */ O(y, {
					asChild: !0,
					pointerEvents: "none",
					children: /* @__PURE__ */ O(s, {
						dropAnimation: null,
						children: I ? /* @__PURE__ */ O(y, {
							layerStyle: "floatingBar",
							textStyle: "label/XS/medium",
							children: f.find((e) => e.id === I)?.title
						}) : null
					})
				})]
			})
		}),
		/* @__PURE__ */ O(m, {
			content: "Add view",
			children: /* @__PURE__ */ O(C, {
				"aria-label": "Add view",
				size: "2xs",
				variant: "ghost",
				disabled: !g || b,
				onClick: () => g && E(() => N({
					title: M(f),
					...x
				})),
				children: /* @__PURE__ */ O(S, { as: t })
			})
		}),
		P && g ? /* @__PURE__ */ O(j, {
			title: P.title,
			onClose: () => F(void 0),
			onRename: (e) => E(() => g.onUpdateView(P.id, { title: e }))
		}, P.id) : null
	] });
};
export { N as t };

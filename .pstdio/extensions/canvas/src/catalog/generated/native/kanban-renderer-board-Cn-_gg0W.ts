// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./chevron-right-CRFNEcZT.ts";
import { t } from "./ellipsis-BnQWfGiA.ts";
import { t as n } from "./plus-CYkLGSPS.ts";
import { t as r } from "./scroll-area-I7hjn89T.ts";
import { t as i } from "./tooltip-BweQW627.ts";
import { n as a, t as o } from "./use-virtualizer-DJbWYnTZ.ts";
import { t as s } from "./icon-options-BaFkbkcp.ts";
import { c, t as l } from "./list-row-BhxGCvIh.ts";
import { t as u } from "./kanban-renderer-card-DtFLg3Jg.ts";
import { t as d } from "./collection-load-more-CGfheyt3.ts";
import { useEffect as f, useLayoutEffect as p, useRef as m, useState as h } from "react";
import { Badge as g, Box as _, HStack as v, Icon as y, IconButton as b, Menu as x, Spacer as S, Stack as C, Text as w, useSlotRecipe as T } from "@chakra-ui/react";
import { jsx as E, jsxs as D } from "react/jsx-runtime";
// packages/ui/src/components/kanban-renderer/kanban-renderer-board-entry.tsx
var O = (e) => ({
	cardProps: e.cardProps,
	contextMenuActions: e.contextMenuActions ?? []
}), k = (t) => {
	let { entry: n, index: r, selectedItemId: i, collapsed: a, dropTarget: o, onToggle: s, onFocus: l, onKeyboard: d, onDragOver: f, onDrop: p, onDragStart: m, onDragEnd: h } = t, { item: b, group: x } = n;
	if (x) return /* @__PURE__ */ D(v, {
		role: "button",
		tabIndex: 0,
		"aria-expanded": !a,
		"data-board-key": n.key,
		"data-board-pan-ignore": !0,
		px: "xs",
		py: "2xs",
		gap: "2xs",
		cursor: "pointer",
		borderRadius: "sm",
		bg: o ? "bg.subtle" : "transparent",
		_hover: { bg: "bg.hover" },
		onFocus: l,
		onClick: s,
		onKeyDown: (e) => {
			d(e, r), (e.key === "Enter" || e.key === " ") && (e.preventDefault(), e.currentTarget.click());
		},
		onDragOver: f,
		onDrop: p,
		children: [
			/* @__PURE__ */ E(y, {
				as: e,
				boxSize: "14px",
				color: "fg.muted",
				transform: a ? "rotate(0deg)" : "rotate(90deg)"
			}),
			/* @__PURE__ */ E(w, {
				textStyle: "label/S/medium",
				color: "fg.muted",
				children: x.label
			}),
			/* @__PURE__ */ E(g, {
				variant: "number",
				colorPalette: "gray",
				size: "sm",
				children: x.count ?? x.items.length
			})
		]
	});
	if (!b) return null;
	let { cardProps: S, contextMenuActions: C } = O(b);
	return /* @__PURE__ */ E(c, {
		actions: C,
		children: /* @__PURE__ */ E(_, {
			"data-board-key": n.key,
			tabIndex: 0,
			role: "button",
			"aria-label": S.title,
			onFocusCapture: l,
			onKeyDown: (e) => {
				d(e, r), e.target === e.currentTarget && (e.key === "Enter" || e.key === " ") && (e.preventDefault(), S.onClick?.());
			},
			onDragOver: f,
			onDrop: p,
			children: /* @__PURE__ */ E(u, {
				...S,
				isSelected: b.id === i,
				draggable: !0,
				onDragStart: m(b.id),
				onDragEnd: h
			})
		})
	});
}, A = (e) => {
	let { column: t, selectedItemId: n, draggedKey: i, revealedItemId: s, onDragStart: c, onDragEnd: l, onDragTarget: u, onDrop: f } = e, g = T({ key: "kanbanBoardColumn" })(), v = m(null), [y, b] = h({}), [x, S] = h(null), [O, A] = h(null), [j, M] = h(null), N = t.groups?.length ? t.groups.flatMap((e) => [{
		key: JSON.stringify([
			"group",
			t.id,
			e.key
		]),
		group: e
	}, ...y[e.key] ? [] : e.items.map((n) => ({
		key: JSON.stringify([
			"row",
			t.id,
			e.key,
			n.id
		]),
		item: n,
		groupKey: e.key
	}))]) : t.items.map((e) => ({
		key: JSON.stringify([
			"row",
			t.id,
			e.id
		]),
		item: e
	})), { virtualizer: P, virtualItems: F, totalSize: I } = o({
		count: N.length,
		onChange: (t, n) => {
			n && t.range && t.range.endIndex >= N.length - 1 && e.onLoadMore?.();
		},
		getScrollElement: () => v.current,
		getItemKey: (e) => N[e].key,
		estimateSize: (e) => N[e].group ? 32 : 100,
		overscan: 5,
		rangeExtractor: (e) => {
			let t = new Set(a(e));
			for (let e of [
				x,
				O,
				i
			]) {
				let n = N.findIndex((t) => t.key === e);
				n >= 0 && t.add(n);
			}
			for (let e of [s]) {
				let n = N.findIndex((t) => t.item?.id === e);
				n >= 0 && t.add(n);
			}
			return [...t].sort((e, t) => e - t);
		}
	}), L = N.findIndex((e) => e.item?.id === s);
	p(() => {
		L >= 0 && P.scrollToIndex(L, { align: "auto" });
	}, [L, P]), p(() => {
		if (!O) return;
		let e = [...v.current?.querySelectorAll("[data-board-key]") ?? []].find((e) => e.dataset.boardKey === O);
		e?.focus({ preventScroll: !0 }), e && A(null);
	}, [O]);
	let R = (e, t) => {
		if (e.target !== e.currentTarget) return;
		let n = t;
		if (e.key === "ArrowDown") n = Math.min(t + 1, N.length - 1);
		else if (e.key === "ArrowUp") n = Math.max(t - 1, 0);
		else if (e.key === "Home") n = 0;
		else if (e.key === "End") n = N.length - 1;
		else return;
		e.preventDefault(), P.scrollToIndex(n, { align: "auto" }), A(N[n].key);
	}, z = (e, t, n) => {
		e.preventDefault(), e.stopPropagation(), e.dataTransfer.dropEffect = "move", M(t), n && u();
	};
	return /* @__PURE__ */ D(r, {
		flex: "1",
		minH: "0",
		size: "xs",
		viewportRef: v,
		viewportProps: {
			"data-board-column-viewport": t.id,
			"aria-label": t.label,
			onWheel: (t) => {
				let n = t.currentTarget;
				t.deltaY > 0 && n.scrollHeight <= n.clientHeight && e.onLoadMore?.();
			}
		},
		verticalScrollbarProps: { css: g.scrollbar },
		children: [
			t.items.length === 0 && t.totalCount ? /* @__PURE__ */ D(C, {
				css: g.empty,
				alignItems: "center",
				gap: "2xs",
				paddingY: "xl",
				textAlign: "center",
				children: [/* @__PURE__ */ E(w, {
					textStyle: "label/S/regular",
					color: "fg.muted",
					children: "No matching cards"
				}), /* @__PURE__ */ D(w, {
					textStyle: "label/XS",
					color: "fg.subtle",
					children: [
						t.totalCount,
						" ",
						t.totalCount === 1 ? "card" : "cards",
						" hidden by search"
					]
				})]
			}) : null,
			/* @__PURE__ */ E(_, {
				position: "relative",
				height: `${I}px`,
				children: F.map((e) => {
					let r = N[e.index], { item: i, group: a } = r, o = a?.key ?? r.groupKey;
					return /* @__PURE__ */ E(_, {
						"data-index": e.index,
						ref: P.measureElement,
						position: "absolute",
						top: `${e.start}px`,
						left: "0",
						width: "full",
						css: g.entry,
						"data-column-id": t.id,
						"data-group-key": o,
						children: /* @__PURE__ */ E(k, {
							entry: r,
							index: e.index,
							selectedItemId: n,
							collapsed: !!(a && y[a.key]),
							dropTarget: j === r.key,
							onFocus: () => S(r.key),
							onKeyboard: R,
							onToggle: () => {
								a && b((e) => ({
									...e,
									[a.key]: !e[a.key]
								}));
							},
							onDragOver: (e) => z(e, r.key, !!i),
							onDrop: (e) => {
								M(null), f(e, i?.id, o);
							},
							onDragStart: c,
							onDragEnd: l
						})
					}, r.key);
				})
			}),
			e.onLoadMore && (t.count ?? 0) > t.items.length ? /* @__PURE__ */ E(d, {
				label: "Load more cards",
				loading: e.loadingMore,
				onLoadMore: e.onLoadMore
			}) : null
		]
	});
}, j = (e) => {
	let { column: r, onCreateStart: a, onColumnAction: o } = e, c = T({ key: "kanbanBoardColumn" })();
	return /* @__PURE__ */ D(v, {
		css: c.header,
		minH: "1.5rem",
		gap: "2xs",
		alignItems: "center",
		colorPalette: r.color ?? "gray",
		children: [
			/* @__PURE__ */ E(y, {
				"data-testid": "column-status-icon",
				as: s(r.icon),
				boxSize: "0.875rem",
				color: "colorPalette.solid",
				flexShrink: 0
			}),
			/* @__PURE__ */ E(w, {
				textStyle: "label/S/medium",
				children: r.label
			}),
			/* @__PURE__ */ E(g, {
				variant: "number",
				size: "xs",
				colorPalette: "gray",
				children: r.count ?? (r.totalCount ? `${r.items.length} of ${r.totalCount}` : r.items.length)
			}),
			/* @__PURE__ */ E(S, {}),
			r.canCreate && a && /* @__PURE__ */ E(i, {
				content: r.createLabel ?? "Create new row",
				children: /* @__PURE__ */ E(b, {
					size: "2xs",
					variant: "outline",
					onClick: () => a(r.id),
					"aria-label": r.createLabel ?? "Create row",
					children: /* @__PURE__ */ E(y, {
						as: n,
						boxSize: "12px"
					})
				})
			}),
			r.actions.length > 0 && /* @__PURE__ */ D(x.Root, { children: [/* @__PURE__ */ E(x.Trigger, {
				asChild: !0,
				children: /* @__PURE__ */ E(b, {
					size: "2xs",
					variant: "ghost",
					"aria-label": `Column actions for ${r.label}`,
					children: /* @__PURE__ */ E(y, {
						as: t,
						boxSize: "12px"
					})
				})
			}), /* @__PURE__ */ E(x.Positioner, { children: /* @__PURE__ */ E(x.Content, {
				minW: "180px",
				bg: "bg",
				children: r.actions.map((e) => /* @__PURE__ */ E(x.Item, {
					value: e.id,
					asChild: !0,
					children: /* @__PURE__ */ E(l, {
						asChild: !0,
						variant: "full-width",
						label: e.label,
						icon: /* @__PURE__ */ E(y, {
							as: e.icon,
							boxSize: "16px"
						}),
						onActivate: () => o?.(r.id, e.id)
					})
				}, e.id))
			}) })] })
		]
	});
}, M = (e, t, n) => {
	if (e < t || e > t + n) return 0;
	let r = Math.min(96, n / 2), i = e - t, a = t + n - e;
	return i < r ? -960 * (1 - i / r) : a < r ? 960 * (1 - a / r) : 0;
}, N = () => {
	let e = m(null), t = m(null);
	return f(() => () => t.current?.(), []), {
		viewportRef: e,
		startDrag: (n) => {
			t.current?.();
			let r = e.current;
			if (!r) return;
			let i = r.ownerDocument, a = i.defaultView, o = null, s = {
				x: n.clientX,
				y: n.clientY
			}, c = a.performance.now(), l = 0, u = (e) => {
				s = {
					x: e.clientX,
					y: e.clientY
				}, o = e.target instanceof Element ? e.target.closest("[data-board-column-viewport]") : null;
			}, d = (e) => {
				e.relatedTarget || (s = null);
			}, f = () => {
				a.cancelAnimationFrame(l), i.removeEventListener("dragover", u, !0), i.removeEventListener("dragleave", d, !0), i.removeEventListener("drop", f, !0), i.removeEventListener("dragend", f, !0), a.removeEventListener("blur", f), t.current = null;
			}, p = (e) => {
				let t = r.getBoundingClientRect(), n = (e - c) / 1e3;
				if (s && s.y >= t.top && s.y <= t.bottom && (r.scrollLeft += M(s.x, t.left, t.width) * n), o && s) {
					let e = o.getBoundingClientRect();
					o.scrollTop += M(s.y, e.top, e.height) * n;
				}
				c = e, l = a.requestAnimationFrame(p);
			};
			i.addEventListener("dragover", u, !0), i.addEventListener("dragleave", d, !0), i.addEventListener("drop", f, !0), i.addEventListener("dragend", f, !0), a.addEventListener("blur", f), t.current = f, l = a.requestAnimationFrame(p);
		}
	};
}, P = "button, a, input, textarea, select, [role=\"button\"], [role=\"menu\"], [contenteditable]:not([contenteditable=\"false\"]), [data-board-pan-ignore], [data-scope=\"scroll-area\"][data-part=\"scrollbar\"]", F = () => {
	let e = m(null), [t, n] = h(!1), r = (t) => {
		e.current?.pointerId === t.pointerId && (e.current = null, n(!1), t.currentTarget.hasPointerCapture(t.pointerId) && t.currentTarget.releasePointerCapture(t.pointerId));
	};
	return {
		cursor: t ? "grabbing" : "grab",
		userSelect: t ? "none" : void 0,
		onPointerDownCapture: (t) => {
			if (t.pointerType !== "mouse" || t.button !== 0 || !t.isPrimary) return;
			let r = t.currentTarget;
			t.target instanceof Element && r.contains(t.target) && !t.target.closest(P) && (r.scrollWidth <= r.clientWidth || (t.preventDefault(), r.setPointerCapture(t.pointerId), e.current = {
				pointerId: t.pointerId,
				startX: t.clientX,
				scrollLeft: r.scrollLeft
			}, n(!0)));
		},
		onPointerMove: (t) => {
			let n = e.current;
			n && n.pointerId === t.pointerId && (t.buttons & 1 ? t.currentTarget.scrollLeft = n.scrollLeft + n.startX - t.clientX : r(t));
		},
		onPointerUp: r,
		onPointerCancel: r,
		onLostPointerCapture: r
	};
}, I = (e) => {
	let { columns: t, selectedItemId: n = null, onMoveItem: i, onMoveToGroup: a, onCreateStart: o, onColumnAction: s } = e, c = T({ key: "kanbanBoardColumn" })(), [l, u] = h(null), [d, f] = h(null), [p, m] = h(null), g = F(), _ = N(), v = (e) => (t) => {
		t.dataTransfer.setData("text/plain", e), t.dataTransfer.effectAllowed = "move", f(t.currentTarget.closest("[data-board-key]")?.dataset.boardKey ?? null), _.startDrag(t);
	}, y = () => {
		u(null), f(null);
	}, b = (e) => (t) => {
		t.preventDefault(), t.dataTransfer.dropEffect = "move", u(e);
	}, x = (e) => {
		e.currentTarget.contains(e.relatedTarget) || u(null);
	}, S = (e) => (t) => {
		t.preventDefault(), u(null);
		let n = t.dataTransfer.getData("text/plain");
		n && (m(n), i?.(n, e));
	};
	return /* @__PURE__ */ E(r, {
		height: "100%",
		size: "xs",
		showHorizontalScrollbar: !0,
		showVerticalScrollbar: !1,
		viewportRef: _.viewportRef,
		viewportProps: g,
		contentProps: {
			display: "flex",
			alignItems: "stretch",
			gap: "xs",
			padding: "xs",
			minH: "100%"
		},
		children: t.map((t) => /* @__PURE__ */ D(C, {
			"data-testid": `board-column-${t.id}`,
			gap: "xs",
			css: c.root,
			borderWidth: "1px",
			borderColor: "border.subtle",
			borderRadius: "sm",
			background: l === t.id ? "bg.active" : "bg.subtle",
			transition: "background 150ms ease",
			height: "100%",
			minH: "240px",
			overflow: "hidden",
			minW: "260px",
			flex: "1 0 260px",
			onDragOver: b(t.id),
			onDragLeave: x,
			onDrop: S(t.id),
			children: [/* @__PURE__ */ E(j, {
				column: t,
				onCreateStart: o,
				onColumnAction: s
			}), /* @__PURE__ */ E(A, {
				onLoadMore: e.onLoadMore,
				loadingMore: e.loadingMore,
				column: t,
				selectedItemId: n,
				draggedKey: d,
				revealedItemId: p,
				onDragStart: v,
				onDragEnd: y,
				onDragTarget: () => u(t.id),
				onDrop: (e, n, r) => {
					e.preventDefault(), e.stopPropagation(), u(null), f(null);
					let o = e.dataTransfer.getData("text/plain");
					o && o !== n && (m(o), i ? i(o, t.id, {
						beforeItemId: n,
						targetGroupKey: r
					}) : r && a?.(o, r, { beforeItemId: n }));
				}
			})]
		}, t.id))
	});
};
export { I as t };

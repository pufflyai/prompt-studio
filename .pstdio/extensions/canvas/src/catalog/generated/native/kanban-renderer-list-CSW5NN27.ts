// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./scroll-area-I7hjn89T.ts";
import { n as t, t as n } from "./use-virtualizer-DJbWYnTZ.ts";
import { t as r } from "./list-row-BhxGCvIh.ts";
import { t as i } from "./highlighted-text-CaWxQuWj.ts";
import { t as a } from "./kanban-renderer-attribute-badge-C8XDAdt5.ts";
import { t as o } from "./collection-load-more-CGfheyt3.ts";
import { useRef as s, useState as c } from "react";
import { Box as l, HStack as u, Icon as d, Text as f, Wrap as p } from "@chakra-ui/react";
import { jsx as m, jsxs as h } from "react/jsx-runtime";
// packages/ui/src/components/kanban-renderer/kanban-renderer-list-row.tsx
var g = (e, t) => {
	if (e) return { _before: {
		content: "\"\"",
		position: "absolute",
		bg: "border.accent",
		left: "0",
		top: "0",
		width: t ? "3px" : "100%",
		height: t ? "100%" : "2px"
	} };
}, _ = (e) => {
	let { item: t } = e;
	return t.isGroup ? /* @__PURE__ */ h(u, {
		gap: "xs",
		minW: "0",
		maxW: "full",
		flex: "1",
		children: [/* @__PURE__ */ m(f, {
			textStyle: "label/S/medium",
			minW: "0",
			truncate: !0,
			children: t.title
		}), /* @__PURE__ */ m(f, {
			textStyle: "label/XS",
			color: "fg.muted",
			flexShrink: 0,
			children: t.countBadge
		})]
	}) : /* @__PURE__ */ h(u, {
		gap: "compact",
		minW: "0",
		maxW: "full",
		flex: "1",
		children: [t.eyebrow ? /* @__PURE__ */ m(f, {
			"data-testid": "list-row-eyebrow",
			flexShrink: 0,
			textStyle: "mono/XS",
			color: "fg.muted",
			truncate: !0,
			children: /* @__PURE__ */ m(i, {
				text: t.eyebrow,
				query: t.highlight ?? ""
			})
		}) : null, /* @__PURE__ */ m(f, {
			textStyle: "paragraph/S/regular",
			minW: "0",
			truncate: !0,
			children: /* @__PURE__ */ m(i, {
				text: t.title,
				query: t.highlight ?? ""
			})
		})]
	});
}, v = (e) => {
	let { item: t } = e;
	return /* @__PURE__ */ m(u, {
		gap: "xs",
		flexShrink: 0,
		children: /* @__PURE__ */ h(p, {
			gap: "2xs",
			flexShrink: 0,
			children: [t.badges?.map((e) => /* @__PURE__ */ m(a, {
				badge: e,
				onChange: t.onBadgeChange
			}, e.attributeId)), t.customSlots]
		})
	});
}, y = (e) => (e.badges?.length ?? 0) > 0 || (e.customSlots?.length ?? 0) > 0, b = (e, t) => ({
	id: e.id,
	label: /* @__PURE__ */ m(_, { item: e }),
	icon: e.statusIcon ? /* @__PURE__ */ m(d, {
		"data-testid": e.isGroup ? "list-status-icon" : "row-status-icon",
		as: e.statusIcon,
		boxSize: "1rem",
		colorPalette: e.statusColorPalette ?? e.countColorPalette ?? "gray",
		color: e.statusColor ?? (e.isGroup || e.statusColorPalette ? "colorPalette.solid" : "fg.muted")
	}) : void 0,
	endContent: y(e) ? /* @__PURE__ */ m(v, { item: e }) : null,
	isContainer: t,
	contextMenuItems: e.contextMenuActions?.map((e) => ({
		id: e.key,
		label: e.label,
		icon: e.icon ?? void 0,
		disabled: e.isDisabled,
		separatorBefore: e.separatorBefore,
		endContent: e.endContent,
		onAction: e.onClick
	}))
}), x = (e) => {
	let { row: t, isExpanded: n, selectedItemId: i, activeDropTargetId: a, draggedItemId: o, onDraggedItemChange: s, onDropTargetChange: c, onItemClick: u, onExpandedChange: d } = e, { item: f, isGroup: p, canExpand: h } = t, _ = f.id === i, v = !!f.onDropRow && f.id !== o, y = v && f.id === a, x = b(f, h), S = () => d(t.id, !n), C = () => {
		h ? S() : p || (f.onClick?.(), u?.(f));
	}, w = (e) => {
		f.draggable && (e.stopPropagation(), e.dataTransfer.setData("text/plain", f.id), e.dataTransfer.effectAllowed = "move", s(f.id), c(null));
	}, T = (e) => {
		v && (e.preventDefault(), e.stopPropagation(), e.dataTransfer.dropEffect = "move", c(f.id));
	}, E = (e) => {
		e.currentTarget.contains(e.relatedTarget) || c(null);
	}, D = (e) => {
		if (!v || !f.onDropRow) return;
		e.preventDefault(), e.stopPropagation(), c(null), s(null);
		let t = e.dataTransfer.getData("text/plain");
		t && t !== f.id && f.onDropRow(t);
	}, O = () => {
		c(null), s(null);
	};
	return /* @__PURE__ */ m(l, {
		"data-drop-target": y ? "true" : void 0,
		position: "relative",
		borderBottomWidth: "1px",
		borderBottomColor: "border.subtle",
		bg: y ? "bg.subtle" : "transparent",
		draggable: f.draggable,
		transition: "background 120ms ease",
		...g(y, h),
		onDragStart: w,
		onDragOver: T,
		onDragLeave: f.onDropRow ? E : void 0,
		onDragEnd: O,
		onDrop: D,
		children: /* @__PURE__ */ m(r, {
			...x,
			"aria-label": p ? void 0 : f.title,
			variant: p ? "compact" : "collection",
			depth: t.depth,
			isSelected: _,
			isExpanded: n,
			showExpandToggle: h,
			showContextMenuTrigger: !1,
			onActivate: C,
			onToggleExpand: S
		})
	});
}, S = (e, t, n = 0) => {
	let r = [];
	for (let i of e) {
		let e = (i.children?.length ?? 0) > 0;
		r.push({
			id: i.id,
			item: i,
			depth: n,
			isGroup: i.isGroup === !0,
			canExpand: e
		}), e && C(t, i.id) && r.push(...S(i.children ?? [], t, n + 1));
	}
	return r;
}, C = (e, t) => e[t] !== !1, w = (e, t, n) => ({
	...e,
	[t]: n
}), T = (r) => {
	let { items: i, selectedItemId: a = null, expandedGroups: u, onItemClick: d, onExpandedGroupChange: f } = r, [p, g] = c({}), [_, v] = c(null), [y, b] = c(null), [T, E] = c(null), D = u ?? p, O = S(i, D), k = (e, t) => {
		f?.(e, t), u === void 0 && g((n) => w(n, e, t));
	}, A = s(null), { virtualizer: j, virtualItems: M, totalSize: N } = n({
		count: O.length,
		onChange: (e, t) => {
			t && e.range && e.range.endIndex >= O.length - 1 && r.onLoadMore?.();
		},
		getScrollElement: () => A.current,
		getItemKey: (e) => O[e].id,
		estimateSize: (e) => O[e].isGroup ? 29 : 35,
		overscan: 10,
		rangeExtractor: (e) => {
			let n = new Set(t(e));
			for (let e of [y, T]) {
				let t = O.findIndex((t) => t.id === e);
				t >= 0 && n.add(t);
			}
			return [...n].sort((e, t) => e - t);
		}
	});
	return /* @__PURE__ */ h(e, {
		flex: "1",
		minH: "0",
		viewportRef: A,
		viewportProps: {
			"aria-label": "Collection list",
			onWheel: (e) => {
				let t = e.currentTarget;
				e.deltaY > 0 && t.scrollHeight <= t.clientHeight && r.onLoadMore?.();
			}
		},
		children: [/* @__PURE__ */ m(l, {
			position: "relative",
			height: `${N}px`,
			children: M.map((e) => {
				let t = O[e.index];
				return /* @__PURE__ */ m(l, {
					"data-index": e.index,
					ref: j.measureElement,
					position: "absolute",
					top: `${e.start}px`,
					left: "0",
					width: "full",
					onFocusCapture: () => E(t.id),
					onBlurCapture: (e) => {
						e.currentTarget.contains(e.relatedTarget) || E(null);
					},
					children: /* @__PURE__ */ m(x, {
						row: t,
						isExpanded: C(D, t.id),
						selectedItemId: a,
						activeDropTargetId: _,
						draggedItemId: y,
						onDraggedItemChange: b,
						onDropTargetChange: v,
						onItemClick: d,
						onExpandedChange: k
					})
				}, t.id);
			})
		}), r.onLoadMore ? /* @__PURE__ */ m(o, {
			label: "Load more rows",
			loading: r.loadingMore,
			onLoadMore: r.onLoadMore
		}) : null]
	});
};
export { T as t };

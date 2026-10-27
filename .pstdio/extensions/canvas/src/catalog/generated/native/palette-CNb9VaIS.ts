// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./check-Bgh538vW.ts";
import { t } from "./use-virtualizer-DJbWYnTZ.ts";
import { t as n } from "./list-row-BhxGCvIh.ts";
import { t as r } from "./search-modal-content-CrWUdr-6.ts";
import { useEffect as i, useRef as a, useState as o } from "react";
import { Box as s, Dialog as c, HStack as l, Icon as u, Text as d, useSlotRecipe as f } from "@chakra-ui/react";
import { jsx as p, jsxs as m } from "react/jsx-runtime";
// packages/ui/src/components/command-palette/palette-filter.ts
var h = (e) => {
	let t = typeof e.label == "string" ? e.label : "", n = typeof e.secondaryLabel == "string" ? e.secondaryLabel : "";
	return `${t} ${e.searchText ?? ""} ${n}`;
}, g = (e, t) => e.trimStart().startsWith(t), _ = (e, t = [], n) => t.find((t) => t.inputPrefix && g(e, t.inputPrefix))?.id ?? n ?? t.find((e) => !e.inputPrefix)?.id ?? t[0]?.id, v = (e, t = [], n) => {
	let r = t.find((t) => t.id === n && t.inputPrefix && g(e, t.inputPrefix));
	return r?.inputPrefix ? e.trimStart().slice(r.inputPrefix.length).trim() : e.trim();
}, y = (e, t) => {
	let n = {};
	return e.filter((e) => {
		let r = e.assetType;
		if (!r) return !0;
		let i = n[r] ?? 0;
		return i >= t ? !1 : (n[r] = i + 1, !0);
	});
}, b = (e, t) => {
	let n = (t.getEffectiveQuery?.(t.query) ?? t.query.trim()).toLowerCase(), r = e.filter((e) => t.mode && e.mode !== t.mode ? !1 : !n || h(e).toLowerCase().includes(n));
	return n || t.defaultAssetLimit === void 0 ? r : y(r, t.defaultAssetLimit);
}, x = 24, S = 40, C = 384, w = (t) => ({
	id: t.id,
	label: t.label,
	description: t.description ?? t.secondaryLabel,
	icon: t.icon,
	endContent: t.endContent ?? (t.shortcut || t.isSelected ? /* @__PURE__ */ m(l, {
		gap: "2",
		children: [t.shortcut, t.isSelected ? /* @__PURE__ */ p(u, {
			as: e,
			boxSize: "14px",
			color: "fg.muted"
		}) : null]
	}) : void 0),
	onActivate: t.onActivate
}), T = (e) => {
	let t = [];
	return e.forEach((n, r) => {
		let i = e[r - 1];
		n.group && n.group !== i?.group && t.push({
			type: "group",
			id: `group:${n.group}:${n.id}`,
			label: n.group
		}), t.push({
			type: "entry",
			id: n.id,
			entry: n,
			entryIndex: r
		});
	}), t;
}, E = (e, t) => e.findIndex((e) => e.type === "entry" && e.entryIndex === t), D = (e) => {
	let { entries: r, activeIndex: a, emptyLabel: o, onHover: c, scrollRef: l } = e, u = T(r), f = E(u, a), { virtualizer: m, virtualItems: h, totalSize: g } = t({
		count: u.length,
		getScrollElement: () => l.current,
		estimateSize: (e) => u[e]?.type === "group" ? x : S,
		getItemKey: (e) => u[e]?.id ?? e,
		initialRect: {
			width: 0,
			height: C
		},
		overscan: 6
	});
	return i(() => {
		f < 0 || m.scrollToIndex(f, {
			align: "auto",
			behavior: "auto"
		});
	}, [f, m]), r.length === 0 ? /* @__PURE__ */ p(d, {
		textStyle: "paragraph/S/regular",
		color: "fg.muted",
		px: "sm",
		py: "md",
		children: o
	}) : /* @__PURE__ */ p(s, {
		role: "listbox",
		position: "relative",
		width: "100%",
		style: { height: g },
		children: h.map((e) => {
			let t = u[e.index];
			return t ? /* @__PURE__ */ p(s, {
				"data-index": e.index,
				ref: m.measureElement,
				position: "absolute",
				left: "0",
				width: "100%",
				style: { top: e.start },
				children: t.type === "group" ? /* @__PURE__ */ p(d, {
					textStyle: "label/XS/medium",
					color: "fg.muted",
					px: "sm",
					pt: "xs",
					pb: "2xs",
					children: t.label
				}) : /* @__PURE__ */ p(n, {
					variant: "full-width",
					...w(t.entry),
					isSelected: t.entryIndex === a,
					tabIndex: -1,
					onPointerMove: () => c(t.entryIndex)
				})
			}, e.key) : null;
		})
	});
}, O = (e, t, n) => typeof e == "function" ? e(t) : e ?? n, k = (e) => {
	let { open: t, label: n = "Command palette", fullScreen: s = !1, searchAutoFocus: l = !0, entries: u, initialQuery: d = "", initialActiveIndex: h = 0, mode: g, modes: y, resetKey: x = "default", inputIcon: S, placeholder: C, emptyLabel: w = "No results.", footerStart: T, footerEnd: E, filterEntries: k, onActiveEntryChange: A, onQueryChange: j, onClose: ee, onEscape: te } = e, M = f({ key: "palette" })({ fullScreen: s }), N = (e) => {
		let t = g ?? _(e, y);
		return k ? k(u, e, t) : b(u, {
			query: e,
			mode: t,
			getEffectiveQuery: (e) => v(e, y, t)
		});
	}, [P, F] = o(() => ({
		query: d,
		activeId: N(d)[h]?.id ?? null
	})), { query: I, activeId: L } = P, [R, z] = o({
		open: !1,
		resetKey: x
	}), B = a(null), V = a(null), H = a(null), U = R.open !== t || R.resetKey !== x;
	U && (z({
		open: t,
		resetKey: x
	}), t && F({
		query: d,
		activeId: N(d)[h]?.id ?? null
	}));
	let W = g ?? _(I, y), G = N(I), K = Math.max(G.findIndex((e) => e.id === L), 0), q = G[K] ?? null;
	!U && (q?.id ?? null) !== L && F({
		...P,
		activeId: q?.id ?? null
	});
	let J = (e) => {
		F((t) => {
			let n = N(t.query), r = Math.max(n.findIndex((e) => e.id === t.activeId), 0), i = typeof e == "function" ? e(r) : e;
			return {
				...t,
				activeId: n[i]?.id ?? null
			};
		});
	}, Y = {
		query: I,
		mode: W,
		activeIndex: K,
		entries: G
	}, X = O(S, Y, null), ne = O(C, Y, "Search"), Z = (e) => {
		F({
			query: e,
			activeId: null
		}), j?.(e);
	}, Q = () => {
		q?.onActivate();
	}, $ = () => {
		ee();
	};
	i(() => {
		if (!R.open || !l) return;
		let e = setTimeout(() => {
			let e = B.current;
			if (!e) return;
			e.focus();
			let t = e.value.length;
			e.setSelectionRange(t, t);
		}, 0);
		return () => clearTimeout(e);
	}, [R, l]);
	let re = q?.id;
	i(() => {
		A?.(q, K);
	}, [re, K]);
	let ie = () => {
		te?.({
			...Y,
			activeEntry: q,
			entryCount: G.length,
			setQuery: Z,
			setActiveIndex: J,
			runActiveEntry: Q,
			closePalette: $
		}) || (I.length > 0 ? (Z(""), J(0)) : $());
	};
	return /* @__PURE__ */ m(c.Root, {
		open: t,
		initialFocusEl: () => l ? B.current : V.current,
		onEscapeKeyDown: (e) => {
			e.preventDefault(), e.stopPropagation(), ie();
		},
		onOpenChange: (e) => !e.open && $(),
		children: [/* @__PURE__ */ p(c.Backdrop, {}), /* @__PURE__ */ p(c.Positioner, {
			css: M.positioner,
			children: /* @__PURE__ */ p(c.Content, {
				ref: V,
				tabIndex: -1,
				css: M.content,
				"aria-label": n,
				children: /* @__PURE__ */ p(r, {
					searchValue: I,
					searchPlaceholder: ne,
					searchIcon: X,
					searchInputRef: B,
					showCloseButton: !0,
					footerStart: T,
					footerEnd: E,
					scrollAreaProps: {
						maxH: "var(--palette-results-height)",
						css: M.results,
						showHorizontalScrollbar: !1,
						viewportRef: H,
						viewportProps: { style: { overflowAnchor: "none" } }
					},
					onSearchChange: (e) => {
						Z(e), J(0);
					},
					onSearchKeyDown: (e) => {
						e.key === "ArrowDown" ? (e.preventDefault(), J((e) => Math.min(e + 1, Math.max(G.length - 1, 0)))) : e.key === "ArrowUp" ? (e.preventDefault(), J((e) => Math.max(e - 1, 0))) : e.key === "Enter" && (e.preventDefault(), Q());
					},
					children: /* @__PURE__ */ p(D, {
						entries: G,
						activeIndex: K,
						emptyLabel: w,
						onHover: J,
						scrollRef: H
					})
				})
			})
		})]
	});
};
export { k as t };

// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./list-filter-BPOkFpgD.ts";
import { t } from "./rotate-ccw-YxjlnQSJ.ts";
import { t as n } from "./search-FHo0INnP.ts";
import { t as r } from "./x-DqEAa6-d.ts";
import { t as i } from "./scroll-area-I7hjn89T.ts";
import { t as a } from "./tooltip-BweQW627.ts";
import { a as o, i as s, n as c, r as l, t as u } from "./collection-view-pills-Bxf3EXOv.ts";
import { i as ee } from "./collection-view-fields-D15M65ck.ts";
import { a as d, l as f, o as p, r as te } from "./filter-rule-value-y7_Oj9HU.ts";
import { r as ne } from "./view-filter-rule-editor-DGTvv4jU.ts";
import { t as re } from "./collection-view-filter-C1-8HUTj.ts";
import { t as ie } from "./collection-view-tabs-D5oJVSgx.ts";
import { t as m } from "./collection-view-types-69xG6kJd.ts";
import { t as ae } from "./filter-menu-eRsMQha_.ts";
import { n as h, r as g } from "./react-vHPBN2SX.ts";
import { r as _ } from "./browser-storage-CFZrWu9H.ts";
import { i as v, n as y, r as b } from "./host-storage-CRtYziQh.ts";
import { useEffect as x, useRef as S, useState as C } from "react";
import { Box as oe, Button as w, HStack as T, Icon as E, IconButton as D, Input as O, Stack as se, Text as k } from "@chakra-ui/react";
import { Fragment as ce, jsx as A, jsxs as j } from "react/jsx-runtime";
import { normalizeBooleanViewRule as M } from "@pstdio/sdk/extensions";
// packages/ui/src/components/collection-view/use-collection-view-store.ts
var N = "pstdio/ui/kanban-renderer", P = (e) => {
	let { storageKey: t, initialState: n, storage: r } = e, i = {
		settings: n.settings,
		filter: n.filter ?? m,
		sorts: (n.sorts ?? []).slice(0, 1),
		expandedGroups: {},
		activeViewId: ""
	};
	return g()(_((e) => ({
		...i,
		openMenu: null,
		openRuleIndex: null,
		setOpenMenu: (t) => e(t ? {
			openMenu: t,
			openRuleIndex: null
		} : { openMenu: t }),
		setOpenRuleIndex: (t) => e(t === null ? { openRuleIndex: t } : {
			openRuleIndex: t,
			openMenu: null
		}),
		startRule: (t) => e((e) => {
			let n = s(e.filter), r = n.rules.findIndex((e) => e.attributeId === t.id);
			if (r !== -1) return {
				filter: n,
				openMenu: null,
				openRuleIndex: r
			};
			let i = d(n, p(t));
			return {
				filter: i,
				openMenu: null,
				openRuleIndex: i.rules.length - 1
			};
		}),
		selectRule: (t) => e((e) => {
			let n = s(e.filter), r = n.rules.findIndex((e) => e.attributeId === t.attributeId);
			if (Array.isArray(t.value) && t.value.length === 0) return {
				filter: f(n, r, void 0),
				openRuleIndex: null
			};
			let i = r === -1 ? d(n, t) : f(n, r, t);
			return Array.isArray(t.value) && e.openMenu === "filter" ? {
				filter: i,
				openRuleIndex: null
			} : {
				filter: i,
				openMenu: null,
				openRuleIndex: r === -1 ? i.rules.length - 1 : r
			};
		}),
		setSettings: (t) => e((e) => ({ settings: {
			...e.settings,
			...t
		} })),
		setFilter: (t) => e({ filter: t }),
		setSorts: (t) => e({ sorts: t.slice(0, 1) }),
		setExpandedGroup: (t, n) => e((e) => ({ expandedGroups: {
			...e.expandedGroups,
			[t]: n
		} })),
		activateView: (t) => e({
			settings: structuredClone(t.settings),
			filter: structuredClone(t.filter),
			sorts: structuredClone(t.sorts.slice(0, 1)),
			activeViewId: t.id,
			expandedGroups: {},
			openRuleIndex: null
		}),
		reset: () => e(i)
	}), {
		name: `${N}/${t}`,
		version: 5,
		migrate: () => i,
		storage: y(r),
		merge: (e, t) => {
			let n = {
				...t,
				...e
			};
			return {
				...n,
				sorts: n.sorts.slice(0, 1)
			};
		},
		partialize: (e) => ({
			settings: e.settings,
			filter: e.filter,
			sorts: e.sorts,
			activeViewId: e.activeViewId,
			expandedGroups: e.expandedGroups
		})
	}));
}, F = b((e, t, n) => P({
	storageKey: e,
	initialState: n,
	storage: t
})), I = (e, t, n) => F(e, n, t), L = (e, t, n) => h(I(e, t, v()), n), R = (e, t) => {
	let n = e.rules.map((e) => {
		let n = t.find((t) => t.id === e.attributeId);
		return n ? M(e, n.type) : e;
	}), r = e.groups?.map((e) => R(e, t));
	return n.some((t, n) => t !== e.rules[n]) || r?.some((t, n) => t !== e.groups?.[n]) ? {
		...e,
		rules: n,
		...r ? { groups: r } : {}
	} : e;
}, z = /* @__PURE__ */ new Set(["displayProperties", "hiddenColumns"]), B = (e) => Object.entries(e).sort(([e], [t]) => e.localeCompare(t)).map(([e, t]) => [e, z.has(e) && Array.isArray(t) ? [...t].sort() : t]), V = (e) => ({
	conjunction: e.conjunction,
	rules: e.rules.map((e) => ({
		attributeId: e.attributeId,
		condition: e.condition,
		value: Array.isArray(e.value) ? [...e.value].sort() : e.value
	})),
	groups: e.groups?.length ? e.groups.map(V) : void 0
}), H = (e, t) => {
	if (!e) return !1;
	let n = (e) => JSON.stringify([
		B(e.settings),
		V(s(e.filter)),
		e.sorts.map((e) => [e.attributeId, e.direction])
	]);
	return n(e) !== n(t);
}, U = (e) => {
	let t = I(e.storageKey, e.initialState, v()), n = h(t, (e) => e.activeViewId), { settings: r, filter: i = m, sorts: a = [] } = e.initialState, o = e.defaultViews?.length ? e.defaultViews : [{
		id: "default",
		title: "All",
		settings: r,
		filter: i,
		sorts: a
	}], s = e.viewsSource?.views ?? o.map((e) => ({
		...e,
		builtIn: !0
	})), c = e.fields ? s.map((t) => {
		let n = R(t.filter, e.fields);
		return n === t.filter ? t : {
			...t,
			filter: n
		};
	}) : s, l = [
		e.viewsSource?.defaultViewId,
		e.defaultActiveViewId,
		c[0]?.id
	].find((e) => c.some((t) => t.id === e)), u = S(void 0);
	return x(() => {
		let r = t.getState();
		if (e.fields) {
			let t = R(r.filter, e.fields);
			t !== r.filter && r.setFilter(t);
		}
		let i = c.find((e) => e.id === n), a = u.current;
		if (i) a?.active?.id === i.id && !H(a.active, r) && H(i, r) && r.activateView(i);
		else if (!a || !n || a.views.some((e) => e.id === n)) {
			let e = c.find((e) => e.id === l) ?? c[0];
			e && r.activateView(e);
		}
		u.current = {
			views: c,
			active: i
		};
	}, [
		t,
		c,
		l,
		n,
		e.fields
	]), {
		views: c,
		defaultId: l
	};
}, le = (e) => {
	let { value: t, onValueChange: i, resultLabel: o } = e, [s, c] = C(!1), l = S(null), u = () => {
		i(""), c(!1);
	};
	return !s && !t ? /* @__PURE__ */ A(a, {
		content: "Search",
		children: /* @__PURE__ */ A(D, {
			"aria-label": "Search this view",
			variant: "ghost",
			size: "2xs",
			onClick: () => {
				c(!0), setTimeout(() => l.current?.focus(), 0);
			},
			children: /* @__PURE__ */ A(E, { as: n })
		})
	}) : /* @__PURE__ */ j(T, {
		"data-testid": "view-search-field",
		width: "13.75rem",
		height: "filter-pill",
		gap: "2xs",
		paddingX: "xs",
		borderWidth: "1px",
		borderColor: "border",
		borderRadius: "xs",
		bg: "bg.subtle",
		flexShrink: 0,
		children: [
			/* @__PURE__ */ A(E, {
				as: n,
				boxSize: "0.75rem",
				color: "fg.muted",
				flexShrink: 0
			}),
			/* @__PURE__ */ A(O, {
				ref: l,
				autoFocus: !0,
				"aria-label": "Search this view",
				value: t,
				placeholder: "Search…",
				variant: "borderless",
				size: "2xs",
				height: "full",
				padding: "0",
				textStyle: "label/S/regular",
				onChange: (e) => i(e.target.value),
				onBlur: () => !t && c(!1),
				onKeyDown: (e) => {
					e.key === "Escape" && u();
				}
			}),
			t && o ? /* @__PURE__ */ A(k, {
				textStyle: "label/XS",
				color: "fg.subtle",
				flexShrink: 0,
				children: o
			}) : null,
			/* @__PURE__ */ A(D, {
				"aria-label": "Close search",
				variant: "ghost",
				size: "2xs",
				minW: "1rem",
				h: "1rem",
				onClick: u,
				children: /* @__PURE__ */ A(E, {
					as: r,
					boxSize: "0.6875rem",
					color: "fg.subtle"
				})
			})
		]
	});
}, ue = (e) => {
	let { label: t, icon: n, count: r, buttonRef: i, onClick: o } = e;
	return /* @__PURE__ */ A(a, {
		content: t,
		children: /* @__PURE__ */ j(w, {
			ref: i,
			"aria-label": t,
			variant: r > 0 ? "subtle" : "ghost",
			size: "2xs",
			onClick: o,
			children: [/* @__PURE__ */ A(E, { as: n }), r > 0 ? r : null]
		})
	});
}, W = (n) => {
	let { storageKey: r, initialState: a, views: d, viewsSource: p, fields: h, optionsFor: g } = n, { search: _, onSearchChange: v, searchResultLabel: y, leading: b, actions: x, displayControl: E, align: D = "split" } = n, O = L(r, a, (e) => e), { activeViewId: M, settings: N, sorts: P, openMenu: F, openRuleIndex: I } = O, R = s(O.filter), { activateView: z, setFilter: B, setOpenMenu: V, setOpenRuleIndex: U, selectRule: W } = O, G = d.find((e) => e.id === M), K = {
		settings: N,
		filter: R,
		sorts: P
	}, q = H(G, K), J = h.filter((e) => e.filterable), Y = S(null), [X, Z] = C(), [Q, $] = C(!1), de = () => V(F === "filter" ? null : "filter"), fe = async (e) => {
		$(!0), Z(void 0);
		try {
			await e();
		} catch (e) {
			Z(e instanceof Error ? e.message : String(e));
		} finally {
			$(!1);
		}
	}, pe = async (e) => {
		p && z(await p.onCreateView(e));
	}, me = (e) => {
		let t = ee(J, e);
		return t ? g(t) : [];
	}, he = q || R.rules.length > 0 || !!R.groups?.length;
	return /* @__PURE__ */ A(ne.Provider, {
		value: n.itemLabel ?? "Item",
		children: /* @__PURE__ */ j(se, {
			"data-testid": "collection-view-bar",
			gap: "0",
			flexShrink: 0,
			borderBottomWidth: "1px",
			borderColor: "border.subtle",
			children: [
				/* @__PURE__ */ j(T, {
					height: "view-bar",
					minW: "0",
					gap: "2xs",
					paddingX: "xs",
					children: [
						b,
						/* @__PURE__ */ A(ie, {
							views: d,
							activeViewId: M,
							viewsSource: p,
							dirty: q,
							busy: Q,
							state: K,
							onActivate: z,
							run: fe,
							createView: pe
						}),
						D === "split" ? /* @__PURE__ */ A(oe, { flex: "1" }) : null,
						/* @__PURE__ */ A(le, {
							value: _,
							onValueChange: v,
							resultLabel: y
						}),
						/* @__PURE__ */ A(ue, {
							label: "Filter",
							icon: e,
							count: re(R),
							buttonRef: Y,
							onClick: de
						}),
						E,
						x
					]
				}),
				he ? /* @__PURE__ */ j(T, {
					"data-testid": "collection-view-criteria",
					height: "view-subheader",
					minW: "0",
					gap: "2xs",
					paddingX: "xs",
					borderTopWidth: "1px",
					borderColor: "border.subtle",
					children: [/* @__PURE__ */ A(i, {
						flex: "1",
						minW: "0",
						showHorizontalScrollbar: !0,
						showVerticalScrollbar: !1,
						contentProps: {
							height: "full",
							display: "flex",
							alignItems: "center"
						},
						children: /* @__PURE__ */ j(T, {
							gap: "2xs",
							width: "max-content",
							children: [R.rules.map((e, t) => /* @__PURE__ */ A(u, {
								fields: J,
								rule: e,
								options: me(e.attributeId),
								open: I === t,
								onOpenChange: (e) => U(e ? t : null),
								onChange: (e) => B(f(R, t, e)),
								onRemove: () => {
									U(null), B(f(R, t, void 0));
								}
							}, `${t}:${e.attributeId}`)), R.groups?.map((e, t) => /* @__PURE__ */ A(c, {
								fields: J,
								group: e,
								optionsFor: g,
								onChange: (e) => B(o(R, t, e)),
								onRemove: () => B(o(R, t))
							}, t))]
						})
					}), q ? /* @__PURE__ */ j(ce, { children: [/* @__PURE__ */ j(w, {
						size: "2xs",
						variant: "outline",
						onClick: () => G && z(G),
						children: [/* @__PURE__ */ A(t, {}), "Reset"]
					}), /* @__PURE__ */ A(w, {
						size: "2xs",
						variant: "primary",
						disabled: !p || Q,
						onClick: () => p && G && fe(() => p.onUpdateView(G.id, K)),
						children: "Save view"
					})] }) : null]
				}) : null,
				X ? /* @__PURE__ */ A(k, {
					role: "alert",
					color: "fg.error",
					textStyle: "label/S",
					padding: "xs",
					children: X
				}) : null,
				/* @__PURE__ */ A(te, {
					open: F === "filter",
					onOpenChange: (e) => V(e ? "filter" : null),
					anchorRef: Y,
					placement: "bottom-end",
					width: "min(440px, calc(100vw - 32px))",
					padding: "0",
					testId: "filter-menu-popover",
					children: /* @__PURE__ */ A(ae, {
						fields: J,
						filter: R,
						optionsFor: g,
						onSelectRule: W,
						onAddAdvanced: () => {
							V(null), B(l(R));
						},
						onClear: () => {
							V(null), U(null), B(m);
						}
					})
				})
			]
		})
	});
};
export { U as n, L as r, W as t };

// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, p as t, r as n } from "./test-whhQHjQi.ts";
import { t as r } from "./list-filter-BPOkFpgD.ts";
import { t as i } from "./tooltip-BweQW627.ts";
import { a, i as o, n as s, r as c, t as l } from "./collection-view-pills-Bxf3EXOv.ts";
import { a as u, l as d, r as f } from "./filter-rule-value-y7_Oj9HU.ts";
import { r as p } from "./view-filter-rule-editor-DGTvv4jU.ts";
import { t as m } from "./collection-view-filter-C1-8HUTj.ts";
import { t as h } from "./collection-view-types-69xG6kJd.ts";
import { t as g } from "./filter-menu-eRsMQha_.ts";
import { r as _, t as v } from "./collection-view-story-fixtures-CeuFUuz2.ts";
import { useRef as y, useState as b } from "react";
import { Button as x, HStack as S, Icon as C } from "@chakra-ui/react";
import { jsx as w, jsxs as T } from "react/jsx-runtime";
// packages/ui/src/components/collection-view/collection-filter.tsx
function E(e) {
	let { itemLabel: t = "Item", fields: n, optionsFor: _, onFilterChange: v } = e, E = o(e.filter), D = n.filter((e) => e.filterable), O = y(null), [k, A] = b(!1), [j, M] = b(null), N = (e) => {
		let t = E.rules.findIndex((t) => t.attributeId === e.attributeId);
		if (Array.isArray(e.value) && e.value.length === 0) {
			v(d(E, t, void 0)), M(null);
			return;
		}
		let n = t === -1 ? u(E, e) : d(E, t, e);
		v(n), Array.isArray(e.value) || (A(!1), M(t === -1 ? n.rules.length - 1 : t));
	}, P = m(E);
	return /* @__PURE__ */ w(p.Provider, {
		value: t,
		children: /* @__PURE__ */ T(S, {
			"data-testid": "collection-filter",
			minW: "0",
			gap: "2xs",
			children: [
				/* @__PURE__ */ w(i, {
					content: "Filter",
					children: /* @__PURE__ */ T(x, {
						ref: O,
						"aria-label": "Filter",
						variant: P ? "subtle" : "ghost",
						size: "2xs",
						onClick: () => {
							M(null), A(!k);
						},
						children: [/* @__PURE__ */ w(C, { as: r }), P || null]
					})
				}),
				/* @__PURE__ */ T(S, {
					minW: "0",
					gap: "2xs",
					overflowX: "auto",
					children: [E.rules.map((e, t) => {
						let n = D.find(({ id: t }) => t === e.attributeId);
						return /* @__PURE__ */ w(l, {
							fields: D,
							rule: e,
							options: n ? _(n) : [],
							open: j === t,
							onOpenChange: (e) => {
								M(e ? t : null), e && A(!1);
							},
							onChange: (e) => v(d(E, t, e)),
							onRemove: () => {
								M(null), v(d(E, t, void 0));
							}
						}, `${t}:${e.attributeId}`);
					}), E.groups?.map((e, t) => /* @__PURE__ */ w(s, {
						fields: D,
						group: e,
						optionsFor: _,
						onChange: (e) => v(a(E, t, e)),
						onRemove: () => v(a(E, t))
					}, t))]
				}),
				/* @__PURE__ */ w(f, {
					open: k,
					onOpenChange: A,
					anchorRef: O,
					placement: "bottom-start",
					width: "min(440px, calc(100vw - 32px))",
					padding: "0",
					testId: "filter-menu-popover",
					children: /* @__PURE__ */ w(g, {
						fields: D,
						filter: E,
						optionsFor: _,
						onSelectRule: N,
						onAddAdvanced: () => {
							A(!1), v(c(E));
						},
						onClear: () => {
							A(!1), M(null), v(h);
						}
					})
				})
			]
		})
	});
}
// packages/ui/src/components/collection-view/collection-filter.stories.tsx
function D(e) {
	let { filter: t, ...n } = e, [r, i] = b(t);
	return /* @__PURE__ */ w(E, {
		...n,
		filter: r,
		onFilterChange: i
	});
}
var O = {
	title: "Patterns/Collection View/Collection Filter",
	component: E,
	render: (e) => /* @__PURE__ */ w(D, { ...e }),
	args: {
		itemLabel: "Ticket",
		fields: v,
		optionsFor: _,
		onFilterChange: () => {},
		filter: {
			conjunction: "and",
			rules: [{
				attributeId: "status",
				condition: "is-any-of",
				value: ["backlog", "done"]
			}]
		}
	}
}, k = { play: async ({ canvasElement: r }) => {
	let i = e(r), a = e(r.ownerDocument.body);
	await t.click(i.getByRole("button", {
		name: "Filter",
		exact: !0
	})), await n(await a.findByTestId("filter-menu")).toBeVisible(), await t.click(i.getByRole("button", {
		name: "Filter",
		exact: !0
	})), await n(a.queryByTestId("filter-menu")).not.toBeInTheDocument(), await t.click(i.getByRole("button", { name: "Remove Status filter" })), await n(i.queryByRole("group", { name: "Status filter" })).not.toBeInTheDocument();
} }, A = { args: { filter: {
	conjunction: "and",
	rules: []
} } }, j = { args: { filter: {
	conjunction: "and",
	rules: [],
	groups: [{
		conjunction: "or",
		rules: [{
			attributeId: "status",
			condition: "is-any-of",
			value: ["done"]
		}, {
			attributeId: "priority",
			condition: "is-any-of",
			value: ["low"]
		}]
	}]
} } };
export { j as Advanced, A as Empty, k as InlineCriteria, O as default };

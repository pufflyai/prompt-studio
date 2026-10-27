// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./list-filter-BPOkFpgD.ts";
import { t } from "./x-DqEAa6-d.ts";
import { i as n } from "./collection-view-fields-D15M65ck.ts";
import { r, s as i, t as a } from "./filter-rule-value-y7_Oj9HU.ts";
import { i as o, t as s } from "./view-filter-rule-editor-DGTvv4jU.ts";
import { i as c, r as l } from "./collection-view-labels-C1iICfrD.ts";
import { t as u } from "./advanced-filter-menu-UCArv6yB.ts";
import { useRef as d, useState as f } from "react";
import { Button as p, HStack as m, Icon as h, IconButton as g, Text as _ } from "@chakra-ui/react";
import { Fragment as v, jsx as y, jsxs as b } from "react/jsx-runtime";
import { normalizeBooleanViewRule as x } from "@pstdio/sdk/extensions";
// packages/ui/src/components/collection-view/advanced-filter.ts
var S = (e) => e.conjunction === "or" ? {
	conjunction: "and",
	rules: [],
	groups: [{
		conjunction: "or",
		rules: e.rules
	}]
} : e, C = (e, t, n) => {
	let r = e.groups ?? [], i = n === void 0 ? r.filter((e, n) => n !== t) : r.map((e, r) => r === t ? n : e), { groups: a, ...o } = e;
	return i.length ? {
		...o,
		groups: i
	} : o;
}, w = (e) => ({
	...e,
	groups: [...e.groups ?? [], {
		conjunction: "and",
		rules: []
	}]
}), T = (i) => {
	let { group: a, fields: s, optionsFor: _, onChange: v, onRemove: x } = i, [S, C] = f(a.rules.length === 0), w = d(null), T = o(), E = a.rules.map((e) => {
		let t = n(s, e.attributeId);
		return [
			t?.type.kind === "boolean" && typeof e.value == "boolean" ? T : t?.label ?? e.attributeId,
			l(e, t),
			c(e, t)
		].filter(Boolean).join(" ");
	}).join(a.conjunction === "and" ? " and " : " or ");
	return /* @__PURE__ */ b(m, {
		role: "group",
		"aria-label": "Advanced filter",
		layerStyle: "filterPill",
		gap: "0",
		flexShrink: 0,
		children: [
			/* @__PURE__ */ b(p, {
				ref: w,
				"aria-label": "Edit advanced filter",
				variant: "filter-segment",
				size: "2xs",
				onClick: () => C(!S),
				children: [/* @__PURE__ */ y(h, { as: e }), E || "Advanced filter"]
			}),
			/* @__PURE__ */ y(g, {
				"aria-label": "Remove advanced filter",
				variant: "ghost",
				size: "2xs",
				onClick: x,
				children: /* @__PURE__ */ y(h, { as: t })
			}),
			/* @__PURE__ */ y(r, {
				open: S,
				onOpenChange: C,
				anchorRef: w,
				width: "40rem",
				testId: "advanced-filter-popover",
				children: /* @__PURE__ */ y(u, {
					fields: s,
					filter: a,
					optionsFor: _,
					onChange: v
				})
			})
		]
	});
}, E = (e) => {
	let { fields: r, rule: c, options: l, open: u, onOpenChange: d, onChange: f, onRemove: p } = e, S = n(r, c.attributeId), C = S ? x(c, S.type) : c, w = o(), T = S?.label ?? C.attributeId, E = S?.type.kind === "boolean";
	return /* @__PURE__ */ b(m, {
		role: "group",
		"aria-label": `${T} filter`,
		layerStyle: "filterPill",
		gap: "0",
		flexShrink: 0,
		children: [
			/* @__PURE__ */ y(_, {
				as: "span",
				textStyle: "label/XS",
				layerStyle: "filterLabel",
				alignItems: "center",
				flexShrink: "0",
				children: E && typeof C.value == "boolean" ? w : T
			}),
			S ? /* @__PURE__ */ b(v, { children: [/* @__PURE__ */ y(s, {
				field: S,
				rule: C,
				variant: "filter-condition",
				onChange: f,
				open: E ? u : void 0,
				onOpenChange: E ? d : void 0
			}), /* @__PURE__ */ y(a, {
				field: S,
				rule: C,
				options: l,
				variant: "filter-segment",
				open: u,
				onOpenChange: d,
				onChange: (e) => f(i(S, C, e))
			})] }) : /* @__PURE__ */ y(_, {
				textStyle: "label/XS",
				children: "Unavailable field"
			}),
			/* @__PURE__ */ y(g, {
				"aria-label": `Remove ${T} filter`,
				variant: "ghost",
				size: "2xs",
				onClick: p,
				children: /* @__PURE__ */ y(h, { as: t })
			})
		]
	});
};
export { C as a, S as i, T as n, w as r, E as t };

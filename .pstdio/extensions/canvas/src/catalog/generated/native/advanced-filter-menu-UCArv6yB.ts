// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./plus-CYkLGSPS.ts";
import { t } from "./x-DqEAa6-d.ts";
import { i as n } from "./collection-view-fields-D15M65ck.ts";
import { a as r, c as i, l as a, o, s, t as c } from "./filter-rule-value-y7_Oj9HU.ts";
import { i as l, t as u } from "./view-filter-rule-editor-DGTvv4jU.ts";
import { t as d } from "./collection-view-field-icon-C_8hVgsS.ts";
import { o as f } from "./collection-view-labels-C1iICfrD.ts";
import { Box as p, Button as m, HStack as h, Icon as g, IconButton as _, Stack as v, Text as y } from "@chakra-ui/react";
import { Fragment as b, jsx as x, jsxs as S } from "react/jsx-runtime";
import { normalizeBooleanViewRule as C } from "@pstdio/sdk/extensions";
// packages/ui/src/components/collection-view/filter-rule-row.tsx
var w = (e) => {
	let { index: t, conjunction: n, onConjunctionChange: r } = e;
	return t === 1 && r ? /* @__PURE__ */ x(f, {
		"aria-label": "Conjunction",
		width: "3.75rem",
		options: [{
			value: "and",
			label: "And"
		}, {
			value: "or",
			label: "Or"
		}],
		value: n,
		onSelect: (e) => r(e)
	}) : /* @__PURE__ */ x(y, {
		width: "3.75rem",
		flexShrink: 0,
		paddingX: "xs",
		textStyle: "label/S/regular",
		color: "fg.muted",
		children: t === 0 ? "Where" : n === "and" ? "And" : "Or"
	});
}, T = (e) => {
	let { fields: r, rule: i, optionsFor: a, onChange: p, onDelete: m } = e, v = n(r, i.attributeId), T = v ? C(i, v.type) : i, E = l();
	return /* @__PURE__ */ S(h, {
		"data-testid": "filter-rule-row",
		gap: "xs",
		minH: "1.75rem",
		minW: "0",
		children: [
			/* @__PURE__ */ x(w, { ...e }),
			/* @__PURE__ */ x(f, {
				"aria-label": "Field",
				width: "8.75rem",
				showSearch: !0,
				options: r.map((e) => ({
					value: e.id,
					label: e.label,
					icon: d(e)
				})),
				showSelectedIcon: !1,
				selectedLabel: v?.type.kind === "boolean" && typeof T.value == "boolean" ? E : void 0,
				value: T.attributeId,
				onSelect: (e) => {
					let t = n(r, e);
					t && e !== T.attributeId && p(o(t));
				}
			}),
			v ? /* @__PURE__ */ S(b, { children: [/* @__PURE__ */ x(u, {
				field: v,
				rule: T,
				width: "7.5rem",
				onChange: p
			}), /* @__PURE__ */ x(c, {
				field: v,
				rule: T,
				options: a(v),
				onChange: (e) => p(s(v, T, e))
			})] }) : /* @__PURE__ */ x(y, {
				textStyle: "label/S/regular",
				color: "fg.muted",
				children: "This field is no longer available"
			}),
			/* @__PURE__ */ x(h, { flex: "1" }),
			/* @__PURE__ */ x(_, {
				"aria-label": "Remove filter",
				variant: "ghost",
				size: "2xs",
				flexShrink: 0,
				onClick: m,
				children: /* @__PURE__ */ x(g, { as: t })
			})
		]
	});
}, E = (t) => {
	let { fields: n, filter: s, optionsFor: c, onChange: l } = t, u = n[0];
	return /* @__PURE__ */ S(v, {
		"data-testid": "advanced-filter-menu",
		gap: "2xs",
		minW: "0",
		children: [
			/* @__PURE__ */ S(v, {
				gap: "2xs",
				paddingX: "xs",
				children: [s.rules.map((e, t) => /* @__PURE__ */ x(T, {
					index: t,
					conjunction: s.conjunction,
					onConjunctionChange: (e) => l(i(s, e)),
					fields: n,
					rule: e,
					optionsFor: c,
					onChange: (e) => l(a(s, t, e)),
					onDelete: () => l(a(s, t, void 0))
				}, `${t}:${e.attributeId}`)), s.rules.length === 0 ? /* @__PURE__ */ x(y, {
					textStyle: "label/S/regular",
					color: "fg.muted",
					paddingY: "xs",
					children: "No filter rules. Add one to narrow this view."
				}) : null]
			}),
			/* @__PURE__ */ x(p, {
				borderTopWidth: "1px",
				borderColor: "border.subtle"
			}),
			/* @__PURE__ */ x(h, {
				gap: "2xs",
				paddingX: "2xs",
				paddingBottom: "2xs",
				children: u ? /* @__PURE__ */ S(m, {
					size: "2xs",
					variant: "ghost",
					onClick: () => l(r(s, o(u))),
					children: [/* @__PURE__ */ x(e, {}), "Add filter rule"]
				}) : null
			})
		]
	});
};
export { E as t };

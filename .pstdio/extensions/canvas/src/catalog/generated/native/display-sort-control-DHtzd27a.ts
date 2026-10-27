// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { i as e, n as t } from "./collection-view-fields-D15M65ck.ts";
import { t as n } from "./collection-view-field-icon-C_8hVgsS.ts";
import { a as r, o as i } from "./collection-view-labels-C1iICfrD.ts";
import { HStack as a, Stack as o, Text as s } from "@chakra-ui/react";
import { jsx as c, jsxs as l } from "react/jsx-runtime";
// packages/ui/src/components/collection-view/display-sort-control.tsx
var u = (u) => {
	let { fields: d, sorts: f, onSortsChange: p } = u, m = f[0], h = m ? e(d, m.attributeId) : void 0;
	return /* @__PURE__ */ l(o, {
		"data-testid": "display-sort-control",
		gap: "1px",
		children: [/* @__PURE__ */ l(a, {
			paddingX: "xs",
			minH: "7",
			gap: "xs",
			children: [/* @__PURE__ */ c(s, {
				textStyle: "label/S/regular",
				flex: "1",
				children: "Ordering"
			}), /* @__PURE__ */ c(i, {
				"aria-label": "Ordering",
				width: "9rem",
				value: m ? `field:${m.attributeId}` : "none",
				options: [{
					value: "none",
					label: "None"
				}, ...d.filter(t).map((e) => ({
					value: `field:${e.id}`,
					label: e.label,
					icon: n(e)
				}))],
				onSelect: (e) => p(e === "none" ? [] : [{
					attributeId: e.slice(6),
					direction: m?.direction ?? "asc"
				}])
			})]
		}), m ? /* @__PURE__ */ l(a, {
			paddingX: "xs",
			minH: "7",
			gap: "xs",
			children: [/* @__PURE__ */ c(s, {
				textStyle: "label/S/regular",
				flex: "1",
				children: "Direction"
			}), /* @__PURE__ */ c(i, {
				"aria-label": "Sort direction",
				width: "9rem",
				value: m.direction,
				options: [{
					value: "asc",
					label: r(h, "asc")
				}, {
					value: "desc",
					label: r(h, "desc")
				}],
				onSelect: (e) => p([{
					...m,
					direction: e
				}])
			})]
		}) : null]
	});
};
export { u as t };

// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { HStack as e, Stack as t, Text as n } from "@chakra-ui/react";
import { jsx as r, jsxs as i } from "react/jsx-runtime";
// packages/ui/src/components/primitives/info-card.tsx
var a = (a) => {
	let { title: o, description: s, infoItems: c = [], actions: l, badge: u } = a, d = c.length > 0, f = l ? Array.isArray(l) ? l : [l] : null;
	return /* @__PURE__ */ i(t, {
		gap: "xs",
		children: [/* @__PURE__ */ i(e, {
			alignItems: "flex-start",
			justifyContent: "space-between",
			gap: "md",
			children: [/* @__PURE__ */ i(t, {
				flex: "1",
				minW: "0",
				children: [/* @__PURE__ */ i(e, {
					gap: "2",
					children: [u, /* @__PURE__ */ r(n, {
						textStyle: "heading/M",
						children: o
					})]
				}), /* @__PURE__ */ r(n, {
					textStyle: "paragraph/S/regular",
					color: "fg.muted",
					children: s
				})]
			}), f ? /* @__PURE__ */ r(e, {
				gap: "xs",
				alignItems: "center",
				children: f.map((e, n) => /* @__PURE__ */ r(t, {
					gap: "0",
					children: e
				}, `info-card-action-${n}`))
			}) : null]
		}), d ? /* @__PURE__ */ r(e, {
			gap: "lg",
			mt: "sm",
			flexWrap: "wrap",
			children: c.map((e, a) => /* @__PURE__ */ i(t, {
				gap: "2px",
				children: [/* @__PURE__ */ r(n, {
					textStyle: "label/S/medium",
					color: "fg.muted",
					children: e.label
				}), typeof e.value == "string" ? /* @__PURE__ */ r(n, {
					textStyle: "paragraph/S/regular",
					children: e.value
				}) : e.value]
			}, `info-item-${a}`))
		}) : null]
	});
};
export { a as t };

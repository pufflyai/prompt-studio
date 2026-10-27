// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import * as e from "react";
import { EmptyState as t, VStack as n } from "@chakra-ui/react";
import { jsx as r, jsxs as i } from "react/jsx-runtime";
// packages/ui/src/components/primitives/empty-state.tsx
var a = e.forwardRef(function(e, a) {
	let { title: o, description: s, icon: c, children: l, ...u } = e;
	return /* @__PURE__ */ r(t.Root, {
		ref: a,
		...u,
		children: /* @__PURE__ */ i(t.Content, { children: [
			c && /* @__PURE__ */ r(t.Indicator, { children: c }),
			s ? /* @__PURE__ */ i(n, {
				textAlign: "center",
				children: [/* @__PURE__ */ r(t.Title, {
					fontWeight: "normal",
					children: o
				}), /* @__PURE__ */ r(t.Description, { children: s })]
			}) : /* @__PURE__ */ r(t.Title, {
				fontWeight: "normal",
				children: o
			}),
			l
		] })
	});
});
export { a as t };

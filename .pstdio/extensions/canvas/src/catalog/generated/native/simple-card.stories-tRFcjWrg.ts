// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./terminal-B2gAfUK-.ts";
import { n as t, t as n } from "./simple-card-OilaHrM-.ts";
import { HStack as r, Text as i } from "@chakra-ui/react";
import { jsx as a, jsxs as o } from "react/jsx-runtime";
// packages/ui/src/components/primitives/simple-card.stories.tsx
var s = {
	title: "Primitives/SimpleCard",
	component: n
}, c = { render: () => /* @__PURE__ */ a(n, { children: /* @__PURE__ */ a(t, { children: "Card body" }) }) }, l = {
	parameters: { docs: { description: { story: "Hover and pressed feedback changes immediately, including when the pointer leaves." } } },
	render: () => /* @__PURE__ */ a(n, {
		variant: "action",
		asChild: !0,
		children: /* @__PURE__ */ a("button", {
			type: "button",
			children: /* @__PURE__ */ a(t, { children: /* @__PURE__ */ o(r, {
				gap: "xs",
				children: [/* @__PURE__ */ a(e, { size: 14 }), /* @__PURE__ */ a(i, {
					textStyle: "label/M/regular",
					children: "Terminal"
				})]
			}) })
		})
	})
};
export { l as Action, c as Outline, s as default };

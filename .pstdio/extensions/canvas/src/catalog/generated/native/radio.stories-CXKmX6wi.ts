// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e, t } from "./radio-BKAZ8M9R.ts";
import { Stack as n } from "@chakra-ui/react";
import { jsx as r, jsxs as i } from "react/jsx-runtime";
// packages/ui/src/components/primitives/radio.stories.tsx
var a = {
	title: "Components/Inputs/Radio",
	component: t,
	decorators: [(t) => /* @__PURE__ */ r("div", {
		style: {
			padding: "24px",
			width: "320px"
		},
		children: /* @__PURE__ */ r(e, {
			defaultValue: "selected",
			children: /* @__PURE__ */ r(t, {})
		})
	})]
}, o = { args: {
	value: "selected",
	children: "Use project template"
} }, s = { args: {
	value: "disabled",
	disabled: !0,
	children: "Unavailable"
} }, c = {
	args: { value: "selected" },
	render: () => /* @__PURE__ */ i(n, {
		gap: "sm",
		children: [
			/* @__PURE__ */ r(t, {
				value: "selected",
				children: "TypeScript"
			}),
			/* @__PURE__ */ r(t, {
				value: "python",
				children: "Python"
			}),
			/* @__PURE__ */ r(t, {
				value: "go",
				children: "Go"
			})
		]
	})
};
export { s as Disabled, c as Options, o as WithLabel, a as default };

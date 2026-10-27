// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./checkbox-C3JJ0TWQ.ts";
import { Stack as t } from "@chakra-ui/react";
import { jsx as n, jsxs as r } from "react/jsx-runtime";
// packages/ui/src/components/primitives/checkbox.stories.tsx
var i = {
	title: "Components/Inputs/Checkbox",
	component: e,
	decorators: [(e) => /* @__PURE__ */ n("div", {
		style: {
			padding: "24px",
			width: "320px"
		},
		children: /* @__PURE__ */ n(e, {})
	})]
}, a = {}, o = { args: { defaultChecked: !0 } }, s = { args: { children: "Enable project template" } }, c = { args: {
	disabled: !0,
	children: "Unavailable"
} }, l = { args: {
	disabled: !0,
	defaultChecked: !0,
	children: "Locked on"
} }, u = { render: () => /* @__PURE__ */ r(t, {
	gap: "md",
	children: [
		/* @__PURE__ */ n(e, {
			size: "sm",
			children: "Small"
		}),
		/* @__PURE__ */ n(e, {
			size: "md",
			children: "Medium"
		}),
		/* @__PURE__ */ n(e, {
			size: "lg",
			children: "Large"
		})
	]
}) };
export { a as Default, o as DefaultChecked, c as Disabled, l as DisabledChecked, u as Sizes, s as WithLabel, i as default };

// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./switch-CVOnzlSE.ts";
import { Stack as t, Text as n } from "@chakra-ui/react";
import { jsx as r, jsxs as i } from "react/jsx-runtime";
// packages/ui/src/components/primitives/switch.stories.tsx
var a = {
	title: "Components/Inputs/Switch",
	component: e,
	decorators: [(e) => /* @__PURE__ */ r("div", {
		style: {
			padding: "24px",
			width: "320px"
		},
		children: /* @__PURE__ */ r(e, {})
	})]
}, o = {}, s = { args: { defaultChecked: !0 } }, c = { args: {
	size: "xs",
	defaultChecked: !0,
	children: "Preserve context"
} }, l = { args: { children: "Enable notifications" } }, u = { args: {
	disabled: !0,
	children: "Unavailable"
} }, d = { args: {
	disabled: !0,
	defaultChecked: !0,
	children: "Locked on"
} }, f = { render: () => /* @__PURE__ */ i(t, {
	gap: "md",
	children: [
		/* @__PURE__ */ r(e, {
			size: "sm",
			children: "Small"
		}),
		/* @__PURE__ */ r(e, {
			size: "md",
			children: "Medium"
		}),
		/* @__PURE__ */ r(e, {
			size: "lg",
			children: "Large"
		})
	]
}) }, p = { args: {
	trackLabel: {
		on: /* @__PURE__ */ r(n, {
			fontSize: "2xs",
			children: "ON"
		}),
		off: /* @__PURE__ */ r(n, {
			fontSize: "2xs",
			children: "OFF"
		})
	},
	size: "lg"
} };
export { c as CompactParameterToggle, o as Default, s as DefaultChecked, u as Disabled, d as DisabledChecked, f as Sizes, l as WithLabel, p as WithTrackLabel, a as default };

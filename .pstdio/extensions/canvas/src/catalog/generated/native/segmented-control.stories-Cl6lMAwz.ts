// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, p as t, r as n } from "./test-whhQHjQi.ts";
import { t as r } from "./segmented-control-DSBHC0XI.ts";
import { useState as i } from "react";
import { Box as a, Stack as o } from "@chakra-ui/react";
import { jsx as s, jsxs as c } from "react/jsx-runtime";
// packages/ui/src/components/primitives/segmented-control.stories.tsx
var l = [{
	value: "single_select",
	label: "Single"
}, {
	value: "multi_select",
	label: "Multiple"
}], u = {
	title: "Components/Inputs/Segmented Control",
	component: r,
	decorators: [(e) => /* @__PURE__ */ s(a, {
		padding: "lg",
		background: "bg",
		children: /* @__PURE__ */ s(e, {})
	})]
}, d = { render: () => {
	let [e, t] = i("single_select");
	return /* @__PURE__ */ s(r, {
		options: l,
		value: e,
		onValueChange: t,
		"aria-label": "Selection mode"
	});
} }, f = {
	render: () => {
		let [e, t] = i("single_select");
		return /* @__PURE__ */ s(r, {
			options: l,
			value: e,
			onValueChange: t,
			"aria-label": "Selection mode"
		});
	},
	play: async ({ canvasElement: r }) => {
		let i = e(r).getByRole("button", { name: "Multiple" });
		await t.click(i), await n(i).toHaveAttribute("aria-pressed", "true");
	}
}, p = { render: () => {
	let [e, t] = i("multi_select");
	return /* @__PURE__ */ c(o, {
		gap: "sm",
		alignItems: "flex-start",
		children: [/* @__PURE__ */ s(r, {
			size: "sm",
			options: l,
			value: e,
			onValueChange: t
		}), /* @__PURE__ */ s(r, {
			size: "xs",
			options: l,
			value: e,
			onValueChange: t
		})]
	});
} }, m = { render: () => /* @__PURE__ */ s(r, {
	options: l,
	value: "single_select",
	disabled: !0,
	onValueChange: () => void 0
}) };
export { d as Default, m as Disabled, p as Sizes, f as Toggle, u as default };

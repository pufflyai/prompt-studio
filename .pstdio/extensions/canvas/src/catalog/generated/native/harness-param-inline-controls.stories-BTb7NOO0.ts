// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e, o as t, s as n, t as r } from "./test-CYwQ_LKY.ts";
import { t as i } from "./harness-param-inline-controls-CDlURer7.ts";
import { useState as a } from "react";
import { Flex as o } from "@chakra-ui/react";
import { jsx as s } from "react/jsx-runtime";
// packages/pstdio-dashboard/src/modules/sessions/components/harness-param-inline-controls.stories.tsx
var c = {
	title: "Sessions/Harness Inline Controls",
	component: i,
	args: {
		schema: { effort: {
			type: "select",
			label: "Reasoning effort",
			defaultValue: "medium",
			options: [
				{
					label: "None",
					value: "none",
					icon: "CircleSlash"
				},
				{
					label: "Minimal",
					value: "minimal",
					icon: "level-low"
				},
				{
					label: "Low",
					value: "low",
					icon: "level-low"
				},
				{
					label: "Medium",
					value: "medium",
					icon: "level-mid"
				},
				{
					label: "High",
					value: "high",
					icon: "level-high"
				},
				{
					label: "Extra high",
					value: "xhigh",
					icon: "level-xhigh"
				},
				{
					label: "Max",
					value: "max",
					icon: "flame"
				},
				{
					label: "Ultra",
					value: "ultra",
					icon: "flame"
				}
			]
		} },
		overrides: {},
		onOverridesChange: () => {}
	},
	render: (e) => {
		let [t, n] = a(e.overrides);
		return /* @__PURE__ */ s(i, {
			...e,
			overrides: t,
			onOverridesChange: n
		});
	}
}, l = {}, u = { args: { schema: { service_tier: {
	type: "select",
	label: "Speed",
	description: "Fast mode uses more of your Codex allowance.",
	defaultValue: "default",
	options: [{
		label: "Standard",
		value: "default",
		icon: "Snail"
	}, {
		label: "Fast",
		value: "fast",
		icon: "Zap"
	}]
} } } }, d = { args: { overrides: { effort: "high" } } }, f = {
	args: { schema: { enabled: {
		type: "boolean",
		label: "Enabled",
		description: "Enable this harness option.",
		defaultValue: !1
	} } },
	play: async ({ canvasElement: t }) => {
		let i = n(t), a = n(t.ownerDocument.body);
		await e.click(i.getByRole("button", { name: "Enabled: off" }));
		let o = i.getByRole("button", { name: "Enabled: on" });
		await e.hover(o), await r(await a.findByRole("tooltip")).toHaveTextContent("Enabled"), await e.unhover(o);
	}
}, p = { play: async ({ canvasElement: t }) => {
	let i = n(t), a = n(t.ownerDocument.body), o = i.getByRole("button", { name: "Reasoning effort: Medium" });
	await e.hover(o), await r(await a.findByRole("tooltip")).toHaveTextContent("Reasoning effort"), await e.click(o), await e.click(a.getByRole("menuitemradio", { name: "Extra high" }));
	let s = i.getByRole("button", { name: "Reasoning effort: Extra high" });
	await e.hover(s), await r(await a.findByRole("tooltip")).toHaveTextContent("Reasoning effort"), await e.unhover(s);
} }, m = { args: { schema: {
	...c.args.schema,
	collaboration: {
		type: "select",
		control: "command",
		defaultValue: "plan",
		options: [{
			label: "Default",
			value: "default"
		}, {
			label: "Plan",
			value: "plan"
		}]
	}
} } }, h = { render: (e) => /* @__PURE__ */ s(o, {
	gap: "4",
	wrap: "wrap",
	children: c.args.schema.effort.options.map((t) => /* @__PURE__ */ s(i, {
		...e,
		overrides: { effort: t.value }
	}, t.value))
}) }, g = { play: async ({ canvasElement: t }) => {
	let i = n(t), a = n(t.ownerDocument.body);
	await e.click(i.getByRole("button", { name: "Reasoning effort: Medium" })), await e.click(a.getByRole("menuitemradio", { name: "Extra high" })), await r(i.getByRole("button", { name: "Reasoning effort: Extra high" })).toBeVisible(), await e.click(i.getByRole("button", { name: "Reasoning effort: Extra high" })), await r(a.getByRole("menuitemradio", { name: "Extra high" })).toHaveAttribute("aria-checked", "true"), await e.click(a.getByRole("menuitemradio", { name: "Medium" })), await r(i.getByRole("button", { name: "Reasoning effort: Medium" })).toBeVisible();
} }, _ = { play: async ({ canvasElement: i }) => {
	let a = n(i), o = n(i.ownerDocument.body);
	a.getByRole("button", { name: "Reasoning effort: Medium" }).focus(), await e.keyboard("{ArrowDown}"), await t(() => r(o.getByRole("menu")).toHaveFocus()), await e.keyboard("{End}{Enter}"), await r(a.getByRole("button", { name: "Reasoning effort: Ultra" })).toBeVisible();
} }, v = { args: { disabled: !0 } };
export { f as BooleanControl, g as ChangeEffort, _ as ChangeEffortWithKeyboard, m as CommandOwnedPlan, v as Disabled, l as EffortLevels, h as LevelColors, d as RememberedEffort, u as Speed, p as Tooltips, c as default };

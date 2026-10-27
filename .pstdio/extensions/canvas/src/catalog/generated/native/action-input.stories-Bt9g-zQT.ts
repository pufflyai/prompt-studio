// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e, h as t, p as n, r } from "./test-whhQHjQi.ts";
import { t as i } from "./action-input-C37MJkHd.ts";
// packages/ui/src/components/param-editor/inputs/action-input.stories.tsx
var a = {
	id: "run",
	name: "Run"
}, o = {
	title: "Patterns/Param Editor/Actions",
	component: i,
	args: {
		id: "action",
		name: "Action",
		defaultValue: "run",
		options: [a],
		presentation: "horizontal",
		onChange: e()
	}
}, s = { play: async ({ canvasElement: e, args: i }) => {
	let a = t(e), o = t(e.ownerDocument.body);
	for (let e = 1; e <= 2; e++) await n.click(a.getByRole("button", { name: "Run" })), await n.click(o.getByRole("menuitemradio", { name: "Run" })), await r(i.onChange).toHaveBeenCalledTimes(e), await r(i.onChange).toHaveBeenLastCalledWith("action", "run");
} }, c = {
	args: { options: [a, {
		id: "stop",
		name: "Stop",
		disabled: !0
	}] },
	play: s.play
}, l = {
	args: { readOnly: !0 },
	play: async ({ canvasElement: e }) => {
		await r(t(e).getByRole("button", { name: "Run" })).toBeDisabled();
	}
}, u = {
	args: { options: [{
		...a,
		disabled: !0
	}] },
	play: l.play
};
export { u as NoEnabledActions, c as OnlyActiveActionEnabled, l as ReadOnly, s as RepeatSelectedAction, o as default };

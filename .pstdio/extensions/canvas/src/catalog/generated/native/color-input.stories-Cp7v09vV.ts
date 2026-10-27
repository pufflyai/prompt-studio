// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { m as e, p as t, r as n } from "./test-whhQHjQi.ts";
import { t as r } from "./color-input-CUqRZDIf.ts";
import { Box as i, Container as a } from "@chakra-ui/react";
import { jsx as o, jsxs as s } from "react/jsx-runtime";
// packages/ui/src/components/param-editor/inputs/color-input.stories.tsx
var c = {
	title: "Components/Inputs/Param Editor/Color Input",
	component: r,
	parameters: { layout: "fullscreen" }
}, l = {
	tags: ["param-editor-color-input"],
	render: (e) => /* @__PURE__ */ s(a, {
		padding: "md",
		children: [/* @__PURE__ */ o(r, { ...e }), /* @__PURE__ */ o(i, {
			as: "button",
			type: "button",
			mt: "md",
			children: "Next field"
		})]
	}),
	play: async ({ canvasElement: r }) => {
		let i = r.querySelector("[data-scope='color-picker'][data-part='trigger']"), a = r.querySelector("[data-scope='color-picker'][data-part='channel-input']"), o = r.ownerDocument.querySelector("[data-scope='color-picker'][data-part='content']");
		if (!i || !a || !o) throw Error("Color picker story controls were not rendered.");
		await t.click(i), await e(() => n(o).toBeVisible()), await t.click(a), await e(() => n(o).not.toBeVisible());
	},
	args: {
		id: "theme-color",
		defaultValue: "#ff0000",
		name: "Theme Color",
		description: "Pick a theme color",
		onChange: () => {}
	}
};
export { l as ClosesOnBlur, c as default };

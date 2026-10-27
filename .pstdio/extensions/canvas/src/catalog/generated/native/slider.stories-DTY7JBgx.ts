// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { r as e } from "./test-whhQHjQi.ts";
import { t } from "./slider-D0nsFAm5.ts";
import { jsx as n } from "react/jsx-runtime";
// packages/ui/src/components/primitives/slider.stories.tsx
var r = {
	title: "Components/Inputs/Slider",
	component: t,
	args: {
		min: 0,
		max: 100,
		defaultValue: [40]
	},
	decorators: [(e) => /* @__PURE__ */ n("div", {
		style: {
			padding: "24px",
			width: "320px"
		},
		children: /* @__PURE__ */ n(e, {})
	})]
}, i = { play: async ({ canvasElement: t }) => {
	let n = t.querySelector("[data-scope=\"slider\"][data-part=\"track\"]"), r = t.querySelector("[data-scope=\"slider\"][data-part=\"thumb\"]");
	await e(n).not.toBeNull(), await e(r).not.toBeNull(), n && r && (await e(getComputedStyle(n).borderRadius).toBe("0px"), await e(getComputedStyle(r).borderRadius).toBe("4px"), await e(getComputedStyle(r).width).toBe("10px"));
} };
export { i as SquareTrack, r as default };

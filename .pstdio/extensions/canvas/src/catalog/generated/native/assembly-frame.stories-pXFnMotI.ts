// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e } from "./use-landing-styles-CQWLl3TI.ts";
import { n as t, t as n } from "./assembly-frame-CwnHoQw-.ts";
import { Box as r } from "@chakra-ui/react";
import { jsx as i, jsxs as a } from "react/jsx-runtime";
// clients/landing-page/src/components/shapes/assembly-frame.stories.tsx
var o = {
	title: "Landing/Initial Editor Frame",
	component: n,
	parameters: { layout: "fullscreen" },
	decorators: [(n) => {
		let o = e();
		return /* @__PURE__ */ i(r, {
			width: "full",
			maxWidth: "6xl",
			height: "48rem",
			children: /* @__PURE__ */ i(r, {
				css: o.hero,
				children: /* @__PURE__ */ a(r, {
					css: o.heroLayout,
					"data-assembly-area": "",
					children: [/* @__PURE__ */ i(t, { headingLevel: "h1" }), /* @__PURE__ */ i(r, {
						css: o.cardSpace,
						children: /* @__PURE__ */ i(n, {})
					})]
				})
			})
		});
	}]
}, s = {}, c = {
	parameters: { docs: { description: { story: "Narrow editors use 95% of the fitted space, aligning with the mobile copy." } } },
	decorators: [(e) => /* @__PURE__ */ i(r, {
		width: "80",
		children: /* @__PURE__ */ i(e, {})
	})]
};
export { s as BeforeJavaScript, c as Narrow, o as default };

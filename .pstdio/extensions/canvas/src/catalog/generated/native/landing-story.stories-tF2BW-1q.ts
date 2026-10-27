// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { ExamplesView as e } from "./examples-view-BFuSkg3v.ts";
import { WhatIsPromptStudioView as t } from "./what-is-prompt-studio-view-CPuMWmPK.ts";
import { useState as n } from "react";
import { Box as r } from "@chakra-ui/react";
import { jsx as i } from "react/jsx-runtime";
// clients/landing-page/src/theme/recipes/landing-story.stories.tsx
var a = () => {
	let [t, r] = n("agents");
	return /* @__PURE__ */ i(e, {
		exampleId: t,
		onNavigate: r
	});
}, o = {
	title: "Theme/Landing Chapters",
	component: t,
	parameters: { layout: "fullscreen" },
	decorators: [(e) => /* @__PURE__ */ i(r, {
		height: "100dvh",
		children: /* @__PURE__ */ i(e, {})
	})]
}, s = { parameters: { docs: { description: { story: "Chapters advance every eight seconds without transition animations. A compact tab row sits above the bounded chapter scroll area. Hover or focus holds the current chapter. Tabs have no numbered stepper or playback controls." } } } }, c = { render: () => /* @__PURE__ */ i(a, {}) }, l = { decorators: [(e) => /* @__PURE__ */ i(r, {
	width: "80",
	height: "full",
	children: /* @__PURE__ */ i(e, {})
})] }, u = {
	...l,
	render: () => /* @__PURE__ */ i(a, {})
}, d = { decorators: [(e) => /* @__PURE__ */ i(r, {
	height: "28rem",
	children: /* @__PURE__ */ i(e, {})
})] };
export { c as Examples, l as NarrowChapters, u as NarrowExamples, d as ShortViewport, s as WhatIsPromptStudio, o as default };

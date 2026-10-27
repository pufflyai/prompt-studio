// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./theme-preferences-Bi1xFDtm.ts";
import { Box as t, Grid as n, Stack as r, Text as i } from "@chakra-ui/react";
import { jsx as a, jsxs as o } from "react/jsx-runtime";
// extensions/pstdio-base-themes/stories/compare.stories.tsx
var s = {
	all: 4700,
	foundations: 650,
	buttons: 780,
	inputs: 850,
	navigation: 650,
	feedback: 1050,
	overlays: 650,
	composed: 1100
};
function c(c) {
	let { section: l } = c;
	return /* @__PURE__ */ o(r, {
		p: "md",
		gap: "md",
		children: [
			/* @__PURE__ */ a(i, {
				as: "h1",
				textStyle: "heading/M",
				children: "Extra themes — core components"
			}),
			/* @__PURE__ */ a(i, {
				textStyle: "paragraph/S/regular",
				color: "fg.muted",
				children: "The same components and states in every theme. Scroll horizontally on smaller screens. Each column has its own document so menus, dialogs and keyboard focus use the real theme."
			}),
			/* @__PURE__ */ a(t, {
				overflowX: "auto",
				children: /* @__PURE__ */ a(n, {
					templateColumns: "repeat(4, minmax(22rem, 1fr))",
					gap: "sm",
					children: e.map((e) => /* @__PURE__ */ o(r, {
						gap: "xs",
						minW: "0",
						children: [/* @__PURE__ */ a(i, {
							as: "h2",
							textStyle: "label/M/medium",
							children: e.title
						}), /* @__PURE__ */ a(t, {
							asChild: !0,
							width: "full",
							height: `${s[l]}px`,
							borderWidth: "1px",
							borderColor: "border",
							children: /* @__PURE__ */ a("iframe", {
								title: e.title,
								src: `iframe.html?id=themes-single-theme--core&viewMode=story&globals=theme:${e.id}&args=section:${l}`
							})
						})]
					}, e.id))
				})
			})
		]
	});
}
var l = {
	title: "Themes/Compare",
	component: c,
	args: { section: "all" }
}, u = {}, d = { args: { section: "foundations" } }, f = { args: { section: "buttons" } }, p = { args: { section: "inputs" } }, m = { args: { section: "navigation" } }, h = { args: { section: "feedback" } }, g = { args: { section: "overlays" } }, _ = { args: { section: "composed" } };
export { u as AllCoreComponents, f as ButtonStates, _ as ComposedControls, h as DataDisplayAndFeedback, p as FormControls, g as MenusAndOverlays, m as NavigationAndLists, d as SurfacesAndText, l as default };

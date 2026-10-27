// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./landing-assembly-DfV4OwkL.ts";
import { t } from "./assembly-cursor-BojyTSnt.ts";
import { Box as n, chakra as r, useSlotRecipe as i } from "@chakra-ui/react";
import { jsx as a, jsxs as o } from "react/jsx-runtime";
var s = {
	title: "Landing/Agent Cursors",
	component: () => {
		let s = i({ recipe: e })({});
		return /* @__PURE__ */ a(n, {
			width: "96",
			height: "24",
			children: /* @__PURE__ */ o(r.svg, {
				css: s.scene,
				"data-assembly-ready": "true",
				viewBox: "0 0 384 96",
				children: [
					/* @__PURE__ */ a(t, {
						name: "Claude",
						index: 0,
						point: {
							x: 16,
							y: 16
						}
					}),
					/* @__PURE__ */ a(t, {
						name: "Codex",
						index: 1,
						point: {
							x: 144,
							y: 16
						},
						mode: "grabbing"
					}),
					/* @__PURE__ */ a(t, {
						name: "OpenCode",
						index: 2,
						point: {
							x: 272,
							y: 16
						},
						mode: "text"
					})
				]
			})
		});
	},
	parameters: { layout: "centered" }
}, c = {}, l = { render: () => {
	let s = i({ recipe: e })({});
	return /* @__PURE__ */ a(n, {
		width: "80",
		height: "28",
		children: /* @__PURE__ */ o(r.svg, {
			css: s.scene,
			"data-assembly-ready": "true",
			viewBox: "0 0 320 112",
			children: [
				/* @__PURE__ */ a(t, {
					name: "Claude",
					index: 0,
					point: {
						x: 0,
						y: 0
					},
					mode: "chat",
					command: "$ pst shaders update --scale 16 --speed 1.2",
					result: "✓ Preview updated"
				}),
				/* @__PURE__ */ a(t, {
					name: "Codex",
					index: 1,
					point: {
						x: 0,
						y: 40
					},
					mode: "chat",
					command: "$ pst icons rename --id component --name component-glow",
					result: "✓ Icon renamed"
				}),
				/* @__PURE__ */ a(t, {
					name: "OpenCode",
					index: 2,
					point: {
						x: 0,
						y: 80
					},
					mode: "chat",
					command: "$ pst tickets update --id TOOL-18 --status \"In Progress\"",
					result: "✓ Ticket moved to In progress"
				})
			]
		})
	});
} };
export { l as CommandBubbles, c as PointerGrabAndText, s as default };

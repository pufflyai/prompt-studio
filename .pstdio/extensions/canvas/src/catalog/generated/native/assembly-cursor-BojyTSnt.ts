// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./landing-assembly-DfV4OwkL.ts";
import { Box as t, Text as n, chakra as r, useSlotRecipe as i } from "@chakra-ui/react";
import { jsx as a, jsxs as o } from "react/jsx-runtime";
// clients/landing-page/src/components/shapes/assembly-cursor.tsx
var s = (s) => {
	let { name: c, index: l, point: u, mode: d = "pointer", command: f = "", result: p = "" } = s, m = i({ recipe: e })({});
	return /* @__PURE__ */ o("g", {
		"data-assembly-cursor": l,
		"data-cursor-name": c,
		"data-cursor-mode": d,
		transform: `translate(${u.x} ${u.y})`,
		pointerEvents: "none",
		children: [
			/* @__PURE__ */ o("g", {
				"data-cursor-tip": "",
				children: [
					/* @__PURE__ */ a(r.path, {
						css: m.cursor,
						"data-agent": l,
						"data-cursor-icon": "pointer",
						d: "M1.4.3C.5-.2-.3.6.1 1.5l7.8 23.1c.4 1.1 1.9 1.2 2.4.1l4.2-9.1 9.3-3.1c1.1-.4 1.3-1.9.2-2.5Z"
					}),
					/* @__PURE__ */ a(r.path, {
						css: m.cursor,
						"data-agent": l,
						"data-cursor-icon": "grabbing",
						d: "M7 10V7a2 2 0 0 1 4 0V5a2 2 0 0 1 4 0v1a2 2 0 0 1 4 0v2a2 2 0 0 1 4 0v8c0 5-3 8-8 8h-1c-3 0-5-1-7-4l-5-7a2.4 2.4 0 0 1 3.5-3.2L7 12Z"
					}),
					/* @__PURE__ */ a(r.path, {
						css: m.cursor,
						"data-agent": l,
						"data-cursor-icon": "text",
						d: "M5 2h4l3 3 3-3h4v3h-3l-2 2v11l2 2h3v3h-4l-3-3-3 3H5v-3h3l2-2V7L8 5H5Z"
					})
				]
			}),
			/* @__PURE__ */ o("g", {
				"data-cursor-label": "",
				children: [/* @__PURE__ */ a(r.rect, {
					css: m.cursorNameplate,
					x: "18",
					y: "26",
					width: c.length * 7 + 18,
					height: "22",
					rx: "6"
				}), /* @__PURE__ */ a(r.text, {
					css: m.cursorName,
					x: "27",
					y: "41",
					children: c
				})]
			}),
			/* @__PURE__ */ a("g", {
				"data-cursor-chat": "",
				transform: "translate(12 0)",
				children: /* @__PURE__ */ a("foreignObject", {
					width: 288,
					height: 32,
					children: /* @__PURE__ */ o(t, {
						css: m.cursorChat,
						"data-agent": l,
						children: [
							/* @__PURE__ */ a(n, {
								css: m.chatName,
								children: c
							}),
							/* @__PURE__ */ a(n, {
								as: "code",
								css: m.chatCommand,
								"data-cursor-command": "",
								children: f
							}),
							/* @__PURE__ */ a(n, {
								css: m.chatResult,
								"data-cursor-result": "",
								"aria-label": p || void 0,
								children: p ? "✓" : ""
							})
						]
					})
				})
			})
		]
	});
};
export { s as t };

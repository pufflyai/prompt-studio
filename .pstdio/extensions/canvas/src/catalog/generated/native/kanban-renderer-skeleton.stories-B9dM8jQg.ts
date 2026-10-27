// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { Box as e, HStack as t, Skeleton as n, Stack as r, useSlotRecipe as i } from "@chakra-ui/react";
import { jsx as a, jsxs as o } from "react/jsx-runtime";
// packages/ui/src/components/kanban-renderer/kanban-renderer-skeleton.tsx
var s = [
	"4rem",
	"3rem",
	"5rem",
	"3.5rem"
], c = [
	["full", "7.5rem"],
	["full"],
	["full", "6rem"],
	["full", "8.75rem"]
], l = [
	"20rem",
	"15rem",
	"17.5rem",
	"12.5rem",
	"22.5rem",
	"16.25rem"
], u = (e) => /* @__PURE__ */ a(n, {
	height: "3",
	borderRadius: "xs",
	flexShrink: 0,
	...e
}), d = () => /* @__PURE__ */ o(t, {
	height: "view-bar",
	gap: "sm",
	paddingX: "xs",
	borderBottomWidth: "1px",
	borderColor: "border.subtle",
	children: [
		/* @__PURE__ */ a(u, { width: "4.5rem" }),
		/* @__PURE__ */ a(u, { width: "3.5rem" }),
		/* @__PURE__ */ a(u, { width: "4rem" })
	]
}), f = () => {
	let e = i({ key: "kanbanBoardColumn" })();
	return /* @__PURE__ */ a(t, {
		flex: "1",
		minH: "0",
		alignItems: "stretch",
		gap: "xs",
		padding: "xs",
		overflow: "hidden",
		children: s.map((i, s) => /* @__PURE__ */ o(r, {
			gap: "xs",
			css: e.root,
			borderWidth: "1px",
			borderColor: "border.subtle",
			borderRadius: "sm",
			background: "bg.subtle",
			minW: "260px",
			flex: "1 0 260px",
			children: [/* @__PURE__ */ o(t, {
				css: e.header,
				minH: "1.5rem",
				gap: "2xs",
				children: [/* @__PURE__ */ a(n, {
					boxSize: "3.5",
					borderRadius: "full"
				}), /* @__PURE__ */ a(u, { width: i })]
			}), Array.from({ length: 3 - s % 2 }, (n, i) => /* @__PURE__ */ a(r, {
				css: e.entry,
				children: /* @__PURE__ */ o(r, {
					gap: "xs",
					padding: "compact",
					borderRadius: "compact",
					borderWidth: "1px",
					borderColor: "border",
					background: "bg",
					children: [
						/* @__PURE__ */ a(u, {
							width: "2rem",
							height: "2.5"
						}),
						c[(s + i) % c.length].map((e) => /* @__PURE__ */ a(u, { width: e }, e)),
						/* @__PURE__ */ o(t, {
							gap: "2xs",
							children: [/* @__PURE__ */ a(u, {
								width: "2.75rem",
								height: "4"
							}), /* @__PURE__ */ a(u, {
								width: "1.75rem",
								height: "4"
							})]
						})
					]
				})
			}, i))]
		}, s))
	});
}, p = () => /* @__PURE__ */ a(r, {
	flex: "1",
	minH: "0",
	gap: "0",
	overflow: "hidden",
	children: Array.from({ length: 12 }, (e, r) => /* @__PURE__ */ o(t, {
		height: "collection-row",
		gap: "xs",
		paddingX: "sm",
		borderBottomWidth: "1px",
		borderColor: "border.subtle",
		children: [
			/* @__PURE__ */ a(n, {
				boxSize: "4",
				borderRadius: "full",
				flexShrink: 0
			}),
			/* @__PURE__ */ a(u, {
				width: "2rem",
				height: "2.5"
			}),
			/* @__PURE__ */ a(u, {
				width: l[r % l.length],
				maxW: "50%"
			}),
			/* @__PURE__ */ a(u, {
				width: "2.75rem",
				height: "4",
				marginLeft: "auto"
			}),
			/* @__PURE__ */ a(u, {
				width: "2.25rem",
				height: "2.5"
			})
		]
	}, r))
}), m = {
	title: "Patterns/Kanban Renderer/Loading",
	component: (e) => {
		let { viewMode: t } = e;
		return /* @__PURE__ */ o(r, {
			role: "region",
			"aria-busy": "true",
			"aria-label": "Loading",
			height: "100%",
			minH: "0",
			gap: "0",
			background: "bg",
			overflow: "hidden",
			children: [/* @__PURE__ */ a(d, {}), a(t === "board" ? f : p, {})]
		});
	},
	parameters: { layout: "fullscreen" },
	args: { viewMode: "board" },
	decorators: [(t) => /* @__PURE__ */ a(e, {
		height: "100vh",
		children: /* @__PURE__ */ a(t, {})
	})]
}, h = {}, g = { args: { viewMode: "list" } };
export { h as Board, g as List, m as default };

// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./icon-options-BaFkbkcp.ts";
import { Box as t, Button as n, Grid as r, HStack as i, Icon as a, Stack as o, Text as s } from "@chakra-ui/react";
import { jsx as c, jsxs as l } from "react/jsx-runtime";
// packages/ui/src/components/primitives/glyph-icon.stories.tsx
var u = {
	title: "Foundations/Icons/Prompt Studio Glyphs",
	decorators: [(e) => /* @__PURE__ */ c(t, {
		padding: "lg",
		background: "bg",
		children: /* @__PURE__ */ c(e, {})
	})]
}, d = [
	{
		name: "status-backlog",
		use: "Backlog — dashed ring"
	},
	{
		name: "status-todo",
		use: "Todo — open ring"
	},
	{
		name: "status-progress",
		use: "In progress — half pie"
	},
	{
		name: "status-review",
		use: "In review — three-quarter pie"
	},
	{
		name: "status-done",
		use: "Done — filled, check knocked out"
	},
	{
		name: "status-canceled",
		use: "Canceled — filled, cross knocked out"
	}
], f = [
	{
		name: "level-low",
		use: "1 of 4 bars"
	},
	{
		name: "level-mid",
		use: "2 of 4 bars"
	},
	{
		name: "level-high",
		use: "3 of 4 bars"
	},
	{
		name: "level-xhigh",
		use: "4 of 4 bars"
	}
], p = (t) => /* @__PURE__ */ c(o, {
	gap: "none",
	children: t.entries.map((t) => /* @__PURE__ */ l(i, {
		gap: "sm",
		py: "xs",
		borderBottomWidth: "1px",
		borderColor: "border.subtle",
		children: [
			/* @__PURE__ */ c(a, {
				as: e(t.name),
				boxSize: "icon-sm",
				color: "fg"
			}),
			/* @__PURE__ */ c(s, {
				textStyle: "label/S/medium",
				minWidth: "9rem",
				children: t.name
			}),
			/* @__PURE__ */ c(s, {
				textStyle: "paragraph/S/regular",
				color: "fg.muted",
				children: t.use
			})
		]
	}, t.name))
}), m = { render: () => /* @__PURE__ */ c(p, { entries: d }) }, h = { render: () => /* @__PURE__ */ c(p, { entries: f }) }, g = { render: () => /* @__PURE__ */ l(o, {
	gap: "md",
	children: [/* @__PURE__ */ c(i, {
		gap: "md",
		alignItems: "center",
		children: [
			"icon-xs",
			"icon-sm",
			"icon-md",
			"2rem",
			"3rem"
		].map((t) => /* @__PURE__ */ c(a, {
			as: e("status-review"),
			boxSize: t,
			color: "fg"
		}, t))
	}), /* @__PURE__ */ c(i, {
		gap: "md",
		alignItems: "center",
		children: [
			"fg.muted",
			"red.500",
			"orange.500",
			"green.500",
			"blue.500",
			"purple.500"
		].map((t) => /* @__PURE__ */ c(a, {
			as: e("status-done"),
			boxSize: "icon-md",
			color: t
		}, t))
	})]
}) }, _ = { render: () => {
	let t = [
		"status-todo",
		"status-done",
		"level-low",
		"level-xhigh",
		"flame",
		"bug",
		"tag"
	];
	return /* @__PURE__ */ l(o, {
		gap: "md",
		alignItems: "flex-start",
		children: [
			/* @__PURE__ */ c(i, {
				gap: "xs",
				children: t.map((t) => /* @__PURE__ */ l(n, {
					size: "sm",
					variant: "outline",
					children: [/* @__PURE__ */ c(a, {
						as: e(t),
						boxSize: "icon-xs"
					}), t]
				}, t))
			}),
			/* @__PURE__ */ c(o, {
				gap: "2xs",
				children: t.map((t) => /* @__PURE__ */ l(i, {
					gap: "xs",
					children: [/* @__PURE__ */ c(a, {
						as: e(t),
						boxSize: "icon-xs"
					}), /* @__PURE__ */ l(s, {
						textStyle: "paragraph/S/regular",
						children: ["Menu row — ", t]
					})]
				}, t))
			}),
			/* @__PURE__ */ l(s, {
				textStyle: "paragraph/S/regular",
				children: [
					"Inline with text:",
					" ",
					t.map((t) => /* @__PURE__ */ c(a, {
						as: e(t),
						boxSize: "icon-xs",
						mx: "2xs"
					}, t)),
					"end."
				]
			})
		]
	});
} }, v = { render: () => /* @__PURE__ */ c(r, {
	templateColumns: "repeat(auto-fill, minmax(9rem, 1fr))",
	gap: "sm",
	children: [...d, ...f].map((t) => /* @__PURE__ */ l(i, {
		gap: "xs",
		children: [/* @__PURE__ */ c(a, {
			as: e(t.name),
			boxSize: "icon-sm",
			color: "fg.muted"
		}), /* @__PURE__ */ c(s, {
			textStyle: "label/2XS",
			color: "fg.subtle",
			children: t.name
		})]
	}, t.name))
}) };
export { v as AllGlyphs, _ as InlineAlignment, h as LevelBars, g as SizesAndColor, m as StatusRings, u as default };

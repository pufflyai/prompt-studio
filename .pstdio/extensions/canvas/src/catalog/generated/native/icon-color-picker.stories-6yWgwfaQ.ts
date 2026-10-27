// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, p as t, r as n } from "./test-whhQHjQi.ts";
import { r } from "./icon-options-BaFkbkcp.ts";
import { n as i, t as a } from "./icon-color-picker-B4kA53R8.ts";
import { useState as o } from "react";
import { Box as s, Grid as c, Icon as l, Stack as u, Text as d } from "@chakra-ui/react";
import { jsx as f, jsxs as p } from "react/jsx-runtime";
// packages/ui/src/components/primitives/icon-color-picker.stories.tsx
var m = {
	title: "Components/Inputs/Icon Color Picker",
	component: a,
	decorators: [(e) => /* @__PURE__ */ f(s, {
		padding: "lg",
		background: "bg",
		minHeight: "480px",
		children: /* @__PURE__ */ f(e, {})
	})]
}, h = { render: () => {
	let [e, t] = o("red"), [n, r] = o("flame");
	return /* @__PURE__ */ p(u, {
		gap: "sm",
		alignItems: "flex-start",
		children: [/* @__PURE__ */ f(a, {
			color: e,
			icon: n,
			onColorChange: t,
			onIconChange: r
		}), /* @__PURE__ */ p(d, {
			textStyle: "paragraph/S/regular",
			color: "fg.muted",
			children: [
				e,
				" · ",
				n ?? "none"
			]
		})]
	});
} }, g = { render: () => {
	let [e, t] = o("green");
	return /* @__PURE__ */ f(a, {
		color: e,
		showIcons: !1,
		onColorChange: t
	});
} }, _ = {
	render: () => {
		let [e, t] = o("blue"), [n, r] = o("status-progress");
		return /* @__PURE__ */ f(a, {
			color: e,
			icon: n,
			onColorChange: t,
			onIconChange: r
		});
	},
	play: async ({ canvasElement: r }) => {
		let i = e(r);
		await t.click(i.getByLabelText("Pick color and icon")), await n(e(document.body).getByText("Color")).toBeVisible(), await n(e(document.body).getByText("Icon")).toBeVisible();
	}
}, v = {
	render: () => {
		let [e, t] = o("gray"), [n, r] = o("circle");
		return /* @__PURE__ */ f(a, {
			color: e,
			icon: n,
			onColorChange: t,
			onIconChange: r
		});
	},
	play: async ({ canvasElement: r }) => {
		let i = e(r);
		await t.click(i.getByLabelText("Pick color and icon")), await n(e(document.body).getByRole("button", { name: "none" })).toHaveAttribute("aria-pressed", "true");
	}
}, y = { render: () => /* @__PURE__ */ f(c, {
	templateColumns: "repeat(8, 1fr)",
	gap: "sm",
	justifyItems: "center",
	maxWidth: "480px",
	children: r.map((e) => /* @__PURE__ */ p(u, {
		gap: "2xs",
		alignItems: "center",
		children: [/* @__PURE__ */ f(l, {
			as: e.icon,
			boxSize: "icon-md",
			color: "fg.muted"
		}), /* @__PURE__ */ f(d, {
			textStyle: "label/2XS",
			color: "fg.subtle",
			textAlign: "center",
			children: e.label
		})]
	}, e.value ?? "none"))
}) }, b = { render: () => /* @__PURE__ */ p(c, {
	templateColumns: "repeat(6, auto)",
	gap: "sm",
	justifyItems: "center",
	width: "fit-content",
	children: [
		/* @__PURE__ */ f(i, { color: "gray" }),
		/* @__PURE__ */ f(i, {
			color: "red",
			icon: "flame"
		}),
		/* @__PURE__ */ f(i, {
			color: "yellow",
			icon: "level-mid"
		}),
		/* @__PURE__ */ f(i, {
			color: "blue",
			icon: "status-progress"
		}),
		/* @__PURE__ */ f(i, {
			color: "green",
			icon: "status-done"
		}),
		/* @__PURE__ */ f(i, {
			color: "purple",
			icon: "status-review"
		})
	]
}) };
export { g as ColorOnly, h as Default, y as IconRegistry, v as NoIconSentinel, _ as PopoverOpen, b as Swatches, m as default };

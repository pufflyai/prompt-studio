// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, m as t, r as n } from "./test-whhQHjQi.ts";
import { t as r } from "./trash-2-C03vrbuo.ts";
import { n as i } from "./apply-theme-preference-DzXMh3mV.ts";
import { Box as a, HStack as o, Icon as s, IconButton as c, Stack as l, Text as u } from "@chakra-ui/react";
import { jsx as d, jsxs as f } from "react/jsx-runtime";
// packages/ui/src/components/primitives/delete-icon-buttons.stories.tsx
var p = {
	title: "Components/Inputs/Delete Icon Buttons",
	args: { mode: "light" },
	render: ({ mode: e }) => /* @__PURE__ */ f(l, {
		className: i(`pstdio-${e}`, e).join(" "),
		"data-color-mode": e,
		"data-theme": `pstdio-${e}`,
		color: "fg",
		padding: "md",
		background: "bg",
		gap: "md",
		children: [
			/* @__PURE__ */ d(u, {
				textStyle: "label/M/medium",
				children: "Delete actions"
			}),
			/* @__PURE__ */ d(a, {
				"data-testid": "idle-reference",
				color: "fg.subtle",
				background: "transparent"
			}),
			/* @__PURE__ */ d(a, {
				"data-testid": "active-reference",
				color: "fg.error",
				background: "bg.error"
			}),
			/* @__PURE__ */ f(o, {
				gap: "sm",
				children: [/* @__PURE__ */ d(c, {
					variant: "destructive-ghost",
					"aria-label": "Delete item",
					children: /* @__PURE__ */ d(s, { as: r })
				}), /* @__PURE__ */ d(c, {
					variant: "destructive-ghost",
					"aria-label": "Delete disabled item",
					disabled: !0,
					children: /* @__PURE__ */ d(s, { as: r })
				})]
			}),
			/* @__PURE__ */ f(o, {
				className: "group",
				"data-testid": "status-row",
				gap: "sm",
				padding: "sm",
				children: [
					/* @__PURE__ */ d(u, {
						textStyle: "label/S",
						children: "Status row"
					}),
					/* @__PURE__ */ d(c, {
						variant: "destructive-ghost",
						size: "xs",
						"aria-label": "Delete status",
						children: /* @__PURE__ */ d(s, { as: r })
					}),
					/* @__PURE__ */ d(c, {
						variant: "destructive-ghost",
						size: "xs",
						"aria-label": "Delete default status",
						disabled: !0,
						children: /* @__PURE__ */ d(s, { as: r })
					})
				]
			})
		]
	}),
	play: async ({ canvasElement: r }) => {
		let i = e(r), a = i.getByRole("button", {
			name: "Delete item",
			exact: !0
		}), o = getComputedStyle(i.getByTestId("idle-reference")), s = getComputedStyle(i.getByTestId("active-reference")), c = async (e, r) => {
			await t(() => {
				n(getComputedStyle(e).color).toBe(r.color), n(getComputedStyle(e).backgroundColor).toBe(r.backgroundColor);
			});
		};
		await c(a, o), a.setAttribute("data-hover", ""), await c(a, s), a.removeAttribute("data-hover"), await c(a, o), a.setAttribute("data-focus-visible", ""), await c(a, s), a.removeAttribute("data-focus-visible"), a.setAttribute("data-active", ""), await c(a, s), a.removeAttribute("data-active"), i.getByTestId("status-row").setAttribute("data-hover", ""), await c(i.getByRole("button", {
			name: "Delete status",
			exact: !0
		}), s), await c(i.getByRole("button", {
			name: "Delete default status",
			exact: !0
		}), o), i.getByRole("button", {
			name: "Delete disabled item",
			exact: !0
		}).setAttribute("data-hover", ""), await c(i.getByRole("button", {
			name: "Delete disabled item",
			exact: !0
		}), o), i.getByTestId("status-row").removeAttribute("data-hover"), i.getByRole("button", {
			name: "Delete disabled item",
			exact: !0
		}).removeAttribute("data-hover");
	}
}, m = {}, h = { args: { mode: "dark" } };
export { h as Dark, m as Light, p as default };

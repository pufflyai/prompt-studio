// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, p as t, r as n } from "./test-whhQHjQi.ts";
import { r, t as i } from "./icon-options-BaFkbkcp.ts";
import { t as a } from "./resolve-icon-component-Ve9WSQ1O.ts";
import { t as o } from "./icon-picker-grid-cD8ukHSR.ts";
import { useEffect as s, useState as c } from "react";
import { Icon as l, IconButton as u, Popover as d, Portal as f, Stack as p, Text as m } from "@chakra-ui/react";
import { jsx as h, jsxs as g } from "react/jsx-runtime";
// packages/ui/src/components/primitives/icon-picker.tsx
var _ = (e) => {
	let { value: t, options: n = r, disabled: _, onChange: v, "aria-label": y = "Change icon" } = e, [b, x] = c(!1);
	s(() => {
		_ && x(!1);
	}, [_]);
	let S = t ? a(t) : void 0, C = n.find((e) => e.icon === S)?.value ?? t;
	return /* @__PURE__ */ g(d.Root, {
		open: b,
		onOpenChange: ({ open: e }) => x(e),
		positioning: { placement: "bottom-start" },
		children: [/* @__PURE__ */ h(d.Trigger, {
			asChild: !0,
			children: /* @__PURE__ */ h(u, {
				variant: "ghost",
				size: "2xs",
				disabled: _,
				"aria-label": y,
				onClick: (e) => e.stopPropagation(),
				children: /* @__PURE__ */ h(l, {
					as: S ?? i(t, n),
					boxSize: "icon-xs"
				})
			})
		}), /* @__PURE__ */ h(f, { children: /* @__PURE__ */ h(d.Positioner, { children: /* @__PURE__ */ h(d.Content, {
			width: "tag-picker",
			bg: "bg.elevated",
			onClick: (e) => e.stopPropagation(),
			children: /* @__PURE__ */ g(p, {
				gap: "compact",
				p: "sm",
				children: [/* @__PURE__ */ h(m, {
					textStyle: "label/S/medium",
					color: "fg.muted",
					children: "Icon"
				}), /* @__PURE__ */ h(o, {
					value: C,
					options: n,
					disabled: _,
					onChange: (e) => {
						v(e), x(!1);
					}
				})]
			})
		}) }) })]
	});
}, v = {
	title: "Components/Inputs/Icon Picker",
	component: (e) => {
		let [t, n] = c("folder");
		return /* @__PURE__ */ g(p, {
			p: "lg",
			align: "start",
			children: [/* @__PURE__ */ h(_, {
				value: t,
				onChange: n,
				disabled: e.disabled
			}), /* @__PURE__ */ h(m, {
				role: "status",
				children: t
			})]
		});
	},
	tags: ["icon-picker"]
}, y = { play: async ({ canvasElement: r }) => {
	let i = e(r);
	await t.click(i.getByRole("button", { name: "Change icon" })), await t.click(await e(r.ownerDocument.body).findByRole("button", { name: "book open" })), await n(i.getByRole("status")).toHaveTextContent("book-open"), await t.click(i.getByRole("button", { name: "Change icon" })), await n(await e(r.ownerDocument.body).findByRole("button", { name: "book open" })).toHaveAttribute("aria-pressed", "true");
} }, b = {
	args: { disabled: !0 },
	play: async ({ canvasElement: r }) => {
		let i = e(r), a = i.getByRole("button", { name: "Change icon" });
		await n(a).toBeDisabled(), await t.click(a), await n(e(r.ownerDocument.body).queryByRole("button", { name: "book open" })).toBeNull(), await n(i.getByRole("status")).toHaveTextContent("folder");
	}
};
export { y as ChooseIcon, b as Disabled, v as default };

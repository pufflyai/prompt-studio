// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, m as t, p as n, r } from "./test-whhQHjQi.ts";
import { t as i } from "./message-circle-DP0BFDQF.ts";
import { t as a } from "./minus-BdT0RA0-.ts";
import { t as o } from "./square-arrow-out-up-right-ChOYv0bR.ts";
import { t as s } from "./tooltip-BweQW627.ts";
import { t as c } from "./header-8InG5j3w.ts";
import { forwardRef as l, useState as u } from "react";
import { Box as d, Button as f, Flex as p, HStack as m, IconButton as h, Input as g, Portal as _, Spacer as v, Stack as y, chakra as b, useRecipe as x } from "@chakra-ui/react";
import { Fragment as S, jsx as C, jsxs as w } from "react/jsx-runtime";
// packages/ui/src/components/overlays/bubble-button.tsx
var T = l(function(e, t) {
	let { children: n, containerProps: r, isOpen: i = !1, tooltip: a, ...o } = e, c = x({ key: "bubbleLauncher" }), l = /* @__PURE__ */ C(h, {
		ref: t,
		rounded: "full",
		size: "lg",
		borderWidth: "1px",
		borderColor: "border",
		_hover: { borderColor: "border.accent" },
		_active: { borderColor: "border.accent" },
		...o,
		children: n
	});
	return /* @__PURE__ */ C(b.div, {
		position: "fixed",
		bottom: "6",
		right: "6",
		zIndex: "docked",
		...r,
		css: c(),
		"data-open": i,
		inert: i,
		"aria-hidden": i,
		children: a ? /* @__PURE__ */ C(s, {
			content: a,
			children: l
		}) : l
	});
}), E = l(function(e, t) {
	let { isOpen: n = !1, title: r, menu: i, header: l, onClose: u, closeLabel: f, onPopOut: g, popOutLabel: y, width: S = "28rem", height: T = "38rem", containerProps: E, testId: D, "aria-label": O, children: k, overlay: A } = e, j = x({ key: "bubblePanel" });
	return /* @__PURE__ */ C(_, { children: /* @__PURE__ */ w(b.section, {
		ref: t,
		role: "dialog",
		"data-testid": D,
		"aria-label": O ?? r,
		position: "fixed",
		bottom: "3",
		right: "3",
		w: S,
		maxW: "calc(100vw - 2rem)",
		h: T,
		maxH: "calc(100vh - 2rem)",
		borderRadius: "xs",
		borderWidth: "1px",
		borderColor: "border.subtle",
		bg: "bg",
		overflow: "hidden",
		zIndex: "dropdown",
		...E,
		css: j(),
		"data-open": n,
		inert: !n,
		"aria-hidden": !n,
		children: [/* @__PURE__ */ w(p, {
			direction: "column",
			h: "full",
			children: [l === void 0 ? /* @__PURE__ */ w(c, {
				variant: "main",
				gap: "sm",
				flexShrink: 0,
				children: [
					/* @__PURE__ */ C(m, {
						gap: "1",
						minW: "0",
						children: i
					}),
					/* @__PURE__ */ C(v, {}),
					/* @__PURE__ */ w(m, {
						gap: "1",
						children: [g ? /* @__PURE__ */ C(s, {
							content: y,
							children: /* @__PURE__ */ C(h, {
								size: "2xs",
								variant: "ghost",
								"aria-label": y,
								onClick: g,
								children: /* @__PURE__ */ C(o, { size: 16 })
							})
						}) : null, u ? /* @__PURE__ */ C(s, {
							content: f,
							children: /* @__PURE__ */ C(h, {
								size: "2xs",
								variant: "ghost",
								"aria-label": f,
								onClick: u,
								children: /* @__PURE__ */ C(a, { size: 16 })
							})
						}) : null]
					})
				]
			}) : l, /* @__PURE__ */ C(d, {
				flex: "1",
				minH: 0,
				display: "flex",
				flexDirection: "column",
				gap: "sm",
				children: k
			})]
		}), A]
	}) });
}), D = {
	tags: ["motion", "launcher-visibility"],
	title: "Components/Overlays/Bubble/Motion",
	component: () => {
		let [e, t] = u(!1);
		return /* @__PURE__ */ w(S, { children: [
			/* @__PURE__ */ C(f, {
				onClick: () => t(!e),
				children: "Toggle floating panel"
			}),
			/* @__PURE__ */ C(T, {
				isOpen: e,
				"aria-label": "Open Side Panel",
				onClick: () => t(!0),
				children: /* @__PURE__ */ C(i, {})
			}),
			/* @__PURE__ */ C(E, {
				isOpen: e,
				title: "Side Panel",
				closeLabel: "Minimize",
				onClose: () => t(!1),
				children: /* @__PURE__ */ C(y, {
					p: "sm",
					children: /* @__PURE__ */ C(g, {
						"aria-label": "Draft",
						placeholder: "A draft stays here when minimized"
					})
				})
			})
		] });
	},
	parameters: { layout: "fullscreen" }
}, O = { play: async () => {
	let i = e(document.body), a = i.getByRole("button", { name: "Open Side Panel" });
	await n.click(a), await t(() => r(a).not.toBeVisible()), await r(a.parentElement).toHaveAttribute("inert"), await t(() => r(i.getByRole("dialog", { name: "Side Panel" })).toBeVisible());
	let o = i.getByRole("dialog", { name: "Side Panel" }), s = i.getByRole("textbox", { name: "Draft" });
	await n.type(s, "Keep this draft"), await n.click(i.getByRole("button", { name: "Minimize" })), await r(o).toHaveAttribute("inert"), await r(s).toBeVisible(), await t(() => r(s).not.toBeVisible()), await t(() => r(a).toBeVisible()), a.focus(), await n.keyboard("{Enter}"), await r(s).toHaveValue("Keep this draft");
} };
export { O as LauncherAndPanel, D as default };

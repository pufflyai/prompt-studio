// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e, h as t, i as n, m as r, p as i, r as a, u as o } from "./test-whhQHjQi.ts";
import { t as s } from "./eye-D2mhng7S.ts";
import { t as c } from "./icon-options-BaFkbkcp.ts";
import { c as l } from "./list-row-BhxGCvIh.ts";
import { useState as u } from "react";
import { Box as d, Icon as f, Input as p, Stack as m, Text as h } from "@chakra-ui/react";
import { jsx as g, jsxs as _ } from "react/jsx-runtime";
// packages/ui/src/components/overlays/resource-context-menu.stories.tsx
var v = (e) => Array.from({ length: e }, (e, t) => ({
	key: `entry-${t}`,
	label: `Sidenav entry ${t + 1}`,
	endContent: /* @__PURE__ */ g(s, { size: 14 }),
	separatorBefore: t > 0 && t % 6 == 0,
	onClick: () => void 0
})), y = /* @__PURE__ */ g(d, {
	borderWidth: "1px",
	borderColor: "border",
	borderRadius: "xs",
	p: "md",
	w: "15rem",
	children: /* @__PURE__ */ g(h, {
		textStyle: "label/S/regular",
		children: "Right-click here"
	})
}), b = { args: {
	children: y,
	actions: [
		["play", "Run attempt"],
		["sparkles", "Refine ticket"],
		["list-tree", "Break into sub-tickets"],
		["archive", "Archive"],
		["trash", "Delete"]
	].map(([e, t]) => ({
		key: e,
		label: t,
		icon: /* @__PURE__ */ g(f, {
			as: c(e),
			boxSize: "4"
		})
	}))
} }, x = () => {
	let [e, t] = u(!1), [n, r] = u(!0);
	return /* @__PURE__ */ _(m, { children: [
		/* @__PURE__ */ g(l, {
			closeOnSelect: !1,
			actions: [{
				key: "toggle",
				label: "Toggle visibility",
				onClick: () => r(!n)
			}, {
				key: "rename",
				label: "Rename inline",
				closeOnSelect: !0,
				onClick: () => t(!0)
			}],
			children: y
		}),
		/* @__PURE__ */ g(h, { children: n ? "Shown" : "Hidden" }),
		e ? /* @__PURE__ */ g(p, {
			autoFocus: !0,
			size: "xs",
			"aria-label": "Name",
			onBlur: () => t(!1)
		}) : null
	] });
}, S = () => {
	let [e, t] = u(!0);
	return /* @__PURE__ */ _(m, { children: [/* @__PURE__ */ g(l, {
		closeOnSelect: !1,
		actions: [{
			key: "visibility",
			label: "Hide/show items",
			items: [{
				key: "notes",
				label: "Notes",
				closeOnSelect: !1,
				endContent: /* @__PURE__ */ g(s, { size: 14 }),
				onClick: () => t(!e)
			}]
		}, {
			key: "unavailable",
			label: "Unavailable options",
			isDisabled: !0,
			items: [{
				key: "hidden",
				label: "Unavailable child",
				onClick: () => void 0
			}]
		}],
		children: y
	}), /* @__PURE__ */ g(h, { children: e ? "Notes shown" : "Notes hidden" })] });
}, C = () => {
	let [e, t] = u("Nothing selected");
	return /* @__PURE__ */ _(m, { children: [/* @__PURE__ */ g(l, {
		closeOnSelect: !1,
		actions: [{
			key: "visibility",
			label: "Hide/show items",
			items: v(60).map((e) => ({
				...e,
				onClick: () => t(e.label)
			}))
		}],
		children: y
	}), /* @__PURE__ */ g(h, { children: e })] });
}, w = {
	tags: ["menu-selection"],
	title: "Components/Overlays/Resource Context Menu",
	component: l,
	parameters: {
		layout: "padded",
		docs: { description: { component: "Right-click menu for resource and Sidenav actions. Menus taller than the space left in the viewport scroll inside the menu." } }
	}
}, T = { render: () => /* @__PURE__ */ g(l, {
	actions: v(4),
	children: y
}) }, E = {
	args: {
		children: y,
		actions: [{
			key: "toggle",
			label: "Toggle visibility",
			onSelect: e()
		}]
	},
	play: async ({ canvasElement: e, args: s }) => {
		n.contextMenu(t(e).getByText("Right-click here"));
		let c = await o.findByRole("menuitem", { name: "Toggle visibility" });
		await i.click(c), a(s.actions[0].onSelect).toHaveBeenCalledTimes(1), await r(() => a(o.queryByRole("menu")).not.toBeInTheDocument());
	}
}, D = {
	render: () => /* @__PURE__ */ g(S, {}),
	play: async ({ canvasElement: e }) => {
		let s = t(e);
		n.contextMenu(s.getByText("Right-click here"));
		let c = await o.findByRole("menuitem", { name: "Unavailable options" });
		await a(c).toHaveAttribute("data-disabled"), await i.hover(c), await a(o.queryByRole("menuitem", { name: "Unavailable child" })).toBeNull();
		let l = await o.findByRole("menuitem", { name: "Hide/show items" });
		await i.hover(l);
		let u = await o.findByRole("menuitem", {
			name: "Notes",
			exact: !0
		});
		await r(() => {
			let e = u.closest("[role=\"menu\"]").getBoundingClientRect(), t = l.getBoundingClientRect();
			a(Math.abs(e.top - t.top)).toBeLessThanOrEqual(t.height);
		}), await i.click(u), await a(s.getByText("Notes hidden")).toBeVisible(), await i.click(u), await a(s.getByText("Notes shown")).toBeVisible(), await i.keyboard("{Escape}{Escape}"), await r(() => a(o.queryByRole("menu")).toBeNull()), n.contextMenu(s.getByText("Right-click here")), await r(() => a(o.getByRole("menu")).toHaveFocus()), await i.keyboard("{Home}{ArrowRight}"), await r(() => a(o.getByRole("menuitem", {
			name: "Notes",
			exact: !0
		})).toBeVisible()), await i.keyboard("{Escape}{Escape}"), await r(() => a(o.queryByRole("menu")).not.toBeInTheDocument());
	}
}, O = {
	render: () => /* @__PURE__ */ g(x, {}),
	play: async ({ canvasElement: e }) => {
		let s = t(e);
		n.contextMenu(s.getByText("Right-click here")), await i.click(await o.findByRole("menuitem", { name: "Toggle visibility" })), await a(s.getByText("Hidden")).toBeVisible(), await r(() => a(o.getByRole("menu")).toBeVisible()), await i.click(o.getByRole("menuitem", { name: "Rename inline" })), await r(() => a(o.queryByRole("menu")).not.toBeInTheDocument()), await a(s.getByRole("textbox", { name: "Name" })).toHaveFocus();
	}
}, k = {
	render: () => /* @__PURE__ */ g(l, {
		actions: [{
			key: "customize",
			label: "Customize navigation",
			onClick: () => void 0
		}],
		children: /* @__PURE__ */ g(d, {
			p: "md",
			children: /* @__PURE__ */ g(l, {
				actions: [{
					key: "open",
					label: "Open session",
					onClick: () => void 0
				}, {
					key: "disabled",
					label: "Unavailable action",
					isDisabled: !0,
					onClick: () => void 0
				}],
				children: /* @__PURE__ */ g(d, {
					tabIndex: 0,
					p: "md",
					children: "Session row"
				})
			})
		})
	}),
	play: async ({ canvasElement: e }) => {
		let s = t(e).getByText("Session row");
		s.focus(), await i.keyboard("{Shift>}{F10}{/Shift}"), await r(() => a(o.getByRole("menuitem", { name: "Open session" })).toBeVisible()), await a(o.getByRole("menuitem", { name: "Unavailable action" })).toHaveAttribute("data-disabled"), await r(() => {
			let e = o.getByRole("menu").getBoundingClientRect(), t = s.getBoundingClientRect();
			a(Math.abs(e.top - t.bottom)).toBeLessThan(t.height);
		}), await r(() => a(o.getByRole("menu")).toHaveFocus()), await i.keyboard("{Escape}"), await r(() => a(o.queryByRole("menu")).not.toBeInTheDocument()), await a(s).toHaveFocus(), await n.pointerDown(s, {
			pointerType: "touch",
			clientX: 40,
			clientY: 40
		}), await r(() => a(o.getByRole("menuitem", { name: "Open session" })).toBeVisible()), await n.pointerUp(s, { pointerType: "touch" }), await a(o.getAllByRole("menu")).toHaveLength(1), await i.keyboard("{Escape}");
	}
}, A = {
	render: () => /* @__PURE__ */ g(l, {
		actions: v(60),
		closeOnSelect: !1,
		children: y
	}),
	play: async ({ canvasElement: e }) => {
		n.contextMenu(t(e).getByText("Right-click here"));
		let i = await o.findByRole("menu");
		await r(() => a(i.getBoundingClientRect().bottom).toBeLessThanOrEqual(window.innerHeight)), await a(o.getByRole("menuitem", { name: "Sidenav entry 60" })).toBeInTheDocument();
	}
}, j = {
	tags: ["!manifest", "menu-escape-focus"],
	render: () => /* @__PURE__ */ _(m, { children: [/* @__PURE__ */ g(l, {
		actions: v(1),
		children: /* @__PURE__ */ g(d, {
			tabIndex: 0,
			p: "md",
			children: "Context target"
		})
	}), /* @__PURE__ */ g(p, { "aria-label": "Next control" })] }),
	play: async ({ canvasElement: e }) => {
		let s = t(e);
		s.getByText("Context target").focus(), await i.keyboard("{Shift>}{F10}{/Shift}");
		let c = await o.findByRole("menu");
		await r(() => a(c).toHaveFocus()), n.keyDown(c, { key: "Escape" });
		let l = s.getByRole("textbox", { name: "Next control" });
		l.focus(), await new Promise((e) => requestAnimationFrame(() => requestAnimationFrame(() => e()))), await a(l).toHaveFocus(), await r(() => a(o.queryByRole("menu")).not.toBeInTheDocument());
	}
}, M = {
	tags: ["!manifest"],
	render: () => /* @__PURE__ */ g(C, {}),
	play: async ({ canvasElement: e }) => {
		let s = t(e);
		n.contextMenu(s.getByText("Right-click here")), await i.hover(await o.findByRole("menuitem", { name: "Hide/show items" }));
		let c = await o.findByRole("menuitem", { name: "Sidenav entry 60" }), l = c.closest("[role=\"menu\"]");
		await r(() => a(l.getBoundingClientRect().bottom).toBeLessThanOrEqual(window.innerHeight)), c.scrollIntoView({ block: "nearest" }), await r(() => {
			let e = c.getBoundingClientRect(), t = l.getBoundingClientRect();
			a(e.top).toBeGreaterThanOrEqual(t.top), a(e.bottom).toBeLessThanOrEqual(t.bottom);
		}), await i.click(c), await a(s.getByText("Sidenav entry 60")).toBeVisible();
	}
}, N = { args: {
	children: y,
	actions: [
		{
			key: "rename",
			label: "Rename session",
			group: {
				id: "resource",
				label: "Session"
			}
		},
		{
			key: "archive",
			label: "Archive session",
			group: {
				id: "resource",
				label: "Session"
			}
		},
		{
			key: "new",
			label: "New session",
			group: {
				id: "quick",
				label: "Sessions"
			}
		},
		{
			key: "switch",
			label: "Switch session",
			group: {
				id: "sessions",
				label: "Sessions"
			}
		},
		{
			key: "all",
			label: "View all sessions",
			group: {
				id: "quick",
				label: "Sessions"
			}
		},
		{
			key: "pin",
			label: "Pin tab",
			group: {
				id: "tab",
				label: "Tab"
			}
		}
	]
} };
export { T as Default, j as EscapeRespectsNewFocus, O as InlineAction, k as KeyboardAndTouch, A as LongMenuScrolls, M as LongSubmenuScrolls, N as ResourceAndSurfaceGroups, E as SelectionAction, b as TicketActions, D as VisibilitySubmenu, w as default };

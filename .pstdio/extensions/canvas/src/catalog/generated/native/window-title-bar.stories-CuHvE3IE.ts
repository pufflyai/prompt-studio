// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, i as t, m as n, p as r, r as i } from "./test-whhQHjQi.ts";
import { t as a } from "./folder-DJ8ZbA4G.ts";
import { t as o } from "./list-tree-wIq_OI-O.ts";
import { n as s, t as c } from "./panel-right-TlUIjx5B.ts";
import { t as l } from "./plus-CYkLGSPS.ts";
import { c as u, s as d } from "./list-row-BhxGCvIh.ts";
import { t as f } from "./window-title-bar-BQdVajcZ.ts";
import { t as p } from "./window-tabs-DXUe-FGy.ts";
import { useState as m } from "react";
import { Box as h, Button as g, HStack as _, IconButton as v, Popover as y, Portal as b, Stack as x } from "@chakra-ui/react";
import { Fragment as S, jsx as C, jsxs as w } from "react/jsx-runtime";
// packages/ui/src/components/tab-strip/window-title-bar.stories.tsx
var T = () => {
	let [e, t] = m(!0);
	return /* @__PURE__ */ w(_, {
		gap: "2xs",
		role: "group",
		"aria-label": "Panel controls",
		children: [
			/* @__PURE__ */ C(v, {
				"aria-label": "Toggle Sidenav",
				"aria-pressed": e,
				variant: "ghost",
				size: "xs",
				onClick: () => t(!e),
				children: /* @__PURE__ */ C(o, {})
			}),
			/* @__PURE__ */ C(v, {
				"aria-label": "Toggle Bottom Panel",
				variant: "ghost",
				size: "xs",
				children: /* @__PURE__ */ C(s, {})
			}),
			/* @__PURE__ */ C(v, {
				"aria-label": "Toggle Side Panel",
				variant: "ghost",
				size: "xs",
				children: /* @__PURE__ */ C(c, {})
			})
		]
	});
}, E = () => null, D = (e) => {
	let { platform: t = "darwin", tabCount: n = 2, emptyActions: r = !1 } = e, [i, o] = m(() => Array.from({ length: n }, (e, t) => ({
		id: String(t),
		label: `Project ${t + 1}`,
		icon: /* @__PURE__ */ C(a, {})
	}))), [s, c] = m("0");
	return /* @__PURE__ */ w(f, {
		platform: t,
		actions: C(r ? E : T, {}),
		children: [/* @__PURE__ */ C(p, {
			tabs: i,
			selectedId: s,
			"aria-label": "Project tabs",
			onSelect: c,
			onClose: (e) => {
				let t = i.filter((t) => t.id !== e);
				o(t), s === e && c(t[0]?.id);
			}
		}), /* @__PURE__ */ C(v, {
			"aria-label": "Open project",
			variant: "ghost",
			size: "xs",
			children: /* @__PURE__ */ C(l, {})
		})]
	});
}, O = async (t, n) => {
	let a = e(t), o = t.querySelector(".ps-window-title-bar__content"), s = t.querySelector(".ps-window-title-bar__actions"), c = Number.parseFloat(getComputedStyle(o).paddingInlineEnd);
	await i(s.getBoundingClientRect().right).toBeCloseTo(o.getBoundingClientRect().right - c, 0), await i(a.getByRole("tablist").getBoundingClientRect().right).toBeLessThanOrEqual(a.getByRole("button", { name: "Open project" }).getBoundingClientRect().left), await i(getComputedStyle(s, "::after").content).toBe(n ? "\"\"" : "none");
	let l = a.getByRole("button", { name: "Toggle Sidenav" });
	await r.click(l), await i(l).toHaveAttribute("aria-pressed", "false"), await r.click(a.getByRole("button", { name: "Close Project 1" })), await i(a.queryByRole("tab", { name: "Project 1" })).not.toBeInTheDocument(), await i(s.getBoundingClientRect().right).toBeCloseTo(o.getBoundingClientRect().right - c, 0);
}, k = () => {
	let e = [{
		key: "archive",
		label: "Archive project"
	}];
	return /* @__PURE__ */ w(S, { children: [/* @__PURE__ */ C(D, {}), /* @__PURE__ */ w(x, {
		p: "md",
		align: "start",
		children: [
			/* @__PURE__ */ C(u, {
				actions: e,
				children: /* @__PURE__ */ C(h, {
					p: "md",
					children: "Right-click project"
				})
			}),
			/* @__PURE__ */ C(d, {
				actions: e,
				children: /* @__PURE__ */ C(g, { children: "Project actions" })
			}),
			/* @__PURE__ */ w(y.Root, { children: [/* @__PURE__ */ C(y.Trigger, {
				asChild: !0,
				children: /* @__PURE__ */ C(g, { children: "Project details" })
			}), /* @__PURE__ */ C(b, { children: /* @__PURE__ */ C(y.Positioner, { children: /* @__PURE__ */ C(y.Content, { children: /* @__PURE__ */ C(y.Body, { children: "Project details" }) }) }) })] })
		]
	})] });
}, A = {
	title: "Components/Navigation/Window Title Bar",
	component: f,
	args: { platform: "darwin" },
	parameters: {
		layout: "fullscreen",
		docs: { description: { component: "Place project tabs and their open-project button in children. Use actions for trailing panel controls. The title bar reserves native control bounds and adds a subtle separator before Windows and Linux controls. Empty actions collapse. macOS full screen releases the leading control reservation. Open menus and popovers pause window dragging so title-bar clicks can dismiss them." } }
	}
}, j = {
	render: () => /* @__PURE__ */ C(D, {}),
	play: async ({ canvasElement: e }) => O(e, !1)
}, M = {
	args: { platform: "win32" },
	render: () => /* @__PURE__ */ C(D, { platform: "win32" }),
	play: async ({ canvasElement: e }) => O(e, !0)
}, N = {
	args: { platform: "linux" },
	render: () => /* @__PURE__ */ C(D, { platform: "linux" }),
	play: async ({ canvasElement: e }) => O(e, !0)
}, P = {
	args: { platform: "win32" },
	render: () => /* @__PURE__ */ C(h, {
		maxWidth: "2xl",
		children: /* @__PURE__ */ C(D, {
			platform: "win32",
			tabCount: 12
		})
	}),
	play: async ({ canvasElement: e }) => O(e, !0)
}, F = {
	render: () => /* @__PURE__ */ C(h, {
		"data-window-full-screen": "",
		children: /* @__PURE__ */ C(D, {})
	}),
	play: async ({ canvasElement: e }) => O(e, !1)
}, I = {
	args: { platform: "win32" },
	render: () => /* @__PURE__ */ C(D, {
		platform: "win32",
		emptyActions: !0
	}),
	play: async ({ canvasElement: e }) => {
		await i(e.querySelector(".ps-window-title-bar__actions")).not.toBeVisible();
	}
}, L = {
	tags: ["!manifest"],
	render: () => /* @__PURE__ */ C(k, {}),
	play: async ({ canvasElement: a }) => {
		let o = e(a), s = e(a.ownerDocument.body), c = a.querySelector("[data-window-title-bar]");
		await i(getComputedStyle(c).getPropertyValue("app-region")).toBe("drag"), t.contextMenu(o.getByText("Right-click project")), await n(() => i(s.getByRole("menu")).toBeVisible()), await n(() => i(getComputedStyle(c).getPropertyValue("app-region")).toBe("no-drag")), await r.click(c), await n(() => i(s.queryByRole("menu")).not.toBeInTheDocument()), await i(getComputedStyle(c).getPropertyValue("app-region")).toBe("drag"), await r.click(o.getByRole("button", { name: "Project actions" })), await n(() => i(s.getByRole("menu")).toBeVisible()), await i(getComputedStyle(c).getPropertyValue("app-region")).toBe("no-drag");
		let l = o.getByRole("button", { name: "Toggle Sidenav" });
		await r.click(l), await n(() => i(s.queryByRole("menu")).not.toBeInTheDocument()), await i(l).toHaveAttribute("aria-pressed", "false"), await i(getComputedStyle(c).getPropertyValue("app-region")).toBe("drag"), t.contextMenu(o.getByText("Right-click project")), await n(() => i(s.getByRole("menu")).toHaveFocus()), await r.keyboard("{Escape}"), await n(() => i(s.queryByRole("menu")).not.toBeInTheDocument()), await i(getComputedStyle(c).getPropertyValue("app-region")).toBe("drag");
	}
}, R = {
	tags: ["!manifest"],
	render: () => /* @__PURE__ */ C(k, {}),
	play: async ({ canvasElement: t }) => {
		let a = e(t), o = e(t.ownerDocument.body), s = t.querySelector("[data-window-title-bar]");
		await r.click(a.getByRole("button", { name: "Project details" })), await n(() => i(o.getByRole("dialog")).toBeVisible()), await i(getComputedStyle(s).getPropertyValue("app-region")).toBe("no-drag"), await r.click(s), await n(() => i(o.queryByRole("dialog")).not.toBeInTheDocument()), await i(getComputedStyle(s).getPropertyValue("app-region")).toBe("drag");
	}
}, z = {
	...M,
	globals: { theme: "pstdio-dark" }
};
export { L as DismissMenus, R as DismissPopovers, I as EmptyActions, F as FullScreen, j as MacOS, P as Overflow, N as Ubuntu, M as Windows, z as WindowsDark, A as default };

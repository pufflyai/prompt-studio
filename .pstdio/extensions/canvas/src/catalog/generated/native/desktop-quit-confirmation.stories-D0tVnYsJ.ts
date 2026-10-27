// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e, i as t, o as n, r, t as i } from "./test-CYwQ_LKY.ts";
import { t as a } from "./icon-D3uE7jD-.ts";
import { useRef as o } from "react";
import { Button as s, Dialog as c, HStack as l, Portal as u, Stack as d, Text as f } from "@chakra-ui/react";
import { SimpleCard as p, SimpleCardBody as m, ThemePreferenceProvider as h } from "@pstdio/ui";
import { jsx as g, jsxs as _ } from "react/jsx-runtime";
// packages/pstdio-dashboard/src/modules/desktop/desktop-quit-confirmation.tsx
var v = (e) => [
	{
		label: "Agent session",
		icon: "message-square",
		items: e.sessions
	},
	{
		label: "Terminal",
		icon: "terminal",
		items: e.terminals
	},
	{
		label: "Automation",
		icon: "workflow",
		items: e.jobs
	}
], y = (e) => {
	let { item: t, kind: n, icon: r } = e;
	return /* @__PURE__ */ g(p, {
		as: "li",
		children: /* @__PURE__ */ g(m, { children: /* @__PURE__ */ _(l, {
			gap: "sm",
			children: [/* @__PURE__ */ g(a, {
				name: r,
				size: 16,
				color: "fg.muted"
			}), /* @__PURE__ */ _(d, {
				gap: "none",
				minW: "0",
				flex: "1",
				children: [/* @__PURE__ */ g(f, {
					textStyle: "paragraph/S/medium",
					truncate: !0,
					title: t.label,
					children: t.label
				}), /* @__PURE__ */ g(f, {
					textStyle: "label/S/regular",
					color: "fg.muted",
					truncate: !0,
					title: t.description,
					children: t.description ? `${n} · ${t.description}` : n
				})]
			})]
		}) })
	});
}, b = {
	title: "Desktop/QuitConfirmation",
	component: (e) => {
		let { activity: t, onKeepOpen: n, onQuit: r } = e, i = o(null);
		return /* @__PURE__ */ g(c.Root, {
			role: "alertdialog",
			open: t !== null,
			scrollBehavior: "inside",
			initialFocusEl: () => i.current,
			closeOnInteractOutside: !1,
			onOpenChange: (e) => {
				e.open || n();
			},
			children: /* @__PURE__ */ _(u, { children: [/* @__PURE__ */ g(c.Backdrop, {}), /* @__PURE__ */ g(c.Positioner, { children: /* @__PURE__ */ _(c.Content, { children: [
				/* @__PURE__ */ g(c.Header, { children: /* @__PURE__ */ g(c.Title, { children: "Active work is still running" }) }),
				/* @__PURE__ */ g(c.Body, { children: /* @__PURE__ */ _(d, {
					gap: "sm",
					children: [/* @__PURE__ */ g(c.Description, {
						color: "fg.muted",
						textStyle: "paragraph/M/regular",
						children: "Quitting will stop these activities."
					}), t && /* @__PURE__ */ g(d, {
						as: "ul",
						gap: "xs",
						listStyle: "none",
						padding: "0",
						margin: "0",
						children: v(t).flatMap((e) => e.items.map((t) => /* @__PURE__ */ g(y, {
							item: t,
							kind: e.label,
							icon: e.icon
						}, `${e.label}:${t.id}`)))
					})]
				}) }),
				/* @__PURE__ */ _(c.Footer, {
					flexWrap: "wrap",
					children: [/* @__PURE__ */ g(s, {
						ref: i,
						size: "sm",
						onClick: n,
						children: "Keep Prompt Studio open"
					}), /* @__PURE__ */ g(s, {
						size: "sm",
						variant: "destructive",
						onClick: r,
						children: "Cancel work and quit"
					})]
				})
			] }) })] })
		});
	},
	parameters: { layout: "fullscreen" },
	args: {
		activity: {
			sessions: [{
				id: "session-one",
				label: "Improve the quit warning"
			}],
			terminals: [{
				id: "terminal-one",
				label: "Desktop tests"
			}],
			jobs: [{
				id: "job-one",
				label: "Check merged pull requests",
				description: "Prompt Studio"
			}, {
				id: "job-two",
				label: "Auto build",
				description: "Website"
			}]
		},
		onKeepOpen: r(),
		onQuit: r()
	},
	play: async ({ args: r }) => {
		let a = await t.findByRole("alertdialog", { name: "Active work is still running" });
		await n(() => i(a).toBeVisible()), await i(t.getByRole("button", { name: "Keep Prompt Studio open" })).toHaveFocus(), await e.tab(), await i(t.getByRole("button", { name: "Cancel work and quit" })).toHaveFocus(), await e.keyboard("{Escape}"), await i(r.onKeepOpen).toHaveBeenCalledOnce(), await i(r.onQuit).not.toHaveBeenCalled();
	}
}, x = { decorators: [(e) => /* @__PURE__ */ g(h, {
	initialPreference: "pstdio-light",
	children: /* @__PURE__ */ g(e, {})
}, "pstdio-light")] }, S = { decorators: [(e) => /* @__PURE__ */ g(h, {
	initialPreference: "pstdio-dark",
	children: /* @__PURE__ */ g(e, {})
}, "pstdio-dark")] }, C = {
	args: { activity: {
		sessions: [],
		terminals: [{
			id: "terminal-one",
			label: "sleep 300"
		}],
		jobs: []
	} },
	decorators: x.decorators
}, w = {
	decorators: x.decorators,
	args: { activity: {
		sessions: Array.from({ length: 30 }, (e, t) => ({
			id: `session-${t}`,
			label: `Session ${t + 1}: ${"LongProjectAndTaskNameWithoutBreaks".repeat(7)}`
		})),
		terminals: Array.from({ length: 20 }, (e, t) => ({
			id: `terminal-${t}`,
			label: `Terminal ${t + 1}`
		})),
		jobs: [{
			id: "background-check",
			label: "Check merged pull requests",
			description: "Prompt Studio"
		}]
	} },
	play: async () => {
		let e = await t.findByRole("alertdialog", { name: "Active work is still running" });
		await n(() => i(e).toBeVisible()), await i(t.getByText("Check merged pull requests")).toBeInTheDocument(), await i(t.getAllByRole("listitem")).toHaveLength(51), await i(t.getByRole("button", { name: "Keep Prompt Studio open" })).toBeVisible(), await i(t.getByRole("button", { name: "Cancel work and quit" })).toBeVisible();
	}
};
export { S as Dark, x as Light, w as LongContent, C as OneTerminal, b as default };

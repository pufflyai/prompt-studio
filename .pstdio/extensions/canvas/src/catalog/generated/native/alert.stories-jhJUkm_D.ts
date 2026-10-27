// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, p as t, r as n } from "./test-whhQHjQi.ts";
import { t as r } from "./alert-D8nHP1tF.ts";
import { useState as i } from "react";
import { Box as a, Button as o, Flex as s, Stack as c, Text as l } from "@chakra-ui/react";
import { Fragment as u, jsx as d, jsxs as f } from "react/jsx-runtime";
// packages/ui/src/components/primitives/alert.stories.tsx
var p = {
	title: "Primitives/AlertMessage",
	component: r,
	tags: ["alerts"],
	parameters: { docs: { description: { component: "Titles and descriptions wrap and scroll within the alert. Alerts use at most half the viewport, capped at 24rem, and shrink inside constrained flex layouts. Error alerts include Copy error message, which copies the complete title and message. Extension webviews need clipboard.write. Place recovery controls in endElement for a wrapping bottom-right footer outside the scrolling content. Dismiss buttons stay at the top right, aligned with the icon and the first title line. Both use compact ghost buttons with hover, focus, and pressed backgrounds tinted by the alert's semantic color." } } }
}, m = [
	{
		status: "info",
		title: "Connection restored",
		message: "Your workspace is connected again.",
		action: "View connection"
	},
	{
		status: "success",
		title: "Workspace ready",
		message: "Extensions loaded successfully.",
		action: "Open workspace"
	},
	{
		status: "warning",
		title: "Indexing paused",
		message: "Search may be incomplete until indexing resumes.",
		action: "Resume indexing"
	},
	{
		status: "error",
		title: "Extension runtime stopped",
		message: "The process ended unexpectedly. Restart it to recover.",
		action: "Restart service"
	}
], h = () => {
	let [e, t] = i([]), [n, a] = i([]), [s, p] = i([]);
	return /* @__PURE__ */ f(c, {
		gap: "sm",
		width: "lg",
		maxW: "full",
		children: [/* @__PURE__ */ d(o, {
			alignSelf: "flex-start",
			size: "xs",
			onClick: () => {
				t([]), a([]), p([]);
			},
			children: "Reset alerts"
		}), m.filter((t) => !e.includes(t.status)).map((i) => /* @__PURE__ */ d(r, {
			role: "alert",
			status: i.status,
			title: i.title,
			closeLabel: `Dismiss ${i.status} notice`,
			onClose: () => t([...e, i.status]),
			endElement: /* @__PURE__ */ f(u, { children: [/* @__PURE__ */ d(o, {
				onClick: () => a([...n, i.status]),
				children: i.action
			}), /* @__PURE__ */ d(o, {
				onClick: () => p([...s, i.status]),
				children: "Show details"
			})] }),
			children: /* @__PURE__ */ f(c, {
				gap: "2xs",
				children: [
					/* @__PURE__ */ d(l, { children: i.message }),
					n.includes(i.status) && /* @__PURE__ */ d(l, { children: "Action requested" }),
					s.includes(i.status) && /* @__PURE__ */ d(l, { children: "Your work is saved. You can keep using the workspace." })
				]
			})
		}, i.status))]
	});
}, g = {
	render: () => /* @__PURE__ */ d(h, {}),
	play: async ({ canvas: r }) => {
		await n(r.getAllByRole("alert")).toHaveLength(4);
		let i = e(r.getAllByRole("alert")[3]), a = i.getByRole("button", { name: "Dismiss error notice" }).getBoundingClientRect(), o = i.getByText("Extension runtime stopped").getBoundingClientRect(), s = r.getAllByRole("alert")[3].firstElementChild.getBoundingClientRect(), c = i.getByRole("button", { name: "Restart service" }).getBoundingClientRect(), l = (e) => e.top + e.height / 2;
		await n(Math.abs(l(a) - l(o))).toBeLessThanOrEqual(1), await n(Math.abs(l(s) - l(o))).toBeLessThanOrEqual(1), await n(o.left - s.right).toBeGreaterThanOrEqual(8), await n(a.bottom).toBeLessThanOrEqual(c.top), await t.click(i.getByRole("button", { name: "Restart service" })), await n(i.getByText("Action requested")).toBeVisible(), await t.click(i.getByRole("button", { name: "Show details" })), await n(i.getByText("Your work is saved. You can keep using the workspace.")).toBeVisible(), await t.click(i.getByRole("button", { name: "Dismiss error notice" })), await n(r.getAllByRole("alert")).toHaveLength(3), await t.click(r.getByRole("button", { name: "Reset alerts" })), await n(r.getAllByRole("alert")).toHaveLength(4);
	}
}, _ = { render: () => /* @__PURE__ */ f(c, {
	gap: "sm",
	children: [
		/* @__PURE__ */ d(r, {
			status: "info",
			title: "Pipeline saved"
		}),
		/* @__PURE__ */ d(r, {
			status: "success",
			title: "Workspace ready",
			children: "Everything is configured and ready to go."
		}),
		/* @__PURE__ */ d(r, {
			status: "warning",
			title: "Merge conflicts detected"
		}),
		/* @__PURE__ */ d(r, {
			status: "error",
			title: "Hook failed"
		})
	]
}) }, v = {
	render: () => /* @__PURE__ */ d(a, {
		width: "2xs",
		maxW: "full",
		children: /* @__PURE__ */ d(r, {
			role: "alert",
			status: "error",
			title: "Extension runtime stopped",
			onClose: () => {},
			endElement: /* @__PURE__ */ f(u, { children: [/* @__PURE__ */ d(o, { children: "Restart service" }), /* @__PURE__ */ d(o, { children: "Show diagnostic details" })] }),
			children: "The process ended unexpectedly. Your work is saved."
		})
	}),
	play: async ({ canvas: e }) => {
		let t = e.getByRole("alert");
		await n(t.scrollWidth).toBeLessThanOrEqual(t.clientWidth);
	}
}, y = { render: () => /* @__PURE__ */ d(r, {
	status: "warning",
	title: "No connection available",
	children: /* @__PURE__ */ f(c, {
		gap: "xs",
		children: [/* @__PURE__ */ d(l, { children: "Review the connection settings, then check again." }), /* @__PURE__ */ f(s, {
			gap: "xs",
			wrap: "wrap",
			children: [/* @__PURE__ */ d(o, {
				variant: "outline",
				children: "Review settings"
			}), /* @__PURE__ */ d(o, {
				variant: "outline",
				children: "Check again"
			})]
		})]
	})
}) }, b = { render: () => /* @__PURE__ */ f(c, {
	gap: "sm",
	children: [/* @__PURE__ */ d(r, {
		status: "error",
		title: "Could not load conversation",
		onClose: () => {},
		endElement: /* @__PURE__ */ d(o, { children: "Retry" }),
		children: "The server had a temporary problem."
	}), /* @__PURE__ */ d(r, {
		status: "error",
		title: "Could not load conversation",
		onClose: () => {},
		children: "This session no longer exists."
	})]
}) }, x = {
	render: () => /* @__PURE__ */ d(a, {
		width: "sm",
		maxW: "full",
		children: /* @__PURE__ */ d(r, {
			status: "error",
			role: "alert",
			title: `Service unavailable: ${"long-service-name".repeat(12)}`,
			onClose: () => {},
			endElement: /* @__PURE__ */ d(o, { children: `Restart ${"unbroken-service-name".repeat(8)}` }),
			children: `Unable to load /${"unbroken-resource-path".repeat(30)}.`
		})
	}),
	play: async ({ canvas: e }) => {
		let t = e.getByRole("alert");
		await n(t.scrollWidth).toBeLessThanOrEqual(t.clientWidth);
	}
}, S = (e) => {
	let { titleOnly: t = !1, constrained: n = !1 } = e, [s, p] = i(!1), [m, h] = i(!1), g = Array.from({ length: 100 }, (e, t) => `Diagnostic ${t}: /${"resource-path".repeat(10)}`).join("\n");
	return /* @__PURE__ */ d(c, {
		width: "sm",
		maxW: "full",
		height: n ? "48" : void 0,
		minH: "0",
		children: m ? /* @__PURE__ */ f(u, { children: [/* @__PURE__ */ d(l, { children: "Dismissed" }), /* @__PURE__ */ d(o, {
			onClick: () => {
				h(!1), p(!1);
			},
			children: "Reset alert"
		})] }) : /* @__PURE__ */ d(r, {
			status: "error",
			role: "alert",
			title: t ? g : "Service unavailable",
			onClose: () => h(!0),
			endElement: /* @__PURE__ */ d(o, {
				onClick: () => p(!0),
				children: s ? "Requested" : "Retry"
			}),
			children: t ? null : /* @__PURE__ */ f(a, {
				as: "pre",
				children: [g, s ? "\nRetry requested" : ""]
			})
		})
	});
}, C = async ({ canvas: e, canvasElement: r }) => {
	let i = e.getByRole("alert"), a = i.getBoundingClientRect(), o = r.ownerDocument.defaultView;
	await n(a.height).toBeLessThanOrEqual(o.innerHeight / 2), await n(i.scrollWidth).toBeLessThanOrEqual(i.clientWidth);
	let s = i.querySelector("[data-scope=\"scroll-area\"][data-part=\"viewport\"]");
	await n(s.scrollHeight).toBeGreaterThan(s.clientHeight), s.scrollTop = s.scrollHeight, await n(s.scrollTop).toBeGreaterThan(0);
	let c = i.querySelector("[data-part=\"scrollbar\"][data-orientation=\"vertical\"]"), l = c.querySelector("[data-part=\"thumb\"]"), u = o.getComputedStyle(i);
	await n(o.getComputedStyle(l).backgroundColor).toBe(u.color), await n(Math.abs(c.getBoundingClientRect().right - a.right + Number.parseFloat(u.paddingRight))).toBeLessThan(1), await t.hover(c), await n(o.getComputedStyle(l).backgroundColor).toBe(u.color), await t.unhover(c);
	let d = e.getByRole("button", { name: "Retry" });
	await n(d.getBoundingClientRect().bottom).toBeLessThanOrEqual(a.bottom), await t.click(d), await n(e.getByRole("button", { name: "Requested" })).toBeVisible(), await t.click(e.getByRole("button", { name: "Dismiss" })), await n(e.getByText("Dismissed")).toBeVisible(), await t.click(e.getByRole("button", { name: "Reset alert" }));
}, w = {
	render: () => /* @__PURE__ */ d(S, {}),
	play: C
}, T = {
	render: () => /* @__PURE__ */ d(S, { titleOnly: !0 }),
	play: C
}, E = {
	render: () => /* @__PURE__ */ d(S, { constrained: !0 }),
	play: async (e) => {
		let t = e.canvas.getByRole("alert");
		await n(t.getBoundingClientRect().height).toBeLessThanOrEqual(t.parentElement.getBoundingClientRect().height), await C(e);
	}
}, D = {
	render: () => /* @__PURE__ */ d(S, {}),
	play: async ({ canvas: e }) => {
		let r = t.setup();
		await r.click(e.getByRole("button", { name: "Copy error message" }));
		let i = await navigator.clipboard.readText();
		await n(i).toContain("Service unavailable"), await n(i).toContain("Diagnostic 99"), await n(i).not.toContain("Copy error message"), await n(i).not.toContain("Retry"), await r.click(e.getByRole("button", { name: "Retry" })), await r.click(e.getByRole("button", { name: "Copied" })), await n(await navigator.clipboard.readText()).toContain("Retry requested");
	}
};
export { g as Actions, E as ConstrainedContent, D as CopyMessage, x as LongContent, v as NarrowActions, b as Recoverable, _ as Statuses, w as VariableContent, T as VariableTitle, y as WarningActions, p as default };

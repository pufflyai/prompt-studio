// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e, s as t, t as n } from "./test-CYwQ_LKY.ts";
import { t as r } from "./workbench-core-kaLFKJEn.ts";
import { t as i } from "./action-errors-CACpJ-MK.ts";
import { i as a } from "./workbench-panels-B-95YOBF.ts";
import { i as o, t as s } from "./workbench-BbqJVWhj.ts";
import { t as c } from "./workbench-theme-provider-CQSyY8qK.ts";
import { useState as l } from "react";
import { Box as u, Button as d, HStack as f, Stack as p } from "@chakra-ui/react";
import { Toaster as m } from "@pstdio/ui";
import { jsx as h, jsxs as g } from "react/jsx-runtime";
var _ = {
	title: "pstdio-workbench/Reference/Core API/Error feedback",
	component: (e) => {
		let { errorCount: t = 0, longMessages: n = !1, statusHidden: _ = !1 } = e, [v] = l(() => {
			let e = r();
			_ && (e.modes.registerMode({
				id: "hidden-status",
				chrome: { status: !1 },
				activate: () => void 0
			}), e.modes.setActiveMode("hidden-status")), e.commands.registerCommand({
				id: "restart-service",
				label: "Restart service"
			}, { execute: () => {
				throw Error("The service could not be restarted. Try again when the connection recovers.");
			} });
			for (let r = 0; r < t; r++) e.notifications.show({
				id: `system-error-${r}`,
				level: "error",
				title: `System error ${r + 1}${n ? `: ${"extension-process-".repeat(12)}` : ""}`,
				message: n ? `Unable to load /${"long-unbroken-resource-name".repeat(30)}.\n${"The service is unavailable. ".repeat(8)}` : "The extension process stopped unexpectedly. Restart it to recover.",
				actions: n ? [{
					title: `Restart ${"unbroken-service-name".repeat(8)}`,
					commandId: "restart-service"
				}] : [{
					title: "Restart service",
					commandId: "restart-service"
				}]
			});
			return e;
		}), y = /* @__PURE__ */ g(u, {
			flex: "1",
			children: [/* @__PURE__ */ g(f, {
				flexWrap: "wrap",
				children: [
					/* @__PURE__ */ h(d, {
						size: "sm",
						onClick: () => v.notifications.captureActionError("Save", "example-view")(/* @__PURE__ */ Error("You do not have permission to save this file.")),
						children: "Save file"
					}),
					/* @__PURE__ */ h(d, {
						size: "sm",
						onClick: () => v.notifications.show({
							id: "extension-crash",
							level: "error",
							title: "Extension stopped",
							message: "The extension process stopped unexpectedly."
						}),
						children: "Report system error"
					}),
					/* @__PURE__ */ h(d, {
						size: "sm",
						onClick: () => v.notifications.dismiss("extension-crash"),
						children: "Recover system"
					})
				]
			}), /* @__PURE__ */ h(i, {
				workbench: v,
				target: "example-view"
			})]
		});
		return _ ? /* @__PURE__ */ h(c, { children: /* @__PURE__ */ h(u, {
			h: "100dvh",
			children: /* @__PURE__ */ h(s, {
				workbench: v,
				titleBar: y
			})
		}) }) : /* @__PURE__ */ g(c, { children: [
			/* @__PURE__ */ g(p, {
				h: t ? "100dvh" : "320px",
				minW: "0",
				gap: "md",
				p: "md",
				children: [y, /* @__PURE__ */ h(a, { workbench: v })]
			}),
			/* @__PURE__ */ h(o, { workbench: v }),
			/* @__PURE__ */ h(m, {})
		] });
	},
	parameters: { layout: "fullscreen" }
}, v = { play: async ({ canvas: t }) => {
	await e.click(t.getByRole("button", { name: "Save file" })), await n(t.getByRole("alert")).toHaveTextContent("You do not have permission"), await n(t.queryByRole("button", { name: /^System errors:/ })).not.toBeInTheDocument(), await e.click(t.getByRole("button", { name: "Report system error" })), await n(t.getByRole("button", { name: "System errors: Extension stopped" })).toBeVisible(), await e.click(t.getByRole("button", { name: "Recover system" })), await n(t.queryByRole("button", { name: /^System errors:/ })).not.toBeInTheDocument(), await n(t.getByRole("alert")).toHaveTextContent("You do not have permission");
} }, y = {
	args: { errorCount: 12 },
	play: async ({ canvas: r, canvasElement: i }) => {
		await e.click(r.getByRole("button", { name: /^System errors:/ }));
		let a = await t(i.ownerDocument.body).findByRole("region", { name: "System error list" });
		await n(t(a).getAllByRole("button", { name: /^Dismiss / })).toHaveLength(12), await n(a.scrollHeight).toBeGreaterThan(a.clientHeight), await n(a.scrollWidth).toBeLessThanOrEqual(a.clientWidth);
	}
}, b = {
	args: { errorCount: 1 },
	play: async ({ canvas: r, canvasElement: i }) => {
		await e.click(r.getByRole("button", { name: /^System errors:/ }));
		let a = t(i.ownerDocument.body), o = await a.findByRole("region", { name: "System error list" });
		await e.click(t(o).getByRole("button", { name: "Restart service" })), await n(t(o).getByText("The service could not be restarted. Try again when the connection recovers.")).toBeVisible(), await n(a.getByText("System errors (1)", { exact: !0 })).toBeVisible();
	}
}, x = {
	args: {
		errorCount: 12,
		longMessages: !0
	},
	play: async (r) => {
		await y.play?.(r);
		let i = t(r.canvasElement.ownerDocument.body), a = i.getByRole("region", { name: "System error list" });
		await e.click(t(a).getAllByRole("button", { name: /^Restart / })[0]), await n(t(a).getByText("The service could not be restarted. Try again when the connection recovers.")).toBeVisible(), await n(i.getByText("System errors (12)", { exact: !0 })).toBeVisible();
	}
}, S = {
	args: { errorCount: 100 },
	play: async ({ canvas: r, canvasElement: i }) => {
		await e.click(r.getByRole("button", { name: /^System errors:/ }));
		let a = await t(i.ownerDocument.body).findByRole("region", { name: "System error list" });
		await n(t(a).getAllByRole("button", { name: /^Dismiss / })).toHaveLength(100), a.scrollTop = a.scrollHeight, await n(t(a).getByText("System error 1", { exact: !0 })).toBeVisible();
	}
}, C = {
	args: { statusHidden: !0 },
	play: async ({ canvas: t, canvasElement: r }) => {
		let i = r.querySelector("[data-workbench-region=\"status\"]");
		await n(i).not.toBeVisible(), await e.click(t.getByRole("button", { name: "Save file" })), await n(t.getByRole("alert")).toHaveTextContent("You do not have permission"), await n(i).not.toBeVisible(), await e.click(t.getByRole("button", { name: "Report system error" })), await n(i).toBeVisible(), await n(t.getByRole("button", { name: "System errors: Extension stopped" })).toBeVisible(), await e.click(t.getByRole("button", { name: "Recover system" })), await n(i).not.toBeVisible();
	}
};
export { C as HiddenStatusBar, S as HundredSystemErrors, x as LongSystemErrors, b as RecoveryActions, v as SystemAndActionErrors, y as TwelveSystemErrors, _ as default };

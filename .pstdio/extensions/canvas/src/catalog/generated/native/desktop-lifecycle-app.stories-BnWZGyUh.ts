// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, r as t } from "./test-whhQHjQi.ts";
import { t as n } from "./desktop-starting-state-wFsx3atB.ts";
import "react";
import { Box as r, Button as i, Flex as a, HStack as o, Heading as s, Spinner as c, Stack as l, Text as u } from "@chakra-ui/react";
import { AlertMessage as d, SimpleCard as f, SimpleCardBody as p, WindowTitleBar as m } from "@pstdio/ui";
import { jsx as h, jsxs as g } from "react/jsx-runtime";
// clients/desktop/src/renderer/desktop-lifecycle-app.tsx
var _ = {
	copyDiagnostics: () => window.promptStudioDesktop.copyDiagnostics(),
	openLogs: () => window.promptStudioDesktop.openLogs(),
	quitApp: () => window.promptStudioDesktop.quitApp(),
	retryRuntime: () => window.promptStudioDesktop.retryRuntime()
}, v = (e) => {
	let { actions: t, state: n } = e, r = new Set(n.error.actions);
	return /* @__PURE__ */ h(f, {
		width: "full",
		maxHeight: "full",
		display: "flex",
		minHeight: "0",
		children: /* @__PURE__ */ h(p, {
			display: "flex",
			minHeight: "0",
			width: "full",
			children: /* @__PURE__ */ g(l, {
				gap: "lg",
				role: "alert",
				minHeight: "0",
				minWidth: "0",
				width: "full",
				children: [
					/* @__PURE__ */ h(s, {
						textStyle: "heading/M",
						flexShrink: "0",
						children: "Prompt Studio needs attention"
					}),
					/* @__PURE__ */ h(d, {
						status: "error",
						title: n.error.code,
						children: n.error.message
					}),
					/* @__PURE__ */ g(o, {
						gap: "xs",
						flexWrap: "wrap",
						flexShrink: "0",
						children: [
							r.has("retry") && /* @__PURE__ */ h(i, {
								onClick: t.retryRuntime,
								children: "Retry"
							}),
							r.has("open_logs") && /* @__PURE__ */ h(i, {
								variant: "outline",
								onClick: t.openLogs,
								children: "Open logs"
							}),
							r.has("copy_diagnostics") && /* @__PURE__ */ h(i, {
								variant: "outline",
								onClick: t.copyDiagnostics,
								children: "Copy diagnostics"
							}),
							r.has("quit") && /* @__PURE__ */ h(i, {
								variant: "ghost",
								onClick: t.quitApp,
								children: "Quit"
							})
						]
					})
				]
			})
		})
	});
}, y = () => /* @__PURE__ */ g(l, {
	align: "center",
	gap: "lg",
	role: "status",
	"aria-live": "polite",
	children: [/* @__PURE__ */ h(c, {
		size: "lg",
		color: "fg.muted",
		"aria-hidden": "true",
		_motionReduce: { display: "none" }
	}), /* @__PURE__ */ g(l, {
		align: "center",
		gap: "xs",
		textAlign: "center",
		children: [/* @__PURE__ */ h(s, {
			textStyle: "heading/M",
			children: "Closing Prompt Studio"
		}), /* @__PURE__ */ h(u, {
			color: "fg.muted",
			textStyle: "paragraph/M/regular",
			children: "Waiting for the runtime to finish safely. This can take a while."
		})]
	})]
}), b = (e) => {
	let { actions: t = _, state: i, platform: a = "darwin" } = e;
	return i.kind === "workbench" || i.kind === "confirming_active_work" ? null : /* @__PURE__ */ g(l, {
		as: "main",
		width: "full",
		height: "100dvh",
		overflow: "hidden",
		bg: "bg",
		color: "fg",
		gap: "0",
		children: [/* @__PURE__ */ h(m, { platform: a }), /* @__PURE__ */ h(r, {
			flex: "1",
			minHeight: "0",
			display: "flex",
			justifyContent: "center",
			padding: "xl",
			children: /* @__PURE__ */ g(r, {
				width: "full",
				maxWidth: "2xl",
				height: "full",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				children: [
					i.kind === "starting" && /* @__PURE__ */ h(n, { phase: i.phase }),
					i.kind === "recovery" && /* @__PURE__ */ h(v, {
						actions: t,
						state: i
					}),
					i.kind === "closing" && /* @__PURE__ */ h(y, {})
				]
			})
		})]
	});
}, x = {
	copyDiagnostics: async () => {},
	openLogs: async () => {},
	quitApp: async () => {},
	revealInFinder: async () => {},
	retryRuntime: async () => {}
}, S = async (n) => {
	let r = e(n).getByRole("main"), i = r.parentElement.getBoundingClientRect().width;
	await t(r.getBoundingClientRect().width).toBe(i), await t(r.querySelector("[data-window-title-bar]").getBoundingClientRect().width).toBe(i);
	let a = e(n).queryByRole("status");
	if (a) {
		let e = a.getBoundingClientRect(), n = r.getBoundingClientRect();
		await t(Math.abs(e.x + e.width / 2 - n.x - i / 2)).toBeLessThan(1);
	}
}, C = {
	title: "Patterns/Desktop/Lifecycle",
	component: b,
	parameters: { layout: "fullscreen" },
	decorators: [(e) => /* @__PURE__ */ h(a, { children: /* @__PURE__ */ h(e, {}) })],
	play: async ({ canvasElement: e }) => S(e),
	args: { actions: x }
}, w = { args: { state: {
	kind: "starting",
	phase: "discovery"
} } }, T = { args: { state: {
	kind: "starting",
	phase: "spawning"
} } }, E = { args: { state: {
	kind: "starting",
	phase: "retiring"
} } }, D = { args: { state: {
	kind: "starting",
	phase: "readiness"
} } }, O = async (n) => {
	await t(e(n).queryByRole("main")).not.toBeInTheDocument(), await t(n.querySelector("[data-window-title-bar]")).not.toBeInTheDocument();
}, k = {
	tags: ["!manifest"],
	args: { state: {
		kind: "workbench",
		runtime: {
			instanceId: "runtime-one",
			origin: "http://127.0.0.1:43127",
			ownerType: "desktop"
		}
	} },
	play: async ({ canvasElement: e }) => O(e)
}, A = {
	tags: ["!manifest"],
	args: { state: {
		kind: "confirming_active_work",
		runtime: {
			instanceId: "runtime-one",
			origin: "http://127.0.0.1:43127",
			ownerType: "desktop"
		},
		activity: {
			sessions: [{
				id: "session-one",
				label: "PS-217 implementation"
			}],
			terminals: [],
			jobs: []
		}
	} },
	play: async ({ canvasElement: e }) => O(e)
}, j = { args: { state: {
	kind: "recovery",
	error: {
		code: "pglite_recovery_failure",
		message: "Prompt Studio could not open its database safely.",
		actions: [
			"retry",
			"open_logs",
			"copy_diagnostics",
			"quit"
		]
	}
} } }, M = { args: { state: { kind: "closing" } } }, N = {
	args: { state: {
		kind: "recovery",
		error: {
			code: "unexpected_exit",
			message: Array.from({ length: 80 }, (e, t) => `Startup log ${t}: ENOENT: /project/.pstdio/extensions/example/src/workbench/src/views/notebook.tsx`).join("\n"),
			actions: [
				"retry",
				"open_logs",
				"copy_diagnostics",
				"quit"
			]
		}
	} },
	play: async ({ canvasElement: n }) => {
		await S(n);
		let r = e(n), i = r.getByRole("main"), a = n.ownerDocument.defaultView;
		await t(i.getBoundingClientRect().height).toBeLessThanOrEqual(a.innerHeight);
		let o = i.querySelector("[data-scope=\"scroll-area\"][data-part=\"viewport\"]");
		await t(o.scrollHeight).toBeGreaterThan(o.clientHeight), o.scrollTop = o.scrollHeight, await t(o.scrollTop).toBeGreaterThan(0);
		for (let e of [
			"Retry",
			"Open logs",
			"Copy diagnostics",
			"Quit"
		]) {
			let n = r.getByRole("button", { name: e });
			await t(n).toBeVisible();
			let i = n.getBoundingClientRect();
			await t(i.top).toBeGreaterThanOrEqual(0), await t(i.bottom).toBeLessThanOrEqual(a.innerHeight);
		}
	}
};
export { A as ActiveWorkInWorkbench, E as BackingUpPreviousData, M as Closing, N as LongRecoveryDetails, j as Recovery, w as StartingDiscovery, T as StartingRuntime, D as WaitingForWorkbench, k as Workbench, C as default };

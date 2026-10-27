// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./cpu-DJuq_2-_.ts";
import { t } from "./terminal-B2gAfUK-.ts";
import { a as n, s as r, t as i } from "./test-CYwQ_LKY.ts";
import { t as a } from "./workspace-agent-menu-DHlog8io.ts";
import { useState as o } from "react";
import { Box as s, Button as c, Dialog as l, Stack as u, Text as d } from "@chakra-ui/react";
import { jsx as f, jsxs as p } from "react/jsx-runtime";
// packages/pstdio-dashboard/src/shared/components/workspace-agent-menu.stories.tsx
var m = {
	title: "Shared/WorkspaceAgentMenu",
	component: a,
	parameters: { layout: "padded" },
	decorators: [(e) => /* @__PURE__ */ f(s, {
		maxWidth: "400px",
		children: /* @__PURE__ */ f(e, {})
	})]
}, h = [
	{
		label: "Claude Code",
		value: "claude-code",
		icon: t
	},
	{
		label: "OpenCode",
		value: "opencode",
		icon: t
	},
	{
		label: "Codex",
		value: "codex",
		icon: e
	}
], g = {
	"claude-code": [
		{
			label: "Claude Sonnet 4",
			value: "claude-sonnet-4",
			description: "Balanced speed and intelligence"
		},
		{
			label: "Claude Opus 4",
			value: "claude-opus-4"
		},
		{
			label: "Claude Haiku 4",
			value: "claude-haiku-4"
		}
	],
	opencode: [
		{
			label: "openai/gpt-5.5",
			value: "openai/gpt-5.5"
		},
		{
			label: "opencode/gpt-5.5",
			value: "opencode/gpt-5.5"
		},
		{
			label: "google/gemini-2.5-pro",
			value: "google/gemini-2.5-pro"
		}
	],
	codex: [{
		label: "GPT-4o",
		value: "gpt-4o"
	}, {
		label: "o3",
		value: "o3"
	}]
}, _ = {
	"claude-code": "claude-sonnet-4",
	opencode: "openai/gpt-5.5",
	codex: "o3"
}, v = { render: () => {
	let [e, t] = o("claude-code"), [n, r] = o("claude-sonnet-4");
	return /* @__PURE__ */ f(a, {
		agentOptions: h,
		selectedAgent: e,
		onSelectAgent: (e) => {
			t(e), r(_[e] ?? "");
		},
		modelOptions: g[e] ?? [],
		selectedModel: n,
		onSelectModel: r
	});
} }, y = { render: () => {
	let [e, t] = o("claude-sonnet-4");
	return /* @__PURE__ */ f(a, {
		agentOptions: [h[0]],
		selectedAgent: "claude-code",
		onSelectAgent: () => void 0,
		modelOptions: g["claude-code"],
		selectedModel: e,
		onSelectModel: t
	});
} }, b = { render: () => {
	let [e, t] = o("claude-code");
	return /* @__PURE__ */ f(a, {
		agentOptions: h,
		selectedAgent: e,
		onSelectAgent: t,
		modelOptions: [],
		selectedModel: "",
		onSelectModel: () => void 0
	});
} }, x = {
	render: () => {
		let [t, n] = o("claude-code");
		return /* @__PURE__ */ f(a, {
			agentOptions: [...h, {
				label: "Outdated Agent",
				value: "unavailable",
				icon: e,
				disabled: !0
			}],
			selectedAgent: t,
			onSelectAgent: n,
			modelOptions: [],
			selectedModel: "",
			onSelectModel: () => void 0,
			offersModels: !1
		});
	},
	play: async ({ canvasElement: e }) => {
		let t = r(e), a = r(document.body);
		await i(t.queryByRole("button", { name: "Select model" })).toBeNull(), await n.click(t.getByRole("button", { name: "Select harness" })), await n.click(await a.findByRole("menuitem", { name: "Outdated Agent" }), { pointerEventsCheck: 0 }), await i(t.getByRole("button", { name: "Select harness" })).toHaveTextContent("Claude Code"), a.queryByRole("menuitem", { name: "Codex" }) || await n.click(t.getByRole("button", { name: "Select harness" })), await n.click(await a.findByRole("menuitem", { name: "Codex" })), await i(t.getByRole("button", { name: "Select harness" })).toHaveTextContent("Codex");
	}
}, S = {
	args: {
		agentOptions: h,
		selectedAgent: "claude-code",
		onSelectAgent: () => void 0,
		modelOptions: [],
		selectedModel: "",
		onSelectModel: () => void 0,
		offersModels: !1,
		isAgentSwitchDisabled: !0
	},
	play: async ({ canvasElement: e }) => {
		await i(r(e).queryByRole("button")).toBeNull();
	}
}, C = { args: {
	agentOptions: h,
	selectedAgent: "claude-code",
	onSelectAgent: () => void 0,
	modelOptions: g["claude-code"],
	selectedModel: "claude-sonnet-4",
	onSelectModel: () => void 0,
	isDisabled: !0
} }, w = { render: () => {
	let [e, t] = o("claude-sonnet-4");
	return /* @__PURE__ */ f(a, {
		agentOptions: h,
		selectedAgent: "claude-code",
		onSelectAgent: () => void 0,
		modelOptions: g["claude-code"],
		selectedModel: e,
		onSelectModel: t,
		isAgentSwitchDisabled: !0
	});
} }, T = "Requires Codex 0.157.0 or newer. Found 0.155.0.", E = {
	render: () => {
		let [t, n] = o("claude-code"), [r, i] = o("claude-sonnet-4"), s = [...h, {
			label: "Outdated Agent",
			value: "unavailable",
			icon: e,
			disabled: !0,
			description: T
		}];
		return /* @__PURE__ */ f(a, {
			agentOptions: s,
			selectedAgent: t,
			onSelectAgent: (e) => {
				n(e), i(_[e] ?? "");
			},
			modelOptions: g[t] ?? [],
			selectedModel: r,
			onSelectModel: i
		});
	},
	play: async ({ canvasElement: e }) => {
		await n.click(r(e).getByRole("button", { name: "Select model" })), await n.click(await r(document.body).findByRole("menuitem", { name: "Select harness" })), await i(await r(document.body).findByText(T)).toBeVisible();
	}
}, D = { args: {
	agentOptions: [],
	selectedAgent: "",
	onSelectAgent: () => void 0,
	modelOptions: [],
	selectedModel: "",
	onSelectModel: () => void 0,
	isAgentsLoading: !0,
	isModelsLoading: !0
} }, O = { render: () => {
	let [e, t] = o(""), [n, r] = o("");
	return /* @__PURE__ */ f(a, {
		agentOptions: h,
		selectedAgent: e,
		onSelectAgent: (e) => {
			t(e), r(_[e] ?? "");
		},
		modelOptions: g[e] ?? [],
		selectedModel: n,
		onSelectModel: r
	});
} }, k = { args: {
	agentOptions: [],
	selectedAgent: "",
	onSelectAgent: () => {},
	modelOptions: [],
	selectedModel: "",
	onSelectModel: () => {}
} }, A = {
	tags: ["!manifest"],
	parameters: { layout: "fullscreen" },
	render: () => {
		let [e, t] = o("claude-code"), [n, r] = o("claude-sonnet-4");
		return /* @__PURE__ */ p(l.Root, {
			open: !0,
			size: "lg",
			scrollBehavior: "inside",
			children: [/* @__PURE__ */ f(l.Backdrop, {}), /* @__PURE__ */ f(l.Positioner, { children: /* @__PURE__ */ p(l.Content, {
				display: "flex",
				flexDirection: "column",
				maxH: "calc(100% - 48px)",
				children: [
					/* @__PURE__ */ f(l.Header, { children: /* @__PURE__ */ f(l.Title, { children: "Run review" }) }),
					/* @__PURE__ */ f(l.Body, {
						flex: "1",
						minH: "0",
						children: /* @__PURE__ */ f(s, {
							h: "3.5rem",
							overflow: "hidden",
							children: /* @__PURE__ */ p(u, {
								gap: "2xs",
								children: [/* @__PURE__ */ f(d, {
									textStyle: "label/S/medium",
									children: "Harness"
								}), /* @__PURE__ */ f(a, {
									agentOptions: h,
									selectedAgent: e,
									onSelectAgent: (e) => {
										t(e), r(_[e] ?? "");
									},
									modelOptions: g[e] ?? [],
									selectedModel: n,
									onSelectModel: r,
									shouldDisableSingleAgentSwitch: !1
								})]
							})
						})
					}),
					/* @__PURE__ */ p(l.Footer, { children: [/* @__PURE__ */ f(c, {
						variant: "ghost",
						size: "sm",
						children: "Cancel"
					}), /* @__PURE__ */ f(c, {
						variant: "primary",
						size: "sm",
						children: "Run"
					})] })
				]
			}) })]
		});
	},
	play: async ({ canvasElement: e }) => {
		let t = r(e);
		await n.click(t.getByRole("button", { name: "Select model" })), await r(document.body).findByTestId("workspace-agent-model-options");
		let a = r(document.body).getByRole("menuitem", { name: "Claude Opus 4" });
		await i(r(document.body).queryByRole("option", { name: "Claude Opus 4" })).not.toBeInTheDocument();
		let o = a.getBoundingClientRect(), s = document.elementFromPoint(o.left + o.width / 2, o.top + o.height / 2);
		await i(a.contains(s) || s?.contains(a)).toBe(!0);
	}
};
export { A as CommandDialogPlacement, v as Default, C as Disabled, w as DisabledAgentSwitch, D as Loading, k as NoHarnessAvailable, b as NoModels, O as NoSelection, y as SingleAgent, E as WithDisabledAgent, x as WithoutModelChoice, S as WithoutModelChoiceLockedAgent, m as default };

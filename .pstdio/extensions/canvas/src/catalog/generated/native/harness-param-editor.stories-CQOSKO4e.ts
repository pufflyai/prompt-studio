// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, p as t, r as n } from "./test-whhQHjQi.ts";
import { t as r } from "./param-editor-row-DC3JM-ZX.ts";
import { t as i } from "./param-editor-BmiGNfdQ.ts";
import { useState as a } from "react";
import { Box as o, Dialog as s, Portal as c, Stack as l } from "@chakra-ui/react";
import { Fragment as u, jsx as d, jsxs as f } from "react/jsx-runtime";
// packages/ui/src/components/param-editor/harness-param-colors.ts
var p = {
	CircleSlash: "gray",
	"level-low": "gray",
	"level-mid": "blue",
	"level-high": "orange",
	"level-xhigh": "red",
	flame: "red"
}, m = (e) => e ? p[e] : void 0, h = (e, t) => typeof t == "string" ? t : t ? t.default ?? t.$l10n : e.replace(/[-_]/g, " "), g = (e, t) => {
	let { [t]: n, ...r } = e;
	return r;
}, _ = (e, t, n, r) => Object.is(t?.[n], r) ? g(e, n) : {
	...e,
	[n]: r
}, v = (e, t, n, r) => {
	let i = r[e] ?? n?.[e] ?? t.defaultValue;
	return i === void 0 ? t.type === "boolean" ? !1 : t.options[0]?.value ?? "" : i;
}, y = (e, t) => {
	let n = h(e, t.label), r = h("", t.description) || void 0;
	return t.type === "boolean" ? {
		id: e,
		type: "boolean",
		name: n,
		description: r,
		defaultValue: t.defaultValue ?? !1
	} : {
		id: e,
		type: "selection",
		name: n,
		description: r,
		defaultValue: t.defaultValue ?? t.options[0]?.value ?? "",
		options: t.options.map((e) => ({
			id: e.value,
			name: e.label,
			icon: e.icon,
			color: m(e.icon)
		}))
	};
}, b = (e) => {
	let { schema: t, defaults: n, overrides: i, onOverridesChange: a, disabled: o = !1 } = e, s = Object.entries(t ?? {});
	if (s.length === 0) return null;
	let c = s.map(([e, t]) => y(e, t)), l = Object.fromEntries(s.map(([e, t]) => [e, v(e, t, n, i)])), f = (e, t) => {
		(typeof t == "string" || typeof t == "boolean") && a(_(i, n, e, t));
	};
	return /* @__PURE__ */ d(u, { children: c.map((e) => /* @__PURE__ */ d(r, {
		param: e,
		values: l,
		readOnly: o,
		onChange: f
	}, e.id)) });
}, x = {
	model_reasoning_effort: {
		type: "select",
		label: "Reasoning effort",
		defaultValue: "medium",
		options: [
			{
				label: "None",
				value: "none",
				icon: "CircleSlash"
			},
			{
				label: "Minimal",
				value: "minimal",
				icon: "level-low"
			},
			{
				label: "Low",
				value: "low",
				icon: "level-low"
			},
			{
				label: "Medium",
				value: "medium",
				icon: "level-mid"
			},
			{
				label: "High",
				value: "high",
				icon: "level-high"
			},
			{
				label: "XHigh",
				value: "xhigh",
				icon: "level-xhigh"
			},
			{
				label: "Max",
				value: "max",
				icon: "flame"
			}
		]
	},
	model_reasoning_summary: {
		type: "select",
		label: "Summary",
		defaultValue: "auto",
		options: [
			{
				label: "Auto",
				value: "auto",
				icon: "Sparkles"
			},
			{
				label: "Concise",
				value: "concise",
				icon: "AlignLeft"
			},
			{
				label: "Detailed",
				value: "detailed",
				icon: "FileText"
			}
		]
	},
	dryRun: {
		type: "boolean",
		label: "Dry run",
		defaultValue: !1
	}
}, S = [{
	id: "model",
	name: "Model",
	type: "selection",
	defaultValue: "gpt-5.3-codex",
	searchable: !0,
	searchPlaceholder: "Search models…",
	options: [{
		id: "gpt-5.3-codex",
		name: "GPT-5.3 Codex",
		icon: "Cpu"
	}, {
		id: "gpt-5.2-codex",
		name: "GPT-5.2 Codex",
		icon: "Cpu"
	}],
	group: {
		id: "harness",
		name: "Harness",
		defaultValue: "codex",
		options: [{
			id: "codex",
			name: "Codex",
			icon: "Terminal"
		}, {
			id: "claude-code",
			name: "Claude Code",
			icon: "Terminal"
		}]
	}
}, {
	id: "workspace",
	name: "Workspace",
	type: "selection",
	defaultValue: "PS-10_A1",
	searchable: !0,
	searchPlaceholder: "Search workspaces…",
	options: [{
		id: "PS-10_A1",
		name: "PS-10_A1",
		icon: "GitBranch"
	}, {
		id: "PS-9_A1",
		name: "PS-9_A1",
		icon: "GitBranch"
	}],
	group: {
		id: "repository",
		name: "Repository",
		defaultValue: "prompt-studio",
		options: [{
			id: "prompt-studio",
			name: "prompt-studio",
			icon: "FolderGit2"
		}]
	}
}], C = {
	id: "mode",
	name: "Mode",
	type: "selection",
	defaultValue: "worktree",
	options: [{
		id: "worktree",
		name: "Worktree",
		icon: "git-branch"
	}, {
		id: "current_branch",
		name: "Current branch",
		icon: "git-commit-horizontal"
	}]
}, w = {
	title: "Components/Param Editor/Harness run options",
	component: (e) => {
		let [t, n] = a(e.initial ?? {});
		return /* @__PURE__ */ d(o, {
			maxW: "640px",
			p: "4",
			bg: "bg",
			borderWidth: "1px",
			borderColor: "border.subtle",
			children: /* @__PURE__ */ d(b, {
				schema: e.schema ?? x,
				defaults: e.defaults ?? {
					model_reasoning_effort: "medium",
					model_reasoning_summary: "auto",
					dryRun: !1
				},
				overrides: t,
				onOverridesChange: n
			})
		});
	}
}, T = {}, E = { args: { initial: {
	model_reasoning_effort: "high",
	dryRun: !0
} } }, D = { args: { defaults: {
	model_reasoning_effort: "low",
	model_reasoning_summary: "concise",
	dryRun: !1
} } }, O = { args: {
	schema: {
		...x,
		model_reasoning_effort: {
			...x.model_reasoning_effort,
			defaultValue: "high",
			options: [
				{
					label: "Low",
					value: "low",
					icon: "level-low"
				},
				{
					label: "Medium",
					value: "medium",
					icon: "level-mid"
				},
				{
					label: "High",
					value: "high",
					icon: "level-high"
				}
			]
		}
	},
	defaults: {
		model_reasoning_effort: "high",
		model_reasoning_summary: "auto",
		dryRun: !1
	}
} }, k = { decorators: [(e) => /* @__PURE__ */ d(o, {
	w: "240px",
	children: /* @__PURE__ */ d(e, {})
})] }, A = {
	parameters: { layout: "fullscreen" },
	decorators: [(e) => /* @__PURE__ */ d(s.Root, {
		open: !0,
		modal: !0,
		size: "lg",
		children: /* @__PURE__ */ f(c, { children: [/* @__PURE__ */ d(s.Backdrop, {}), /* @__PURE__ */ d(s.Positioner, { children: /* @__PURE__ */ f(s.Content, { children: [/* @__PURE__ */ d(s.Header, { children: /* @__PURE__ */ d(s.Title, { children: "Run attempt" }) }), /* @__PURE__ */ d(s.Body, { children: /* @__PURE__ */ f(l, {
			gap: "0",
			children: [
				/* @__PURE__ */ d(i, {
					params: S,
					defaultValues: {
						model: "gpt-5.3-codex",
						harness: "codex",
						workspace: "PS-10_A1",
						repository: "prompt-studio"
					}
				}),
				/* @__PURE__ */ d(e, {}),
				/* @__PURE__ */ d(i, {
					params: [C],
					defaultValues: { mode: "worktree" }
				})
			]
		}) })] }) })] })
	})],
	play: async () => {
		let r = e(document.body);
		await n(r.getByRole("button", { name: "GPT-5.3 Codex" })).toBeVisible(), await n(r.getByRole("button", { name: "PS-10_A1" })).toBeVisible(), await t.click(r.getByRole("button", { name: "Medium" }));
		let i = await r.findByRole("menuitemradio", { name: "High" }), a = i.getBoundingClientRect(), o = document.elementFromPoint(a.left + a.width / 2, a.top + a.height / 2);
		await n(i.contains(o)).toBe(!0), await t.click(i), await n(r.getByRole("button", { name: "High" })).toBeVisible();
	}
};
export { D as CustomProjectDefaults, T as Defaults, A as InsideDialog, O as ModelSpecificEffortLevels, k as Narrow, E as WithOverrides, w as default };

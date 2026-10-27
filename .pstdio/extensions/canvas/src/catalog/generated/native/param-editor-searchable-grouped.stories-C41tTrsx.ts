// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./param-editor-387PxPNF.ts";
import { useState as t } from "react";
import { Container as n } from "@chakra-ui/react";
import { jsx as r } from "react/jsx-runtime";
// packages/ui/src/components/param-editor/param-editor-searchable-grouped.stories.tsx
var i = {
	title: "Patterns/Param Editor/Searchable Grouped Selection",
	component: e,
	parameters: { layout: "fullscreen" }
}, a = {
	render: (i) => {
		let [a, o] = t(i.defaultValues ?? {});
		return /* @__PURE__ */ r(n, {
			padding: "md",
			children: /* @__PURE__ */ r(e, {
				...i,
				defaultValues: a,
				onChange: (e, t) => o((n) => ({
					...n,
					[e]: t
				}))
			})
		});
	},
	args: {
		defaultValues: {
			harness: "codex",
			model: "gpt-5.3-codex",
			repository: "prompt-studio",
			workspace: "PS-10_A1",
			reasoningEffort: "medium",
			mode: "worktree"
		},
		onChange: () => {},
		params: [
			{
				id: "model",
				name: "Model",
				type: "selection",
				defaultValue: "gpt-5.3-codex",
				placeholder: "Select model",
				searchable: !0,
				searchPlaceholder: "Search models…",
				emptyText: "No models found",
				options: [
					{
						id: "gpt-5.3-codex",
						name: "GPT-5.3 Codex",
						icon: "Cpu",
						description: "Latest Codex model"
					},
					{
						id: "gpt-5.2-codex",
						name: "GPT-5.2 Codex",
						icon: "Cpu"
					},
					{
						id: "gpt-5.1-codex-max",
						name: "GPT-5.1 Codex Max",
						icon: "Cpu"
					}
				],
				group: {
					id: "harness",
					name: "Harness",
					defaultValue: "codex",
					placeholder: "Select harness",
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
			},
			{
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
					}, {
						id: "sdk",
						name: "sdk",
						icon: "FolderGit2"
					}]
				}
			},
			{
				id: "reasoningEffort",
				name: "Reasoning effort",
				type: "selection",
				defaultValue: "medium",
				options: [
					{
						id: "minimal",
						name: "Minimal",
						icon: "level-low"
					},
					{
						id: "low",
						name: "Low",
						icon: "level-low"
					},
					{
						id: "medium",
						name: "Medium",
						icon: "level-mid"
					},
					{
						id: "high",
						name: "High",
						icon: "level-high"
					},
					{
						id: "xhigh",
						name: "Extra high",
						icon: "level-xhigh"
					}
				]
			},
			{
				id: "mode",
				name: "Mode",
				type: "selection",
				defaultValue: "worktree",
				options: [{
					id: "worktree",
					name: "Worktree",
					icon: "git-branch"
				}, {
					id: "current-branch",
					name: "Current branch",
					icon: "git-commit-horizontal"
				}]
			}
		],
		readOnly: !1
	}
};
export { a as RunAttemptForm, i as default };

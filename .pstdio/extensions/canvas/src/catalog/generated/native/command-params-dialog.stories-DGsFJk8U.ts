// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e } from "./rolldown-runtime-CwxnZyOB.ts";
import { a as t, s as n, t as r } from "./test-CYwQ_LKY.ts";
import { t as i } from "./command-params-dialog-2_Mul3ay.ts";
import { t as a } from "./workbench-theme-provider-CQSyY8qK.ts";
import { useState as o } from "react";
import { Box as s, Button as c, Stack as l, Text as u } from "@chakra-ui/react";
import { jsx as d, jsxs as f } from "react/jsx-runtime";
// packages/pstdio-workbench/src/react/command-palette/command-params-dialog-source.ts
var p = (e) => `import {
  defineCommand,
  defineExtension,
  params,
} from "@pstdio/sdk/extensions";

${e}

export default defineExtension({ commands: [command] });`, m = {
	number: p("const command = defineCommand({\n  id: \"bump-counter\",\n  title: \"Bump counter\",\n  params: {\n    amount: params.number({ label: \"Amount\", defaultValue: 1 }),\n  },\n  async run(ctx, commandParams) {\n    await ctx.storage.set(\"counter\", commandParams.amount);\n  },\n});"),
	refineTicket: p("const command = defineCommand({\n  id: \"refine-ticket\",\n  title: \"Refine ticket\",\n  params: {\n    template: params.template({\n      type: \"ticket\",\n      label: \"Template\",\n      required: false,\n    }),\n    context: params.longText({\n      label: \"Additional context\",\n      required: false,\n    }),\n  },\n  async run(_ctx, commandParams) {\n    return commandParams;\n  },\n});"),
	everyControl: p("const command = defineCommand({\n  id: \"all-parameters\",\n  title: \"Run with every parameter type\",\n  params: {\n    title: params.text({ label: \"Title\", required: true }),\n    mode: params.select({\n      label: \"Mode\",\n      defaultValue: \"worktree\",\n      options: [\n        { label: \"Worktree\", value: \"worktree\" },\n        { label: \"Current branch\", value: \"current_branch\" },\n      ],\n    }),\n    labels: params.multiSelect({\n      label: \"Labels\",\n      options: [\n        { label: \"Bug\", value: \"bug\" },\n        { label: \"Feature\", value: \"feature\" },\n      ],\n    }),\n    attempts: params.number({ label: \"Attempts\", defaultValue: 2 }),\n    draft: params.boolean({ label: \"Open as draft\" }),\n    notes: params.longText({ label: \"Notes\" }),\n  },\n  async run(ctx, commandParams) {\n    await ctx.storage.set(\"last-run\", commandParams);\n  },\n});"),
	files: p("const command = defineCommand({\n  id: \"import-data\",\n  title: \"Import data files\",\n  params: {\n    files: params.files({\n      label: \"Data files\",\n      description: \"Choose one or more CSV files to import.\",\n      required: true,\n      multiple: true,\n      accept: \".csv\",\n    }),\n  },\n  async run(ctx, commandParams) {\n    await ctx.storage.set(\"last-import\", commandParams.files);\n  },\n});")
}, h = /* @__PURE__ */ e({
	DependentOptions: () => k,
	EmptyOptions: () => M,
	EveryControl: () => E,
	FailedOptions: () => j,
	FilesParameter: () => D,
	LoadingOptions: () => A,
	NumberParameter: () => w,
	RefineTicket: () => T,
	RunFailed: () => N,
	default: () => C
}), g = (e) => ({
	command: e,
	handler: { execute: () => void 0 },
	ownerId: "storybook",
	priority: 0,
	source: "module"
}), _ = g({
	id: "extension-lab.counter.bump",
	label: "Bump lab counter",
	params: { amount: {
		type: "number",
		label: "Amount",
		defaultValue: 1
	} }
}), v = g({
	id: "pstdio-planner.refine-ticket",
	label: "Refine ticket",
	description: "Research the ticket and expand it with implementation detail.",
	params: {
		template: {
			type: "template",
			label: "Template",
			required: !1,
			options: [{
				label: "Proposal",
				value: "proposal",
				icon: "FileText"
			}, {
				label: "Bug report",
				value: "bug-report",
				icon: "FileText"
			}]
		},
		context: {
			type: "longtext",
			label: "Additional context",
			required: !1
		}
	}
}), y = g({
	id: "storybook.every-param",
	label: "Run with every param type",
	params: {
		title: {
			type: "text",
			label: "Title",
			required: !0
		},
		mode: {
			type: "select",
			label: "Mode",
			defaultValue: "worktree",
			options: [{
				label: "Worktree",
				value: "worktree",
				icon: "GitFork"
			}, {
				label: "Current branch",
				value: "current_branch",
				icon: "GitBranch"
			}]
		},
		labels: {
			type: "multi-select",
			label: "Labels",
			options: [{
				label: "Bug",
				value: "bug"
			}, {
				label: "Feature",
				value: "feature"
			}]
		},
		attempts: {
			type: "number",
			label: "Attempts",
			defaultValue: 2
		},
		draft: {
			type: "boolean",
			label: "Open as draft"
		},
		notes: {
			type: "longtext",
			label: "Notes"
		}
	}
}), b = g({
	id: "storybook.files-param",
	label: "Import data files",
	params: { files: {
		type: "files",
		label: "Data files",
		description: "Choose one or more CSV files to import.",
		required: !0,
		multiple: !0,
		accept: ".csv"
	} }
}), x = (e) => ({ docs: { source: {
	code: e,
	language: "tsx",
	type: "code"
} } }), S = (e) => {
	let { onClose: t, request: n } = e, [r, a] = o(!1);
	return /* @__PURE__ */ f(l, {
		align: "flex-start",
		gap: "sm",
		p: "lg",
		children: [
			/* @__PURE__ */ f(l, {
				gap: "xs",
				children: [/* @__PURE__ */ d(u, {
					textStyle: "heading/S/semibold",
					children: n?.label
				}), /* @__PURE__ */ d(u, {
					color: "fg.muted",
					children: "The workbench builds the form from the command's parameter schema."
				})]
			}),
			/* @__PURE__ */ d(c, {
				size: "sm",
				onClick: () => a(!0),
				children: "Open parameter form"
			}),
			/* @__PURE__ */ d(i, {
				...e,
				request: r ? n : null,
				onClose: () => {
					a(!1), t();
				}
			})
		]
	});
}, C = {
	title: "pstdio-workbench/Guides/Command parameters",
	component: i,
	tags: ["!dev"],
	parameters: {
		layout: "padded",
		docs: { description: { component: "Command parameter schemas in @pstdio/sdk/extensions describe input fields. The host renders the form, validates it, and passes normalized values to the command." } }
	},
	args: {
		onClose: () => {},
		onRun: async () => {}
	},
	decorators: [(e) => /* @__PURE__ */ d(a, { children: /* @__PURE__ */ d(s, {
		minH: "180px",
		children: /* @__PURE__ */ d(e, {})
	}) })]
}, w = {
	parameters: x(m.number),
	render: (e) => /* @__PURE__ */ d(S, { ...e }),
	args: { request: {
		label: "Bump lab counter",
		record: _
	} }
}, T = {
	parameters: x(m.refineTicket),
	render: (e) => /* @__PURE__ */ d(S, { ...e }),
	args: { request: {
		label: "Refine ticket",
		record: v
	} }
}, E = {
	parameters: x(m.everyControl),
	render: (e) => /* @__PURE__ */ d(S, { ...e }),
	args: { request: {
		label: "Run with every param type",
		record: y
	} }
}, D = {
	parameters: x(m.files),
	render: (e) => /* @__PURE__ */ d(S, { ...e }),
	args: { request: {
		label: "Import data files",
		record: b
	} }
}, O = {
	label: "Run experiment",
	record: { command: {
		id: "run",
		label: "Run experiment",
		params: {
			region: {
				type: "select",
				label: "Region",
				defaultValue: "eu",
				options: [{
					value: "eu",
					label: "Europe"
				}, {
					value: "us",
					label: "United States"
				}]
			},
			locale: {
				type: "select",
				label: "Locale",
				required: !0,
				options: {
					commandId: "locales",
					valueField: "id",
					labelField: "name",
					params: { region: {
						kind: "param-value",
						key: "region"
					} }
				}
			}
		}
	} }
}, k = {
	render: (e) => /* @__PURE__ */ d(S, { ...e }),
	args: {
		request: O,
		executeOptionCommand: async (e, t) => [{
			id: t.region === "eu" ? "de" : "en",
			name: t.region === "eu" ? "German" : "English"
		}]
	}
}, A = {
	...k,
	args: {
		request: O,
		executeOptionCommand: () => new Promise(() => {})
	}
}, j = {
	...k,
	args: {
		request: O,
		executeOptionCommand: async () => {
			throw Error("Could not load locales.");
		}
	}
}, M = {
	...k,
	args: {
		request: O,
		executeOptionCommand: async () => []
	}
}, N = {
	render: (e) => /* @__PURE__ */ d(S, { ...e }),
	args: {
		request: {
			label: "Run attempt",
			record: g({
				id: "pstdio-planner.run-attempt",
				label: "Run attempt",
				params: {
					model: {
						type: "select",
						label: "Model",
						defaultValue: "opus",
						options: [{
							label: "Claude Opus",
							value: "opus",
							icon: "Cpu"
						}]
					},
					mode: {
						type: "select",
						label: "Mode",
						defaultValue: "worktree",
						options: [{
							label: "Worktree",
							value: "worktree",
							icon: "GitFork"
						}]
					}
				}
			})
		},
		onRun: async () => {
			throw Error("PS-458 can't start: it waits on PS-457, which is not done and has no attempt to build on.");
		}
	},
	play: async ({ canvasElement: e }) => {
		await t.click(n(e).getByRole("button", { name: "Open parameter form" }));
		let i = n(document.body);
		await t.click(await i.findByRole("button", { name: "Run" })), await r(await i.findByText(/PS-458 can't start: it waits on PS-457/)).toBeVisible();
	}
};
export { k as DependentOptions, M as EmptyOptions, E as EveryControl, j as FailedOptions, D as FilesParameter, A as LoadingOptions, w as NumberParameter, T as RefineTicket, N as RunFailed, C as default, m as n, h as t };

// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./workspace-provider-form-DscAlhUT.ts";
import { CloseButton as t, Dialog as n } from "@chakra-ui/react";
import { jsx as r, jsxs as i } from "react/jsx-runtime";
// packages/pstdio-dashboard/src/modules/workspaces/components/workspace-provider-form.stories.tsx
var a = {
	id: "pstdio.worktree",
	label: "Git worktree",
	icon: "git-branch",
	description: "Git review and merge cover the entire repository, including paths outside the project folder.",
	params: { base: {
		type: "select",
		label: "Base branch",
		defaultValue: "main",
		required: !0,
		options: [
			"main",
			"develop",
			"feature/documents"
		].map((e) => ({
			label: e,
			value: e,
			icon: "git-commit-horizontal"
		}))
	} }
}, o = {
	id: "cloud.environment",
	label: "Remote environment",
	icon: "rocket",
	description: "The provider supplies its files. Local files are not uploaded or synchronized.",
	params: {
		image: {
			type: "text",
			label: "Environment image",
			required: !0
		},
		source: {
			type: "text",
			label: "Source URL"
		}
	}
}, s = {
	title: "Workspaces/Provider selection",
	component: e,
	args: {
		providers: [a, o],
		onSubmit: async () => {},
		onCancel: () => {}
	},
	decorators: [(e) => /* @__PURE__ */ i(n.Root, {
		open: !0,
		size: "sm",
		placement: "center",
		scrollBehavior: "inside",
		closeOnInteractOutside: !1,
		children: [/* @__PURE__ */ r(n.Backdrop, {}), /* @__PURE__ */ r(n.Positioner, { children: /* @__PURE__ */ i(n.Content, { children: [
			/* @__PURE__ */ r(n.Header, { children: /* @__PURE__ */ r(n.Title, { children: "Create workspace" }) }),
			/* @__PURE__ */ r(e, {}),
			/* @__PURE__ */ r(n.CloseTrigger, {
				asChild: !0,
				children: /* @__PURE__ */ r(t, {
					size: "sm",
					"aria-label": "Close Create workspace"
				})
			})
		] }) })]
	})]
}, c = {}, l = { args: { providers: [a] } }, u = { args: { providers: [o, a] } }, d = { args: { providers: [] } }, f = { args: { providers: [{
	id: "cloud.localized",
	label: { $l10n: "workspace.cloud" },
	description: { $l10n: "workspace.description" },
	params: { region: {
		type: "select",
		label: { $l10n: "workspace.region" },
		description: { $l10n: "workspace.regionDescription" },
		options: [{
			value: "eu",
			label: { $l10n: "workspace.europe" }
		}]
	} }
}] } }, p = { args: { providers: [] } }, m = { args: {
	providers: [o],
	busy: !0
} }, h = { args: {
	providers: [a, o],
	onSubmit: async () => {
		throw Error("The environment could not be created. Try again.");
	}
} }, g = {
	id: "example.cloud.workspace-type.machine",
	label: "Agent machine",
	params: {
		instance: {
			type: "select",
			label: "Instance",
			required: !0,
			options: {
				command: {
					kind: "command",
					id: "instances",
					extensionId: "example.cloud"
				},
				valueField: "id",
				labelField: "name"
			}
		},
		template: {
			type: "select",
			label: "Template",
			required: !0,
			options: {
				command: {
					kind: "command",
					id: "templates",
					extensionId: "example.cloud"
				},
				valueField: "id",
				labelField: "name",
				params: { instance: {
					kind: "param-value",
					key: "instance"
				} }
			}
		},
		tools: {
			type: "multi-select",
			label: "Tools",
			options: {
				command: {
					kind: "command",
					id: "tools",
					extensionId: "example.cloud"
				},
				valueField: "id",
				labelField: "name"
			}
		}
	}
}, _ = async (e, t) => e.endsWith(".instances") ? [{
	id: "local",
	name: "Local controller"
}, {
	id: "team",
	name: "Team controller"
}] : e.endsWith(".tools") ? [{
	id: "git",
	name: "Git"
}, {
	id: "bun",
	name: "Bun"
}] : t.instance ? [{
	id: `${t.instance}-code`,
	name: `${t.instance} coding agent`
}] : [], v = { args: {
	providers: [g, a],
	executeOptionCommand: _
} }, y = { args: {
	providers: [g],
	executeOptionCommand: () => new Promise(() => {})
} }, b = { args: {
	providers: [g],
	executeOptionCommand: async () => []
} }, x = { args: {
	providers: [g],
	executeOptionCommand: async () => {
		throw Error("Controller unavailable. Try again.");
	}
} }, S = { args: {
	providers: [g],
	executeOptionCommand: (() => {
		let e = /* @__PURE__ */ new Set();
		return async (t, n) => {
			if (!e.has(t)) throw e.add(t), Error("Controller unavailable. Try again.");
			return _(t, n);
		};
	})()
} };
export { v as CommandBackedChoices, b as EmptyChoices, x as FailedChoices, c as GitAndRemote, l as GitBranches, y as LoadingChoices, p as NoLocation, d as NoProviders, h as ProviderFailure, m as Provisioning, u as RemoteParameters, S as RetryChoices, f as TranslationTokens, s as default };

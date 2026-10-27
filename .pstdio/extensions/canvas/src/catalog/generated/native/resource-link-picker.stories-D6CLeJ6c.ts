// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./resource-link-picker-Cp3Bn-In.ts";
import { t } from "./workbench-theme-provider-CQSyY8qK.ts";
import { jsx as n } from "react/jsx-runtime";
// packages/pstdio-workbench/src/react/resource-links/resource-link-picker.stories.tsx
var r = {
	title: "Workbench/Resource link picker",
	component: e,
	args: {
		excludeKey: "",
		busy: !1,
		onCancel: () => void 0,
		onSelect: async () => void 0,
		service: {
			list: async () => ({ items: [] }),
			add: async () => void 0,
			remove: async () => void 0,
			search: async () => [{
				resource: {
					type: "artifact",
					id: "prototype",
					extensionId: "artifacts",
					label: "Interaction prototype"
				},
				description: "Artifacts"
			}, {
				resource: {
					type: "note",
					id: "notes",
					extensionId: "notes",
					label: "Project notes"
				},
				description: "Notes"
			}],
			resolve: async () => [],
			subscribe: () => () => void 0
		}
	},
	decorators: [(e) => /* @__PURE__ */ n(t, { children: /* @__PURE__ */ n(e, {}) })]
}, i = {}, a = { args: { service: {
	...r.args.service,
	search: async () => []
} } }, o = { args: { service: {
	...r.args.service,
	search: async () => {
		throw Error("The owner search is unavailable.");
	}
} } };
export { a as Empty, o as Failure, i as Search, r as default };

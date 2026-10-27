// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./seed-DSxmxcWD.ts";
// extensions/pstdio-planner/src/timeline/view/auto-build.story-fixture.ts
var t = {
	saving: !1,
	requireMergedDependencies: !1,
	eligible: {
		conjunction: "and",
		rules: [{
			attributeId: "status",
			condition: "is-any-of",
			value: ["ready"]
		}]
	},
	prompt: "Implement the calculator feature.",
	host: {
		extensionId: "pstdio.pstdio-planner",
		call: async () => ({
			harnesses: [{
				id: "codex",
				name: "Codex",
				availability: { type: "INSTALLED" }
			}],
			models: [{
				id: "example-model",
				label: "Example model"
			}],
			selection: {
				harnessId: "codex",
				model: "example-model"
			},
			schema: { effort: {
				type: "select",
				label: "Reasoning effort",
				defaultValue: "medium",
				options: [{
					label: "Medium",
					value: "medium"
				}, {
					label: "High",
					value: "high"
				}]
			} }
		}),
		onEvent: () => () => {}
	},
	data: {
		rows: [],
		attributes: [{
			id: "title",
			label: "Title",
			filterable: !0,
			type: { kind: "string" }
		}, {
			id: "status",
			label: "Status",
			filterable: !0,
			type: {
				kind: "enum",
				options: e.map((e) => ({
					value: e.id,
					label: e.name,
					icon: e.icon,
					color: e.color
				}))
			}
		}],
		storageKey: "auto-build-story"
	},
	onEnable: async () => !0
};
export { t };

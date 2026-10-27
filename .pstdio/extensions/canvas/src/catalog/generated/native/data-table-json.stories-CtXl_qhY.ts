// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./data-table-BpTupEfR.ts";
import { n as t } from "./data-table.story-fixtures-Da0Sif93.ts";
import { Box as n } from "@chakra-ui/react";
import { jsx as r } from "react/jsx-runtime";
// packages/ui/src/components/data-table/data-table-json.stories.tsx
var i = {
	title: "Components/Data Display/Data Table",
	component: e
}, a = {
	args: {
		data: t,
		hiddenColumns: ["id"],
		columnRenderers: { Profile: { type: "json" } },
		toolbarStorageKey: "storybook-data-table-friendly-json"
	},
	render: (t) => /* @__PURE__ */ r(n, {
		width: "100%",
		maxWidth: "820px",
		height: "420px",
		marginX: "auto",
		padding: "sm",
		background: "bg",
		children: /* @__PURE__ */ r(e, { ...t })
	})
};
export { a as FriendlyJson, i as default };

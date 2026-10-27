// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./git-branch-BjWwGBn9.ts";
import { t } from "./plus-CYkLGSPS.ts";
import { t as n } from "./empty-state-C7gtd4pd.ts";
import { t as r } from "./tree-list-Db4WJcm2.ts";
import { Box as i } from "@chakra-ui/react";
import { jsx as a } from "react/jsx-runtime";
// packages/ui/src/components/tree-list/tree-list-empty-state.stories.tsx
var o = {
	title: "Components/Data Display/Tree List/Empty State",
	component: r
}, s = [{
	id: "workspaces",
	label: "Workspaces",
	emptyState: /* @__PURE__ */ a(n, {
		title: "No workspaces",
		description: "Create a workspace to start implementation.",
		icon: /* @__PURE__ */ a(e, { size: 16 }),
		size: "sm",
		px: "sm",
		py: "md",
		minH: "6rem"
	}),
	nodes: []
}], c = [{
	id: "files",
	label: "Files",
	actions: [{
		id: "new-file",
		label: "New file",
		icon: /* @__PURE__ */ a(t, { size: 14 })
	}],
	nodes: [{
		id: "files-empty",
		label: "No files",
		disabled: !0,
		rowVariant: "empty-state"
	}]
}, {
	id: "workspaces",
	label: "Workspaces",
	actions: [{
		id: "new-workspace",
		label: "New workspace",
		icon: /* @__PURE__ */ a(t, { size: 14 })
	}],
	nodes: [{
		id: "workspaces-empty",
		label: "No workspaces",
		disabled: !0,
		rowVariant: "empty-state"
	}]
}], l = { render: () => /* @__PURE__ */ a(i, {
	maxW: "20rem",
	borderWidth: "1px",
	p: "xs",
	children: /* @__PURE__ */ a(r, {
		sections: s,
		expandedSectionIds: ["workspaces"],
		rowVariant: "compact",
		sectionGap: "md",
		nodeGap: "1px"
	})
}) }, u = { render: () => /* @__PURE__ */ a(i, {
	maxW: "20rem",
	borderWidth: "1px",
	p: "xs",
	children: /* @__PURE__ */ a(r, {
		sections: c,
		expandedSectionIds: ["files", "workspaces"],
		rowVariant: "compact",
		nodeGap: "1px"
	})
}) };
export { l as ExpandedSection, u as PlaceholderRows, o as default };

// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./workbench-core-kaLFKJEn.ts";
import { t } from "./workbench-story-BezxAS71.ts";
import { Box as n, Text as r } from "@chakra-ui/react";
import { jsx as i } from "react/jsx-runtime";
// packages/pstdio-workbench/src/react/region/drop-feedback.stories.tsx
var a = (t = !1, a = !1) => {
	let o = {
		kind: "page",
		extensionId: "storybook",
		id: "drop-feedback"
	}, s = e({
		startPage: o,
		initialSidePanelMode: a ? "floating" : "attached",
		defaultPanelOpenByRegionId: {
			side: !0,
			secondary: !0
		}
	});
	s.modes.registerMode({
		id: "drop-feedback",
		label: "Drop feedback",
		activate() {}
	}), s.views.registerView({
		id: "document",
		title: "Document",
		body: {
			kind: "react",
			render: (e) => /* @__PURE__ */ i(n, {
				p: "md",
				children: /* @__PURE__ */ i(r, { children: e.instance.resource?.label ?? "Open related resources" })
			})
		}
	}), s.pages.registerPage({
		id: o.id,
		ref: o,
		modeId: "drop-feedback",
		path: "drop-feedback",
		main: {
			kind: "view",
			view: {
				kind: "view",
				id: "document"
			},
			cardinality: "one"
		},
		slots: []
	}), s.pageLocations.switchProject("drop-feedback");
	for (let e of ["side", "secondary"]) s.shellPlacements.registerPlacement({
		id: e,
		region: e,
		item: {
			kind: "binding",
			binding: {
				kinds: [{
					kind: "resource-kind",
					id: "document"
				}],
				view: {
					kind: "view",
					id: "document"
				},
				cardinality: "many"
			}
		}
	});
	for (let [e, n, r, i] of [
		[
			"notes",
			"Implementation notes",
			"side",
			"pin"
		],
		[
			"latest",
			"Latest session",
			"side",
			"preview"
		],
		[
			"incoming",
			"Incoming session",
			"secondary",
			t ? "pin" : "preview"
		]
	]) s.shellPlacements.openPlacement({
		placementId: r,
		resource: {
			type: "document",
			id: e,
			label: n,
			projectId: "drop-feedback",
			extensionId: "storybook"
		},
		open: i
	});
	return s;
}, o = {
	title: "pstdio-workbench/Reference/Core API/Drop feedback",
	component: t,
	excludeStories: ["createDropFeedbackWorkbench"],
	parameters: { layout: "fullscreen" }
}, s = { args: { workbench: a() } }, c = { args: {
	workbench: a(),
	initialThemePreference: "pstdio-dark"
} }, l = { args: { workbench: a(!0) } }, u = { args: { workbench: a(!1, !0) } };
export { c as DarkPreviewInsertion, u as FloatingInsertion, l as PinnedInsertion, s as PreviewInsertion, a as createDropFeedbackWorkbench, o as default };

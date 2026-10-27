// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./auto-build-button-_xC8oBDp.ts";
import { t } from "./timeline-presentation-D6H7HEWi.ts";
import { n } from "./timeline-display-menu-BwCkJQKU.ts";
import { t as r } from "./plan-header-B4KCIQTd.ts";
import { useState as i } from "react";
import { jsx as a } from "react/jsx-runtime";
// extensions/pstdio-planner/src/timeline/view/plan-header.stories.tsx
function o(t) {
	let { filtered: o, running: s, obsoleteProperties: c } = t, [l, u] = i(""), [d, f] = i([{
		id: "all",
		title: "All",
		...n,
		settings: {
			...n.settings,
			displayProperties: c ? [
				"status",
				"reviewRequests",
				"deleted-tag"
			] : ["status"]
		},
		builtIn: !0
	}, {
		id: "active",
		title: "In progress",
		...n,
		filter: {
			conjunction: "and",
			rules: [{
				attributeId: "status",
				condition: "is-any-of",
				value: ["progress"]
			}]
		},
		builtIn: !1
	}]), [p, m] = i(o ? "active" : "all");
	return /* @__PURE__ */ a(r, {
		data: {
			rows: [{
				id: "one",
				title: "Build the shared header",
				attributes: { status: "progress" }
			}, {
				id: "two",
				title: "Review the result",
				attributes: { status: "ready" }
			}],
			attributes: [{
				id: "title",
				label: "Title",
				type: { kind: "string" },
				filterable: !0
			}, {
				id: "status",
				label: "Status",
				type: {
					kind: "enum",
					options: [{
						value: "progress",
						label: "In progress",
						icon: "circle"
					}, {
						value: "ready",
						label: "Ready",
						icon: "circle"
					}]
				},
				filterable: !0,
				displayable: !0
			}],
			storageKey: `timeline-header-story:${o ? "filtered" : "all"}:${c ? "obsolete" : "current"}`
		},
		viewsSource: {
			views: d,
			defaultViewId: p,
			onCreateView: async (e) => {
				let t = {
					...e,
					id: crypto.randomUUID(),
					builtIn: !1
				};
				return f((e) => [...e, t]), t;
			},
			onUpdateView: async (e, t) => f((n) => n.map((n) => n.id === e ? {
				...n,
				...t
			} : n)),
			onDeleteView: async (e) => f((t) => t.filter((t) => t.id !== e)),
			onSetDefaultView: async (e) => m(e ?? "all")
		},
		search: l,
		onSearchChange: u,
		resultLabel: "2 of 2",
		actions: /* @__PURE__ */ a(e, {
			enabled: s ?? !1,
			sessions: [],
			running: 0,
			capacity: 2,
			onOpenSession: () => {},
			onStop: async () => !0,
			t: (e, t) => t ?? e
		})
	});
}
var s = {
	title: "Extensions/Planner/Timeline header",
	component: o,
	decorators: [(e) => /* @__PURE__ */ a(t, {
		projectId: "timeline-header-story",
		children: /* @__PURE__ */ a(e, {})
	})]
}, c = {}, l = { args: { filtered: !0 } }, u = { args: { running: !0 } }, d = { args: { obsoleteProperties: !0 } };
export { u as AutoBuildRunning, l as FilteredView, d as RetiredDisplayProperties, c as SavedViews, s as default };

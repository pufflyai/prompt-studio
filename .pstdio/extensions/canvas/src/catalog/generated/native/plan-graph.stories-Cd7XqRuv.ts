// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { r as e } from "./test-whhQHjQi.ts";
import { o as t, p as n, s as r, t as i } from "./tracks-EnwyuZ-9.ts";
import { t as a } from "./plan-graph-D9ApLaZ-.ts";
import { t as o } from "./timeline-presentation-D6H7HEWi.ts";
import { Box as s } from "@chakra-ui/react";
import { jsx as c } from "react/jsx-runtime";
// extensions/pstdio-planner/src/timeline/view/plan-graph.stories.tsx
var l = n({
	statuses: [],
	tags: [],
	today: "2026-10-10",
	tickets: ["preview", "launch"].map((e) => ({
		id: e,
		shorthand: e === "preview" ? "P-1" : "P-2",
		title: e === "preview" ? "Preview work" : "Launch work",
		content: "",
		statusId: null
	})),
	plan: {
		deadlines: [
			{
				id: "preview",
				date: "2026-10-15",
				name: "Preview"
			},
			{
				id: "launch",
				date: "2026-10-22",
				name: "Launch"
			},
			{
				id: "empty",
				date: "2026-10-29",
				name: "Empty placement target"
			}
		],
		order: [{
			ticketId: "preview",
			deadlineId: "preview"
		}, {
			ticketId: "launch",
			deadlineId: "launch"
		}]
	}
}), u = n({
	statuses: [],
	tags: [],
	today: "2026-10-10",
	tickets: Array.from({ length: 1e3 }, (e, t) => ({
		id: String(t),
		shorthand: `P-${t + 1}`,
		title: t % 7 == 0 ? "A long work item title that wraps across several lines of the shared card" : "Work item",
		content: "",
		statusId: null,
		dependsOn: t ? [String(t - 1)] : []
	})),
	plan: {
		deadlines: [],
		order: []
	}
}), d = { commands: {
	"timeline.track.assign": async () => {},
	"timeline.plan.move": async () => {}
} };
function f(e) {
	let { dense: n, filtered: o, preview: f } = e, p = n ? u : l, m = p.sections.flatMap(({ rows: e }) => e.map(({ id: e }) => e)), { sections: h, toggle: g } = r(p, new Set(o ? ["preview"] : m)), _ = t(d), v = i(p.trackProperty, p.sections.flatMap(({ rows: e }) => e));
	return /* @__PURE__ */ c(s, {
		h: "600px",
		children: /* @__PURE__ */ c(a, {
			sections: h,
			tracks: v,
			today: l.today,
			relations: /* @__PURE__ */ new Map(),
			dragId: f?.dragId ?? _.dragId,
			dropTarget: f?.dropTarget ?? _.dropTarget,
			onToggle: g,
			onContext: () => {},
			onSelect: () => {},
			onDragStart: _.setDragId,
			onDragTarget: _.setDropTarget,
			onDrop: () => void _.drop(),
			onDelete: () => {},
			onRenameDeadline: async () => {},
			onRedate: async () => {},
			onRenameTrack: async () => {},
			onReview: () => {},
			onNewTrack: () => {},
			onCreateDeadline: () => {}
		})
	});
}
var p = {
	title: "Extensions/Planner/Timeline graph",
	component: f,
	decorators: [(e) => /* @__PURE__ */ c(o, {
		projectId: "graph-story",
		children: /* @__PURE__ */ c(e, {})
	})]
}, m = {}, h = { args: { dense: !0 } }, g = { args: { filtered: !0 } }, _ = { args: { preview: {
	dragId: "launch",
	dropTarget: {
		deadlineId: "preview",
		beforeId: "preview",
		trackId: null
	}
} } }, v = { args: { preview: {
	dragId: "launch",
	dropTarget: { deadlineId: "empty" }
} } }, y = { play: async ({ canvasElement: t }) => {
	let n = t.querySelector("[data-timeline-viewport]");
	await e(n).not.toBeNull();
	let { left: r, top: i } = n.getBoundingClientRect(), a = {
		pointerId: 1,
		button: 0,
		bubbles: !0,
		clientX: r + 600,
		clientY: i + 400
	};
	n.dispatchEvent(new PointerEvent("pointerdown", a)), n.dispatchEvent(new PointerEvent("pointermove", {
		...a,
		clientX: a.clientX - 40
	})), n.dispatchEvent(new PointerEvent("pointerup", a)), await e(n).toHaveFocus(), await e(n.matches(":focus-visible")).toBe(!1);
} };
export { m as AllMilestones, v as DropOnEmptyMilestone, _ as DropPreview, g as FilteredMilestone, h as LargePlan, y as PanWithoutFocusRing, p as default };

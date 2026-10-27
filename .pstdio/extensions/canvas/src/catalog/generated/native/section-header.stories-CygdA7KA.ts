// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { p as e, r as t } from "./test-whhQHjQi.ts";
import { n, t as r } from "./seed-DSxmxcWD.ts";
import { c as i, p as a, s as o, t as s } from "./tracks-EnwyuZ-9.ts";
import { t as c } from "./workflow-statuses-BkOMtUf-.ts";
import { t as l } from "./use-plan-actions-C5MIALJI.ts";
import { Box as u } from "@chakra-ui/react";
import { jsx as d, jsxs as f } from "react/jsx-runtime";
import { createWebviewClient as p } from "@pstdio/sdk/extensions";
// extensions/pstdio-planner/src/timeline/view/section-header.stories.tsx
var m = {
	extensionId: "pstdio.pstdio-planner",
	call: async () => {
		throw Error("This story does not run host commands.");
	},
	onEvent: () => () => {}
}, h = p(m);
function g(e) {
	let { state: t, visible: p } = e, g = a({
		workflow: {
			...c(),
			completedStatusIds: ["done"]
		},
		today: "2026-10-13",
		now: Date.parse("2026-10-13T12:00:00Z"),
		statuses: r,
		tags: n.map((e) => e()),
		attempts: [{
			ticketId: "done",
			createdAt: "2026-10-13T10:00:00Z"
		}],
		requests: new Map(["open", "hidden"].map((e) => [e, {
			requests: [],
			errors: ["Unreadable request"]
		}])),
		tickets: [
			{
				id: "done",
				shorthand: "P-1",
				title: "Simple work",
				content: "",
				statusId: t === "learning" ? "ready" : "done",
				tags: { "default-complexity": "default-complexity-simple" }
			},
			{
				id: "open",
				shorthand: "P-2",
				title: "Complex work",
				content: "",
				statusId: t === "complete" ? "done" : "ready",
				tags: { "default-complexity": "default-complexity-complex" }
			},
			{
				id: "hidden",
				shorthand: "P-3",
				title: "Other work",
				content: "",
				statusId: t === "complete" ? "done" : "ready",
				tags: { "default-complexity": "default-complexity-simple" }
			}
		],
		plan: {
			deadlines: [...t === "unstarted" ? [{
				id: "previous",
				date: "2026-10-14"
			}] : [], {
				id: "preview",
				name: "Preview",
				date: "2026-10-15"
			}],
			order: [
				"done",
				"open",
				"hidden"
			].map((e) => ({
				ticketId: e,
				deadlineId: t === "unstarted" && e === "done" ? "previous" : "preview"
			}))
		}
	}), { sections: _, toggle: v } = o(g, new Set(p ?? [
		"done",
		"open",
		"hidden"
	])), { viewProps: y, selected: b, review: x } = l({
		host: m,
		client: h,
		plan: g,
		sections: _,
		toggle: v,
		tracks: s(void 0, [])
	});
	return /* @__PURE__ */ f(u, {
		maxW: "full",
		w: "full",
		h: "40px",
		children: [/* @__PURE__ */ d(i, {
			entry: _.find(({ section: e }) => e.deadline?.id === "preview"),
			onToggle: () => {},
			onDelete: () => {},
			onRenameDeadline: async () => {},
			onReview: y.onReview
		}), b ? /* @__PURE__ */ f(u, {
			role: "status",
			children: [
				b.title,
				" · ",
				x?.length,
				" tickets to review"
			]
		}) : null]
	});
}
var _ = {
	title: "Extensions/Planner/Milestone header",
	component: g,
	args: { state: "forecast" }
}, v = { play: async ({ canvas: e }) => {
	let n = e.getByLabelText("Milestone estimate"), r = e.getByRole("progressbar", { name: "Milestone progress" });
	await t(n).toHaveTextContent("ETA ~8h"), await t(n.getBoundingClientRect().right).toBeLessThanOrEqual(r.getBoundingClientRect().left);
} }, y = { args: { state: "learning" } }, b = { args: { state: "complete" } }, x = {
	args: { visible: ["done", "open"] },
	play: async ({ canvas: n }) => {
		await t(n.getByLabelText("Milestone estimate")).toHaveTextContent("ETA ~6h"), await t(n.getByRole("progressbar")).toHaveAttribute("aria-valuemax", "2"), await t(n.getByRole("button", { name: "Review 1 tickets that need a person in Preview" })).toBeVisible(), await e.click(n.getByRole("button", { name: "Review 1 tickets that need a person in Preview" })), await t(n.getByRole("status")).toHaveTextContent("Complex work · 1 tickets to review");
	}
}, S = {
	args: { visible: ["open"] },
	play: async ({ canvas: e }) => {
		await t(e.getByLabelText("Milestone estimate")).toHaveTextContent("ETA ~6h"), await t(e.getByRole("progressbar")).toHaveAttribute("aria-valuemax", "1"), await t(e.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0"), await t(e.getByRole("button", { name: "Review 1 tickets that need a person in Preview" })).toBeVisible();
	}
}, C = {
	args: { visible: ["done"] },
	play: async ({ canvas: e }) => {
		await t(e.getByLabelText("Milestone estimate")).toHaveTextContent("Done"), await t(e.getByRole("progressbar")).toHaveAttribute("aria-valuemax", "1"), await t(e.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1"), await t(e.queryByRole("button", { name: /tickets that need a person/ })).toBeNull();
	}
}, w = {
	args: { state: "unstarted" },
	play: async (e) => {
		await v.play(e), await t(e.canvas.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
	}
};
export { b as Complete, C as CompletedOnly, x as Filtered, v as Forecast, y as Learning, S as Remaining, w as Unstarted, _ as default };

// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { m as e, p as t, r as n } from "./test-whhQHjQi.ts";
import { a as r, p as i, s as a } from "./tracks-EnwyuZ-9.ts";
import { t as o } from "./workflow-statuses-BkOMtUf-.ts";
import { t as s } from "./plan-graph-D9ApLaZ-.ts";
import { t as c } from "./timeline-presentation-D6H7HEWi.ts";
import { t as l } from "./timeline-display-menu-BwCkJQKU.ts";
import { t as u } from "./visible-tracks-Bzo-AUT3.ts";
import { useState as d } from "react";
import { Box as f, Button as p } from "@chakra-ui/react";
import { Fragment as m, jsx as h, jsxs as g } from "react/jsx-runtime";
// extensions/pstdio-planner/src/timeline/view/plan-graph-tracks.stories.tsx
var _ = {
	id: "track",
	name: "Track",
	type: "single_select",
	sortOrder: 0,
	options: [
		"API",
		"UI",
		"Docs"
	].map((e, t) => ({
		id: e.toLowerCase(),
		name: e,
		color: "gray",
		sortOrder: t,
		icon: null,
		description: null
	}))
}, v = (e, t, n = [], r = null) => ({
	id: e,
	shorthand: e.toUpperCase(),
	title: `${e.toUpperCase()} work`,
	content: "",
	statusId: r,
	tagIds: t ? [t] : [],
	dependsOn: n
}), y = i({
	workflow: {
		...o(),
		completedStatusIds: ["done"]
	},
	statuses: [{
		id: "done",
		name: "Done",
		color: "green",
		sortOrder: 0,
		isDefault: !1,
		canCreate: !0,
		columnActions: []
	}],
	tags: [_],
	track: _,
	today: "2026-10-10",
	tickets: [
		v("a-1", "api", [], "done"),
		v("a-2", "api", ["a-1"]),
		v("u-1", "ui", ["a-1", "d-1"]),
		v("u-2", "ui", ["a-2"]),
		v("d-1", "docs"),
		v("n-1", null, ["u-1"])
	],
	plan: {
		deadlines: [{
			id: "preview",
			date: "2026-10-15",
			name: "Preview"
		}, {
			id: "launch",
			date: "2026-10-22",
			name: "Launch"
		}],
		order: [
			{
				ticketId: "a-1",
				deadlineId: "preview"
			},
			{
				ticketId: "u-1",
				deadlineId: "preview"
			},
			{
				ticketId: "a-2",
				deadlineId: "launch"
			},
			{
				ticketId: "u-2",
				deadlineId: "launch"
			},
			{
				ticketId: "d-1",
				deadlineId: "launch"
			},
			{
				ticketId: "n-1",
				deadlineId: "launch"
			}
		]
	}
}), b = y.sections.flatMap((e) => e.rows), x = [{
	id: "track",
	label: "Track",
	type: {
		kind: "enum",
		options: _.options.map(({ id: e, name: t }) => ({
			value: e,
			label: t
		}))
	},
	filterable: !0
}];
function S(e) {
	let { filter: t, selectedId: n, height: i = 640 } = e, o = u(y, t, x), c = b.filter((e) => o.list.some(({ id: t }) => t === (e.trackId ?? "unassigned"))), { sections: l, toggle: d } = a(y, new Set(c.map(({ id: e }) => e)));
	return /* @__PURE__ */ h(f, {
		h: `${i}px`,
		children: /* @__PURE__ */ h(s, {
			sections: l,
			tracks: o,
			today: y.today,
			selectedId: n,
			relations: r(b.find(({ id: e }) => e === n), y),
			onToggle: d,
			onContext: () => {},
			onSelect: () => {},
			onDragStart: () => {},
			onDragTarget: () => {},
			onDrop: () => {},
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
var C = {
	title: "Extensions/Planner/Timeline graph/Tracks",
	component: S,
	decorators: [(e) => /* @__PURE__ */ h(c, {
		projectId: "track-story",
		children: /* @__PURE__ */ h(e, {})
	})],
	args: { filter: {
		conjunction: "and",
		rules: []
	} }
}, w = {}, T = { args: { selectedId: "u-1" } }, E = { args: { filter: {
	conjunction: "and",
	rules: [{
		attributeId: "track",
		condition: "is-any-of",
		value: ["api", "docs"]
	}]
} } }, D = { args: { filter: {
	conjunction: "and",
	rules: [{
		attributeId: "track",
		condition: "is-empty"
	}]
} } }, O = { play: async ({ canvasElement: t }) => {
	let r = t.querySelector("[data-timeline-viewport]"), i = () => Number.parseFloat(getComputedStyle(r.firstElementChild).zoom), { left: a, top: o } = r.getBoundingClientRect(), s = {
		bubbles: !0,
		cancelable: !0,
		clientX: a + 200,
		clientY: o + 200
	};
	r.dispatchEvent(new WheelEvent("wheel", {
		...s,
		deltaX: 120,
		deltaY: 80
	})), await e(() => {
		n(r.scrollLeft).toBe(120), n(r.scrollTop).toBe(80), n(i()).toBe(1);
	}), r.dispatchEvent(new WheelEvent("wheel", {
		...s,
		ctrlKey: !0,
		deltaY: 300
	})), await e(() => n(i()).toBeLessThan(1));
	let c = i(), l = (r.scrollLeft + 200) / c;
	r.dispatchEvent(new WheelEvent("wheel", {
		...s,
		ctrlKey: !0,
		deltaY: -100
	})), await e(() => {
		n(i()).toBeGreaterThan(c), n((r.scrollLeft + 200) / i()).toBeCloseTo(l, 0);
	});
} }, k = {
	...O,
	args: { selectedId: "a-1" }
}, A = { play: async ({ canvasElement: t }) => {
	let r = t.querySelector("[data-timeline-viewport]"), { left: i, top: a } = r.getBoundingClientRect();
	r.scrollTo(200, 80);
	for (let [e, t] of [[100, 30], [400, -30]]) r.dispatchEvent(new WheelEvent("wheel", {
		bubbles: !0,
		cancelable: !0,
		ctrlKey: !0,
		clientX: i + e,
		clientY: a + 200,
		deltaY: t
	}));
	await e(() => {
		n(Number.parseFloat(getComputedStyle(r.firstElementChild).zoom)).toBe(1), n(r.scrollLeft).toBeGreaterThan(200);
	});
} }, j = {
	args: { height: 360 },
	parameters: { viewport: { defaultViewport: "mobile1" } }
}, M = { play: async ({ canvasElement: r }) => {
	let i = r.querySelector("[data-timeline-viewport]"), { left: a, top: o } = i.getBoundingClientRect(), s = {
		pointerId: 1,
		button: 0,
		bubbles: !0,
		clientX: a + 600,
		clientY: o + 400
	};
	i.dispatchEvent(new PointerEvent("pointerdown", s)), i.dispatchEvent(new PointerEvent("pointermove", {
		...s,
		clientX: s.clientX - 40
	})), i.dispatchEvent(new PointerEvent("pointerup", s)), r.querySelector("[aria-label=\"Collapse API\"]").focus(), await t.keyboard("{Enter}"), await e(() => n(r.querySelector("[aria-label=\"Expand API\"]")).not.toBeNull());
} };
function N() {
	let [e, t] = d(0), [n] = d(() => {
		let e = /* @__PURE__ */ new Map();
		return {
			getItem: (t) => e.get(t) ?? null,
			setItem: (t, n) => {
				e.set(t, n);
			}
		};
	});
	return /* @__PURE__ */ g(m, { children: [/* @__PURE__ */ h(p, {
		onClick: () => t((e) => e + 1),
		children: "Reopen timeline"
	}), /* @__PURE__ */ g(c, {
		projectId: "remembered-presentation",
		storage: n,
		children: [/* @__PURE__ */ h(l, {
			storageKey: "remembered-display",
			attributes: x
		}), /* @__PURE__ */ h(S, { filter: {
			conjunction: "and",
			rules: []
		} })]
	}, e)] });
}
var P = { render: () => /* @__PURE__ */ h(N, {}) };
export { w as CurvedDependencies, E as FilteredTracks, M as KeyboardAfterPan, A as MovingPinchAnchor, P as RememberedPresentation, T as SelectedHierarchy, k as SelectedTrackpadNavigation, j as TouchNavigation, O as TrackpadNavigation, D as UnassignedOnly, C as default };

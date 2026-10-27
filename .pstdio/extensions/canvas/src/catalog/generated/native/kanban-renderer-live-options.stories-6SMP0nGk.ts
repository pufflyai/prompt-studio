// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, p as t, r as n } from "./test-whhQHjQi.ts";
import { t as r } from "./kanban-renderer-story-fixtures-DLwkBAvf.ts";
import { n as i, t as a } from "./kanban-renderer-DXp4dq2X.ts";
import { useEffect as o, useRef as s, useState as c } from "react";
import { Badge as l, Box as u, Button as d, HStack as f, Stack as p, Text as m } from "@chakra-ui/react";
import { jsx as h, jsxs as g } from "react/jsx-runtime";
// packages/ui/src/components/kanban-renderer/kanban-renderer-live-options.stories.tsx
var _ = {
	title: "Patterns/Kanban Renderer/Internal/Live Options",
	component: a,
	parameters: {
		layout: "fullscreen",
		docs: { description: { component: "Regression story for live enum option updates. Excluded from agent manifests so agents use the canonical Kanban Renderer stories." } }
	},
	tags: ["!manifest"]
}, v = "storybook-kanban-renderer-live", y = [
	{
		value: "review",
		label: "Review",
		color: "purple"
	},
	{
		value: "blocked",
		label: "Blocked",
		color: "red"
	},
	{
		value: "shipped",
		label: "Shipped",
		color: "cyan"
	},
	{
		value: "archived",
		label: "Archived",
		color: "gray"
	}
], b = [
	{
		value: "todo",
		label: "Todo",
		color: "gray"
	},
	{
		value: "in_progress",
		label: "In progress",
		color: "blue"
	},
	{
		value: "done",
		label: "Done",
		color: "green"
	}
], x = [
	"gray",
	"blue",
	"green",
	"red",
	"purple",
	"yellow",
	"cyan",
	"orange"
], S = (e) => x[(x.indexOf(e) + 1) % x.length], C = (e) => {
	let t = e, n = /* @__PURE__ */ new Set();
	return {
		source: {
			subscribe: (e) => (n.add(e), () => {
				n.delete(e);
			}),
			getSnapshot: () => t
		},
		setOptions: (e) => {
			t = e;
			for (let e of n) e();
		},
		getOptions: () => t
	};
}, w = [
	{
		id: "live-1",
		title: "Set up API authentication",
		attributes: {
			status: "todo",
			assignee: "Alex",
			component: "backend",
			priority: "high",
			updated: "2026-03-15T12:00:00.000Z"
		}
	},
	{
		id: "live-2",
		title: "Build row list interactions",
		attributes: {
			status: "in_progress",
			assignee: "Sam",
			component: "frontend",
			priority: "medium",
			updated: "2026-03-16T12:00:00.000Z"
		}
	},
	{
		id: "live-3",
		title: "Write docs",
		attributes: {
			status: "done",
			assignee: "Taylor",
			component: "docs",
			updated: "2026-03-17T12:00:00.000Z"
		}
	}
], T = () => {
	let e = C(b);
	return {
		store: e,
		liveAttributes: [{
			id: "status",
			label: "Status",
			type: {
				kind: "enum",
				options: e.source
			},
			filterable: !0,
			groupable: !0,
			sortable: !0,
			displayable: !0,
			editable: !0
		}, ...r.filter((e) => e.id !== "status")]
	};
}, E = async (n) => {
	await t.click(n.getByLabelText("Display settings")), await t.click(e(document.body).getByText("List"));
}, D = (e) => [...document.body.querySelectorAll(".chakra-badge")].find((t) => {
	let n = t.getBoundingClientRect();
	return n.width > 0 && n.height > 0 && t.textContent?.trim() === e;
}), O = (e) => [...document.body.querySelectorAll("[role=\"option\"]")].find((t) => t.textContent?.replace(/\s+/g, "").trim() === `${e}1`)?.querySelector(".chakra-badge") ?? null, k = () => {
	let [{ store: e, liveAttributes: t }] = c(T), [n, r] = c(() => e.getOptions()), [_, b] = c(w), x = s(w.length + 1), C = i(v, (e) => e.reset);
	return c(C), o(() => e.source.subscribe(() => r([...e.getOptions()])), [e]), /* @__PURE__ */ g(p, {
		p: "sm",
		height: "640px",
		gap: "sm",
		children: [/* @__PURE__ */ g(p, {
			gap: "2xs",
			children: [/* @__PURE__ */ g(f, {
				gap: "2xs",
				flexWrap: "wrap",
				children: [
					/* @__PURE__ */ h(d, {
						size: "sm",
						variant: "outline",
						onClick: () => {
							let t = new Set(n.map((e) => e.value)), r = y.find((e) => !t.has(e.value));
							r && e.setOptions([...n, r]);
						},
						children: "Add status"
					}),
					/* @__PURE__ */ h(d, {
						size: "sm",
						variant: "outline",
						onClick: () => {
							if (n.length === 0) return;
							let t = n[n.length - 1], r = {
								...t,
								label: `${t.label} *`
							};
							e.setOptions([...n.slice(0, -1), r]);
						},
						children: "Rename last"
					}),
					/* @__PURE__ */ h(d, {
						size: "sm",
						variant: "outline",
						onClick: () => {
							if (n.length === 0) return;
							let t = n[n.length - 1], r = {
								...t,
								color: S(t.color)
							};
							e.setOptions([...n.slice(0, -1), r]);
						},
						children: "Recolor last"
					}),
					/* @__PURE__ */ h(d, {
						size: "sm",
						variant: "outline",
						onClick: () => {
							n.length <= 1 || e.setOptions(n.slice(0, -1));
						},
						children: "Remove last"
					}),
					/* @__PURE__ */ h(d, {
						size: "sm",
						variant: "outline",
						onClick: () => {
							let e = n[n.length - 1]?.value ?? "todo", t = `live-${x.current++}`;
							b((n) => [...n, {
								id: t,
								title: `New task in ${e}`,
								attributes: {
									status: e,
									assignee: "Pat",
									component: "backend",
									priority: "medium",
									updated: (/* @__PURE__ */ new Date()).toISOString()
								}
							}]);
						},
						children: "Add row in latest status"
					})
				]
			}), /* @__PURE__ */ g(f, {
				gap: "2xs",
				flexWrap: "wrap",
				children: [/* @__PURE__ */ h(m, {
					textStyle: "label/XS/regular",
					color: "fg.muted",
					children: "Live options:"
				}), n.map((e) => /* @__PURE__ */ h(l, {
					variant: "subtle",
					colorPalette: e.color ?? "gray",
					textStyle: "label/XS/medium",
					children: e.label
				}, e.value))]
			})]
		}), /* @__PURE__ */ h(u, {
			flex: "1",
			minH: "0",
			children: /* @__PURE__ */ h(a, {
				rows: _,
				storageKey: v,
				attributes: t,
				defaultSettings: { columnGrouping: "status" },
				onAttributeChange: (e, t, n) => b((r) => r.map((r) => r.id === e ? {
					...r,
					attributes: {
						...r.attributes,
						[t]: n
					}
				} : r)),
				getBoardColumnConfig: (e) => ({ color: n.find((t) => t.value === e)?.color })
			})
		})]
	});
}, A = {
	tags: ["live-options-regression", "!manifest"],
	render: () => /* @__PURE__ */ h(k, {}),
	play: async ({ canvasElement: r }) => {
		let i = e(r);
		await E(i);
		let a = D("Done"), o = O("Done");
		if (!a || !o) throw Error("Expected visible Done badges before recoloring");
		let s = getComputedStyle(o).backgroundColor;
		await t.click(i.getByRole("button", { name: "Recolor last" }));
		let c = D("Done"), l = O("Done");
		if (!c || !l) throw Error("Expected visible Done badges after recoloring");
		await n(getComputedStyle(l).backgroundColor).toBe(getComputedStyle(c).backgroundColor), await n(getComputedStyle(l).backgroundColor).not.toBe(s);
	}
};
export { A as LiveOptions, _ as default };

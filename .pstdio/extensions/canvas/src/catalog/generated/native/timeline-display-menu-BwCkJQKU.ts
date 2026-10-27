// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./check-Bgh538vW.ts";
import { t } from "./settings-2-CNFOcldp.ts";
import { n } from "./ticket-create-form-CcZ40XLh.ts";
import { t as r } from "./ticket-board-Clw0UQea.ts";
import { n as i } from "./timeline-presentation-D6H7HEWi.ts";
import { useRef as a } from "react";
import { Button as o, IconButton as s, Popover as c, Portal as l, Text as u, Wrap as d } from "@chakra-ui/react";
import { ScrollArea as f, Tooltip as p } from "@pstdio/ui";
import { jsx as m, jsxs as h } from "react/jsx-runtime";
import { DEFAULT_KANBAN_RENDERER_SETTINGS as g, buildDisplayPropertyOptions as _ } from "@pstdio/ui/kanban-renderer";
import { EMPTY_VIEW_FILTER as v, useCollectionViewStore as y, withTitleField as b } from "@pstdio/ui/collection-view";
// extensions/pstdio-planner/src/timeline/model/query-data.ts
function x(e, t) {
	let r = e.ticketAttributes.flatMap((e) => {
		let r = e.type;
		return r.kind === "enum" || r.kind === "enum-multi" ? [{
			...e,
			label: n(e.label, t),
			type: {
				...r,
				options: Array.isArray(r.options) ? r.options.map((e) => ({
					...e,
					label: n(e.label, t)
				})) : []
			}
		}] : [{
			...e,
			label: n(e.label, t),
			type: r
		}];
	});
	return {
		rows: e.ticketRows,
		attributes: b(r),
		storageKey: `pstdio.pstdio-planner.timeline-views:${e.projectId}`
	};
}
// extensions/pstdio-planner/src/timeline/view/timeline-query.ts
var S = {
	settings: {
		...g,
		displayProperties: r
	},
	filter: v,
	sorts: []
};
// extensions/pstdio-planner/src/timeline/view/timeline-display-menu.tsx
function C(n) {
	let { storageKey: r, attributes: g } = n, { settings: v, setSettings: b } = y(r, S, (e) => e), x = i(), C = v.displayProperties, w = a(null);
	return /* @__PURE__ */ h(c.Root, {
		lazyMount: !0,
		unmountOnExit: !0,
		positioning: {
			placement: "bottom-end",
			strategy: "fixed",
			offset: { mainAxis: 8 },
			getAnchorElement: () => w.current
		},
		children: [/* @__PURE__ */ m(p, {
			content: "Display",
			children: /* @__PURE__ */ m(c.Trigger, {
				asChild: !0,
				children: /* @__PURE__ */ m(s, {
					ref: w,
					"aria-label": "Display settings",
					variant: "ghost",
					size: "2xs",
					children: /* @__PURE__ */ m(t, {})
				})
			})
		}), /* @__PURE__ */ m(l, { children: /* @__PURE__ */ m(c.Positioner, { children: /* @__PURE__ */ m(c.Content, {
			"aria-label": "Display settings",
			children: /* @__PURE__ */ h(c.Body, { children: [
				/* @__PURE__ */ m(u, {
					textStyle: "label/XS/medium",
					color: "fg.muted",
					textTransform: "uppercase",
					py: "xs",
					children: "Properties"
				}),
				/* @__PURE__ */ m(f, {
					maxH: "filter-picker-height",
					children: /* @__PURE__ */ m(d, {
						gap: "2xs",
						children: _(g).map(({ value: e, label: t }) => /* @__PURE__ */ m(o, {
							size: "2xs",
							variant: "ghost",
							"aria-pressed": C.includes(e),
							onClick: () => b({ displayProperties: C.includes(e) ? C.filter((t) => t !== e) : [...C, e] }),
							children: t
						}, e))
					})
				}),
				/* @__PURE__ */ m(u, {
					textStyle: "label/XS/medium",
					color: "fg.muted",
					textTransform: "uppercase",
					py: "xs",
					children: "Milestones"
				}),
				/* @__PURE__ */ m(d, {
					gap: "2xs",
					children: [["showPassedMilestones", "Show passed milestones"], ["showCompletedMilestones", "Show completed milestones"]].map(([t, n]) => /* @__PURE__ */ h(o, {
						size: "2xs",
						variant: "ghost",
						"aria-pressed": x.value[t] !== !1,
						onClick: () => x.update({ [t]: x.value[t] === !1 }),
						children: [x.value[t] === !1 ? null : /* @__PURE__ */ m(e, { "aria-hidden": "true" }), n]
					}, t))
				})
			] })
		}) }) })]
	});
}
export { S as n, x as r, C as t };

// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./check-Bgh538vW.ts";
import { t } from "./chevron-down-ZmPqsMG0.ts";
import { a as n } from "./square-split-horizontal-D8KwXGQS.ts";
import { t as r } from "./settings-2-CNFOcldp.ts";
import { t as i } from "./square-kanban-DzsMXKKR.ts";
import { t as a } from "./scroll-area-I7hjn89T.ts";
import { t as o } from "./tooltip-BweQW627.ts";
import { l as s } from "./kanban-renderer-helpers-CvTscXNQ.ts";
import { Fragment as c, useEffect as l, useRef as u, useState as d } from "react";
import { Button as f, HStack as p, Icon as m, IconButton as h, Menu as g, Popover as _, Portal as v, Text as y } from "@chakra-ui/react";
import { jsx as b, jsxs as x } from "react/jsx-runtime";
// packages/ui/src/components/kanban-renderer/display-menu.tsx
var S = (e) => /* @__PURE__ */ b(y, {
	paddingX: "xs",
	paddingTop: "xs",
	paddingBottom: "2xs",
	textStyle: "label/XS/medium",
	color: "fg.muted",
	children: e.children
}), C = (n) => {
	let r = n.options.find((e) => e.value === n.value)?.label ?? n.label, i = n.options[0]?.value === "none";
	return /* @__PURE__ */ x(g.Root, {
		positioning: {
			strategy: "fixed",
			hideWhenDetached: !0
		},
		children: [/* @__PURE__ */ b(g.Trigger, {
			asChild: !0,
			children: /* @__PURE__ */ x(f, {
				size: "xs",
				variant: "ghost",
				width: "full",
				justifyContent: "flex-start",
				gap: "xs",
				children: [
					/* @__PURE__ */ b(y, {
						textStyle: "label/S/regular",
						children: n.label
					}),
					/* @__PURE__ */ b(p, {
						marginLeft: "auto",
						minW: "0",
						gap: "2xs",
						color: "fg.muted",
						children: /* @__PURE__ */ b(y, {
							textStyle: "label/S/regular",
							truncate: !0,
							children: r
						})
					}),
					/* @__PURE__ */ b(t, { size: 12 })
				]
			})
		}), /* @__PURE__ */ b(g.Positioner, { children: /* @__PURE__ */ b(g.Content, {
			overflow: "hidden",
			overflowY: "hidden",
			children: /* @__PURE__ */ b(a, {
				maxH: "var(--available-height)",
				minH: "0",
				viewportProps: { overscrollBehavior: "contain" },
				children: n.options.map((t, r) => /* @__PURE__ */ x(c, { children: [i && r === 1 ? /* @__PURE__ */ b(g.Separator, {}) : null, /* @__PURE__ */ b(g.Item, {
					value: t.value,
					onClick: () => n.onSelect(t.value),
					children: /* @__PURE__ */ x(p, {
						width: "full",
						gap: "xs",
						children: [/* @__PURE__ */ b(y, {
							textStyle: "label/S/regular",
							children: t.label
						}), t.value === n.value ? /* @__PURE__ */ b(m, {
							as: e,
							marginLeft: "auto",
							boxSize: "0.875rem"
						}) : null]
					})
				})] }, t.value))
			})
		}) })]
	});
}, w = (e) => {
	let { settings: t, groupingOptions: a, displayPropertyOptions: c, onViewModeChange: g, onColumnGroupingChange: y, onRowGroupingChange: w, onDisplayPropertyToggle: T } = e, E = u(null), D = u(null), [O, k] = d(!1);
	return l(() => {
		if (!O) return;
		let e = (e) => {
			let t = e.target;
			t instanceof Node && (D.current?.contains(t) || E.current?.contains(t) || k(!1));
		};
		return document.addEventListener("pointerdown", e), () => document.removeEventListener("pointerdown", e);
	}, [O]), /* @__PURE__ */ x(_.Root, {
		open: O,
		closeOnInteractOutside: !1,
		positioning: {
			placement: "bottom-end",
			offset: { mainAxis: 8 },
			getAnchorElement: () => E.current
		},
		onOpenChange: (e) => k(e.open),
		children: [/* @__PURE__ */ b(o, {
			content: "Display",
			children: /* @__PURE__ */ b(_.Trigger, {
				asChild: !0,
				children: /* @__PURE__ */ b(h, {
					ref: E,
					"aria-label": "Display settings",
					variant: "ghost",
					size: "2xs",
					children: /* @__PURE__ */ b(m, { as: r })
				})
			})
		}), /* @__PURE__ */ b(v, { children: /* @__PURE__ */ b(_.Positioner, { children: /* @__PURE__ */ x(_.Content, {
			ref: D,
			width: "18.75rem",
			padding: "xs",
			gap: "1px",
			children: [
				/* @__PURE__ */ b(S, { children: "DISPLAY" }),
				/* @__PURE__ */ x(p, {
					borderRadius: "sm",
					bg: "bg.subtle",
					padding: "2xs",
					gap: "2xs",
					children: [/* @__PURE__ */ x(f, {
						flex: "1",
						size: "2xs",
						variant: "ghost",
						"aria-pressed": t.viewMode === "list",
						onClick: () => g("list"),
						children: [/* @__PURE__ */ b(n, {}), "List"]
					}), /* @__PURE__ */ x(f, {
						flex: "1",
						size: "2xs",
						variant: "ghost",
						"aria-pressed": t.viewMode === "board",
						onClick: () => g("board"),
						children: [/* @__PURE__ */ b(i, {}), "Board"]
					})]
				}),
				/* @__PURE__ */ b(C, {
					label: "Grouping",
					value: t.columnGrouping,
					options: a,
					onSelect: (e) => {
						y(e), (e === "none" || e === t.rowGrouping) && w("none");
					}
				}),
				/* @__PURE__ */ b(C, {
					label: "Sub-grouping",
					value: t.rowGrouping,
					options: s(a, t.columnGrouping),
					onSelect: w
				}),
				e.sortControl,
				/* @__PURE__ */ b(S, { children: "PROPERTIES" }),
				/* @__PURE__ */ b(p, {
					paddingX: "xs",
					paddingBottom: "xs",
					flexWrap: "wrap",
					gap: "2xs",
					children: c.map((e) => {
						let n = t.displayProperties.includes(e.value);
						return /* @__PURE__ */ b(f, {
							size: "2xs",
							variant: "ghost",
							"aria-pressed": n,
							onClick: () => T(e.value),
							children: e.label
						}, e.value);
					})
				})
			]
		}) }) })]
	});
};
export { C as n, w as t };

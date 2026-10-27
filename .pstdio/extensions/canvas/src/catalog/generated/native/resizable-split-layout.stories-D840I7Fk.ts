// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, r as t } from "./test-whhQHjQi.ts";
import { t as n } from "./bot-DyijWSfK.ts";
import { t as r } from "./ellipsis-BnQWfGiA.ts";
import { t as i } from "./git-branch-BjWwGBn9.ts";
import { t as a } from "./panel-left-WC4Gsik4.ts";
import { t as o } from "./header-8InG5j3w.ts";
import { t as s } from "./resizable-split-layout-DdxKHR9a.ts";
import { Box as c, Flex as l, Icon as u, IconButton as d, Text as f } from "@chakra-ui/react";
import { jsx as p, jsxs as m } from "react/jsx-runtime";
// packages/ui/src/components/layout/resizable-split-layout.stories.tsx
var h = (e) => {
	let { title: t, description: n, bg: i = "bg.panel" } = e;
	return /* @__PURE__ */ m(l, {
		direction: "column",
		h: "full",
		w: "full",
		minH: "0",
		minW: "0",
		bg: i,
		layerStyle: "panel",
		overflow: "hidden",
		children: [/* @__PURE__ */ m(o, {
			variant: "narrow",
			flexShrink: 0,
			children: [/* @__PURE__ */ p(f, {
				textStyle: "label/S/medium",
				truncate: !0,
				children: t
			}), /* @__PURE__ */ p(d, {
				size: "2xs",
				variant: "ghost",
				"aria-label": "Panel actions",
				marginInlineStart: "auto",
				children: /* @__PURE__ */ p(u, {
					as: r,
					boxSize: "14px"
				})
			})]
		}), /* @__PURE__ */ p(l, {
			flex: "1",
			minH: "0",
			align: "center",
			justify: "center",
			px: "sm",
			children: /* @__PURE__ */ p(f, {
				fontSize: "sm",
				color: "fg.muted",
				textAlign: "center",
				children: n
			})
		})]
	});
}, g = {
	title: "Components/Layout/Resizable Split Layout",
	component: s,
	parameters: { layout: "fullscreen" },
	args: {
		resizablePanel: /* @__PURE__ */ p(h, {
			title: "Sidenav",
			description: "Drag the grip. Double-click or press Home to collapse.",
			bg: "bg.subtle"
		}),
		contentPanel: /* @__PURE__ */ p(h, {
			title: "Main",
			description: "Hover a separator for a moment to see the bar."
		}),
		defaultSizePx: 240,
		minSizePx: 160,
		maxSizePx: 480,
		contentMinSizePx: 320,
		resizeLabel: "Resize sidenav",
		p: "panel-gap"
	},
	decorators: [(e) => /* @__PURE__ */ p(c, {
		h: "100vh",
		w: "100vw",
		bg: "bg",
		color: "fg",
		children: /* @__PURE__ */ p(e, {})
	})]
}, _ = {}, v = { args: {
	resizableSide: "bottom",
	resizablePanel: /* @__PURE__ */ p(h, {
		title: "Secondary Panel",
		description: "resource · hideable"
	}),
	contentPanel: /* @__PURE__ */ p(h, {
		title: "Main",
		description: "resource · always on"
	}),
	defaultSizePx: 200,
	minSizePx: 96,
	contentMinSizePx: 200,
	resizeLabel: "Resize secondary panel"
} }, y = { args: { collapsible: !1 } }, b = {
	tags: ["!manifest", "split-frame-scroll"],
	args: {
		collapsed: !0,
		resizableSide: "right",
		p: "0"
	},
	render: (e) => /* @__PURE__ */ p(s, {
		...e,
		"data-testid": "split-frame"
	}),
	play: async ({ canvasElement: n }) => {
		let r = e(n).getByTestId("split-frame"), i = r.querySelector("[id$=\"-content\"]"), a = i.getBoundingClientRect().toJSON();
		r.scrollTo({
			left: r.scrollWidth,
			top: r.scrollHeight
		}), t(r.scrollLeft).toBe(0), t(r.scrollTop).toBe(0), t(i.getBoundingClientRect().toJSON()).toEqual(a);
	}
}, x = {
	args: {
		layout: {
			base: "stacked",
			lg: "split"
		},
		collapsible: !1
	},
	parameters: { docs: { description: { story: "Stack panels below the large breakpoint. CSS selects the layout before hydration." } } }
}, S = { args: {
	layout: {
		base: "stacked-reverse",
		lg: "split"
	},
	collapsible: !1
} }, C = {
	args: {
		layout: {
			base: "content",
			lg: "split"
		},
		collapsible: !1
	},
	parameters: { docs: { description: { story: "Hide the resizable navigation panel on small screens while keeping content mounted." } } }
}, w = () => /* @__PURE__ */ m(l, {
	as: "nav",
	direction: "column",
	align: "center",
	flexShrink: 0,
	w: "3.5rem",
	py: "xs",
	gap: "2xs",
	children: [
		/* @__PURE__ */ p(d, {
			size: "sm",
			variant: "subtle",
			"aria-label": "Files",
			children: /* @__PURE__ */ p(u, {
				as: a,
				boxSize: "18px"
			})
		}),
		/* @__PURE__ */ p(d, {
			size: "sm",
			variant: "ghost",
			"aria-label": "Source control",
			children: /* @__PURE__ */ p(u, {
				as: i,
				boxSize: "18px"
			})
		}),
		/* @__PURE__ */ p(d, {
			size: "sm",
			variant: "ghost",
			"aria-label": "Agents",
			children: /* @__PURE__ */ p(u, {
				as: n,
				boxSize: "18px"
			})
		})
	]
}), T = () => /* @__PURE__ */ m(l, {
	as: "footer",
	align: "center",
	flexShrink: 0,
	h: "2rem",
	px: "sm",
	gap: "sm",
	children: [
		/* @__PURE__ */ p(f, {
			fontSize: "xs",
			color: "fg.muted",
			children: "main"
		}),
		/* @__PURE__ */ p(f, {
			fontSize: "xs",
			color: "fg.muted",
			children: "3 files changed"
		}),
		/* @__PURE__ */ p(f, {
			fontSize: "xs",
			color: "fg.muted",
			marginInlineStart: "auto",
			children: "Claude Code · idle"
		})
	]
}), E = () => /* @__PURE__ */ m(l, {
	direction: "column",
	h: "full",
	w: "full",
	minH: "0",
	minW: "0",
	children: [/* @__PURE__ */ m(l, {
		flex: "1",
		minH: "0",
		minW: "0",
		children: [/* @__PURE__ */ p(w, {}), /* @__PURE__ */ p(c, {
			flex: "1",
			minH: "0",
			minW: "0",
			py: "panel-gap",
			pr: "panel-gap",
			children: /* @__PURE__ */ p(s, {
				resizableSide: "right",
				defaultSizePx: 320,
				minSizePx: 240,
				maxSizePx: 560,
				contentMinSizePx: 480,
				resizeLabel: "Resize side panel",
				resizablePanel: /* @__PURE__ */ p(h, {
					title: "Side Panel",
					description: "project · chat"
				}),
				contentPanel: /* @__PURE__ */ p(s, {
					defaultSizePx: 240,
					minSizePx: 160,
					maxSizePx: 480,
					contentMinSizePx: 320,
					resizeLabel: "Resize sidenav",
					resizablePanel: /* @__PURE__ */ p(h, {
						title: "Sidenav",
						description: "project · resizable",
						bg: "bg.subtle"
					}),
					contentPanel: /* @__PURE__ */ m(l, {
						direction: "column",
						h: "full",
						w: "full",
						minH: "0",
						minW: "0",
						children: [/* @__PURE__ */ p(o, {
							variant: "main",
							flexShrink: 0,
							px: "xs",
							children: /* @__PURE__ */ p(f, {
								textStyle: "label/M/medium",
								truncate: !0,
								children: "workspace A"
							})
						}), /* @__PURE__ */ p(s, {
							flex: "1",
							minH: "0",
							resizableSide: "bottom",
							defaultSizePx: 200,
							minSizePx: 96,
							maxSizePx: 480,
							contentMinSizePx: 200,
							resizeLabel: "Resize secondary panel",
							resizablePanel: /* @__PURE__ */ p(h, {
								title: "Secondary Panel",
								description: "resource · hideable"
							}),
							contentPanel: /* @__PURE__ */ p(h, {
								title: "main",
								description: "resource · always on"
							})
						})]
					})
				})
			})
		})]
	}), /* @__PURE__ */ p(T, {})]
}), D = { render: () => /* @__PURE__ */ p(E, {}) }, O = { args: {
	separator: "line",
	p: "0",
	resizablePanel: /* @__PURE__ */ p(h, {
		title: "File list",
		description: "Inner split: a 1px line instead of a grip."
	}),
	contentPanel: /* @__PURE__ */ p(h, {
		title: "Diff",
		description: "Hover the line to see the bar."
	})
} };
export { v as BottomPanel, b as CollapsedFrameStaysFixed, S as ContentFirstOnMobile, _ as LeftPanel, O as LineSeparator, y as NotCollapsible, C as ResponsiveNavigation, x as ResponsivePanels, D as WorkbenchShell, g as default };

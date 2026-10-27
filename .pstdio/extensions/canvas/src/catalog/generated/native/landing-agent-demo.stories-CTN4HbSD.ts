// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./check-Bgh538vW.ts";
import { t } from "./circle-dashed-B1ik78oL.ts";
import { n, t as r } from "./landing-tool-demo-AYY5tVVR.ts";
import { useState as i } from "react";
import { Box as a, Button as o, Code as s, HStack as c, Stack as l, Text as u, useSlotRecipe as d } from "@chakra-ui/react";
import { SessionIndicator as f } from "@pstdio/ui";
import { jsx as p, jsxs as m } from "react/jsx-runtime";
import { KanbanRendererBoard as h } from "@pstdio/ui/kanban-renderer";
var g = {
	title: "Theme/Landing Agent Demo",
	component: () => {
		let g = d({ recipe: n })({}), _ = d({ recipe: r })({}), [v, y] = i(!1), b = {
			id: "TOOL-16",
			cardProps: {
				eyebrow: "TOOL-16",
				title: "Use the icon set in the shader preview",
				customSlots: [/* @__PURE__ */ m(c, {
					css: _.sessionStatus,
					"data-status": v ? "completed" : "in_progress",
					children: [/* @__PURE__ */ p(f, {
						status: v ? "completed" : "in_progress",
						boxSize: "icon-sm"
					}), /* @__PURE__ */ p(u, {
						textStyle: "label/XS/regular",
						children: "Codex · Build"
					})]
				}, "session")]
			}
		}, x = [{
			id: "running",
			label: "In progress",
			color: "blue",
			items: v ? [] : [b]
		}, {
			id: "review",
			label: "Ready for review",
			color: "green",
			items: v ? [b] : []
		}].map((e) => ({
			...e,
			canCreate: !1,
			actions: []
		}));
		return /* @__PURE__ */ m(a, {
			css: g.page,
			children: [
				/* @__PURE__ */ p(a, {
					css: g.visual,
					children: /* @__PURE__ */ m(a, {
						css: g.panel,
						children: [/* @__PURE__ */ p(a, {
							css: g.panelHeader,
							children: "Tool development"
						}), /* @__PURE__ */ p(a, {
							height: "80",
							children: /* @__PURE__ */ p(h, { columns: x })
						})]
					})
				}),
				/* @__PURE__ */ m(a, {
					css: g.panels,
					children: [/* @__PURE__ */ m(a, {
						css: g.panel,
						children: [/* @__PURE__ */ p(a, {
							css: g.panelHeader,
							children: "Agent sessions"
						}), /* @__PURE__ */ m(a, {
							css: g.panelBody,
							children: [/* @__PURE__ */ p(u, {
								textStyle: "label/M/medium",
								children: "Use the icon set in the shader preview"
							}), /* @__PURE__ */ p(o, {
								variant: "subtle",
								onClick: () => y(!v),
								children: v ? "Start session" : "Complete session"
							})]
						})]
					}), /* @__PURE__ */ m(a, {
						css: g.panel,
						children: [/* @__PURE__ */ p(a, {
							css: g.panelHeader,
							children: "When a session completes"
						}), /* @__PURE__ */ m(l, {
							css: g.panelBody,
							children: [
								/* @__PURE__ */ p(u, {
									textStyle: "mono/XS",
									children: "session.completed"
								}),
								/* @__PURE__ */ m(c, {
									gap: "sm",
									children: [p(v ? e : t, { size: 16 }), /* @__PURE__ */ p(u, { children: "Move task to Ready for review" })]
								}),
								/* @__PURE__ */ m(c, {
									gap: "sm",
									children: [p(v ? e : t, { size: 16 }), /* @__PURE__ */ p(u, { children: "Start a review session" })]
								})
							]
						})]
					})]
				}),
				/* @__PURE__ */ m(a, {
					css: g.panels,
					children: [
						/* @__PURE__ */ m(a, {
							css: g.panel,
							children: [/* @__PURE__ */ p(a, {
								css: g.panelHeader,
								children: "Ticket commands"
							}), /* @__PURE__ */ m(l, {
								css: g.panelBody,
								children: [
									/* @__PURE__ */ p(u, {
										textStyle: "label/M/medium",
										children: "Create a ticket"
									}),
									/* @__PURE__ */ p(s, {
										whiteSpace: "pre-wrap",
										overflowWrap: "anywhere",
										children: "pst tickets create --content \"# Add a color picker\" --status \"Queued\""
									}),
									/* @__PURE__ */ p(u, {
										textStyle: "label/M/medium",
										children: "Update ticket status"
									}),
									/* @__PURE__ */ p(s, {
										whiteSpace: "pre-wrap",
										overflowWrap: "anywhere",
										children: "pst tickets update --id TOOL-16 --status \"Ready for review\""
									}),
									/* @__PURE__ */ p(u, {
										textStyle: "label/M/medium",
										children: "List tickets"
									}),
									/* @__PURE__ */ p(s, {
										whiteSpace: "pre-wrap",
										overflowWrap: "anywhere",
										children: "pst tickets list --status \"Queued\""
									})
								]
							})]
						}),
						/* @__PURE__ */ m(a, {
							css: g.panel,
							children: [/* @__PURE__ */ p(a, {
								css: g.panelHeader,
								children: "Agent skills"
							}), /* @__PURE__ */ m(l, {
								css: g.panelBody,
								children: [
									/* @__PURE__ */ p(u, {
										textStyle: "label/M/medium",
										children: "Implement a ticket"
									}),
									/* @__PURE__ */ p(u, { children: "Read the requirements, make the change, run the checks, and update the ticket." }),
									/* @__PURE__ */ p(u, {
										textStyle: "label/M/medium",
										children: "Review a change"
									}),
									/* @__PURE__ */ p(u, { children: "Check the change against the ticket, test edge cases, and record findings." })
								]
							})]
						}),
						/* @__PURE__ */ m(a, {
							css: g.panel,
							children: [/* @__PURE__ */ p(a, {
								css: g.panelHeader,
								children: "Scheduled work"
							}), /* @__PURE__ */ m(l, {
								css: g.panelBody,
								children: [
									/* @__PURE__ */ p(u, {
										textStyle: "label/M/medium",
										children: "Pick up queued tickets · Weekdays at 09:00"
									}),
									/* @__PURE__ */ p(u, { children: "Choose an unblocked ticket and start an agent with the implementation skill." }),
									/* @__PURE__ */ p(u, {
										textStyle: "label/M/medium",
										children: "Prepare a review summary · Weekdays at 16:00"
									}),
									/* @__PURE__ */ p(u, { children: "Summarize tickets ready for review, their checks, and open questions." })
								]
							})]
						})
					]
				})
			]
		});
	},
	parameters: { layout: "fullscreen" }
}, _ = {}, v = { decorators: [(e) => /* @__PURE__ */ p(a, {
	width: "80",
	children: /* @__PURE__ */ p(e, {})
})] };
export { _ as Desktop, v as NarrowPanel, g as default };

// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./arrow-left-DwicprnJ.ts";
import { t } from "./arrow-right-C4vsuHeN.ts";
import { v as n } from "./tracks-EnwyuZ-9.ts";
import { n as r, r as i, t as a } from "./requests-panel-BnXYg-9j.ts";
import { o, s } from "./graph-card-CCSH6w7n.ts";
import { useState as c } from "react";
import { Box as l, Button as u, CloseButton as d, Flex as f, Icon as p, IconButton as m, Stack as h, Text as g } from "@chakra-ui/react";
import { ScrollArea as _ } from "@pstdio/ui";
import { jsx as v, jsxs as y } from "react/jsx-runtime";
// extensions/pstdio-planner/src/timeline/view/block-reason.ts
function b(e) {
	if (e.state === "done" || e.dependsOn.some(({ done: e }) => !e)) return;
	let t = e.blockedReason?.trim();
	if (t) return t;
	if (e.state === "blocked") return "No block reason provided.";
}
// extensions/pstdio-planner/src/timeline/view/block-reason-panel.tsx
function x(e) {
	let { row: t } = e, n = b(t);
	return n ? /* @__PURE__ */ y(h, {
		gap: "xs",
		role: "region",
		"aria-label": "Blocked reason",
		children: [/* @__PURE__ */ v(g, {
			textStyle: "label/S/medium",
			color: "fg.muted",
			children: "Blocked reason"
		}), /* @__PURE__ */ v(l, {
			p: "sm",
			bg: "red.subtle",
			color: "red.fg",
			borderRadius: "md",
			children: /* @__PURE__ */ v(r, { text: n })
		})]
	}) : null;
}
// extensions/pstdio-planner/src/timeline/view/gate-panel.tsx
function S(e) {
	let { row: t, client: n } = e, [i, a] = c(!1), [o, s] = c(), l = async () => {
		a(!0), s(void 0);
		try {
			await n.commands["timeline.gate.launch"]({ ticket: t.id });
		} catch (e) {
			s(String(e));
		} finally {
			a(!1);
		}
	};
	return /* @__PURE__ */ y(h, {
		gap: "xs",
		p: "sm",
		borderWidth: "1px",
		borderStyle: "dashed",
		borderColor: "border.accent/40",
		borderRadius: "md",
		bg: "bg.subtle",
		children: [
			/* @__PURE__ */ v(g, {
				textStyle: "label/S/medium",
				color: "fg.accent",
				children: "AGENT GATE"
			}),
			/* @__PURE__ */ v(g, {
				textStyle: "label/S/regular",
				color: "fg.muted",
				children: "The agent reviews dependencies and milestones, then updates the plan using these instructions."
			}),
			/* @__PURE__ */ v(r, { text: t.instructions }),
			t.done ? null : /* @__PURE__ */ v(u, {
				size: "sm",
				variant: "outline",
				loading: i,
				onClick: () => void l(),
				children: "Review gate"
			}),
			o ? /* @__PURE__ */ v(g, {
				role: "alert",
				color: "fg.error",
				children: o
			}) : null
		]
	});
}
// extensions/pstdio-planner/src/timeline/view/review-bar.tsx
function C(n) {
	let { review: r } = n;
	return /* @__PURE__ */ y(f, {
		align: "center",
		gap: "xs",
		px: "sm",
		py: "2xs",
		bg: "orange.subtle",
		borderRadius: "md",
		children: [
			/* @__PURE__ */ y(g, {
				textStyle: "label/S/medium",
				color: "orange.fg",
				flex: "1",
				children: [
					"Needs human review · ",
					r.position,
					" of ",
					r.total
				]
			}),
			/* @__PURE__ */ v(m, {
				size: "2xs",
				variant: "ghost",
				"aria-label": "Previous ticket to review",
				onClick: () => r.onStep(-1),
				children: /* @__PURE__ */ v(p, { as: e })
			}),
			/* @__PURE__ */ v(m, {
				size: "2xs",
				variant: "ghost",
				"aria-label": "Next ticket to review",
				onClick: () => r.onStep(1),
				children: /* @__PURE__ */ v(p, { as: t })
			})
		]
	});
}
// extensions/pstdio-planner/src/timeline/view/details.tsx
function w(e) {
	let { title: t, links: n, onSelect: r } = e;
	return n.length === 0 ? null : /* @__PURE__ */ y(h, {
		gap: "xs",
		children: [/* @__PURE__ */ v(g, {
			textStyle: "label/S/medium",
			color: "fg.muted",
			children: t
		}), /* @__PURE__ */ v(f, {
			gap: "xs",
			wrap: "wrap",
			children: n.map((e) => /* @__PURE__ */ y(u, {
				size: "2xs",
				variant: "outline",
				onClick: () => r(e.id),
				children: [e.done ? "✓ " : "", e.shorthand]
			}, e.id))
		})]
	});
}
function T(e) {
	let { row: t, plan: r, client: c, onOpen: p, onSelect: m, onClose: b, review: T } = e;
	return /* @__PURE__ */ v(l, {
		w: {
			base: "260px",
			lg: "320px"
		},
		flexShrink: "0",
		minH: "0",
		borderLeftWidth: "1px",
		borderColor: "border.subtle",
		children: /* @__PURE__ */ v(_, {
			h: "full",
			minH: "0",
			children: /* @__PURE__ */ y(h, {
				p: "md",
				gap: "md",
				children: [
					T ? /* @__PURE__ */ v(C, { review: T }) : null,
					/* @__PURE__ */ y(f, {
						align: "start",
						gap: "sm",
						children: [/* @__PURE__ */ y(h, {
							gap: "xs",
							flex: "1",
							minW: "0",
							children: [/* @__PURE__ */ y(f, {
								align: "center",
								gap: "xs",
								children: [
									/* @__PURE__ */ v(s, { row: t }),
									/* @__PURE__ */ v(o, { row: t }),
									/* @__PURE__ */ v(g, {
										textStyle: "label/S/medium",
										color: "fg.muted",
										children: [...t.ancestors, t].map(({ shorthand: e }) => e).join("/")
									})
								]
							}), /* @__PURE__ */ v(g, {
								textStyle: "label/L/medium",
								children: t.title
							})]
						}), /* @__PURE__ */ v(d, {
							size: "sm",
							"aria-label": "Close details",
							onClick: b
						})]
					}),
					/* @__PURE__ */ v(i, {
						row: t,
						plan: r,
						onOpen: p,
						children: /* @__PURE__ */ v(x, { row: t })
					}),
					t.gate ? /* @__PURE__ */ v(S, {
						row: t,
						client: c
					}) : null,
					/* @__PURE__ */ v(i, {
						row: t,
						plan: r,
						onOpen: p,
						children: /* @__PURE__ */ v(a, {
							row: t,
							onAnswer: (e, t) => c.commands.review({
								requestId: e,
								response: t
							}),
							onOpenChat: (e) => c.commands["review-requests.open"]({ requestId: e })
						})
					}),
					t.laterDependencies.length ? /* @__PURE__ */ y(g, {
						textStyle: "label/S/regular",
						color: n.warning,
						children: [
							"Placed before ",
							t.laterDependencies.map(({ shorthand: e }) => e).join(", "),
							", which it depends on."
						]
					}) : null,
					/* @__PURE__ */ v(w, {
						title: "Depends on",
						links: t.dependsOn,
						onSelect: m
					}),
					/* @__PURE__ */ v(w, {
						title: "Holding up",
						links: t.blocks,
						onSelect: m
					}),
					/* @__PURE__ */ v(u, {
						size: "sm",
						variant: "outline",
						onClick: () => p(t.target),
						children: "Open ticket"
					})
				]
			})
		})
	});
}
export { T as Details };

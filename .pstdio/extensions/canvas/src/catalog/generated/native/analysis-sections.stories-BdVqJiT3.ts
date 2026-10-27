// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { i as e, m as t, n, o as r, r as i, t as a, y as o } from "./charts-EzV1PygN.ts";
import { Box as s, Flex as c, Grid as l, HStack as u, Text as d } from "@chakra-ui/react";
import { EmptyState as f, ListRow as p, ScrollArea as m, SimpleCard as h, SimpleCardBody as g } from "@pstdio/ui";
import { jsx as _, jsxs as v } from "react/jsx-runtime";
// .pstdio/extensions/social-radar/src/analysis/analysis-sections.tsx
var y = (e) => {
	let { label: t, value: n, detail: r } = e;
	return /* @__PURE__ */ _(h, { children: /* @__PURE__ */ v(g, { children: [/* @__PURE__ */ _(d, {
		textStyle: "label/S/regular",
		color: "fg.muted",
		children: t
	}), /* @__PURE__ */ v(u, {
		gap: "xs",
		align: "baseline",
		children: [/* @__PURE__ */ _(d, {
			textStyle: "heading/XL",
			children: n
		}), r ? /* @__PURE__ */ _(d, {
			textStyle: "label/XS",
			color: "fg.muted",
			children: r
		}) : null]
	})] }) });
}, b = (e) => {
	let { title: t, meta: n, children: r } = e;
	return /* @__PURE__ */ _(h, {
		minW: "0",
		minH: "0",
		display: "flex",
		flexDirection: "column",
		children: /* @__PURE__ */ v(g, {
			flex: "1",
			minH: "0",
			display: "flex",
			flexDirection: "column",
			gap: "md",
			children: [/* @__PURE__ */ v(u, {
				justify: "space-between",
				flexShrink: 0,
				children: [/* @__PURE__ */ _(d, {
					textStyle: "label/M/medium",
					children: t
				}), n ? /* @__PURE__ */ _(d, {
					textStyle: "label/XS",
					color: "fg.muted",
					children: n
				}) : null]
			}), r]
		})
	});
}, x = (e) => e > 0 ? `+${e}` : String(e), S = (e) => new Date(e).toLocaleDateString("en-US", {
	month: "short",
	day: "numeric"
}), C = {
	title: "Extensions/Social radar/Analysis",
	component: (t) => {
		let { analysis: r, channelNames: o, onOpenMention: u } = t, { mentions: h, threadsFound: g, answered: C, postsUsed: w, days: T } = r;
		return /* @__PURE__ */ v(c, {
			direction: "column",
			gap: "md",
			flex: "1",
			minH: "0",
			children: [/* @__PURE__ */ v(l, {
				templateColumns: "repeat(4, minmax(0, 1fr))",
				gap: "md",
				flexShrink: 0,
				children: [
					/* @__PURE__ */ _(y, {
						label: "Mentions",
						value: h.count,
						detail: x(h.change)
					}),
					/* @__PURE__ */ _(y, {
						label: "Threads found",
						value: g
					}),
					/* @__PURE__ */ _(y, {
						label: "Answered",
						value: C.count,
						detail: `${C.gotReply} got a reply`
					}),
					/* @__PURE__ */ _(y, {
						label: "Post ideas used",
						value: w.count,
						detail: `of ${w.total}`
					})
				]
			}), /* @__PURE__ */ v(l, {
				templateColumns: "minmax(0, 3fr) minmax(0, 2fr)",
				templateRows: "repeat(2, minmax(0, 1fr))",
				gap: "md",
				flex: "1",
				minH: "0",
				children: [
					/* @__PURE__ */ _(b, {
						title: "Mentions per day",
						children: /* @__PURE__ */ _(a, {
							days: r.mentionsPerDay,
							label: `Mentions per day over ${T} days`
						})
					}),
					/* @__PURE__ */ v(b, {
						title: "Mentions",
						meta: `${h.count} in ${T} days`,
						children: [/* @__PURE__ */ _(i, {
							counts: r.mentionSentiment,
							label: "Mentions by sentiment"
						}), r.mentionsBySite.length ? /* @__PURE__ */ _(n, {
							label: "Mentions by site",
							rows: r.mentionsBySite.map((e) => ({
								label: o[e.site] ?? e.site,
								count: e.count
							}))
						}) : null]
					}),
					/* @__PURE__ */ _(b, {
						title: "Common topics",
						meta: `${g} threads`,
						children: r.topics.length ? /* @__PURE__ */ _(n, {
							label: "Common topics",
							rows: r.topics
						}) : /* @__PURE__ */ _(f, {
							title: "No topics yet",
							description: "The agent tags topics when it saves a thread."
						})
					}),
					/* @__PURE__ */ _(b, {
						title: "Recent mentions",
						meta: "Opens the thread",
						children: r.recentMentions.length ? /* @__PURE__ */ _(m, {
							flex: "1",
							minH: "0",
							children: r.recentMentions.map((t) => /* @__PURE__ */ _(p, {
								id: t.id,
								variant: "full-width",
								label: t.title,
								icon: /* @__PURE__ */ _(s, {
									boxSize: "2",
									borderRadius: "full",
									bg: e[t.sentiment ?? "neutral"]
								}),
								endContent: /* @__PURE__ */ v(d, {
									textStyle: "label/XS",
									color: "fg.muted",
									children: [
										o[t.site] ?? t.site,
										" · ",
										S(t.foundAt)
									]
								}),
								onActivate: () => u(t)
							}, t.id))
						}) : /* @__PURE__ */ _(f, {
							title: "No mentions yet",
							description: "Threads that name a brand term appear here."
						})
					})
				]
			})]
		});
	},
	args: {
		analysis: r,
		channelNames: t([]),
		onOpenMention: () => {}
	},
	decorators: [(e) => /* @__PURE__ */ _(s, {
		p: "lg",
		maxW: "7xl",
		children: /* @__PURE__ */ _(e, {})
	})]
}, w = {}, T = { args: { analysis: o({
	threads: [],
	days: 14
}) } };
export { w as FourteenDays, T as NoThreadsYet, C as default };

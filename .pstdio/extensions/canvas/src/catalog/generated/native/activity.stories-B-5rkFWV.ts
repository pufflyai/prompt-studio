// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./circle-dot-DzEudT09.ts";
import { t } from "./circle-B0quX-xX.ts";
import { t as n } from "./ellipsis-BnQWfGiA.ts";
import { t as r } from "./paperclip-CoBJq1oI.ts";
import { n as i, t as a } from "./pin-CyIg8b7z.ts";
import { t as o } from "./tag-CIM9XYhf.ts";
import { t as s } from "./trash-2-C03vrbuo.ts";
import { t as c } from "./scroll-area-I7hjn89T.ts";
import { t as l } from "./activity-57k0aaRS.ts";
import { useState as u } from "react";
import { Box as d, HStack as f, Icon as p, IconButton as m, Menu as h, Portal as g, Text as _ } from "@chakra-ui/react";
import { jsx as v, jsxs as y } from "react/jsx-runtime";
// packages/ui/src/components/activity/activity.stories.tsx
var b = { name: "Jordan Lee" }, x = { name: "System" }, S = [{
	id: "opening-comment",
	body: "teest\n\n\nasdasdas as",
	timestamp: "2mo ago",
	replies: [{
		id: "opening-reply",
		body: "this is a reply",
		timestamp: "just now"
	}]
}, {
	id: "latest-comment",
	body: "another message",
	timestamp: "just now",
	replies: []
}], C = {
	title: "Components/Data Display/Activity",
	parameters: { layout: "fullscreen" },
	decorators: [(e) => /* @__PURE__ */ v(c, {
		height: "100vh",
		background: "bg",
		color: "fg",
		contentProps: { padding: {
			base: "md",
			md: "xl"
		} },
		children: /* @__PURE__ */ v(d, {
			width: "full",
			maxWidth: "820px",
			marginX: "auto",
			children: /* @__PURE__ */ v(e, {})
		})
	})]
}, w = (e) => `${e}-${Date.now()}-${Math.random().toString(16).slice(2)}`, T = (e) => {
	let { comment: t, onDelete: r, onTogglePin: o } = e;
	return /* @__PURE__ */ y(f, {
		gap: "2xs",
		children: [t.isPinned ? /* @__PURE__ */ v(_, {
			textStyle: "label/XS/medium",
			color: "fg.muted",
			children: "Pinned"
		}) : null, /* @__PURE__ */ y(h.Root, {
			positioning: { placement: "bottom-end" },
			children: [/* @__PURE__ */ v(h.Trigger, {
				asChild: !0,
				children: /* @__PURE__ */ v(m, {
					size: "2xs",
					variant: "ghost",
					"aria-label": "Comment actions",
					children: /* @__PURE__ */ v(p, {
						as: n,
						boxSize: "14px"
					})
				})
			}), /* @__PURE__ */ v(g, { children: /* @__PURE__ */ v(h.Positioner, { children: /* @__PURE__ */ y(h.Content, {
				minW: "180px",
				bg: "bg",
				children: [/* @__PURE__ */ y(h.Item, {
					value: "pin-comment",
					onClick: () => o(t.id),
					children: [/* @__PURE__ */ v(p, {
						as: t.isPinned ? i : a,
						boxSize: "14px"
					}), /* @__PURE__ */ v(_, { children: t.isPinned ? "Unpin comment" : "Pin comment" })]
				}), /* @__PURE__ */ y(h.Item, {
					value: "delete-comment",
					color: "red.fg",
					onClick: () => r(t.id),
					children: [/* @__PURE__ */ v(p, {
						as: s,
						boxSize: "14px"
					}), /* @__PURE__ */ v(_, { children: "Delete comment" })]
				})]
			}) }) })]
		})]
	});
}, E = (e) => {
	let { comment: t, onAttach: n, onDelete: r, onReplySubmit: i, onTogglePin: a } = e;
	return /* @__PURE__ */ v(l.Comment, {
		actor: b,
		timestamp: t.timestamp,
		actions: /* @__PURE__ */ v(T, {
			comment: t,
			onDelete: r,
			onTogglePin: a
		}),
		replies: t.replies.map((e) => /* @__PURE__ */ v(l.Reply, {
			actor: b,
			timestamp: e.timestamp,
			children: e.body
		}, e.id)),
		composer: /* @__PURE__ */ v(l.Composer, {
			actor: b,
			variant: "inline",
			placeholder: "Leave a reply...",
			onAttach: n,
			onSubmit: (e) => i(t.id, e)
		}),
		children: t.body
	});
}, D = () => /* @__PURE__ */ y(f, {
	as: "span",
	gap: "2xs",
	whiteSpace: "nowrap",
	children: [
		/* @__PURE__ */ v(_, {
			as: "span",
			children: "added label"
		}),
		/* @__PURE__ */ v(d, {
			as: "span",
			boxSize: "6px",
			borderRadius: "full",
			background: "purple.400"
		}),
		/* @__PURE__ */ v(_, {
			as: "span",
			color: "fg",
			children: "Feature"
		})
	]
}), O = () => {
	let [i, a] = u(S), [s, c] = u([]), f = i.find((e) => e.id === "opening-comment"), p = i.filter((e) => e.id !== "opening-comment"), m = () => {
		c((e) => [...e, {
			id: w("attachment"),
			timestamp: e.length === 0 ? "just now" : "now"
		}]);
	}, h = (e) => {
		a((t) => [...t, {
			id: w("comment"),
			body: e,
			timestamp: "just now",
			replies: []
		}]);
	}, g = (e, t) => {
		a((n) => n.map((n) => n.id === e ? {
			...n,
			replies: [...n.replies, {
				id: w("reply"),
				body: t,
				timestamp: "just now"
			}]
		} : n));
	}, _ = (e) => {
		a((t) => t.map((t) => t.id === e ? {
			...t,
			isPinned: !t.isPinned
		} : t));
	}, C = (e) => {
		a((t) => t.filter((t) => t.id !== e));
	};
	return /* @__PURE__ */ v(d, { children: /* @__PURE__ */ y(l.Root, { children: [/* @__PURE__ */ v(l.Header, {}), /* @__PURE__ */ y(l.Feed, { children: [
		/* @__PURE__ */ v(l.Timeline, { children: /* @__PURE__ */ v(l.Event, {
			actor: x,
			icon: /* @__PURE__ */ v(t, {
				size: 8,
				fill: "currentColor"
			}),
			timestamp: "3mo ago",
			children: "created the issue"
		}) }),
		f ? /* @__PURE__ */ v(E, {
			comment: f,
			onAttach: m,
			onDelete: C,
			onReplySubmit: g,
			onTogglePin: _
		}) : null,
		/* @__PURE__ */ y(l.Timeline, { children: [/* @__PURE__ */ v(l.Event, {
			actor: b,
			icon: /* @__PURE__ */ v(e, { size: 12 }),
			timestamp: "2mo ago",
			children: "moved from Todo to In Progress"
		}), /* @__PURE__ */ v(l.Event, {
			actor: b,
			icon: /* @__PURE__ */ v(n, { size: 12 }),
			timestamp: "7w ago",
			children: "set priority to High, then removed priority"
		})] }),
		p.map((e) => /* @__PURE__ */ v(E, {
			comment: e,
			onAttach: m,
			onDelete: C,
			onReplySubmit: g,
			onTogglePin: _
		}, e.id)),
		/* @__PURE__ */ y(l.Timeline, { children: [/* @__PURE__ */ v(l.Event, {
			actor: b,
			icon: /* @__PURE__ */ v(o, { size: 12 }),
			timestamp: "just now",
			children: /* @__PURE__ */ v(D, {})
		}), s.map((e) => /* @__PURE__ */ v(l.Event, {
			actor: b,
			icon: /* @__PURE__ */ v(r, { size: 12 }),
			timestamp: e.timestamp,
			children: "attached a file"
		}, e.id))] }),
		/* @__PURE__ */ v(l.Composer, {
			actor: b,
			placeholder: "Leave a comment...",
			onAttach: m,
			onSubmit: h
		})
	] })] }) });
}, k = { render: () => /* @__PURE__ */ v(O, {}) };
export { k as Setup, C as default };

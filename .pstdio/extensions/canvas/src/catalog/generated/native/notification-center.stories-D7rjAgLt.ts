// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./bell-Cw2yL2ca.ts";
import { t } from "./search-FHo0INnP.ts";
import { t as n } from "./x-DqEAa6-d.ts";
import { t as r } from "./alert-D8nHP1tF.ts";
import { t as i } from "./list-row-BhxGCvIh.ts";
import { t as a } from "./search-modal-content-CrWUdr-6.ts";
import { useEffect as o, useRef as s, useState as c } from "react";
import { Badge as l, Box as u, Button as d, Dialog as f, HStack as p, Icon as m, Skeleton as h, Stack as g, Text as _ } from "@chakra-ui/react";
import { jsx as v, jsxs as y } from "react/jsx-runtime";
// packages/ui/src/components/notification-center/notification-center.tsx
var b = (e) => e === "urgent" ? "red" : e === "high" ? "orange" : e === "low" ? "gray" : "blue", x = (e) => e !== "normal", S = (e) => [
	e.title,
	e.body,
	e.kind,
	e.priority,
	e.status,
	e.sourceLabel,
	e.targetLabel,
	e.searchText,
	...(e.actions ?? []).map((e) => e.label)
].filter(Boolean).join(" ").toLowerCase(), C = (e, t) => {
	let n = t.trim().toLowerCase();
	return n ? e.filter((e) => S(e).includes(n)) : e;
}, w = (e) => {
	let t = e.filter((e) => e.kind === "blocked"), n = e.filter((e) => e.kind !== "blocked" && (e.priority === "urgent" || e.priority === "high")), r = e.filter((e) => e.kind !== "blocked" && (e.priority === "normal" || e.priority === "low"));
	return [
		{
			id: "needs-input",
			label: "Needs input",
			items: t
		},
		{
			id: "attention",
			label: "Needs attention",
			items: n
		},
		{
			id: "other",
			label: "Other",
			items: r
		}
	].filter((e) => e.items.length > 0);
}, T = (e) => w(e).flatMap((e) => e.items), E = (e) => [
	e.body,
	e.targetLabel,
	e.sourceLabel,
	e.timeLabel
].filter(Boolean).join(" · "), D = (e, t) => {
	let r = [];
	return t.onDismiss && r.push({
		id: "dismiss",
		label: "Dismiss",
		icon: /* @__PURE__ */ v(n, { size: 14 }),
		tooltip: "Dismiss",
		onAction: () => t.onDismiss?.(e)
	}), r;
}, O = (e) => {
	let { actions: t, item: n, onRunAction: r } = e;
	return /* @__PURE__ */ y(p, {
		gap: "2",
		minW: "0",
		flexWrap: "wrap",
		justify: "flex-end",
		children: [
			x(n.priority) ? /* @__PURE__ */ v(l, {
				size: "sm",
				colorPalette: b(n.priority),
				textTransform: "capitalize",
				flexShrink: 0,
				children: n.priority
			}) : null,
			n.status === "open" ? /* @__PURE__ */ v(l, {
				size: "sm",
				colorPalette: "blue",
				variant: "solid",
				flexShrink: 0,
				children: "New"
			}) : null,
			t.map((e) => /* @__PURE__ */ v(d, {
				size: "2xs",
				variant: "outline",
				colorPalette: e.destructive ? "red" : "gray",
				maxW: "9rem",
				onClick: (t) => {
					t.stopPropagation(), r?.(n, e);
				},
				children: /* @__PURE__ */ v(_, {
					truncate: !0,
					children: e.label
				})
			}, e.id))
		]
	});
}, k = (t) => {
	let { activeIndex: n, items: r, onActivateItem: a, onActiveIndexChange: o, onRunAction: s } = t, c = w(r), l = 0;
	return /* @__PURE__ */ v(g, {
		gap: "2xs",
		py: "xs",
		children: c.map((r) => /* @__PURE__ */ y(g, {
			gap: "2xs",
			children: [/* @__PURE__ */ v(_, {
				textStyle: "label/XS/medium",
				color: "fg.muted",
				px: "sm",
				pt: "xs",
				children: r.label
			}), r.items.map((r) => {
				let c = l;
				return l += 1, /* @__PURE__ */ v(i, {
					id: r.id,
					label: r.title,
					description: E(r),
					icon: /* @__PURE__ */ v(m, {
						as: e,
						boxSize: "14px"
					}),
					iconColor: `${b(r.priority)}.500`,
					variant: "compact",
					isSelected: c === n,
					endContent: /* @__PURE__ */ v(O, {
						item: r,
						actions: r.actions ?? [],
						onRunAction: s
					}),
					actions: D(r, t),
					tabIndex: -1,
					onActivate: () => a?.(r),
					onPointerMove: () => o(c)
				}, r.id);
			})]
		}, r.id))
	});
}, A = () => /* @__PURE__ */ v(g, {
	gap: "2",
	p: "sm",
	children: [
		0,
		1,
		2,
		3
	].map((e) => /* @__PURE__ */ y(g, {
		gap: "2xs",
		children: [/* @__PURE__ */ v(h, {
			h: "4",
			w: e % 2 == 0 ? "68%" : "52%",
			borderRadius: "xs"
		}), /* @__PURE__ */ v(h, {
			h: "3",
			w: "88%",
			borderRadius: "xs"
		})]
	}, e))
}), j = (e) => {
	let { autoFocus: n = !1, emptyLabel: i = "No notifications.", error: l, footerEnd: d, footerStart: f, items: p, loading: m = !1, onActivateItem: h, onEscape: g, onQueryChange: b, query: x } = e, [S, w] = c(""), [E, D] = c(0), O = s(null), j = x ?? S, M = C(p, j), N = T(M), P = N[E] ?? null;
	o(() => {
		if (!n) return;
		let e = setTimeout(() => O.current?.focus(), 0);
		return () => clearTimeout(e);
	}, [n]), o(() => {
		D((e) => Math.min(e, Math.max(N.length - 1, 0)));
	}, [N.length]);
	let F = (e) => {
		x === void 0 && w(e), b?.(e), D(0);
	};
	return /* @__PURE__ */ y(a, {
		searchValue: j,
		searchPlaceholder: "Search notifications",
		searchIcon: /* @__PURE__ */ v(t, { size: 14 }),
		searchInputRef: O,
		searchAutoFocus: n,
		footerStart: f,
		footerEnd: d,
		scrollAreaProps: {
			maxH: "24rem",
			showHorizontalScrollbar: !1
		},
		onSearchChange: F,
		onSearchKeyDown: (e) => {
			e.key === "ArrowDown" ? (e.preventDefault(), D((e) => Math.min(e + 1, Math.max(N.length - 1, 0)))) : e.key === "ArrowUp" ? (e.preventDefault(), D((e) => Math.max(e - 1, 0))) : e.key === "Enter" ? (e.preventDefault(), P && h?.(P)) : e.key === "Escape" && (e.preventDefault(), j.length > 0 ? F("") : g?.());
		},
		children: [
			l ? /* @__PURE__ */ v(u, {
				p: "sm",
				children: /* @__PURE__ */ v(r, {
					status: "error",
					colorPalette: "red",
					title: "Notifications unavailable",
					size: "sm",
					children: l
				})
			}) : null,
			!l && m && /* @__PURE__ */ v(A, {}),
			!l && !m && M.length === 0 && /* @__PURE__ */ v(_, {
				textStyle: "paragraph/S/regular",
				color: "fg.muted",
				px: "sm",
				py: "md",
				children: i
			}),
			!l && !m && M.length > 0 && /* @__PURE__ */ v(k, {
				...e,
				items: M,
				activeIndex: E,
				onActiveIndexChange: D
			})
		]
	});
}, M = [
	{
		id: "review-1",
		title: "Review generated workspace changes",
		body: "Agent finished a workspace and is waiting for review.",
		priority: "urgent",
		status: "open",
		sourceLabel: "Planner",
		targetLabel: "PS-95",
		timeLabel: "2m ago",
		actions: [{
			id: "open",
			label: "Open",
			primary: !0
		}]
	},
	{
		id: "blocked-1",
		title: "Resolve blocked package verification",
		body: "Packaged smoke output needs attention before merge.",
		kind: "blocked",
		priority: "high",
		status: "open",
		sourceLabel: "Build",
		targetLabel: "scripts",
		timeLabel: "12m ago",
		actions: [{
			id: "open",
			label: "Inspect",
			primary: !0
		}, {
			id: "rerun",
			label: "Rerun"
		}]
	},
	{
		id: "merge-1",
		title: "Draft PR is ready to merge",
		body: "All required checks passed.",
		priority: "normal",
		status: "read",
		sourceLabel: "GitHub",
		targetLabel: "feature/notifications",
		timeLabel: "1h ago",
		actions: [{
			id: "open-pr",
			label: "Open PR",
			primary: !0
		}]
	},
	{
		id: "info-1",
		title: "Extension index refreshed",
		priority: "low",
		status: "open",
		sourceLabel: "Extensions",
		timeLabel: "Today"
	}
], N = {
	title: "Components/Feedback/Notification Center",
	component: j,
	decorators: [(e) => /* @__PURE__ */ v(u, {
		bg: "bg",
		minH: "32rem",
		p: "lg",
		children: /* @__PURE__ */ v(f.Root, {
			open: !0,
			modal: !1,
			children: /* @__PURE__ */ v(f.Positioner, {
				alignItems: "flex-start",
				justifyContent: "center",
				p: "lg",
				children: /* @__PURE__ */ v(f.Content, {
					maxW: "44rem",
					w: "full",
					p: "0",
					overflow: "hidden",
					borderWidth: "1px",
					borderColor: "border.subtle",
					children: /* @__PURE__ */ v(e, {})
				})
			})
		})
	})]
}, P = { args: {
	items: M,
	footerStart: /* @__PURE__ */ v(_, {
		textStyle: "label/XS",
		color: "fg.muted",
		children: "Enter opens the selected notification"
	})
} }, F = { args: { items: [{
	id: "proposal-review",
	title: "Review proposal: PS-95",
	priority: "high",
	status: "open",
	actions: [{
		id: "review-proposal",
		label: "Review proposal",
		primary: !0
	}, {
		id: "approve-proposal",
		label: "Approve"
	}]
}] } }, I = { args: { items: [{
	id: "new-notification",
	title: "New ticket needs input",
	priority: "high",
	status: "open",
	actions: [{
		id: "reply",
		label: "Reply to agent",
		primary: !0
	}]
}, {
	id: "viewed-notification",
	title: "Viewed merge reminder",
	priority: "normal",
	status: "read",
	actions: [{
		id: "open",
		label: "Open",
		primary: !0
	}]
}] } }, L = { args: { items: [] } }, R = { args: {
	items: [],
	loading: !0
} }, z = { args: {
	items: [],
	error: "The notification stream could not be loaded."
} }, B = { args: { items: Array.from({ length: 80 }, (e, t) => {
	let n = t % 3 == 0 ? "high" : "normal";
	return {
		...M[t % M.length],
		id: `notification-${t}`,
		title: `${M[t % M.length].title} ${t + 1}`,
		priority: t % 6 == 0 ? "urgent" : n
	};
}) } };
export { P as Default, L as Empty, z as ErrorState, B as HighVolume, R as Loading, F as SecondaryActions, I as ViewedItems, N as default };

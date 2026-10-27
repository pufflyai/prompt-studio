// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { S as e, a as t, l as n } from "./lucide-react-CiGXWUCb.ts";
import { b as r } from "./zap-Dajcy3HI.ts";
import { t as i } from "./bell-Cw2yL2ca.ts";
import { t as a } from "./circle-alert-DphG-Ztw.ts";
import { t as o } from "./git-branch-BjWwGBn9.ts";
import { t as s } from "./info-D1px5mME.ts";
import { t as c } from "./message-circle-DP0BFDQF.ts";
import { t as l } from "./sparkles-GpXFEeOw.ts";
import { t as u } from "./scroll-area-I7hjn89T.ts";
import { a as d, n as f, o as p, t as m } from "./activity-timeline-CREzUpF3.ts";
import { t as h } from "./empty-state-C7gtd4pd.ts";
import { t as g } from "./alert-D8nHP1tF.ts";
import { t as _ } from "./rich-message-BDq8UfVC.ts";
import { Box as v, Button as y, HStack as b, Icon as x, Spinner as S, Stack as C, Text as w } from "@chakra-ui/react";
import { jsx as T, jsxs as E } from "react/jsx-runtime";
// packages/ui/src/components/rich-text/resource-activity-feed/resource-activity-feed.tsx
var D = {
	activity: e,
	bell: i,
	"circle-alert": a,
	component: r,
	"external-link": n,
	"git-branch": o,
	info: s,
	"message-circle": c,
	"scan-search": t,
	sparkles: l
}, O = (e) => {
	let t = D[e.name];
	return /* @__PURE__ */ T(x, {
		as: t,
		boxSize: "13px"
	});
}, k = (e) => {
	let { item: t, size: n, onActionSelect: r, onRelatedResourceSelect: i } = e, a = t.kind === "message" ? t.attention?.actions : void 0;
	return !t.relatedResources?.length && !a?.length ? null : /* @__PURE__ */ E(b, {
		gap: "2xs",
		flexWrap: "wrap",
		children: [a?.map((e) => /* @__PURE__ */ E(y, {
			type: "button",
			size: n === "compact" ? "2xs" : "xs",
			variant: "outline",
			disabled: !r,
			onClick: () => r?.(e, t),
			children: [e.icon ? /* @__PURE__ */ T(O, { name: e.icon }) : null, e.label]
		}, e.id)), t.relatedResources?.map((e) => /* @__PURE__ */ T(y, {
			type: "button",
			size: n === "compact" ? "2xs" : "xs",
			variant: "ghost",
			disabled: !i,
			onClick: () => i?.(e, t),
			children: e.label
		}, `${e.type}:${e.id}`))]
	});
}, A = (e) => {
	let { attention: t } = e;
	return t.statusLabel ? /* @__PURE__ */ E(b, {
		gap: "2xs",
		color: "fg.warning",
		children: [/* @__PURE__ */ T(O, { name: t.icon ?? "bell" }), /* @__PURE__ */ T(w, {
			textStyle: "label/XS/medium",
			children: t.statusLabel
		})]
	}) : null;
}, j = (e) => {
	let { item: t, size: n, fallbackActorName: r, formatTimestamp: i, onActionSelect: a, onRelatedResourceSelect: o } = e, s = t.actor ?? { name: r }, c = /* @__PURE__ */ T("time", {
		dateTime: t.createdAt,
		children: t.timestampLabel ?? i(t.createdAt, t)
	});
	if (t.kind === "event") return /* @__PURE__ */ T(m, { children: /* @__PURE__ */ E(d, {
		actor: s,
		icon: t.icon ? /* @__PURE__ */ T(O, { name: t.icon }) : void 0,
		timestamp: c,
		paddingX: n === "compact" ? "sm" : "md",
		children: [/* @__PURE__ */ T(w, {
			as: "span",
			children: t.summary
		}), /* @__PURE__ */ T(k, {
			item: t,
			size: n,
			onRelatedResourceSelect: o
		})]
	}) });
	let l = t.attention?.icon ?? "bell";
	return /* @__PURE__ */ T(p, {
		actor: s,
		icon: t.attention ? /* @__PURE__ */ T(O, { name: l }) : void 0,
		iconColor: t.attention ? "fg.warning" : void 0,
		iconBackground: t.attention ? "bg.warning" : void 0,
		timestamp: c,
		actions: t.attention ? /* @__PURE__ */ T(A, { attention: t.attention }) : void 0,
		tone: t.attention ? "attention" : "default",
		size: n,
		children: /* @__PURE__ */ E(C, {
			gap: n === "compact" ? "xs" : "sm",
			children: [/* @__PURE__ */ T(_, {
				defaultState: t.markdown,
				fullWidth: !0
			}), /* @__PURE__ */ T(k, {
				item: t,
				size: n,
				onActionSelect: a,
				onRelatedResourceSelect: o
			})]
		})
	});
}, M = (e) => e, N = (e) => {
	let { items: t, size: n = "comfortable", isLoading: r = !1, error: i, hasMore: a = !1, isLoadingMore: o = !1, emptyTitle: s = "No activity yet", emptyDescription: c = "Events and messages will appear here.", errorTitle: l = "Activity unavailable", loadMoreLabel: u = "Load more", loadingLabel: d = "Loading activity", fallbackActorName: p = "System", formatTimestamp: m = M, onActionSelect: _, onLoadMore: v, onRelatedResourceSelect: x, ...C } = e;
	return i ? /* @__PURE__ */ T(g, {
		status: "error",
		colorPalette: "red",
		title: l,
		size: "sm",
		...C,
		children: i
	}) : r && t.length === 0 ? /* @__PURE__ */ E(b, {
		role: "status",
		"aria-live": "polite",
		gap: "xs",
		color: "fg.muted",
		...C,
		children: [/* @__PURE__ */ T(S, { size: "sm" }), /* @__PURE__ */ T(w, {
			textStyle: "label/S/regular",
			children: d
		})]
	}) : t.length === 0 ? /* @__PURE__ */ T(h, {
		title: s,
		description: c,
		...C
	}) : /* @__PURE__ */ E(f, {
		gap: n === "compact" ? "sm" : "md",
		...C,
		children: [t.map((e) => /* @__PURE__ */ T(j, {
			item: e,
			size: n,
			fallbackActorName: p,
			formatTimestamp: m,
			onActionSelect: _,
			onRelatedResourceSelect: x
		}, e.id)), a ? /* @__PURE__ */ T(y, {
			type: "button",
			width: "full",
			size: n === "compact" ? "xs" : "sm",
			variant: "ghost",
			loading: o,
			onClick: v,
			children: u
		}) : null]
	});
}, P = {
	id: "input-request",
	kind: "message",
	createdAt: "2026-08-24T10:48:00.000Z",
	timestampLabel: "10:48",
	actor: { name: "Planner Agent" },
	markdown: "Which workspace should be treated as canonical?\n\nChoose `PS-276_A1` or the current branch before the next attempt starts.",
	attention: {
		statusLabel: "Awaiting input",
		icon: "bell",
		actions: [{
			id: "open-session",
			label: "Open session",
			icon: "message-circle"
		}, {
			id: "open-ticket",
			label: "Open ticket",
			icon: "component"
		}]
	}
}, F = [
	{
		id: "review-note",
		kind: "message",
		createdAt: "2026-08-23T15:45:00.000Z",
		timestampLabel: "yesterday",
		actor: { name: "Sam Rivera" },
		markdown: "The component should keep routing outside `@pstdio/ui`.\n\n- Keep item data serializable\n- Use stable IDs for keys",
		relatedResources: [{
			id: "design-note",
			type: "document",
			label: "Design note"
		}]
	},
	{
		id: "status-change",
		kind: "event",
		createdAt: "2026-08-20T10:30:00.000Z",
		timestampLabel: "4 days ago",
		actor: { name: "Jordan Lee" },
		icon: "activity",
		summary: "moved the ticket from Backlog to Todo",
		relatedResources: [{
			id: "PS-287",
			type: "ticket",
			label: "PS-287"
		}]
	},
	{
		id: "created",
		kind: "event",
		createdAt: "2026-08-20T08:15:00.000Z",
		timestampLabel: "4 days ago",
		actor: { name: "System" },
		icon: "component",
		summary: "created this resource"
	}
], I = [{
	id: "long-message",
	kind: "message",
	createdAt: "2026-08-24T08:00:00.000Z",
	timestampLabel: "1 hour ago",
	actor: { name: "Release bot" },
	markdown: "## Validation notes\n\nThe activity feed accepts events and markdown messages through one typed item union. It preserves the supplied order and keeps resource navigation in caller callbacks.\n\n### Checks\n\n1. Loading, empty, error, and pagination states remain visible to assistive technology.\n2. Long markdown wraps inside the existing comment component.\n3. Related resources use buttons, so keyboard and pointer users trigger the same callback.\n\n```ts\nconst item = {\n  id: \"event-1\",\n  kind: \"event\",\n  createdAt: \"2026-08-24T08:00:00.000Z\",\n  summary: \"published a revision\",\n};\n```\n"
}], L = [
	P,
	{
		id: "workspace-created",
		kind: "event",
		createdAt: "2026-08-24T10:46:00.000Z",
		timestampLabel: "10:46",
		actor: { name: "System Agent" },
		icon: "git-branch",
		summary: "created a worktree-backed workspace",
		relatedResources: [{
			id: "PS-276_A1",
			type: "workspace",
			label: "PS-276_A1"
		}]
	},
	{
		id: "refinement-started",
		kind: "event",
		createdAt: "2026-08-24T10:42:00.000Z",
		timestampLabel: "10:42",
		actor: { name: "Planner Agent" },
		icon: "sparkles",
		summary: "started a refinement session",
		relatedResources: [{
			id: "PS-276",
			type: "ticket",
			label: "Refine PS-276"
		}]
	}
], R = {
	title: "Components/Data Display/Resource Activity Feed",
	component: N,
	tags: ["ps-287"],
	parameters: { layout: "fullscreen" },
	decorators: [(e, t) => /* @__PURE__ */ T(u, {
		height: "100vh",
		background: "bg",
		color: "fg",
		contentProps: { padding: {
			base: "md",
			md: "xl"
		} },
		children: /* @__PURE__ */ T(v, {
			width: "full",
			maxWidth: t.parameters.feedWidth ?? "820px",
			marginX: "auto",
			children: /* @__PURE__ */ T(e, {})
		})
	})]
}, z = { args: {
	items: F,
	hasMore: !0,
	onLoadMore: () => void 0,
	onRelatedResourceSelect: () => void 0
} }, B = { args: {
	items: [P],
	onActionSelect: () => void 0
} }, V = { args: { items: [] } }, H = { args: {
	items: [],
	isLoading: !0
} }, U = { args: {
	items: [],
	error: "The activity service did not respond."
} }, W = { args: { items: I } }, G = {
	args: {
		items: L,
		onActionSelect: () => void 0,
		onRelatedResourceSelect: () => void 0
	},
	parameters: { feedWidth: "1100px" }
}, K = {
	args: {
		items: [P, ...F.slice(0, 2)],
		size: "compact",
		onActionSelect: () => void 0,
		onRelatedResourceSelect: () => void 0
	},
	parameters: { feedWidth: "320px" }
}, q = {
	...K,
	globals: { theme: "pstdio-dark" }
}, J = {
	args: {
		items: [P, ...F],
		hasMore: !0,
		onActionSelect: () => void 0,
		onLoadMore: () => void 0,
		onRelatedResourceSelect: () => void 0
	},
	globals: { theme: "pstdio-dark" }
};
export { B as AttentionMessage, J as DarkMode, V as Empty, U as ErrorState, H as Loading, W as LongContent, z as MixedActivity, K as PanelMenu, q as PanelMenuDark, G as WideContent, R as default };

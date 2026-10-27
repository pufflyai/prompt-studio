// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./chevron-down-ZmPqsMG0.ts";
import { t } from "./cloud-Bj0H0fk_.ts";
import { t as n } from "./folder-DJ8ZbA4G.ts";
import { t as r } from "./git-branch-BjWwGBn9.ts";
import { t as i } from "./tooltip-BweQW627.ts";
import { t as a } from "./session-indicator-7-mIGr-J.ts";
import { Badge as o, Box as s, HStack as c, Icon as l, Spinner as u, Text as d } from "@chakra-ui/react";
import { jsx as f, jsxs as p } from "react/jsx-runtime";
// packages/ui/src/components/primitives/workspace-badge.tsx
var m = { amber: "yellow" }, h = /* @__PURE__ */ new Set([
	"gray",
	"red",
	"orange",
	"yellow",
	"green",
	"teal",
	"blue",
	"cyan",
	"purple",
	"pink"
]), g = {
	bg: {
		_light: "bg.muted",
		_dark: "bg.subtle"
	},
	color: "fg.muted",
	_hover: { bg: {
		_light: "bg.subtle",
		_dark: "bg.hover"
	} }
}, _ = {
	folder: {
		icon: n,
		label: "Project folder"
	},
	remote: {
		icon: t,
		label: "Remote workspace"
	},
	worktree: {
		icon: r,
		label: "Git worktree"
	}
}, v = (e) => {
	if (e.startsWith("#") || e.startsWith("rgb") || e.startsWith("hsl") || e.startsWith("var(")) return e;
	let t = m[e] ?? e;
	return h.has(t) ? `var(--chakra-colors-${t}-500)` : t;
}, y = (e) => e ? e.description ? `${e.name}: ${e.description}` : e.name : null, b = (e, t) => {
	e.stopPropagation(), t?.();
}, x = (e, t) => {
	e.stopPropagation(), t?.();
}, S = (e) => {
	let { sessionStatus: t, onSessionIndicatorClick: n } = e;
	if (!t) return null;
	let r = n ? "Open latest session" : "Latest session status";
	return /* @__PURE__ */ f(i, {
		content: r,
		children: /* @__PURE__ */ f(a, {
			status: t,
			boxSize: "12px",
			ariaLabel: r,
			cursor: "pointer",
			onClick: n ? (e) => b(e, n) : void 0
		})
	});
}, C = (e) => {
	let { workspaceType: t, initializing: n, label: r, shorthand: i } = e, { icon: a, label: o } = _[t], s = r ?? i;
	return /* @__PURE__ */ p(c, {
		as: "span",
		gap: "2xs",
		alignItems: "center",
		color: "fg.muted",
		minW: "0",
		children: [
			/* @__PURE__ */ f(l, {
				as: a,
				boxSize: "3.5",
				flexShrink: 0,
				"aria-label": o
			}),
			n ? /* @__PURE__ */ f(u, {
				size: "xs",
				color: "fg.muted"
			}) : null,
			s ? /* @__PURE__ */ f(d, {
				as: "span",
				textStyle: "label/XS/medium",
				color: "fg.muted",
				minW: "0",
				maxW: "10rem",
				truncate: !0,
				children: s
			}) : null
		]
	});
}, w = (e) => {
	let { attemptStatus: t } = e;
	return t ? /* @__PURE__ */ f(i, {
		content: y(t),
		children: /* @__PURE__ */ f(s, {
			as: "span",
			boxSize: "8px",
			borderRadius: "full",
			backgroundColor: v(t.color),
			flexShrink: 0,
			"aria-label": `Attempt status ${t.name}`,
			"data-testid": "workspace-attempt-status"
		})
	}) : null;
}, T = (e) => {
	let { diffAdditions: t, diffDeletions: n } = e;
	return typeof t != "number" || typeof n != "number" ? null : /* @__PURE__ */ p(c, {
		as: "span",
		gap: "3xs",
		flexShrink: 0,
		children: [/* @__PURE__ */ p(d, {
			as: "span",
			textStyle: "label/XS/medium",
			color: "fg.success",
			children: ["+", t]
		}), /* @__PURE__ */ p(d, {
			as: "span",
			textStyle: "label/XS/medium",
			color: "fg.error",
			children: ["-", n]
		})]
	});
}, E = (t) => {
	let { hasMultipleWorkspaces: n, onDropdownClick: r } = t;
	return n ? /* @__PURE__ */ f(l, {
		as: e,
		boxSize: "12px",
		color: "fg.muted",
		cursor: r ? "pointer" : "default",
		"aria-label": "Workspace selector",
		onClick: r ? (e) => b(e, r) : void 0
	}) : null;
}, D = (e) => {
	let { workspaceType: t, initializing: n = !1, label: r, shorthand: i, attemptStatus: a, sessionStatus: s, showLeadingSessionIndicator: c = !0, diffAdditions: l, diffDeletions: u, hasMultipleWorkspaces: d = !1, onClick: m, onDropdownClick: h, onSessionIndicatorClick: _ } = e;
	return /* @__PURE__ */ p(o, {
		as: "span",
		display: "inline-flex",
		gap: "2xs",
		alignItems: "center",
		minW: "0",
		maxW: "100%",
		variant: "subtle",
		...g,
		textStyle: "label/XS/medium",
		cursor: m || h || d ? "pointer" : "default",
		transition: "background-color 0.2s ease-in-out",
		onClick: m ? (e) => x(e, m) : void 0,
		"data-testid": "workspace-badge",
		children: [
			c ? /* @__PURE__ */ f(S, {
				sessionStatus: s,
				onSessionIndicatorClick: _
			}) : null,
			/* @__PURE__ */ f(C, {
				workspaceType: t,
				initializing: n,
				label: r,
				shorthand: i
			}),
			/* @__PURE__ */ f(w, { attemptStatus: a }),
			/* @__PURE__ */ f(T, {
				diffAdditions: l,
				diffDeletions: u
			}),
			/* @__PURE__ */ f(E, {
				hasMultipleWorkspaces: d,
				onDropdownClick: h
			})
		]
	});
};
export { D as t };

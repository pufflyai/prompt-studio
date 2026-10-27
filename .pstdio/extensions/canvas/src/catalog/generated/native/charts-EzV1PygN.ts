// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e, b as t, d as n, f as r, g as i, m as a, n as o, o as s, p as c, v as l } from "./schemas-D84h_Ad-.ts";
import { t as u } from "./iso-Dyo-gxfV.ts";
import { t as d } from "./QueryClientProvider-LIjzams-.ts";
import { t as f } from "./queryClient-BgKKh9f4.ts";
import { a as p, i as m, n as h, o as g, r as _, t as v } from "./wiggle-K39oXP_x.ts";
import { t as y } from "./band-Daw32bCA.ts";
import * as b from "react";
import { createContext as x, useContext as S } from "react";
import { Box as C, HStack as w, Text as T } from "@chakra-ui/react";
import { psTheme as E } from "@pstdio/ui";
import { jsx as D, jsxs as O } from "react/jsx-runtime";
import { defineArtifactMount as k, defineResourceKind as A, eventRef as ee } from "@pstdio/sdk/extensions";
// .pstdio/extensions/social-radar/src/schemas.ts
var j = i().trim().min(1), M = [
	"negative",
	"neutral",
	"positive"
], N = i().trim().min(1), P = u();
o([
	"new",
	"idea",
	"answered",
	"skipped"
]), o([
	"new",
	"saved",
	"used",
	"dismissed"
]);
var F = o([
	"demo",
	"topic",
	"showcase"
]), I = t({ protocol: /^https?$/ }), te = c({
	file: N.regex(/^[^/\\]+$/, "Use a file name, not a path."),
	alt: N.optional()
}), L = e(te).optional(), ne = c({
	id: N,
	parentId: N.optional(),
	author: N,
	publishedAt: P.optional(),
	body: N,
	votes: r().int().optional(),
	mine: s().optional(),
	topic: N.optional(),
	images: L
}), re = c({
	takenAt: P,
	post: c({
		author: N.optional(),
		publishedAt: P.optional(),
		body: N,
		score: r().int().optional(),
		commentCount: r().int().nonnegative().optional(),
		images: L
	}),
	comments: e(ne).max(30).superRefine((e, t) => {
		let n = new Map(e.map((e) => [e.id, e.parentId]));
		n.size !== e.length && t.addIssue({
			code: "custom",
			message: "Comment ids must be unique."
		});
		for (let r of e) {
			let e = /* @__PURE__ */ new Set([r.id]);
			for (let i = r.parentId; i; i = n.get(i)) {
				if (e.has(i)) {
					t.addIssue({
						code: "custom",
						message: `Comment ${r.id} answers itself.`
					});
					break;
				}
				e.add(i);
			}
		}
	})
}).superRefine((e, t) => {
	let n = [e.post, ...e.comments].flatMap((e) => e.images ?? []).map((e) => e.file);
	n.length > 4 && t.addIssue({
		code: "custom",
		message: "A thread keeps at most 4 images."
	});
	let r = n.find((e, t) => n.indexOf(e) !== t);
	r && t.addIssue({
		code: "custom",
		message: `This thread already has an image named ${r}.`
	});
}), R = r().int().nonnegative(), ie = c({
	summary: N,
	sentiment: o(M),
	replySentiment: c({
		negative: R,
		neutral: R,
		positive: R
	}),
	topics: e(c({
		label: N,
		count: R
	})),
	questions: e(N)
}), ae = c({
	runId: N,
	site: j,
	url: I,
	title: N,
	author: N.optional(),
	community: N.optional(),
	excerpt: N.max(500),
	publishedAt: P.optional(),
	topic: N,
	mention: s(),
	intent: o([
		"asking-for-tool",
		"problem",
		"comparison",
		"launch",
		"mention",
		"discussion"
	]),
	relevance: l([
		n(1),
		n(2),
		n(3)
	]),
	reason: N,
	snapshot: re.optional(),
	analysis: ie.optional()
}), oe = c({
	runId: N,
	kind: F,
	site: j,
	title: N,
	draft: N,
	reason: N,
	tags: e(N),
	basedOn: e(N).optional()
});
l([oe.strict(), ae.strict()]), c({
	...ae.omit({
		runId: !0,
		site: !0,
		url: !0
	}).shape,
	...oe.omit({
		runId: !0,
		site: !0,
		kind: !0
	}).shape,
	outcome: N
}).partial().strict().refine((e) => Object.keys(e).length > 0, "Provide at least one thread change."), c({
	runId: N,
	threadId: N,
	replyTo: N.optional(),
	body: N
}), c({ body: N }).strict(), c({
	runId: N,
	summary: N,
	searches: a(j, r().int().nonnegative()),
	skippedSites: e(c({
		site: j,
		reason: N,
		needsLogin: s()
	}))
});
var z = (e) => "kind" in e, se = (e) => new Date(e).toLocaleDateString("sv-SE"), ce = (e, t) => {
	let n = /* @__PURE__ */ new Map();
	for (let r of e) n.set(t(r), (n.get(t(r)) ?? 0) + 1);
	return n;
}, le = (e, t) => [...e].sort((e, t) => t[1] - e[1] || e[0].localeCompare(t[0])).slice(0, t), B = (e) => {
	let t = new Set(e.snapshot?.comments.filter((e) => e.mine).map((e) => e.id));
	return e.snapshot?.comments.some((e) => e.parentId && t.has(e.parentId)) ?? !1;
}, ue = (e) => {
	let { threads: t, days: n, site: r, now: i = Date.now() } = e, a = new Date(i);
	a.setHours(0, 0, 0, 0), a.setDate(a.getDate() - n + 1);
	let o = a.getTime(), s = new Date(o);
	s.setDate(s.getDate() - n);
	let c = t.filter((e) => !r || e.site === r), l = (e, t, n) => {
		let r = Date.parse(e.foundAt);
		return r >= t && r < n;
	}, u = c.filter((e) => !z(e) && l(e, o, i + 1)), d = c.filter((e) => z(e) && l(e, o, i + 1)), f = u.filter((e) => e.mention), p = c.filter((e) => !z(e) && e.mention && l(e, s.getTime(), o)).length, m = u.filter((e) => e.status === "answered"), h = ce(f, (e) => se(Date.parse(e.foundAt))), g = Object.fromEntries(M.map((e) => [e, 0]));
	for (let e of f) e.analysis && (g[e.analysis.sentiment] += 1);
	let _ = /* @__PURE__ */ new Map();
	for (let e of u) for (let t of new Set(e.analysis?.topics.map((e) => e.label))) _.set(t, (_.get(t) ?? 0) + 1);
	return {
		days: n,
		mentions: {
			count: f.length,
			change: f.length - p
		},
		threadsFound: u.length,
		answered: {
			count: m.length,
			gotReply: m.filter(B).length
		},
		postsUsed: {
			count: d.filter((e) => e.status === "answered").length,
			total: d.length
		},
		mentionsPerDay: Array.from({ length: n }, (e, t) => {
			let n = new Date(o);
			n.setDate(n.getDate() + t);
			let r = se(n.getTime());
			return {
				day: r,
				count: h.get(r) ?? 0
			};
		}),
		mentionSentiment: g,
		mentionsBySite: le(ce(f, (e) => e.site), 8).map(([e, t]) => ({
			site: e,
			count: t
		})),
		topics: le(_, 8).map(([e, t]) => ({
			label: e,
			count: t
		})),
		recentMentions: [...f].sort((e, t) => t.foundAt.localeCompare(e.foundAt)).slice(0, 8).map((e) => ({
			id: e.id,
			title: e.title,
			site: e.site,
			sentiment: e.analysis?.sentiment ?? null,
			foundAt: e.foundAt
		}))
	};
}, V = [
	{
		id: "hn",
		name: "Hacker News",
		budget: 4,
		targets: []
	},
	{
		id: "reddit",
		name: "Reddit",
		budget: 4,
		targets: [
			"r/ClaudeAI",
			"r/ClaudeCode",
			"r/ChatGPTCoding",
			"r/AI_Agents",
			"r/vibecoding"
		]
	},
	{
		id: "bluesky",
		name: "Bluesky",
		budget: 3,
		targets: []
	},
	{
		id: "devto",
		name: "DEV Community",
		budget: 2,
		targets: []
	},
	{
		id: "github",
		name: "GitHub",
		budget: 2,
		targets: []
	},
	{
		id: "youtube",
		name: "YouTube",
		budget: 2,
		targets: []
	},
	{
		id: "x",
		name: "X",
		budget: 3,
		targets: []
	},
	{
		id: "linkedin",
		name: "LinkedIn",
		budget: 3,
		targets: []
	}
], de = (e) => Object.fromEntries([...V, ...e].map((e) => [e.id, e.name])), fe = {
	hn: {
		images: 0,
		videos: 0
	},
	reddit: {
		images: 20,
		videos: 1,
		either: !0
	},
	bluesky: {
		images: 4,
		videos: 1,
		either: !0
	},
	devto: {
		images: 10,
		videos: 0
	},
	github: {
		images: 10,
		videos: 1
	},
	youtube: {
		images: 0,
		videos: 1
	},
	x: {
		images: 4,
		videos: 1,
		either: !0
	},
	linkedin: {
		images: 20,
		videos: 1,
		either: !0
	}
}, pe = [
	"png",
	"jpg",
	"jpeg",
	"webp"
], H = [
	"gif",
	"mp4",
	"mov",
	"webm"
], me = (e) => {
	let t = e.split(".").pop()?.toLowerCase() ?? "";
	return pe.includes(t) ? "image" : H.includes(t) ? "video" : null;
}, U = {
	x: 280,
	bluesky: 300,
	linkedin: 3e3
}, he = (e, t) => {
	if (!t.images && !t.videos) return `${e} takes no media.`;
	let n = t.images ? `up to ${t.images} image${t.images === 1 ? "" : "s"}` : "";
	return `${e} takes ${[t.videos ? `${t.videos} video` : "", n].filter(Boolean).join(t.either ? ", or " : " and ")}.`;
};
ee({
	extensionId: "pstdio.social-radar",
	id: "radar.changed"
}), A({
	id: "thread",
	label: "Thread",
	icon: "message-square"
});
var ge = k({
	id: "post-media",
	path: "post-media",
	label: "Post media"
}), _e = k({
	id: "thread-media",
	path: "thread-media",
	label: "Thread images"
});
A({
	id: "run",
	label: "Run",
	icon: "radar"
}), A({
	id: "settings-section",
	label: "Settings section",
	icon: "settings"
}), A({
	id: "channel",
	label: "Channel",
	icon: "radio-tower"
});
// .pstdio/extensions/social-radar/src/webview/client.tsx
var ve = x(null), ye = () => {
	let e = S(ve);
	if (!e) throw Error("Social radar needs the extension host.");
	return e;
}, be = () => {
	let { host: e } = ye();
	return (t) => e.call("navigation.open", { target: {
		kind: "href",
		href: t
	} });
}, xe = Date.parse("2026-09-28T07:14:00.000Z"), W = (e) => (/* @__PURE__ */ new Date(xe - e * 36e5)).toISOString(), Se = {
	id: "thread-1",
	runId: "run-1",
	site: "reddit",
	url: "https://www.reddit.com/r/ClaudeAI/comments/abc/tried_prompt_studio",
	title: "Tried Prompt Studio for my review flow, some notes",
	community: "r/ClaudeAI",
	excerpt: "I tried Prompt Studio to build a small review page.",
	topic: "Prompt Studio",
	mention: !0,
	intent: "mention",
	relevance: 3,
	reason: "A first-hand review that names Prompt Studio.",
	status: "answered",
	foundAt: W(20),
	answeredAt: W(18),
	outcome: "23 upvotes, 4 replies. The poster will try the review page again.",
	snapshot: {
		takenAt: W(1),
		post: {
			author: "u/devtools_dana",
			publishedAt: W(22),
			body: "I review a lot of agent diffs every day, so I tried Prompt Studio to build a small review page. It took an evening. Setup was the slow part. Has anyone else done this on Windows?",
			score: 142,
			commentCount: 38,
			images: [{
				file: "review-page.png",
				alt: "A review page with a diff and its tests"
			}]
		},
		comments: [
			{
				id: "c1",
				author: "u/agent_wrangler",
				publishedAt: W(20),
				body: "Setup on Windows took me an hour. I followed https://prompt.studio/docs/setup.",
				votes: 41,
				topic: "Windows setup"
			},
			{
				id: "c2",
				parentId: "c1",
				author: "u/devtools_dana",
				publishedAt: W(19),
				body: "Same here, macOS was fine.",
				votes: 12
			},
			{
				id: "c3",
				parentId: "c1",
				author: "u/prompt_studio_au",
				publishedAt: W(18),
				body: "The desktop app now installs without WSL; the setup guide covers it in two steps.",
				votes: 23,
				mine: !0
			},
			{
				id: "c4",
				author: "u/cursor_fan",
				publishedAt: W(16),
				body: "How does this compare to Cursor's background agents?",
				votes: 9,
				topic: "comparisons to Cursor"
			}
		]
	},
	analysis: {
		summary: "The poster built a review page in an evening and liked it. The main complaint is Windows setup.",
		sentiment: "positive",
		replySentiment: {
			negative: 6,
			neutral: 12,
			positive: 20
		},
		topics: [
			{
				label: "review flow",
				count: 11
			},
			{
				label: "Windows setup",
				count: 7
			},
			{
				label: "comparisons to Cursor",
				count: 5
			}
		],
		questions: ["Does it work on Windows without WSL?", "How does it compare to Cursor background agents?"]
	}
}, Ce = [{
	id: "idea-1",
	runId: "run-1",
	threadId: "thread-1",
	replyTo: "c4",
	body: "Different jobs. Background agents run a task in the cloud and push a branch. Prompt Studio is where you build the tools around that work, like this review page.",
	status: "new",
	createdAt: W(1)
}], we = {
	id: "post-1",
	runId: "run-1",
	kind: "demo",
	site: "x",
	title: "Review page for agent diffs, built in ten minutes",
	draft: "I review agent diffs all day, so I built a review page for them in Prompt Studio. Ten minutes: I described the page and the agent built it. #BuildInPublic",
	reason: "Two threads this week show people building review pages for agent diffs.",
	tags: ["#BuildInPublic", "#AIagents"],
	basedOn: ["thread-1", "abc1234"],
	status: "idea",
	foundAt: W(1)
}, Te = ue({
	now: xe,
	days: 14,
	threads: Array.from({ length: 14 }, (e, t) => ({
		...Se,
		id: `mention-${t}`,
		site: [
			"reddit",
			"hn",
			"x"
		][t % 3],
		title: `${Se.title} (${t + 1})`,
		foundAt: W(t * 20 + 1),
		status: t % 4 ? "new" : "answered",
		analysis: {
			...Se.analysis,
			sentiment: [
				"positive",
				"neutral",
				"negative"
			][t % 3]
		}
	}))
}), Ee = "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22640%22%20height%3D%22360%22%3E%3Crect%20width%3D%22640%22%20height%3D%22360%22%20fill%3D%22%23e8ecf2%22%2F%3E%3Crect%20x%3D%2240%22%20y%3D%2240%22%20width%3D%22560%22%20height%3D%2240%22%20rx%3D%226%22%20fill%3D%22%23c9d2df%22%2F%3E%3Crect%20x%3D%2240%22%20y%3D%22100%22%20width%3D%22360%22%20height%3D%22220%22%20rx%3D%226%22%20fill%3D%22%23d7dee8%22%2F%3E%3Crect%20x%3D%22420%22%20y%3D%22100%22%20width%3D%22180%22%20height%3D%22220%22%20rx%3D%226%22%20fill%3D%22%23c9d2df%22%2F%3E%3C%2Fsvg%3E", De = {
	artifacts: {
		list: async () => [],
		readText: async () => "",
		imageUrl: async () => Ee
	},
	events: { subscribe: () => () => {} }
}, Oe = new f(), ke = (e) => {
	let { children: t } = e;
	return /* @__PURE__ */ D(d, {
		client: Oe,
		children: /* @__PURE__ */ D(ve.Provider, {
			value: {
				host: { call: async () => void 0 },
				client: De,
				propsStore: {
					get: () => ({}),
					subscribe: () => () => {}
				}
			},
			children: t
		})
	});
};
// node_modules/.bun/@tanstack+charts@0.18.0+74b9eec76f411c79/node_modules/@tanstack/charts/dist/scale-input.js
function Ae(e, t) {
	let n = je(e), r = n ? e() : e;
	if (typeof r != "function" || typeof r.copy != "function" || typeof r.domain != "function" || typeof r.range != "function") throw TypeError("A scale factory must return a copyable scale with domain and range methods");
	let i = r.copy();
	if (n) {
		let e = Me(i, t.values, t.includeZero);
		e && i.domain(e);
	}
	return Pe(i, t.nice, t.niceCount), i;
}
function je(e) {
	return typeof e == "function" && !("copy" in e);
}
function Me(e, t, n = !1) {
	if (typeof e.bandwidth == "function" || typeof e.ticks != "function") {
		let e = [], n = /* @__PURE__ */ new Set(), r = /* @__PURE__ */ new Set();
		for (let i of t) {
			if (!We(i)) continue;
			let t = i instanceof Date, a = t ? i.getTime() : i, o = t ? r : n;
			o.has(a) || (o.add(a), e.push(i));
		}
		return e.length ? e : void 0;
	}
	let r = t.filter(We);
	if (!r.length) return;
	if (e.domain().some((e) => e instanceof Date)) {
		let e = r.filter((e) => e instanceof Date);
		if (e.length !== r.length) throw TypeError("A temporal scale factory requires Date channel values");
		let t = Infinity, n = -Infinity;
		for (let r of e) {
			let e = r.getTime();
			t = Math.min(t, e), n = Math.max(n, e);
		}
		if (!Number.isFinite(t) || !Number.isFinite(n)) throw TypeError("A temporal scale factory requires Date channel values");
		if (t === n) {
			let e = 432e5;
			t -= e, n += e;
		}
		return [new Date(t), new Date(n)];
	}
	let i = Infinity, a = -Infinity;
	for (let e of r) {
		if (!q(e)) throw TypeError("A quantitative scale factory requires numeric values");
		i = Math.min(i, e), a = Math.max(a, e);
	}
	if (!Number.isFinite(i) || !Number.isFinite(a)) throw TypeError("A quantitative scale factory requires numeric values");
	let o = G(e);
	if (n) {
		if (o) throw TypeError("An inferred log scale cannot include an implicit zero baseline");
		i = Math.min(0, i), a = Math.max(0, a);
	}
	if (Ne(e, i, a), i === a) {
		if (i === 0) return [0, 1];
		let e = Math.abs(i) * .05 || 1;
		i -= e, a += e;
	}
	return [i, a];
}
function G(e) {
	return "base" in e && typeof e.base == "function";
}
function Ne(e, t, n) {
	if (G(e) && (t === 0 || n === 0 || t < 0 && n > 0)) throw TypeError("An inferred log domain cannot include or cross zero");
}
function Pe(e, t, n = 5) {
	if (!t) return;
	let r = e;
	if (typeof r.nice != "function") throw TypeError("This scale does not support nicening");
	r.nice(typeof t == "number" ? t : n);
}
// node_modules/.bun/@tanstack+charts@0.18.0+74b9eec76f411c79/node_modules/@tanstack/charts/dist/scales.js
function Fe(e, t, n) {
	if (t?.scale) {
		let r = Re(t.scale), i = r ? t.scale() : t.scale;
		if (typeof i != "function" || typeof i.copy != "function") throw TypeError("A color scale must be callable and copyable");
		if (r && (typeof i.domain != "function" || typeof i.range != "function")) throw TypeError("A color scale factory must return a scale with domain and range methods");
		let a = i.copy(), o = He(a);
		if (r) {
			let n = a;
			t.range?.length && n.range(t.range);
			let r = t.domain ?? ze(n, e);
			(t.domain !== void 0 || r.length) && n.domain(r);
			let i = n.range();
			if (!i.length || i.some((e) => typeof e != "string")) throw TypeError("A color-scale factory requires a string range");
		}
		if (t.nice) {
			let e = a.nice;
			if (typeof e != "function") throw TypeError("This color scale does not support nicening");
			e.call(a, typeof t.nice == "number" ? t.nice : 5);
		}
		let s = a.domain?.() ?? t.domain ?? [], c = (a.range?.() ?? t.range ?? n.palette).map(String);
		return {
			type: "configured",
			kind: o,
			domain: s,
			range: c,
			map: (e) => {
				if (e == null) return c[0] ?? "currentColor";
				let t = a(e);
				return t == null ? "currentColor" : String(t);
			}
		};
	}
	if (t?.resolver) return t.resolver.resolve({
		values: e,
		domain: t.domain,
		range: t.range,
		theme: n
	});
	let r = t?.range?.length ? t.range : n.palette, i = Ie(t?.domain ?? e), a = i.map(K);
	return {
		type: "ordinal",
		kind: "categorical",
		domain: i,
		range: r,
		map: (e) => {
			if (e == null) return r[0] ?? "currentColor";
			let t = a.indexOf(K(e));
			return t < 0 && (t = a.push(K(e)) - 1), r[t % r.length] ?? "currentColor";
		}
	};
}
function Ie(e) {
	return [...new Set(e.filter(Le))];
}
function Le(e) {
	return typeof e == "string" || typeof e == "number";
}
function Re(e) {
	return typeof e == "function" && !("copy" in e);
}
function ze(e, t) {
	let n = t.filter(Le), r = e.quantiles, i = e.thresholds;
	if (r) return Be(n);
	if (e.invertExtent && !i) throw TypeError("Threshold color-scale factory requires an explicit domain");
	if (e.ticks || i) {
		let t = Be(n), r = Infinity, a = -Infinity;
		for (let e of t) r = Math.min(r, e), a = Math.max(a, e);
		if (!Number.isFinite(r) || !Number.isFinite(a)) return [];
		if (Ne(e, r, a), r === a) {
			if (r === 0) a = 1;
			else {
				let e = Math.abs(r) * .05 || 1;
				r -= e, a += e;
			}
		}
		if (i) return [r, a];
		let o = Math.max(2, e.domain().length, e.range().length);
		return Array.from({ length: o }, (e, t) => r + (a - r) * t / (o - 1));
	}
	return Ie(n);
}
function Be(e) {
	let t = e.filter((e) => typeof e == "number" && Number.isFinite(e));
	return t.length !== e.length && Ve(), t;
}
function Ve() {
	throw TypeError("A quantitative color-scale factory requires numeric values");
}
function He(e) {
	return e.quantiles ? e.invertExtent ? "quantile" : "continuous" : e.thresholds ? "quantize" : e.invertExtent ? "threshold" : e.ticks ? "continuous" : "categorical";
}
function K(e) {
	return e instanceof Date ? `date:${e.getTime()}` : typeof e == "string" ? `string:${e.length}:${e}` : `${typeof e}:${String(e)}`;
}
// node_modules/.bun/@tanstack+charts@0.18.0+74b9eec76f411c79/node_modules/@tanstack/charts/dist/mark.js
var Ue = /* @__PURE__ */ new WeakSet();
function We(e) {
	return typeof e == "string" || e instanceof Date && Number.isFinite(e.getTime()) || q(e);
}
function q(e) {
	return typeof e == "number" && Number.isFinite(e);
}
function Ge(e, t, n) {
	return {
		initialize: (r) => {
			let i = Je(e(r)), a = t === void 0 || i.motion !== void 0 ? i : {
				...i,
				motion: t
			};
			return n === void 0 ? a : Ke(a, n);
		},
		...t === void 0 ? {} : { motion: t },
		...n === void 0 ? {} : { renderer: n }
	};
}
function Ke(e, t) {
	let n = e.render, r = e.resolveLayout;
	return {
		...e,
		render: (e) => qe(n(e), t),
		...r ? { resolveLayout(e) {
			let n = r(e);
			return {
				...n,
				render: (e) => qe(n.render(e), t)
			};
		} } : {}
	};
}
function qe(e, t) {
	return {
		...e,
		nodes: e.nodes.map((e) => ({
			...e,
			renderer: t
		})),
		...e.focusGuides ? { focusGuides: e.focusGuides.map((e) => ({
			...e,
			renderer: t
		})) } : {}
	};
}
function Je(e) {
	return typeof e.render == "function" ? e : {
		...e,
		render: () => {
			throw TypeError(`Mark "${e.id}" must resolve its layout before rendering`);
		}
	};
}
function Ye(e, t) {
	return t?.length ? {
		data: e,
		definitions: t
	} : void 0;
}
function Xe(e, t, n, r, i) {
	return typeof e == "function" ? e(t, {
		index: n,
		data: r
	}) : e ?? i;
}
function Ze(e, t, n) {
	return typeof t == "function" ? e.map((n, r) => t(n, {
		index: r,
		data: e
	})) : t === void 0 ? e.map((t, r) => n(t, {
		index: r,
		data: e
	})) : e.map((e) => typeof e == "object" && e ? e[t] : void 0);
}
function Qe(e, t, n = {}) {
	if (t !== void 0) return Ze(e, t, (e, { index: t }) => t);
	let r = [
		e.map((e) => typeof e == "object" && e ? e.id : void 0),
		e.map((e) => {
			if (typeof e != "object" || !e) return;
			let t = e.data;
			return typeof t == "object" && t ? t.id : void 0;
		}),
		...n.candidates ?? []
	];
	for (let t of r) {
		if (t.length !== e.length) continue;
		let r = t.map($e);
		if (r.every((e) => e !== void 0) && et(r, n.groups)) return r;
	}
	return tt(n.markId, n.candidates, n.warningIdentity), e.map((e, t) => t);
}
function $e(e) {
	if (Le(e)) return e;
	if (e instanceof Date && Number.isFinite(e.getTime())) return `date:${e.getTime()}`;
}
function et(e, t) {
	let n = /* @__PURE__ */ new Set();
	for (let r = 0; r < e.length; r += 1) {
		let i = JSON.stringify([K(t?.[r] ?? null), K(e[r])]);
		if (n.has(i)) return !1;
		n.add(i);
	}
	return !0;
}
function tt(e, t, n) {
	e && t?.length && n && Ue.has(n);
}
// node_modules/.bun/d3-shape@3.2.0/node_modules/d3-shape/src/order/appearance.js
function nt(e) {
	var t = e.map(rt);
	return p(e).sort(function(e, n) {
		return t[e] - t[n];
	});
}
function rt(e) {
	for (var t = -1, n = 0, r = e.length, i, a = -Infinity; ++t < r;) (i = +e[t][1]) > a && (a = i, n = t);
	return n;
}
// node_modules/.bun/d3-shape@3.2.0/node_modules/d3-shape/src/order/ascending.js
function it(e) {
	for (var t = 0, n = -1, r = e.length, i; ++n < r;) (i = +e[n][1]) && (t += i);
	return t;
}
// node_modules/.bun/d3-shape@3.2.0/node_modules/d3-shape/src/order/insideOut.js
function at(e) {
	var t = e.length, n, r, i = e.map(it), a = nt(e), o = 0, s = 0, c = [], l = [];
	for (n = 0; n < t; ++n) r = a[n], o < s ? (o += i[r], c.push(r)) : (s += i[r], l.push(r));
	return l.reverse().concat(c);
}
// node_modules/.bun/@tanstack+charts@0.18.0+74b9eec76f411c79/node_modules/@tanstack/charts/dist/stack-internal.js
function ot(e, t = {}) {
	let n = ct(t);
	if (e.length === 0) return /* @__PURE__ */ new Map();
	let r = [], i = /* @__PURE__ */ new Map(), a = [], o = /* @__PURE__ */ new Set();
	for (let t of e) {
		let e = K(t.position);
		i.has(e) || (i.set(e, r.length), r.push(t.position));
		let n = K(t.series);
		o.has(n) || (o.add(n), a.push(t.series));
	}
	let s = r.map(() => /* @__PURE__ */ Object.create(null)), c = /* @__PURE__ */ new Map();
	for (let t of e) {
		let e = i.get(K(t.position)), n = K(t.series), r = `${e}:${n}`;
		if (c.has(r)) throw TypeError(`A stack requires at most one value for each position and series; duplicate ${String(t.position)} / ${String(t.series)}`);
		c.set(r, t.index), s[e][n] = t.value;
	}
	let l = t.order === "inside-out";
	if (n !== void 0 && e.some(({ value: e }) => e < 0)) throw TypeError("A stack anchor requires nonnegative values");
	let u = ht(e, a, t.order);
	t.reverse && !l && u.reverse();
	let d = u.map(K), f = t.anchor ? g : t.offset === "normalize" ? _ : t.offset === "center" ? h : t.offset === "wiggle" ? v : st, p = m().keys(d).value((e, t) => e[t] ?? 0).offset(f);
	l && p.order(t.reverse ? (e) => at(e).reverse() : at);
	let y = p(s);
	t.anchor && n !== void 0 && lt(y, t.anchor.series, n), t.offset === "wiggle" && ut(y);
	let b = /* @__PURE__ */ new Map();
	return y.forEach((e) => {
		let t = e.key;
		e.forEach((e, n) => {
			let r = c.get(`${n}:${t}`);
			r !== void 0 && b.set(r, {
				start: e[0],
				end: e[1]
			});
		});
	}), b;
}
function st(e, t) {
	if (e.length === 0) return;
	let n = e.map((e) => {
		let t = !1, n = !1;
		for (let [r, i] of e) {
			let e = i - r;
			e < 0 ? t = !0 : e > 0 && (n = !0);
		}
		return t && !n;
	}), r = e[t[0]].length;
	for (let i = 0; i < r; i += 1) {
		let r = 0, a = 0;
		for (let o of t) {
			let t = e[o][i], s = t[1] - t[0];
			s > 0 ? (t[0] = r, t[1] = r += s) : s < 0 ? (t[1] = a, t[0] = a += s) : s === 0 ? t[0] = t[1] = n[o] ? a : r : (t[0] = 0, t[1] = s);
		}
	}
}
function ct(e) {
	let t = e.anchor;
	if (!t) return;
	if (e.offset !== void 0 && e.offset !== "diverging") throw TypeError("A stack anchor can only be used with the diverging offset");
	let n = t.fraction ?? .5;
	if (!Number.isFinite(n) || n < 0 || n > 1) throw TypeError("A stack anchor fraction must be between zero and one");
	return n;
}
function lt(e, t, n) {
	let r = K(t), i = e.find((e) => e.key === r);
	if (!i) throw TypeError(`Stack anchor series "${String(t)}" is not in the resolved series order`);
	i.forEach((t, r) => {
		let i = t[0] + (t[1] - t[0]) * n;
		for (let t of e) {
			let e = t[r];
			e && (e[0] -= i, e[1] -= i);
		}
	});
}
function ut(e) {
	let t = Infinity;
	for (let n of e) for (let e of n) t = Math.min(t, e[0]);
	if (Number.isFinite(t) && t !== 0) for (let n of e) for (let e of n) e[0] -= t, e[1] -= t;
}
function dt(e, t, n, r = {}, i = "value") {
	let a = [];
	for (let r = 0; r < e.length; r += 1) {
		let o = e[r], s = t[r];
		if (!pt(o) || !mt(s)) continue;
		let c = n[r];
		a.push({
			index: r,
			position: o,
			value: s,
			series: ft(c) ? c : i === "index" ? r : "value"
		});
	}
	let o = ot(a, r), s = Array.from({ length: e.length }, () => void 0), c = Array.from({ length: e.length }, () => void 0);
	for (let [e, t] of o) s[e] = t.start, c[e] = t.end;
	return {
		starts: s,
		ends: c
	};
}
function ft(e) {
	return typeof e == "string" || typeof e == "number";
}
function pt(e) {
	return typeof e == "string" || mt(e) || e instanceof Date && Number.isFinite(e.getTime());
}
function mt(e) {
	return typeof e == "number" && Number.isFinite(e);
}
function ht(e, t, n) {
	if (Array.isArray(n)) {
		let e = [...n], r = new Set(e.map(K));
		return [...e, ...t.filter((e) => !r.has(K(e)))];
	}
	if (n !== "ascending" && n !== "descending") return [...t];
	let r = new Map(t.map((e) => [K(e), 0]));
	for (let t of e) {
		let e = K(t.series);
		r.set(e, (r.get(e) ?? 0) + Math.abs(t.value));
	}
	return [...t].sort((e, t) => {
		let i = (r.get(K(e)) ?? 0) - (r.get(K(t)) ?? 0);
		return n === "ascending" ? i : -i;
	});
}
// node_modules/.bun/@tanstack+charts@0.18.0+74b9eec76f411c79/node_modules/@tanstack/charts/dist/configured-scale.js
function gt(e, t) {
	let n = Ae(e, {
		values: t.values,
		includeZero: t.includeZero,
		nice: t.options?.nice,
		niceCount: t.tickCount
	}), r = xt(n.domain()), i = _t(n, t, r), a = n.bandwidth !== void 0, o = a && t.channel === "y" ? [Math.min(...t.range), Math.max(...t.range)] : t.range, s = t.options?.reverse ? [o[1], o[0]] : o;
	n.range(s);
	let c = xt(n.domain());
	if (i && (!yt(c, i.domain) || !bt(n, i.domain, s))) throw TypeError(`Chart viewport "${t.id}" requires independent configurable domain and range capabilities`);
	let l = t.options?.axis === !1 ? void 0 : t.options?.axis?.ticks, u = l === !1 ? void 0 : l, d = u?.values ?? n.ticks?.(t.tickCount) ?? c, f = n.tickFormat?.(t.tickCount), p = n.bandwidth?.() ?? 0, m = (e) => {
		let t = n(e);
		return t === void 0 ? NaN : t + p / 2;
	}, h = n.invert ? (e) => n.invert(e - p / 2) : void 0;
	return {
		id: t.id,
		type: a ? "band" : "configured",
		domain: c,
		map: m,
		...h ? { invert: h } : {},
		ticks: d.map((e) => ({
			value: e,
			position: m(e),
			label: u?.format?.(e) ?? f?.(e) ?? kt(e)
		})),
		bandwidth: p,
		...i ? { viewport: {
			contentDomain: r,
			domain: i.domain,
			translate: i.translate,
			map: (e) => m(e) + i.translate
		} } : {}
	};
}
function _t(e, t, n) {
	let r = t.options?.viewport;
	if (!r) return;
	let i = e;
	if (e.bandwidth !== void 0 || typeof e.ticks != "function" || typeof i.invert != "function") throw TypeError(`Chart viewport "${t.id}" requires a continuous numeric or temporal scale`);
	if (typeof i.clamp == "function" && i.clamp() === !0) throw TypeError(`Chart viewport "${t.id}" does not support a clamped scale`);
	let a = r.domain;
	a.length === 2 && Tt(a[0], a[1]) || Ot(t.id);
	let o = Et(a[0]), s = Et(a[1]);
	Number.isFinite(o) && Number.isFinite(s) && o !== s || Ot(t.id), Ct(e, t.id, n, a);
	let c = r.translate ?? 0;
	if (!Number.isFinite(c)) throw TypeError(`Chart viewport "${t.id}" translate must be a finite number`);
	yt(e.domain(), a) && vt(e, [a[1], a[0]], t.id), vt(e, a, t.id);
	let l = xt(e.domain());
	return l.length === 2 && Tt(l[0], l[1]) || St(t.id), {
		domain: l,
		translate: c
	};
}
function vt(e, t, n) {
	let r = e.domain;
	try {
		r.call(e, [...t]);
	} catch {
		St(n);
	}
	yt(e.domain(), t) || St(n);
}
function yt(e, t) {
	return e.length === t.length && e.every((e, n) => Dt(e, t[n]));
}
function bt(e, t, n) {
	let r = e(t[0]), i = e(t[1]);
	return r !== void 0 && i !== void 0 && Number.isFinite(r) && Number.isFinite(i) && Math.abs(r - n[0]) <= 1e-6 && Math.abs(i - n[1]) <= 1e-6;
}
function xt(e) {
	return e.map((e) => e instanceof Date ? new Date(e.getTime()) : e);
}
function St(e) {
	throw TypeError(`Chart viewport "${e}" requires a scale with a configurable domain`);
}
function Ct(e, t, n, r) {
	if (!G(e)) return;
	let i = wt(n), a = wt(r);
	if (i === void 0 || a === void 0 || i !== a) throw TypeError(`Chart viewport "${t}" logarithmic content and viewport domains must be finite, nonzero, and stay on the same side of zero`);
}
function wt(e) {
	let t;
	for (let n of e) {
		if (typeof n != "number" || !Number.isFinite(n) || n === 0) return;
		let e = Math.sign(n);
		if (t !== void 0 && e !== t) return;
		t = e;
	}
	return t;
}
function Tt(e, t) {
	return typeof e == "number" && typeof t == "number" || e instanceof Date && t instanceof Date;
}
function Et(e) {
	return e instanceof Date ? e.getTime() : e;
}
function Dt(e, t) {
	return e instanceof Date && t instanceof Date ? e.getTime() === t.getTime() : Object.is(e, t);
}
function Ot(e) {
	throw TypeError(`Chart viewport "${e}" domain must contain two distinct finite numbers or Dates`);
}
function kt(e) {
	return e instanceof Date ? e.toLocaleDateString() : String(e);
}
// node_modules/.bun/@tanstack+charts@0.18.0+74b9eec76f411c79/node_modules/@tanstack/charts/dist/guide-layout.js
var At = 16, jt = 400, Mt = {
	fontFamily: "sans-serif",
	fontStyle: "normal",
	fontStretch: "normal",
	letterSpacing: 0,
	direction: "inherit",
	fontScale: 1
};
function Nt(e, t) {
	if (e === "middle") return "middle";
	let n = t !== "rtl";
	return e === "left" ? n ? "start" : "end" : n ? "end" : "start";
}
function Pt(e, t, n) {
	return t === "middle" ? -e / 2 : t === "start" == (n !== "rtl") ? 0 : -e;
}
function Ft(e, t) {
	let n = Wt(t.fontScale, 1), r = Ht(t.fontSize, At) * n, i = Ht(t.fontWeight, jt), a = Ut(t.letterSpacing, 0) * n;
	if (!e || r === 0) return {
		x: 0,
		y: 0,
		width: 0,
		height: 0
	};
	let o = 0;
	for (let t of e) o += Vt(t);
	let s = 1 + (Math.min(900, Math.max(100, i)) - 400) / 12500, c = Math.max(0, o * r * s + Math.max(0, Array.from(e).length - 1) * a), l = r;
	return {
		x: Pt(c, t.anchor, t.direction),
		y: t.baseline === "middle" ? -l / 2 : t.baseline === "hanging" ? 0 : -r * .8,
		width: c,
		height: l
	};
}
function It(e, t = Ft) {
	let n = Ht(e.fontSize, At), r = e.anchor ?? "start", i = e.baseline ?? "auto", a = e.text.length === 0 ? {
		x: 0,
		y: 0,
		width: 0,
		height: 0
	} : t(e.text, {
		fontSize: n,
		fontWeight: e.fontWeight,
		...Mt,
		anchor: r,
		baseline: i
	}), o = Ut(a.x, 0), s = Ut(a.y, 0), c = Ht(a.width, 0), l = Ht(a.height, 0), u = {
		x: e.x + o,
		y: e.y + s,
		width: c,
		height: l
	};
	return e.rotate ? Bt(u, e.x, e.y, e.rotate) : u;
}
function Lt(e = Ft, t = {}) {
	let n = {
		...Mt,
		...t,
		fontFamily: t.fontFamily || Mt.fontFamily,
		fontStyle: t.fontStyle || Mt.fontStyle,
		fontStretch: t.fontStretch || Mt.fontStretch,
		letterSpacing: Ut(t.letterSpacing, 0),
		fontScale: Wt(t.fontScale, 1)
	};
	return (t, r) => e(t, {
		...r,
		...n
	});
}
function Rt(e, t, n) {
	zt(t, 0, 0, (t, r, i) => {
		let a = t.style;
		if (!(a?.strokeWidth !== void 0 || a?.lineCap !== void 0 && a.lineCap !== "butt") || a?.stroke === "none") return;
		let o = a?.strokeWidth ?? 1;
		if (!Number.isFinite(o) || o <= 0) return;
		let s = o / 2, c = t.x1 + r, l = t.x2 + r, u = t.y1 + i, d = t.y2 + i, f = l - c, p = d - u, m = Math.hypot(f, p), h = m > 0 ? f / m : 0, g = m > 0 ? p / m : 0, _ = a?.lineCap && a.lineCap !== "butt" ? s : 0, v = Math.abs(g) * s + Math.abs(h) * _, y = Math.abs(h) * s + Math.abs(g) * _, b = Math.min(c, l) - v, x = Math.max(c, l) + v, S = Math.min(u, d) - y, C = Math.max(u, d) + y;
		e.top = Math.max(e.top, n.y - S), e.right = Math.max(e.right, x - n.x - n.width), e.bottom = Math.max(e.bottom, C - n.y - n.height), e.left = Math.max(e.left, n.x - b);
	});
}
function zt(e, t, n, r) {
	if (e.kind === "rule") {
		r(e, t, n);
		return;
	}
	if (e.kind !== "group") return;
	let i = t + (e.translateX ?? 0), a = n + (e.translateY ?? 0);
	for (let t of e.children) zt(t, i, a, r);
}
function Bt(e, t, n, r) {
	let i = r * Math.PI / 180, a = Math.cos(i), o = Math.sin(i), s = e.x + e.width / 2 - t, c = e.y + e.height / 2 - n, l = Math.abs(e.width * a) + Math.abs(e.height * o), u = Math.abs(e.width * o) + Math.abs(e.height * a), d = s * a - c * o + t, f = s * o + c * a + n;
	return {
		x: d - l / 2,
		y: f - u / 2,
		width: l,
		height: u
	};
}
function Vt(e) {
	return /\s/u.test(e) ? .33 : /[\u0300-\u036f]/u.test(e) ? 0 : /[ilI1|!.,:;'`]/u.test(e) ? .28 : /[mwMW@#%&]/u.test(e) ? .9 : /[A-Z]/u.test(e) ? .64 : /[0-9]/u.test(e) ? .56 : e.codePointAt(0) > 127 ? 1 : .54;
}
function Ht(e, t) {
	return e !== void 0 && Number.isFinite(e) && e >= 0 ? e : t;
}
function Ut(e, t) {
	return e !== void 0 && Number.isFinite(e) ? e : t;
}
function Wt(e, t) {
	return e !== void 0 && Number.isFinite(e) && e > 0 ? e : t;
}
// node_modules/.bun/@tanstack+charts@0.18.0+74b9eec76f411c79/node_modules/@tanstack/charts/dist/renderer-rect.js
function Gt(e, t, n) {
	let [r, i, a, o] = e ?? [
		0,
		0,
		0,
		0
	], s = [
		qt(r),
		qt(i),
		qt(a),
		qt(o)
	], c = Jt(t), l = Jt(n), u = Math.min(1, Yt(c, s[0] + s[1]), Yt(c, s[3] + s[2]), Yt(l, s[0] + s[3]), Yt(l, s[1] + s[2]));
	return u === 1 ? s : [
		s[0] * u,
		s[1] * u,
		s[2] * u,
		s[3] * u
	];
}
function Kt(e, t, n, r, i) {
	let a = Xt(e, t, n, r), [o, s, c, l] = Gt(i, a.width, a.height), u = a.x, d = a.y, f = u + a.width, p = d + a.height;
	return [
		`M${J(u + o)},${J(d)}`,
		`H${J(f - s)}`,
		`A${J(s)},${J(s)} 0 0 1 ${J(f)},${J(d + s)}`,
		`V${J(p - c)}`,
		`A${J(c)},${J(c)} 0 0 1 ${J(f - c)},${J(p)}`,
		`H${J(u + l)}`,
		`A${J(l)},${J(l)} 0 0 1 ${J(u)},${J(p - l)}`,
		`V${J(d + o)}`,
		`A${J(o)},${J(o)} 0 0 1 ${J(u + o)},${J(d)}`,
		"Z"
	].join("");
}
function qt(e) {
	return Number.isFinite(e) && e > 0 ? e : 0;
}
function Jt(e) {
	return Number.isFinite(e) ? Math.abs(e) : 0;
}
function Yt(e, t) {
	return t === 0 ? 1 : e / t;
}
function Xt(e, t, n, r) {
	let i = e + n, a = t + r;
	return {
		x: Math.min(e, i),
		y: Math.min(t, a),
		width: Math.abs(n),
		height: Math.abs(r)
	};
}
function J(e) {
	return String(Math.round(e * 100) / 100);
}
// node_modules/.bun/@tanstack+charts@0.18.0+74b9eec76f411c79/node_modules/@tanstack/charts/dist/rect-radius-internal.js
var Zt = Math.PI * 2;
function Qt(e, t, n, r, i, a, o) {
	let s = en(e, t, n, r), c = s.x, l = s.y, u = c + s.width, d = l + s.height;
	if (!(a >= c && a <= u && o >= l && o <= d)) return !1;
	let [f, p, m, h] = Gt(i, s.width, s.height);
	return a < c + f && o < l + f ? tn(a, o, c + f, l + f, f) : a > u - p && o < l + p ? tn(a, o, u - p, l + p, p) : a > u - m && o > d - m ? tn(a, o, u - m, d - m, m) : a < c + h && o > d - h ? tn(a, o, c + h, d - h, h) : !0;
}
function $t(e, t, n, r, i, a, o) {
	if (Qt(e, t, n, r, i, a, o)) return 0;
	let s = en(e, t, n, r), c = s.x, l = s.y, u = c + s.width, d = l + s.height, [f, p, m, h] = Gt(i, s.width, s.height);
	return Math.min(rn(c + f, l, u - p, l, a, o), rn(u, l + p, u, d - m, a, o), rn(u - m, d, c + h, d, a, o), rn(c, d - h, c, l + f, a, o), nn(a, o, c + f, l + f, f, Math.PI, Math.PI * 1.5), nn(a, o, u - p, l + p, p, Math.PI * 1.5, Zt), nn(a, o, u - m, d - m, m, 0, Math.PI * .5), nn(a, o, c + h, d - h, h, Math.PI * .5, Math.PI));
}
function en(e, t, n, r) {
	let i = e + n, a = t + r;
	return {
		x: Math.min(e, i),
		y: Math.min(t, a),
		width: Math.abs(n),
		height: Math.abs(r)
	};
}
function tn(e, t, n, r, i) {
	let a = e - n, o = t - r;
	return a * a + o * o <= i * i;
}
function nn(e, t, n, r, i, a, o) {
	if (i === 0) return an(e, t, n, r);
	let s = Math.atan2(t - r, e - n);
	return s < 0 && (s += Zt), s >= a && s <= o ? (Math.hypot(e - n, t - r) - i) ** 2 : Math.min(an(e, t, n + Math.cos(a) * i, r + Math.sin(a) * i), an(e, t, n + Math.cos(o) * i, r + Math.sin(o) * i));
}
function rn(e, t, n, r, i, a) {
	let o = n - e, s = r - t, c = o * o + s * s;
	if (c === 0) return an(i, a, e, t);
	let l = Math.max(0, Math.min(1, ((i - e) * o + (a - t) * s) / c));
	return an(i, a, e + l * o, t + l * s);
}
function an(e, t, n, r) {
	return (e - n) ** 2 + (t - r) ** 2;
}
// node_modules/.bun/@tanstack+charts@0.18.0+74b9eec76f411c79/node_modules/@tanstack/charts/dist/nearest.js
var on = /* @__PURE__ */ new WeakMap();
function sn(e, t, n, r) {
	let i, a = Infinity;
	for (let r = e.length; r--;) {
		let o = e[r], s = o.x - t, c = o.y - n, l = s * s + c * c;
		l <= a && (i = o, a = l);
	}
	return i && a <= Math.max(0, r) ** 2 ? i : null;
}
function cn(e, t, n, r, i = e.points) {
	let a = un(e), o = i === e.points ? void 0 : new Set(i);
	if (!a.targets.length && !a.attachedPoints.size) return sn(i, t, n, r);
	let s = ln(e, t, n, i);
	if (s) return s.point;
	let c, l, u = Infinity, d = Infinity;
	for (let e of a.targets) {
		let r = e.node.interaction;
		if (!pn(r, o)) continue;
		let i = r.affinity ?? "xy";
		if (i === "geometry") continue;
		let a = i === "x" ? "x" : i === "y" ? "y" : void 0, s = a ? jn(e.bounds, a === "x" ? t : n, a) : hn(e, t, n);
		if (s > u) continue;
		let f = a ? hn(e, t, n) : s;
		(s < u || s === u && f < d) && (l = r, c = void 0, u = s, d = f);
	}
	if (u !== 0) for (let e of i) {
		if (a.attachedPoints.has(e)) continue;
		let r = e.x - t, i = e.y - n, o = r * r + i * i;
		o < u && (c = e, l = void 0, u = o, d = o);
	}
	return u > Math.max(0, r) ** 2 ? null : c ?? (l ? fn(l, t, n, o) : void 0) ?? null;
}
function ln(e, t, n, r = e.points) {
	let i = un(e), a = r === e.points ? void 0 : new Set(r);
	for (let e = i.targets.length; e--;) {
		let r = i.targets[e];
		if (An(r.bounds, t, n) && mn(r, t, n)) {
			let e = r.node.interaction, i = fn(e, t, n, a), o = e.point ? !0 : e.points.length > 0;
			if (i || !a || !o) return { point: i };
		}
	}
	return null;
}
function un(e) {
	let t = on.get(e);
	if (t) return t;
	let n = [], r = /* @__PURE__ */ new Set();
	dn(e.nodes, 0, 0, void 0, n, r);
	let i = {
		targets: n,
		attachedPoints: r
	};
	return on.set(e, i), i;
}
function dn(e, t, n, r, i, a) {
	for (let o of e) {
		if (o.kind === "group") {
			if (o.focus) continue;
			let e = t + (o.translateX ?? 0), s = n + (o.translateY ?? 0), c = o.clip ? Dn(o.clip, e, s) : void 0, l = r === null ? null : kn(r, c);
			dn(o.children, e, s, l, i, a);
			continue;
		}
		if (o.kind === "label" || !o.interaction) continue;
		if (o.interaction.point) a.add(o.interaction.point);
		else for (let e of o.interaction.points) a.add(e);
		if (r === null) continue;
		let e = gn(o);
		if (!e) continue;
		let s = Dn(e, t, n), c = r ? kn(s, r) : s;
		c != null && i.push({
			node: o,
			offsetX: t,
			offsetY: n,
			bounds: c,
			clip: r
		});
	}
}
function fn(e, t, n, r) {
	if (e.point) return !r || r.has(e.point) ? e.point : null;
	let i = e.affinity ?? "xy", a, o = Infinity, s = Infinity;
	for (let c of e.points) {
		if (r && !r.has(c)) continue;
		let e = c.x - t, l = c.y - n, u = e * e + l * l, d = i === "x" ? e * e : i === "y" ? l * l : u;
		(d < o || d === o && u < s) && (a = c, o = d, s = u);
	}
	return a ?? null;
}
function pn(e, t) {
	return t ? e.point ? t.has(e.point) : e.points.some((e) => t.has(e)) : !0;
}
function mn(e, t, n) {
	let r = t - e.offsetX, i = n - e.offsetY, { node: a } = e;
	switch (a.kind) {
		case "rect": return a.cornerRadii === void 0 ? _n(a, r, i) : Qt(a.x, a.y, a.width, a.height, a.cornerRadii, r, i);
		case "dot": {
			let e = r - a.x, t = i - a.y, n = Math.max(0, a.radius);
			return e * e + t * t <= n * n;
		}
		case "area": return a.polygons === void 0 ? yn(a.points, r, i) : bn(a.polygons, r, i);
		case "polyline": return Sn(a.points, r, i, !1) <= Nn(a) ** 2;
		case "rule": return Cn(a.x1, a.y1, a.x2, a.y2, r, i) <= Nn(a) ** 2;
	}
}
function hn(e, t, n) {
	let r = t - e.offsetX, i = n - e.offsetY, { node: a } = e, o;
	switch (a.kind) {
		case "rect":
			o = a.cornerRadii === void 0 ? a.radius ? vn(a, r, i) : Mn(a, r, i) : $t(a.x, a.y, a.width, a.height, a.cornerRadii, r, i);
			break;
		case "dot": {
			let e = r - a.x, t = i - a.y, n = Math.max(0, Math.sqrt(e * e + t * t) - Math.max(0, a.radius));
			o = n * n;
			break;
		}
		case "area":
			o = a.polygons === void 0 ? Sn(a.points, r, i, !0) : xn(a.polygons, r, i);
			break;
		case "polyline": {
			let e = Sn(a.points, r, i, !1), t = Math.max(0, Math.sqrt(e) - Nn(a));
			o = t * t;
			break;
		}
		case "rule": {
			let e = Cn(a.x1, a.y1, a.x2, a.y2, r, i), t = Math.max(0, Math.sqrt(e) - Nn(a));
			o = t * t;
			break;
		}
	}
	return e.clip ? Math.max(o, Mn(e.clip, t, n)) : o;
}
function gn(e) {
	switch (e.kind) {
		case "rect": return En(e);
		case "dot": {
			let t = Math.max(0, e.radius);
			return {
				x: e.x - t,
				y: e.y - t,
				width: t * 2,
				height: t * 2
			};
		}
		case "area": return e.polygons === void 0 ? wn(e.points) : Tn(e.polygons);
		case "polyline": {
			let t = wn(e.points);
			return t ? On(t, Nn(e)) : null;
		}
		case "rule": return On({
			x: Math.min(e.x1, e.x2),
			y: Math.min(e.y1, e.y2),
			width: Math.abs(e.x2 - e.x1),
			height: Math.abs(e.y2 - e.y1)
		}, Nn(e));
	}
}
function _n(e, t, n) {
	let r = En(e);
	if (!An(r, t, n)) return !1;
	let i = Math.max(0, Math.min(e.radius ?? 0, r.width / 2, r.height / 2));
	if (i === 0 || t >= r.x + i && t <= r.x + r.width - i || n >= r.y + i && n <= r.y + r.height - i) return !0;
	let a = t < r.x + i ? r.x + i : r.x + r.width - i, o = n < r.y + i ? r.y + i : r.y + r.height - i, s = t - a, c = n - o;
	return s * s + c * c <= i * i;
}
function vn(e, t, n) {
	let r = En(e), i = r.width / 2, a = r.height / 2, o = Math.max(0, Math.min(e.radius ?? 0, i, a)), s = Math.abs(t - (r.x + i)) - (i - o), c = Math.abs(n - (r.y + a)) - (a - o), l = Math.sqrt(Math.max(0, s) ** 2 + Math.max(0, c) ** 2) - o;
	return Math.max(0, l) ** 2;
}
function yn(e, t, n) {
	let r = !1;
	for (let i = 0, a = e.length - 1; i < e.length; a = i++) {
		let o = e[i], s = e[a];
		o[1] > n != s[1] > n && t < (s[0] - o[0]) * (n - o[1]) / (s[1] - o[1]) + o[0] && (r = !r);
	}
	return r;
}
function bn(e, t, n) {
	return e.some(([e, ...r]) => !e || !yn(e, t, n) ? !1 : !r.some((e) => yn(e, t, n)));
}
function xn(e, t, n) {
	let r = Infinity;
	for (let i of e) for (let e of i) r = Math.min(r, Sn(e, t, n, !0));
	return r;
}
function Sn(e, t, n, r) {
	if (!e.length) return Infinity;
	if (e.length === 1) {
		let r = e[0];
		return (r[0] - t) ** 2 + (r[1] - n) ** 2;
	}
	let i = Infinity, a = r ? e.length : Math.max(0, e.length - 1);
	for (let r = 0; r < a; r += 1) {
		let a = e[r], o = e[(r + 1) % e.length];
		i = Math.min(i, Cn(a[0], a[1], o[0], o[1], t, n));
	}
	return i;
}
function Cn(e, t, n, r, i, a) {
	let o = n - e, s = r - t, c = o * o + s * s, l = c ? Math.max(0, Math.min(1, ((i - e) * o + (a - t) * s) / c)) : 0, u = i - (e + l * o), d = a - (t + l * s);
	return u * u + d * d;
}
function wn(e) {
	let t = Infinity, n = Infinity, r = -Infinity, i = -Infinity;
	for (let a of e) Number.isFinite(a[0]) && Number.isFinite(a[1]) && (t = Math.min(t, a[0]), n = Math.min(n, a[1]), r = Math.max(r, a[0]), i = Math.max(i, a[1]));
	return Number.isFinite(t) ? {
		x: t,
		y: n,
		width: r - t,
		height: i - n
	} : null;
}
function Tn(e) {
	return wn(e.flatMap((e) => e.flat()));
}
function En(e) {
	return {
		x: Math.min(e.x, e.x + e.width),
		y: Math.min(e.y, e.y + e.height),
		width: Math.abs(e.width),
		height: Math.abs(e.height)
	};
}
function Dn(e, t, n) {
	let r = En(e);
	return {
		...r,
		x: r.x + t,
		y: r.y + n
	};
}
function On(e, t) {
	return {
		x: e.x - t,
		y: e.y - t,
		width: e.width + t * 2,
		height: e.height + t * 2
	};
}
function kn(e, t) {
	if (!e) return t;
	if (!t) return e;
	let n = Math.max(e.x, t.x), r = Math.max(e.y, t.y), i = Math.min(e.x + e.width, t.x + t.width), a = Math.min(e.y + e.height, t.y + t.height);
	return i < n || a < r ? null : {
		x: n,
		y: r,
		width: i - n,
		height: a - r
	};
}
function An(e, t, n) {
	return t >= e.x && t <= e.x + e.width && n >= e.y && n <= e.y + e.height;
}
function jn(e, t, n) {
	let r = n === "x" ? e.x : e.y, i = n === "x" ? e.width : e.height, a = t < r ? r - t : t > r + i ? t - r - i : 0;
	return a * a;
}
function Mn(e, t, n) {
	let r = En(e), i = t < r.x ? r.x - t : t > r.x + r.width ? t - r.x - r.width : 0, a = n < r.y ? r.y - n : n > r.y + r.height ? n - r.y - r.height : 0;
	return i * i + a * a;
}
function Nn(e) {
	return Math.max(0, e.style?.strokeWidth ?? 1) / 2;
}
// node_modules/.bun/@tanstack+charts@0.18.0+74b9eec76f411c79/node_modules/@tanstack/charts/dist/focus-coordinate-internal.js
var Pn = /* @__PURE__ */ new WeakMap();
function Fn(e, t, n) {
	let r = Pn.get(e);
	r ? r[t] = n : Pn.set(e, { [t]: n });
}
function In(e, t) {
	return Pn.get(e)?.[t] ?? e[t];
}
// node_modules/.bun/@tanstack+charts@0.18.0+74b9eec76f411c79/node_modules/@tanstack/charts/dist/materialized-channel-internal.js
var Ln = /* @__PURE__ */ Symbol();
function Rn(e, t) {
	return e === "x" || e === "y" ? e : t[Ln];
}
// node_modules/.bun/@tanstack+charts@0.18.0+74b9eec76f411c79/node_modules/@tanstack/charts/dist/scene-point-map.js
function zn(e, t) {
	return ["x", "y"].some((n) => (e.scales[n]?.viewport?.translate ?? 0) !== (t.scales[n]?.viewport?.translate ?? 0));
}
function Bn(e, t) {
	return e.map((e) => e.kind === "group" ? {
		...e,
		children: Bn(e.children, t),
		...e.focus ? { focus: {
			...e.focus,
			points: e.focus.points.map(t)
		} } : {},
		...e.states ? { states: {
			...e.states,
			points: e.states.points.map(t)
		} } : {}
	} : e.kind === "label" || !e.interaction ? e : {
		...e,
		interaction: e.interaction.point ? {
			...e.interaction,
			point: t(e.interaction.point)
		} : {
			...e.interaction,
			points: e.interaction.points.map(t)
		}
	});
}
// node_modules/.bun/@tanstack+charts@0.18.0+74b9eec76f411c79/node_modules/@tanstack/charts/dist/scene-source.js
var Vn = /* @__PURE__ */ Symbol("chart-scene-source"), Hn = /* @__PURE__ */ Symbol("default-focus-layer");
function Un(e) {
	return e.focus && Object.assign(e.focus, { [Hn]: !0 }), e;
}
function Wn(e) {
	return e.focus?.[Hn] === !0;
}
// node_modules/.bun/@tanstack+charts@0.18.0+74b9eec76f411c79/node_modules/@tanstack/charts/dist/scene.js
var Gn = {
	foreground: "currentColor",
	muted: "currentColor",
	grid: "currentColor",
	background: "transparent",
	palette: [
		"var(--ts-chart-1, #2563eb)",
		"var(--ts-chart-2, #f97316)",
		"var(--ts-chart-3, #10b981)",
		"var(--ts-chart-4, #8b5cf6)",
		"var(--ts-chart-5, #ec4899)",
		"var(--ts-chart-6, #06b6d4)"
	]
};
function Kn(e, t) {
	return t ? typeof e == "function" ? {
		chart: e,
		...t
	} : {
		...e,
		...t
	} : typeof e == "function" ? { chart: e } : e;
}
function qn(e, t, n = {}) {
	return Yn(e, t, (e) => {
		if (!e.options?.scale) throw TypeError(`Chart scale "${e.id}" requires a configured scale`);
		return Jn(e.options.scale, e);
	}, n);
}
function Jn(e, t) {
	if (typeof e == "function") return gt(e, t);
	if (t.options?.viewport) throw TypeError(`Chart viewport "${t.id}" requires a configured or inferable continuous scale`);
	return e.resolve(t);
}
function Yn(e, t, n, r) {
	let i = Rr(t.width), a = Rr(t.height), o = {
		...r,
		measureText: Lt(r.measureText, r.typography)
	}, s = {
		...Gn,
		...o.defaultTheme,
		palette: o.defaultTheme?.palette ?? Gn.palette
	}, c = {
		...s,
		...e.theme,
		palette: e.theme?.palette ?? s.palette
	}, l = e.marks.map((e, t) => e.initialize({ markIndex: t })), { margin: u, chart: d, scales: f, axes: p, marks: m, colors: h, legend: g, legendBounds: _, positionScales: v, scaleGuides: y, gridScales: b } = ur(e, l, i, a, c, or(e, ar(l)), n, o), x = [], S = [], C = [], w = [], T = m.findIndex((e) => !e.focus && !e.focusGuideOnly);
	m.forEach((e, t) => {
		let n = Zn(e, "x", v, f), r = Zn(e, "y", v, f), s = n !== void 0, l = r !== void 0, u = /* @__PURE__ */ new Map(), p = (t) => {
			let i = u.get(t);
			if (i) return i;
			let a = s || l ? {
				...t,
				x: t.x + (n ?? 0),
				y: t.y + (r ?? 0)
			} : t;
			return Xn(a, e, f, n, r), u.set(t, a), a;
		}, m = e.render({
			markIndex: t,
			surface: {
				x: 0,
				y: 0,
				width: i,
				height: a
			},
			chart: d,
			scales: f,
			theme: c,
			color: h.map,
			colors: h,
			layout: o
		});
		g?.filterMark && (m = g.filterMark(m, { seriesFromColor: e.seriesFromColor })), e.postDomain && (m = e.postDomain(m));
		let _ = rr(m.nodes, m.points), y = s || l ? Bn(m.nodes, p) : m.nodes, b = _.map(p), E = [], D = T < 0 || t < T ? "under" : "over";
		for (let e of m.focusGuides ?? []) w.push({
			...e,
			placement: e.placement ?? D
		});
		if (e.focus) {
			let t = e.focus.retarget === !0;
			E.push({
				kind: "group",
				key: `focus:${e.id}`,
				className: "ts-chart__focus-layer",
				ariaHidden: !0,
				focus: {
					markId: e.id,
					match: e.focus.match ?? "primary",
					anchors: m.focusAnchors ?? _,
					points: b,
					placement: D,
					...t ? {
						retarget: !0,
						candidates: y
					} : {}
				},
				children: t ? [] : y
			});
		} else {
			let t = b;
			if (e.states) E.push({
				kind: "group",
				key: `states:${e.id}`,
				children: y,
				states: {
					data: e.states.data,
					definitions: e.states.definitions,
					points: t
				}
			});
			else for (let e of y) E.push(e);
			for (let e of t) C.push(e);
			t.length && S.push({
				markId: e.id,
				points: t,
				clipped: s || l
			});
		}
		x.push({
			key: e.id,
			nodes: E,
			translateX: n,
			translateY: r
		});
	});
	let E = $n(x, d), D = [{
		kind: "group",
		key: "marks",
		className: "ts-chart__marks",
		clip: e.clip ? d : void 0,
		children: E
	}];
	b.length && D.unshift(Cr(d, b, c)), y.length && D.push(p);
	let O = [], k = /* @__PURE__ */ new Set();
	for (let t of e.controls ?? []) {
		if (!t.id.trim()) throw TypeError("Chart control ids must be nonempty");
		if (k.has(t.id)) throw TypeError(`Duplicate chart control id "${t.id}"`);
		k.add(t.id);
		let e = t.resolve({
			chart: d,
			scales: f,
			colors: h,
			theme: c,
			width: i,
			height: a
		});
		e.nodes && D.push(...e.nodes), e.controls && O.push(...e.controls);
	}
	if (g && _) {
		let e = {
			colors: h,
			chart: d,
			bounds: _,
			theme: c,
			layout: o,
			width: i,
			height: a,
			direction: o.typography?.direction
		};
		D.push(g.render(e)), g.control && O.push(g.control(e));
	}
	let A = /* @__PURE__ */ new Set();
	for (let e of O) {
		let t = `${e.extension.id}:${e.key}`;
		if (A.has(t)) throw TypeError(`Duplicate chart host control "${t}"`);
		A.add(t);
	}
	let ee = e.focusRing ?? c.focusRing;
	if (e.focus !== !1 && ee !== !1 && C.length) {
		let e = typeof ee == "object" ? ee : void 0, t = br(e?.radius, 5), n = e?.fill ?? "var(--ts-chart-focus-fill, Canvas)", r = e?.stroke, i = br(e?.strokeWidth, 2.5);
		for (let e of S) D.push(Un({
			kind: "group",
			key: `default-focus:${e.markId}`,
			className: "ts-chart__focus-layer ts-chart__focus-layer--default",
			ariaHidden: !0,
			clip: e.clipped ? d : void 0,
			focus: {
				match: "primary",
				anchors: e.points,
				points: e.points,
				placement: "over"
			},
			children: e.points.map((e) => ({
				kind: "dot",
				key: e.key,
				x: e.x,
				y: e.y,
				radius: t,
				style: {
					fill: n,
					stroke: r ?? e.color,
					strokeWidth: i
				}
			}))
		}));
	}
	return {
		width: i,
		height: a,
		margin: u,
		chart: d,
		nodes: D,
		points: C,
		scales: f,
		colors: h,
		gradients: e.gradients ?? [],
		theme: c,
		...o.typography?.direction === void 0 ? {} : { direction: o.typography.direction },
		...O.length ? { controls: O } : {},
		...w.length ? { focusGuides: w } : {},
		[Vn]: [e, l]
	};
}
function Xn(e, t, n, r, i) {
	a("x", e.xValue, e.x, r), a("y", e.yValue, e.y, i);
	function a(r, i, a, o) {
		let s = t.channels[r]?.scale, c = s === void 0 ? void 0 : n[s];
		if (!c || c.type === "none") return;
		let l = c.map(i) + (o ?? 0);
		Number.isFinite(l) && l !== a && Fn(e, r, l);
	}
}
function Zn(e, t, n, r) {
	let i = e.viewport?.[t];
	if (i !== "fixed") {
		for (let r of n) if (r.channel === t && r.scale.viewport && Object.values(e.channels).some((e) => e.scale === r.id)) return r.scale.viewport.translate;
		return i === "content" ? r[t]?.viewport?.translate : void 0;
	}
}
function Qn(e, t) {
	return ["x", "y"].some((n) => t.some((t) => t.channel === n && t.scale.viewport && e.viewport?.[n] !== "fixed" && (e.viewport?.[n] === "content" || Object.values(e.channels).some((e) => e.scale === t.id))));
}
function $n(e, t) {
	return e.flatMap((e) => e.translateX === void 0 && e.translateY === void 0 ? [...e.nodes] : [{
		kind: "group",
		key: `viewport-clip:${e.key}`,
		className: "ts-chart__viewport-clip",
		clip: t,
		children: [{
			kind: "group",
			key: `viewport-content:${e.key}`,
			className: "ts-chart__viewport-content",
			...e.translateX === void 0 ? {} : { translateX: e.translateX },
			...e.translateY === void 0 ? {} : { translateY: e.translateY },
			children: e.nodes
		}]
	}]);
}
function er(e, t, n, r = Infinity, i = e.points) {
	return cn(e, t, n, r, i);
}
function tr(e, t = e.points) {
	if (!Object.values(e.scales).some((e) => e.viewport)) return t;
	let { x: n, y: r, width: i, height: a } = e.chart, o = n + i, s = r + a, c = t.filter((t) => !nr(e, t) || t.x >= n && t.x <= o && t.y >= r && t.y <= s);
	return c.length === t.length ? t : c;
}
function nr(e, t) {
	let n = e[Vn]?.[1].find((e) => e.id === t.markId);
	return !n || ["x", "y"].some((t) => {
		let r = n.viewport?.[t];
		return r === "fixed" ? !1 : r === "content" && e.scales[t]?.viewport ? !0 : Object.entries(n.channels).some(([n, r]) => n === t && r.scale !== void 0 && e.scales[r.scale]?.viewport !== void 0);
	});
}
function rr(e, t) {
	let n = t ? [...t] : [], r = new Set(n), i = (e) => {
		for (let t of e) {
			if (t.kind === "group") {
				t.focus || i(t.children);
				continue;
			}
			if (t.kind === "label" || !t.interaction) continue;
			let e = t.interaction;
			if (e.point) r.has(e.point) || (r.add(e.point), n.push(e.point));
			else for (let t of e.points) r.has(t) || (r.add(t), n.push(t));
		}
	};
	return i(e), n;
}
function ir(e, t) {
	let n = [], r = !1, i = !1;
	for (let a of e) for (let e of Object.values(a.channels)) if (e.scale === t) {
		i = !0;
		for (let t of e.values) n.push(t);
		r ||= e.includeZero ?? !1;
	}
	return {
		values: n,
		includeZero: r,
		materialized: i
	};
}
function ar(e) {
	let t = /* @__PURE__ */ new Map();
	for (let n of e) for (let [e, r] of Object.entries(n.channels)) {
		let i = r.scale;
		if (i === void 0) continue;
		let a = Rn(e, r);
		if (i === "color") {
			if (a) throw TypeError("Position scales cannot use reserved ID \"color\"");
			continue;
		}
		let o = t.get(i) ?? {
			values: [],
			includeZero: !1,
			materialized: !1
		};
		if (a && o.channel && o.channel !== a) throw TypeError(`Chart scale "${i}" cannot materialize both x and y channels`);
		o.channel ??= a, o.materialized ||= !n.focusGuideOnly, o.includeZero ||= r.includeZero ?? !1;
		for (let e of r.values) o.values.push(e);
		t.set(i, o);
	}
	return t;
}
function or(e, t) {
	let n = e.scales;
	if (!n || !Object.hasOwn(n, "x") || !Object.hasOwn(n, "y")) throw TypeError("Chart scales must define reserved `x` and `y` entries");
	for (let e of t.keys()) if (!Object.hasOwn(n, e)) throw TypeError(`Chart scale "${e}" is used by a mark but is not configured`);
	return Object.entries(n).map(([e, n]) => {
		if (e === "color") throw TypeError("Position scales cannot use reserved ID \"color\"");
		let r = t.get(e) ?? {
			values: [],
			includeZero: !1,
			materialized: !1
		}, i = e === "x" || e === "y" ? e : void 0, a = n?.channel;
		if (!i && n !== null && !a) throw TypeError(`Named chart scale "${e}" requires channel: "x" or channel: "y"`);
		let o = i ?? a ?? r.channel ?? "x";
		if (a && a !== o || r.channel && r.channel !== o) throw TypeError(`Chart scale "${e}" is configured for ${o} but is used as ${r.channel ?? a}`);
		let s = n?.side ?? (o === "x" ? "bottom" : "left");
		if (o === "x" && s !== "top" && s !== "bottom" || o === "y" && s !== "left" && s !== "right") throw TypeError(`Chart scale "${e}" uses ${o} and cannot render an axis on the ${s} side`);
		return {
			id: e,
			channel: o,
			side: s,
			options: n,
			channels: r
		};
	});
}
var sr = 4, cr = 4, lr = .25;
function ur(e, t, n, r, i, a, o, s) {
	let c = gr(e.margin), l = vr(xr(e.guides !== !1 && a.some(dr) ? sr : 0), c), u = l;
	for (let e = 0; e < cr; e += 1) {
		let e = p(l), t = m(e);
		if (u = vr(t, c, u), yr(l, t)) return e;
		l = t;
	}
	let d = p(u), f = vr(m(d), c, u);
	return yr(u, f) || (d = p(f)), d;
	function p(c) {
		let l = {
			x: c.left,
			y: c.top,
			width: Math.max(1, n - c.left - c.right),
			height: Math.max(1, r - c.top - c.bottom)
		}, u = {}, d = [];
		for (let e of a) {
			let { id: t, channel: n, options: r, channels: i } = e, a = Dr(r, n === "x" ? l.width : l.height, n === "x" ? 92 : 48, n === "x" ? 8 : 7), s = n === "x" ? [l.x, l.x + l.width] : [l.y + l.height, l.y], c = r == null ? Sr(t, i.materialized, r) : o({
				id: t,
				channel: n,
				values: i.values,
				range: s,
				options: r,
				tickCount: a,
				includeZero: i.includeZero
			});
			u[t] = c, d.push({
				...e,
				scale: c
			});
		}
		let f = pr(t, {
			chart: l,
			scales: u,
			theme: i,
			layout: s
		}), p = Fe(ir(f, "color").values, e.color, i);
		if (p.kind !== "categorical" && f.some((e) => e.seriesFromColor)) throw TypeError("A continuous color channel cannot infer series identity; supply z explicitly");
		let m = p.domain.length ? e.color?.legend : void 0;
		if (m?.seriesVisible && p.kind !== "categorical") throw TypeError("An interactive color legend requires a categorical color scale");
		let h = m?.height(p.domain.length, {
			colors: p,
			chart: l,
			bounds: {
				x: l.x,
				y: 0,
				width: l.width,
				height: 0
			},
			theme: i,
			layout: s,
			width: n,
			height: r,
			direction: s.typography?.direction
		}), g = m && h !== void 0 ? {
			x: l.x,
			y: m.placement === "bottom" ? r - h : 0,
			width: l.width,
			height: h
		} : void 0, _ = e.guides === !1 ? [] : d.filter(dr), v = e.guides === !1 ? [] : d.filter(fr), y = wr(l, _, i, n, s.measureText, s.typography?.direction === "rtl");
		return v.length && Rt(y.margin, Cr(l, v, i), l), {
			margin: c,
			chart: l,
			scales: u,
			axes: y.axes,
			positionScales: d,
			scaleGuides: _,
			gridScales: v,
			guideMargin: y.margin,
			marks: f,
			colors: p,
			legend: m,
			legendBounds: g
		};
	}
	function m(t) {
		let a = t.guideMargin;
		if (t.legend) {
			let e = t.legend.height(t.colors.domain.length, {
				colors: t.colors,
				chart: t.chart,
				bounds: {
					x: t.chart.x,
					y: 0,
					width: t.chart.width,
					height: 0
				},
				theme: i,
				layout: s,
				width: n,
				height: r,
				direction: s.typography?.direction
			});
			t.legend.placement === "bottom" ? c.bottom === void 0 && (a.bottom += e) : c.top === void 0 && (a.top = Math.max(a.top, e));
		}
		return e.clip || t.marks.forEach((e, o) => {
			if (Qn(e, t.positionScales)) return;
			let c = e.layoutLabels?.({
				markIndex: o,
				surface: {
					x: 0,
					y: 0,
					width: n,
					height: r
				},
				chart: t.chart,
				scales: t.scales,
				theme: i,
				color: t.colors.map,
				colors: t.colors,
				layout: s
			});
			for (let e of c ?? []) mr(a, t.chart, e, s.measureText);
		}), vr(a, c);
	}
}
function dr(e) {
	return e.options != null && e.options.axis !== !1;
}
function fr(e) {
	return e.options != null && !!e.options.grid;
}
function pr(e, t) {
	return e.map((e, n) => {
		if (typeof e.resolveLayout != "function") return e;
		let r = e.resolveLayout({
			...t,
			markIndex: n
		});
		return {
			id: e.id,
			channels: r.channels ?? e.channels,
			viewport: e.viewport,
			focusGuideOnly: e.focusGuideOnly,
			seriesFromColor: e.seriesFromColor,
			focus: e.focus,
			states: r.states ?? e.states,
			postDomain: r.postDomain ?? e.postDomain,
			layoutLabels: r.layoutLabels ?? e.layoutLabels,
			render: r.render
		};
	});
}
function mr(e, t, n, r) {
	let i = It(n, r);
	return n.text && hr(e, t, i), i;
}
function hr(e, t, n) {
	e.top = Math.max(e.top, t.y - n.y + sr), e.right = Math.max(e.right, n.x + n.width - t.x - t.width + sr), e.bottom = Math.max(e.bottom, n.y + n.height - t.y - t.height + sr), e.left = Math.max(e.left, t.x - n.x + sr);
}
function gr(e) {
	if (typeof e == "number") return xr(Y(e));
	if (!e) return {};
	let t = {};
	for (let n of _r) e[n] !== void 0 && (t[n] = Y(e[n]));
	return t;
}
var _r = [
	"top",
	"right",
	"bottom",
	"left"
];
function vr(e, t, n) {
	let r = { ...e };
	for (let i of _r) r[i] = t[i] ?? (n ? Math.max(n[i], e[i]) : e[i]);
	return r;
}
function yr(e, t) {
	return _r.every((n) => Math.abs(e[n] - t[n]) <= lr);
}
function Y(e) {
	return e !== void 0 && Number.isFinite(e) ? Math.max(0, e) : 0;
}
function br(e, t) {
	return e !== void 0 && Number.isFinite(e) && e >= 0 ? e : t;
}
function xr(e) {
	return {
		top: e,
		right: e,
		bottom: e,
		left: e
	};
}
function Sr(e, t, n) {
	if (t) throw TypeError(n === null ? `Chart scale "${e}" cannot be null when a mark materializes its channel` : `Chart scale "${e}" requires a configured scale when a mark materializes its channel`);
	return {
		id: e,
		type: "none",
		domain: [],
		map: () => {
			throw TypeError(`Chart scale "${e}" is not configured`);
		},
		ticks: [],
		bandwidth: 0
	};
}
function Cr(e, t, n) {
	let r = [];
	for (let n of t) {
		if (!n.options?.grid) continue;
		let t = Tr(n.options.grid);
		for (let i of n.scale.ticks) {
			let a = `${n.id}-grid:${K(i.value)}`;
			r.push(n.channel === "x" ? {
				kind: "rule",
				key: a,
				x1: i.position,
				x2: i.position,
				y1: e.y,
				y2: e.y + e.height,
				...t ? { style: t } : {}
			} : {
				kind: "rule",
				key: a,
				x1: e.x,
				x2: e.x + e.width,
				y1: i.position,
				y2: i.position,
				...t ? { style: t } : {}
			});
		}
	}
	return {
		kind: "group",
		key: "grid",
		className: "ts-chart__grid",
		ariaHidden: !0,
		children: r,
		style: {
			stroke: n.grid,
			strokeOpacity: .11,
			strokeWidth: 1
		}
	};
}
function wr(e, t, n, r, i, a = !1) {
	let o = [], s = xr(t.length ? sr : 0), c = {
		top: 0,
		right: 0,
		bottom: 0,
		left: 0
	}, l = {
		top: 0,
		right: 0,
		bottom: 0,
		left: 0
	}, u = e.x + e.width, d = e.y + e.height;
	for (let n of t) {
		let t = Er(Or(n.options)?.line), r = c[n.side] + (l[n.side] > 0 ? t : 0);
		s[n.side] = Math.max(s[n.side], r + sr);
		let i = n.side === "top" ? e.y - r : n.side === "right" ? u + r : n.side === "bottom" ? d + r : e.x - r, a = i, o = (t) => {
			hr(s, e, t), a = n.side === "top" ? Math.min(a, t.y) : n.side === "right" ? Math.max(a, t.x + t.width) : n.side === "bottom" ? Math.max(a, t.y + t.height) : Math.min(a, t.x);
		}, f = (e) => {
			a = n.side === "top" || n.side === "left" ? Math.min(a, e) : Math.max(a, e);
		};
		n.channel === "x" ? p(n, i, o, f) : m(n, i, o, f);
		let h = n.side === "top" ? e.y - a : n.side === "right" ? a - u : n.side === "bottom" ? a - d : e.x - a;
		c[n.side] = Math.max(r, h) + 8, l[n.side] += 1;
	}
	let f = {
		kind: "group",
		key: "axes",
		className: "ts-chart__axes",
		ariaHidden: !0,
		children: o
	};
	return Rt(s, f, e), {
		axes: f,
		margin: s
	};
	function p(t, s, c, l) {
		let d = Or(t.options), f = t.side === "bottom", p = f ? 1 : -1;
		d?.line !== !1 && (o.push({
			kind: "rule",
			key: `${t.id}-axis`,
			x1: e.x,
			x2: u,
			y1: s,
			y2: s,
			style: h(d?.line)
		}), l(s + p * Er(d?.line)));
		let m = d?.ticks === !1 ? [] : t.scale.ticks, g = Y(d?.ticks === !1 ? 0 : d?.ticks?.size ?? 4), _ = Y(d?.ticks === !1 ? 0 : d?.ticks?.padding ?? 4), v = kr(d), y = v === !1 ? [] : jr(t, Ar(t.scale, t.options, v), s, g, _, v, r, n, i, a), b = v === !1 ? [] : Nr(y, v, t.scale.type === "band"), x = s;
		for (let e of m) {
			if (g <= 0) continue;
			let n = s + p * g;
			l(n), x = f ? Math.max(x, n) : Math.min(x, n), o.push({
				kind: "rule",
				key: `${t.id}-tick-rule:${K(e.value)}`,
				x1: e.position,
				x2: e.position,
				y1: s,
				y2: n,
				style: h()
			});
		}
		for (let e of b) c(e.bounds), x = f ? Math.max(x, e.bounds.y + e.bounds.height) : Math.min(x, e.bounds.y), o.push(e.label);
		let S = d?.label, C = typeof S == "string" ? S : S?.text;
		if (!C) return;
		let w = typeof S == "object" ? S : void 0, T = w?.offset ?? "auto", E = T !== "auto", D = {
			kind: "label",
			key: `${t.id}-label`,
			x: e.x + e.width / 2,
			y: E ? s + p * Math.max(0, Y(T)) : x + p * 8,
			text: C,
			anchor: "middle",
			baseline: f && !E ? "hanging" : "auto",
			fontSize: w?.fontSize ?? (r < 360 ? 10 : 11),
			fontWeight: w?.fontWeight ?? 600,
			style: {
				fill: w?.fill ?? n.foreground,
				...w?.opacity === void 0 ? { fillOpacity: .76 } : { opacity: w.opacity }
			}
		};
		c(It(D, i)), o.push(D);
	}
	function m(t, s, c, l) {
		let u = Or(t.options), f = t.side === "right", p = f ? 1 : -1;
		u?.line !== !1 && (o.push({
			kind: "rule",
			key: `${t.id}-axis`,
			x1: s,
			x2: s,
			y1: e.y,
			y2: d,
			style: h(u?.line)
		}), l(s + p * Er(u?.line)));
		let m = u?.ticks === !1 ? [] : t.scale.ticks, g = Y(u?.ticks === !1 ? 0 : u?.ticks?.size ?? 4), _ = Y(u?.ticks === !1 ? 0 : u?.ticks?.padding ?? 4), v = kr(u), y = v === !1 ? [] : jr(t, Ar(t.scale, t.options, v), s, g, _, v, r, n, i, a), b = v === !1 ? [] : Nr(y, v, !1), x = s;
		for (let e of m) {
			if (g <= 0) continue;
			let n = s + p * g;
			l(n), x = f ? Math.max(x, n) : Math.min(x, n), o.push({
				kind: "rule",
				key: `${t.id}-tick-rule:${K(e.value)}`,
				x1: s,
				x2: n,
				y1: e.position,
				y2: e.position,
				style: h()
			});
		}
		for (let e of b) c(e.bounds), x = f ? Math.max(x, e.bounds.x + e.bounds.width) : Math.min(x, e.bounds.x), o.push(e.label);
		let S = u?.label, C = typeof S == "string" ? S : S?.text;
		if (!C) return;
		let w = typeof S == "object" ? S : void 0, T = {
			kind: "label",
			key: `${t.id}-label`,
			x: s,
			y: e.y + e.height / 2,
			text: C,
			anchor: "middle",
			baseline: "middle",
			rotate: f ? 90 : -90,
			fontSize: w?.fontSize ?? 11,
			fontWeight: w?.fontWeight ?? 600,
			style: {
				fill: w?.fill ?? n.foreground,
				...w?.opacity === void 0 ? { fillOpacity: .76 } : { opacity: w.opacity }
			}
		}, E = w?.offset ?? "auto";
		if (E !== "auto") T.x = s + p * Math.max(0, Y(E));
		else {
			let e = It({
				...T,
				x: 0,
				y: 0
			}, i);
			T.x = f ? x + 8 - e.x : x - 8 - (e.x + e.width);
		}
		c(It(T, i)), o.push(T);
	}
	function h(e) {
		return {
			stroke: n.foreground,
			strokeOpacity: .28,
			...Tr(e) ?? {}
		};
	}
}
function Tr(e) {
	if (!e || typeof e != "object") return;
	let t = {};
	return e.stroke !== void 0 && (t.stroke = e.stroke), e.strokeOpacity !== void 0 && (t.strokeOpacity = e.strokeOpacity), e.strokeWidth !== void 0 && (t.strokeWidth = e.strokeWidth), e.strokeDasharray !== void 0 && (t.strokeDasharray = e.strokeDasharray), e.lineCap !== void 0 && (t.lineCap = e.lineCap), Object.keys(t).length ? t : void 0;
}
function Er(e) {
	if (!e || typeof e != "object" || e.stroke === "none") return 0;
	let t = e.strokeWidth;
	return t !== void 0 && Number.isFinite(t) && t > 0 ? t / 2 : 0;
}
function Dr(e, t, n, r) {
	let i = e?.axis === !1 ? void 0 : e?.axis?.ticks;
	if (i === !1) return Math.max(2, Math.min(r, Math.floor(t / n)));
	let a = i ?? {};
	if ([
		a.count !== void 0,
		a.spacing !== void 0,
		a.values !== void 0
	].filter(Boolean).length > 1) throw TypeError("Axis ticks accept only one candidate policy: count, spacing, or values");
	if (a.values) return Math.max(1, a.values.length);
	if (a.count !== void 0) return Math.max(1, Math.floor(Y(a.count)));
	if (a.spacing !== void 0) {
		let e = Math.max(1, Y(a.spacing));
		return Math.max(1, Math.floor(t / e));
	}
	return Math.max(2, Math.min(r, Math.floor(t / n)));
}
function Or(e) {
	if (e && e.axis !== !1) return e.axis ?? {};
}
function kr(e) {
	return e?.ticks === !1 || e?.tickLabels === !1 ? !1 : e?.tickLabels ?? {};
}
function Ar(e, t, n) {
	let r = (typeof n.thin == "object" ? n.thin : void 0)?.keep ?? [];
	if (!r.length) return e.ticks;
	let i = t?.axis === !1 || t?.axis?.ticks === !1 ? void 0 : t?.axis?.ticks?.format, a = e.ticks.map((e) => ({
		...e,
		hard: r.some((t) => K(t) === K(e.value))
	})), o = new Set(a.map((e) => K(e.value)));
	for (let t of r) {
		let n = e.map(t);
		!o.has(K(t)) && Number.isFinite(n) && a.push({
			value: t,
			position: n,
			label: i?.(t) ?? Lr(t),
			hard: !0
		});
	}
	return a;
}
function jr(e, t, n, r, i, a, o, s, c, l = !1) {
	let u = o < 360 ? 10 : 11, d = e.side === "bottom" || e.side === "right", f = d ? 1 : -1;
	return t.map((t, o) => {
		let p = {
			value: t.value,
			index: o,
			position: t.position,
			bandwidth: e.scale.bandwidth
		}, m = a.rotate, h = Mr(a.fontSize, p) ?? u, g = Mr(a.fontWeight, p), _ = Mr(a.opacity, p), v = Mr(a.dx, p) ?? 0, y = Mr(a.dy, p) ?? 0, b = e.channel === "y" ? Nt(d ? "left" : "right", l ? "rtl" : "ltr") : (m ?? 0) < 0 ? Nt("right", l ? "rtl" : "ltr") : (m ?? 0) > 0 ? Nt("left", l ? "rtl" : "ltr") : "middle", x = Mr(a.anchor, p) ?? b, S = e.channel === "x" ? {
			kind: "label",
			key: `${e.id}-tick-label:${K(t.value)}`,
			x: t.position + v,
			y: n + f * (r + i + h * .8) + y,
			text: t.label,
			anchor: x,
			rotate: m,
			fontSize: h,
			fontWeight: g,
			style: {
				fill: s.muted,
				..._ === void 0 ? { fillOpacity: .68 } : { opacity: _ }
			}
		} : {
			kind: "label",
			key: `${e.id}-tick-label:${K(t.value)}`,
			x: n + f * (r + i) + v,
			y: t.position + y,
			text: t.label,
			anchor: x,
			baseline: "middle",
			rotate: m,
			fontSize: h,
			fontWeight: g,
			style: {
				fill: s.muted,
				..._ === void 0 ? { fillOpacity: .68 } : { opacity: _ }
			}
		};
		return {
			value: t.value,
			label: S,
			bounds: It(S, c),
			hard: t.hard ?? !1
		};
	});
}
function Mr(e, t) {
	return typeof e == "function" ? e(t) : e;
}
function Nr(e, t, n) {
	if (t.thin === !1 || e.length < 2) return [...e];
	let r = typeof t.thin == "object" ? t.thin : {}, i = Math.max(0, Y(r.minGap ?? 4)), a = e.filter((e) => e.hard), o = e.filter((e) => !e.hard);
	if ((r.priority === "ends" || n) && o.length) {
		let e = o[0], t = o.at(-1);
		Fr(e, a, i) || a.push(e), t !== e && !Fr(t, a, i) && a.push(t);
	}
	let s = Pr(o.filter((e) => !a.includes(e)));
	for (let e of s) Fr(e, a, i) || a.push(e);
	let c = new Set(a);
	return e.filter((e) => c.has(e));
}
function Pr(e) {
	if (e.length < 3) return [...e];
	let t = [], n = [e];
	for (; n.length;) {
		let e = n.shift();
		if (!e.length) continue;
		let r = Math.floor(e.length / 2);
		t.push(e[r]), n.push(e.slice(0, r), e.slice(r + 1));
	}
	return t;
}
function Fr(e, t, n) {
	return t.some((t) => Ir(e.bounds, t.bounds, n));
}
function Ir(e, t, n) {
	return !(e.x + e.width + n <= t.x || t.x + t.width + n <= e.x || e.y + e.height + n <= t.y || t.y + t.height + n <= e.y);
}
function Lr(e) {
	return e instanceof Date ? e.toLocaleDateString() : String(e);
}
function Rr(e) {
	return Number.isFinite(e) ? Math.max(1, e) : 1;
}
// node_modules/.bun/@tanstack+charts@0.18.0+74b9eec76f411c79/node_modules/@tanstack/charts/dist/runtime.js
function zr(e = {}) {
	let t = {
		...Gn,
		...e.defaultTheme,
		palette: e.defaultTheme?.palette ?? Gn.palette
	};
	return {
		render(e, n, r) {
			if (!Br(e)) return qn(e, n, {
				...r,
				defaultTheme: t
			});
			let { chart: i, ...a } = e;
			return qn({
				...i({
					width: n.width,
					height: n.height,
					defaultTheme: t
				}),
				...a
			}, n, {
				...r,
				defaultTheme: t
			});
		},
		destroy() {}
	};
}
function Br(e) {
	return "chart" in e && typeof e.chart == "function";
}
// node_modules/.bun/@tanstack+charts@0.18.0+74b9eec76f411c79/node_modules/@tanstack/charts/dist/adapter-shared.js
function Vr(e) {
	let t = e.width ?? e.initialWidth ?? 640, n = typeof e.aspectRatio == "number" && Number.isFinite(e.aspectRatio) && e.aspectRatio > 0 ? e.aspectRatio : void 0;
	return {
		aspectRatio: n,
		initialWidth: t,
		initialHeight: e.height ?? (n === void 0 ? 320 : t / n)
	};
}
function Hr(e, t = 0) {
	return e.keyboard === !1 || e.focus === !1 || e.cursor?.mode === "free" ? -1 : t;
}
// node_modules/.bun/@tanstack+charts@0.18.0+74b9eec76f411c79/node_modules/@tanstack/charts/dist/dom-text.js
function Ur(e) {
	let t = e.ownerDocument.defaultView, n = t?.CanvasRenderingContext2D ? e.ownerDocument.createElement("canvas").getContext("2d") : null, r = o(), i = Kr(r), a = /* @__PURE__ */ new Map();
	return {
		measureText(e, t) {
			if (!n) return Ft(e, t);
			let o = `${i}\0${t.fontSize}\0${t.fontWeight ?? ""}\0${t.fontFamily}\0${t.fontStyle}\0${t.fontStretch}\0${t.letterSpacing}\0${t.direction}\0${t.locale ?? ""}\0${t.fontScale}\0${t.anchor}\0${t.baseline}\0${e}`, s = a.get(o);
			if (s) return s;
			Wr(n, r.weight, t);
			let c = Gr(n.measureText(e), t);
			return a.set(o, c), c;
		},
		typography() {
			return {
				fontFamily: r.family,
				fontStyle: r.style,
				fontStretch: r.stretch,
				letterSpacing: r.letterSpacing,
				direction: r.direction
			};
		},
		refresh() {
			let e = o(), t = Kr(e);
			return t !== i && (r = e, i = t, a.clear(), !0);
		},
		invalidate() {
			a.clear();
		}
	};
	function o() {
		let n = t?.getComputedStyle(e);
		return {
			family: n?.fontFamily || "sans-serif",
			style: n?.fontStyle || "normal",
			stretch: qr(n?.fontStretch),
			weight: n?.fontWeight || "400",
			direction: n?.direction === "rtl" ? "rtl" : n?.direction === "ltr" ? "ltr" : "inherit",
			letterSpacing: Jr(n?.letterSpacing)
		};
	}
}
function Wr(e, t, n) {
	let r = Yr(n.fontScale, 1), i = n.fontSize * r, a = n.fontWeight ?? t;
	e.font = [
		n.fontStyle,
		a,
		`${i}px`,
		n.fontFamily
	].join(" "), "fontStretch" in e && (e.fontStretch = qr(n.fontStretch)), e.textAlign = n.anchor === "middle" ? "center" : n.anchor, e.textBaseline = n.baseline === "auto" ? "alphabetic" : n.baseline, e.direction = n.direction, "letterSpacing" in e && (e.letterSpacing = `${n.letterSpacing * r}px`);
}
function Gr(e, t) {
	let n = t.fontSize * Yr(t.fontScale, 1), r = e.actualBoundingBoxLeft, i = e.actualBoundingBoxRight, a = e.actualBoundingBoxAscent, o = e.actualBoundingBoxDescent;
	if ([
		r,
		i,
		a,
		o
	].every((e) => Number.isFinite(e)) && (r + i > 0 || e.width === 0) && (a + o > 0 || e.width === 0)) return {
		x: -r,
		y: -a,
		width: r + i,
		height: a + o
	};
	let s = Number.isFinite(e.width) ? Math.max(0, e.width) : 0;
	return {
		x: Pt(s, t.anchor, t.direction),
		y: t.baseline === "middle" ? -n / 2 : t.baseline === "hanging" ? 0 : -n * .8,
		width: s,
		height: n
	};
}
function Kr(e) {
	return [
		e.family,
		e.style,
		e.stretch,
		e.weight,
		e.direction,
		e.letterSpacing
	].join("\0");
}
function qr(e) {
	if (e === "ultra-condensed" || e === "extra-condensed" || e === "condensed" || e === "semi-condensed" || e === "normal" || e === "semi-expanded" || e === "expanded" || e === "extra-expanded" || e === "ultra-expanded") return e;
	let t = Number.parseFloat(e ?? "");
	return Number.isFinite(t) ? t <= 50 ? "ultra-condensed" : t <= 62.5 ? "extra-condensed" : t <= 75 ? "condensed" : t <= 87.5 ? "semi-condensed" : t < 112.5 ? "normal" : t < 125 ? "semi-expanded" : t < 150 ? "expanded" : t < 200 ? "extra-expanded" : "ultra-expanded" : "normal";
}
function Jr(e) {
	let t = Number.parseFloat(e ?? "");
	return Number.isFinite(t) ? t : 0;
}
function Yr(e, t) {
	return e !== void 0 && Number.isFinite(e) && e > 0 ? e : t;
}
// node_modules/.bun/@tanstack+charts@0.18.0+74b9eec76f411c79/node_modules/@tanstack/charts/dist/focus-disabled.js
var Xr = {
	resolve: () => [],
	group: () => [],
	navigation: () => []
}, Zr = ti("x", !0), Qr = ti("y", !0), $r = ti("x", !1), ei = ti("y", !1);
function ti(e, t) {
	let n = (t) => In(t, e), r = (t) => e === "x" ? t.y : t.x;
	return {
		resolve(i, a) {
			let { x: o, y: s, maxDistance: c } = a, l = e === "x" ? o : s, u, d = c;
			for (let e of i) {
				let t = Math.abs(n(e) - l);
				t >= d || (u = e, d = t);
			}
			if (!u) return [];
			let f = ni(i, u, n), p = e === "x" ? s : o, m = f.reduce((e, t) => Math.abs(r(t) - p) < Math.abs(r(e) - p) ? t : e, u);
			return t ? [m, ...f.filter((e) => e !== m)] : [m];
		},
		group(e, r) {
			let { point: i } = r;
			return t ? ni(e, i, n) : [i];
		},
		navigation(e) {
			let r = [...e].sort((e, t) => e.x - t.x || e.y - t.y);
			if (!t) return r;
			let i = /* @__PURE__ */ new Map();
			for (let e of r) {
				let t = K(n(e));
				i.has(t) || i.set(t, e);
			}
			return [...i.values()];
		}
	};
}
function ni(e, t, n) {
	let r = K(n(t)), i = /* @__PURE__ */ new Map();
	i.set(K(t.group), t);
	for (let t of e) {
		if (K(n(t)) !== r) continue;
		let e = K(t.group);
		i.has(e) || i.set(e, t);
	}
	return [t, ...[...i.values()].sort((e, t) => e.y - t.y).filter((e) => e !== t)];
}
// node_modules/.bun/@tanstack+charts@0.18.0+74b9eec76f411c79/node_modules/@tanstack/charts/dist/interaction.js
function ri(e) {
	if (e !== !1) {
		if (typeof e != "string") return e;
		switch (e) {
			case "nearest-x": return $r;
			case "nearest-y": return ei;
			case "group-x": return Zr;
			case "group-y": return Qr;
			case "nearest": return;
		}
	}
}
function ii(e, t, n, r, i, a = e.points) {
	let o = ri(t);
	if (o) {
		if (a === e.points && (o === $r || o === ei || o === Zr || o === Qr)) {
			let t = ln(e, n, r);
			if (t) return t.point ? o.group(a, { point: t.point }) : [];
		}
		return o.resolve(a, {
			x: n,
			y: r,
			maxDistance: i
		});
	}
}
function ai(e, t) {
	return e === t || e !== null && t !== null && e.key === t.key && e.markId === t.markId && e.datumIndex === t.datumIndex;
}
function oi(e, t) {
	let n = e.filter((e) => e.key === t.key);
	if (n.length < 2) return n[0] ?? null;
	let r = typeof t.datum;
	if (t.datum !== null && (r === "object" || r === "function")) {
		let e = n.find((e) => e.datum === t.datum);
		if (e) return e;
	}
	return n.find((e) => e.markId === t.markId && Object.is(e.group, t.group) && di(e.xValue, t.xValue) && di(e.yValue, t.yValue)) ?? n.find((e) => e.markId === t.markId && e.datumIndex === t.datumIndex) ?? n[0] ?? null;
}
function si(e, t, n) {
	let r = t ? e.findIndex((e) => ai(e, t)) : -1, i;
	switch (n) {
		case "ArrowRight":
		case "ArrowDown":
			i = Math.min(e.length - 1, r + 1);
			break;
		case "ArrowLeft":
		case "ArrowUp":
			i = Math.max(0, r < 0 ? 0 : r - 1);
			break;
		case "Home":
			i = 0;
			break;
		case "End":
			i = e.length - 1;
			break;
		default: return;
	}
	return e[i] ?? null;
}
function ci(e, t, n) {
	let r = n === "ArrowRight" || n === "ArrowDown" ? 1 : n === "ArrowLeft" || n === "ArrowUp" ? -1 : n === "Home" ? 0 : n === "End" ? 2 : void 0;
	if (r === void 0) return;
	if (!e.length) return null;
	let i = t ? e.findIndex((e) => ai(e, t)) : -1;
	if (!t || i < 0 || r === 0 || r === 2) return li(e, r === 2);
	let a = null, o = -1;
	for (let n = 0; n < e.length; n += 1) {
		let s = e[n];
		if (!s) continue;
		let c = ui(s, n, t, i);
		r > 0 && c <= 0 || r < 0 && c >= 0 || (!a || r * ui(s, n, a, o) < 0) && (a = s, o = n);
	}
	return a ?? t;
}
function li(e, t) {
	let n = e[0] ?? null, r = 0;
	for (let i = 1; i < e.length; i += 1) {
		let a = e[i];
		if (!a || !n) continue;
		let o = ui(a, i, n, r);
		(t && o > 0 || !t && o < 0) && (n = a, r = i);
	}
	return n;
}
function ui(e, t, n, r) {
	return e.x - n.x || e.y - n.y || t - r;
}
function di(e, t) {
	return e instanceof Date && t instanceof Date ? e.getTime() === t.getTime() : Object.is(e, t);
}
// node_modules/.bun/@tanstack+charts@0.18.0+74b9eec76f411c79/node_modules/@tanstack/charts/dist/cursor-host-contract.js
function fi(e) {
	let t = e.use;
	if (t.__chartExtensionType !== "cursor") throw TypeError("A chart cursor requires a cursor host extension.");
	return t.create(e.controller);
}
// node_modules/.bun/@tanstack+charts@0.18.0+74b9eec76f411c79/node_modules/@tanstack/charts/dist/renderer.js
function pi(e, t) {
	return (hi(e.nodes, t) ?? mi(e.focusGuides, t))?.compose(t) ?? t;
}
function mi(e, t) {
	for (let n of e ?? []) if (n.renderer !== void 0 && n.renderer !== t) return gi(n.renderer);
}
function hi(e, t) {
	for (let n of e) {
		if (n.renderer !== void 0 && n.renderer !== t) return gi(n.renderer);
		if (n.kind === "group") {
			let e = hi(n.children, t);
			if (e) return e;
		}
	}
}
function gi(e) {
	if (typeof e.compose != "function") throw TypeError(`Mark renderer "${e.id}" cannot compose chart layers`);
	return e;
}
function _i(e, t, n = zr()) {
	xi(t.definition.tooltip);
	let r = t, i, a, o = null, s = "pointer", c = null, l = null, u = null, d, f, p, m = !1, h, g = !1, _ = !1, v, y, b = !1, x = !1, S, C, w = !1, T, E = /* @__PURE__ */ new Map(), D, O, k, A, ee, j, M = null, N = !1, P = e.style.position, F = e.ownerDocument.defaultView, I = F?.getComputedStyle(e).position, te = !I || I === "static", L = Ur(e), ne = e.ownerDocument.fonts;
	te && (e.style.position = "relative");
	let re = (t = !1, n = "update") => {
		if (g) return;
		t && !r.measureText && L.refresh();
		let d = o, f = M, p = ee;
		i = yi(De()), a = i;
		let m = pi(i, r.renderer);
		v ? v.renderer !== m && (y?.(), y = void 0, ze(), ke(), v.destroy(), e.replaceChildren(), v = m.mount(e, ce), Ne(), _ = !1) : (v = m.mount(e, ce), Ne()), b = !0;
		try {
			v.render(i, {
				ariaLabel: r.ariaLabel,
				ariaDescription: r.ariaDescription,
				className: r.className,
				tabIndex: Hr(r.definition, r.tabIndex),
				idPrefix: r.idPrefix,
				animation: _ ? ki(r.definition.svgAnimation, e, n) : void 0
			});
		} finally {
			b = !1;
		}
		Oe(), _ = !0;
		let h = Me();
		T = r.definition.focus === !1 ? void 0 : r.definition.spatialIndex?.(tr(i, i.points), { scene: i });
		let x = B();
		if (ee = x, x) fe(!0);
		else if (p) M = null, o = null, u = null, l = null, c = null, U(null, []), d && (r.onFocusChange?.(null), r.onFocusGroupChange?.([]));
		else {
			M = null;
			let e = (c === "pointer" || c === "controlled" && s === "pointer") && u === null ? l : null, t = e ? je(e.x, e.y, Fe()) : d ? (() => {
				let e = oi(h, d);
				return e ? G(e, h) : [];
			})() : [], n = t[0] ?? null;
			o = n, n || (u = null), (d || n || f) && (e || (s = "restored"), U(n, t), r.onFocusChange?.(n), r.onFocusGroupChange?.(t));
		}
		let S = r.onRender;
		S && S({
			container: e,
			scene: i,
			surface: v,
			interaction: _e
		});
	}, R = () => r.width === void 0, ie = () => r.height === void 0 && !Si(r.aspectRatio), ae = (t) => {
		let n = F?.getComputedStyle(e), r = Ci(n?.paddingLeft) + Ci(n?.paddingRight), i = Ci(n?.paddingTop) + Ci(n?.paddingBottom), a = Ci(n?.borderLeftWidth) + Ci(n?.borderRightWidth), o = Ci(n?.borderTopWidth) + Ci(n?.borderBottomWidth);
		return {
			width: wi(n?.width, n?.boxSizing, t?.width, r, a),
			height: wi(n?.height, n?.boxSizing, t?.height, i, o)
		};
	}, oe = () => {
		let t = R(), n = ie(), i = (t || n) && !f ? e.getBoundingClientRect() : void 0, a = t || n ? f ?? ae(i) : void 0;
		return {
			width: r.width ?? a?.width,
			height: n ? a?.height : void 0
		};
	}, z = () => {
		let e = oe();
		return R() && e.width !== void 0 && e.width !== i.width || ie() && e.height !== void 0 && e.height !== i.height;
	}, se = () => {
		if (d?.disconnect(), d = void 0, f = void 0, !R() && !ie()) return;
		let t = F?.ResizeObserver;
		t && (d = new t((t) => {
			let n = t.find((t) => t.target === e) ?? t[0];
			f = n ? {
				width: Ei(n.contentRect.width),
				height: Ei(n.contentRect.height)
			} : void 0, z() && ce(!1, "resize");
		}), d.observe(e));
	}, ce = (e = !1, t = "layout") => {
		if (m ||= e, h = h === "layout" || t === "layout" ? "layout" : "resize", p === void 0) {
			if (F?.requestAnimationFrame) p = F.requestAnimationFrame(() => {
				p = void 0;
				let e = m || z();
				m = !1;
				let t = h ?? "layout";
				h = void 0, e && re(!0, t);
			});
			else {
				let e = m || z();
				m = !1;
				let t = h ?? "layout";
				h = void 0, e && re(!0, t);
			}
		}
	}, le = () => {
		g || r.measureText || (L.invalidate(), ce(!0));
	}, B = () => r.definition.cursor, ue = () => D?.getState()?.pinned === !0, V = () => u !== null || ue(), de = () => {
		let e = B();
		e && (N = !0);
		let t = e?.controller, n = e?.mode, r = e?.mode === "focus" ? e.match ?? "xy" : void 0;
		(t !== D?.controller || n !== O || r !== k || e?.use !== A) && (j?.(), j = void 0, D?.destroy(), D = e ? fi(e) : void 0, O = n, k = r, A = e?.use, j = D?.subscribe(() => {
			!g && _ && fe(!1);
		}));
	}, fe = (e) => {
		let t = B();
		if (!t) {
			M = null;
			return;
		}
		let n = D;
		if (!n) return;
		let a = n.getState();
		a?.source === "pointer" && n.owns(a) || (l = null), M = n.resolvePresentation(i, t, a);
		let c = o;
		if (t.mode === "focus") {
			let i = ri(r.definition.focus), l = n.resolveFocus(Me(), t, a, i), d = l[0] ?? null;
			a && (s = a.source), u = a?.pinned && d ? d.key : null, o = d, U(d, l), (!ai(c, d) || e && (c !== null || d !== null)) && (r.onFocusChange?.(d), r.onFocusGroupChange?.(l));
		} else u = null, o = null, U(null, []), c && (r.onFocusChange?.(null), r.onFocusGroupChange?.([]));
	}, pe = (e, t = V()) => {
		let n = B();
		if (n?.mode !== "focus") return !1;
		let r = D;
		if (!r) return !1;
		let a = e[0];
		return a ? (r.publish(r.createFocusState(i, n, {
			primary: a,
			group: e,
			source: s,
			pinned: t
		})), !0) : (r.clearOwnedTransient(), !0);
	}, H = (e, t = !1) => {
		let n = e[0] ?? null;
		pe(e) || (ai(n, o) ? (o = n, t && U(n, e)) : (o = n, U(n, e), r.onFocusChange?.(n), r.onFocusGroupChange?.(e)));
	}, me = () => {
		let t = B();
		if (!o && !u && !D?.getState()) return;
		let n = !!C?.contains(e.ownerDocument.activeElement);
		u = null, l = null, c = null, t ? D?.clear() : H([]);
		let r = v?.element;
		n && r && "focus" in r && typeof r.focus == "function" && (w = !0, r.focus());
	}, U = (e, t) => {
		x = !0;
		let n;
		try {
			let r = e ? {
				primary: e,
				group: t,
				source: s,
				pinned: V()
			} : null;
			n = N ? v?.paintFocus(r, l, M) : v?.paintFocus(r, l);
		} finally {
			x = !1;
		}
		a = n ?? i, Ie(e, t);
	}, he = (e, t) => {
		let n = v?.clientToScene?.(i, e, t);
		return n ? {
			position: n,
			points: je(n.x, n.y, Fe())
		} : null;
	}, ge = (e, t) => {
		let n = he(e, t);
		return l = n?.position ?? null, n?.points ?? [];
	}, _e = {
		clientToScene(e, t) {
			return g ? null : v?.clientToScene?.(i, e, t) ?? null;
		},
		resolvePointer(e, t) {
			if (g) return null;
			let n = he(e, t), r = n?.points[0];
			return n && r ? {
				position: n.position,
				point: r,
				points: n.points
			} : null;
		},
		setControlledFocus(e, t = {}) {
			if (g) return;
			if (c = "controlled", !e) {
				s = t.source ?? "programmatic", l = null, u = null, H([]), c = null;
				return;
			}
			let n, r;
			bi(e) ? (n = e, r = e.point) : (n = null, r = e), s = t.source ?? (n === null ? "programmatic" : "pointer");
			let i = Me(), a = oi(i, r);
			if (l = n?.position ?? null, !a) {
				u = null, H([]), c = null;
				return;
			}
			let d = G(a, i);
			u = t.pinned && (Be() || B()?.pin === !0) ? a.key : null, ai(a, o) ? (o = a, U(a, d)) : H(d);
		}
	}, ve = (e, t) => {
		let n = v?.clientToScene?.(i, e, t);
		return l = n ?? null, n;
	}, ye = (e, t) => {
		let n = B();
		if (n?.mode !== "free") return !1;
		if (ue()) return !0;
		let r = ve(e, t);
		if (!r || !Oi(i, r)) return l = null, D?.clearOwnedTransient(), !0;
		let a = D;
		return a ? (a.publish(a.createFreeState(i, n, r, "pointer", !1)), !0) : !1;
	}, be = (e) => {
		Ae(e.target) ? V() || (l = null, H([])) : r.definition.pointer === !1 || V() || (c = "pointer", s = "pointer", !ye(e.clientX, e.clientY) && H(ge(e.clientX, e.clientY), Ve()));
	}, xe = (e) => {
		r.definition.pointer === !1 || V() || (c = "pointer", s = "pointer", ye(e.clientX, e.clientY));
	}, W = ({ relatedTarget: t }) => {
		r.definition.pointer !== !1 && c === "pointer" && !V() && !(F && t instanceof F.Node && e.contains(t)) && (l = null, B() ? D?.clearOwnedTransient() : H([]), c = null);
	}, Se = ({ relatedTarget: t }) => {
		c === "keyboard" && !u && !(F && t instanceof F.Node && e.contains(t)) && (l = null, B() ? D?.clearOwnedTransient() : H([]), c = null);
	}, Ce = (t) => {
		if (r.definition.pointer === !1 || u === null || ue()) return;
		let n = t.composedPath();
		n.includes(e) || n.some((e) => F && e instanceof F.Node && C?.contains(e)) || me();
	}, we = (t) => {
		if (Ae(t.target) || r.definition.pointer === !1) return;
		let n = C, i = e.ownerDocument.defaultView?.Node, a = i ? t.composedPath().some((e) => e instanceof i && n?.contains(e)) : n?.contains(t.target);
		if (n && a) return;
		c = "pointer";
		let o = B();
		if (o?.mode === "free") {
			D?.getState() || ye(t.clientX, t.clientY);
			let e = D?.getState();
			o.pin && e && (e.pinned ? D?.clear() : D?.publish({
				...e,
				pinned: !0
			})), r.onSelect?.(null);
			return;
		}
		let l = ge(t.clientX, t.clientY);
		s = "pointer";
		let d = l[0] ?? null, f = !1, p = Be() || o?.pin === !0;
		p && (V() ? (u = null, f = !0, o && D?.clear()) : d && (u = d.key, f = !0)), o && p && f && !u || H(l, f), r.definition.selection?.change(d, "pointer"), r.onSelect?.(d);
	}, Te = (e) => {
		if (Ae(e.target)) return;
		let t = B();
		if (e.key === "Escape" && D?.getState() || e.key === "Escape" && u) {
			e.preventDefault(), me();
			return;
		}
		if (r.definition.keyboard === !1 || t?.mode === "free") return;
		let n = Me();
		if (!n.length) return;
		if (e.key === "Enter" || e.key === " ") {
			if (!o) return;
			e.preventDefault();
			let n = o, i = Be() || t?.pin === !0;
			t?.mode === "focus" && i ? V() ? (u = null, D?.clear()) : (u = n.key, pe(G(n), !0)) : Be() && (u = u ? null : n.key, U(n, G(n))), r.definition.selection?.change(n, "keyboard"), r.onSelect?.(n);
			return;
		}
		let i = Di(r.definition.focus), a = i ? si(i.navigation(n), o, e.key) : ci(n, o, e.key);
		a !== void 0 && (e.preventDefault(), l = null, c = "keyboard", s = "keyboard", H(a ? G(a) : []));
	}, Ee = (e) => {
		if (Ae(e.target)) u || (l = null, H([]));
		else if (e.target === v?.element && w) w = !1;
		else if (r.definition.keyboard !== !1 && B()?.mode !== "free" && e.target === v?.element && !o) {
			let e = Di(r.definition.focus), t = Me(), n = e ? e.navigation(t)[0] : ci(t, null, "Home");
			l = null, c = "keyboard", s = "keyboard", H(n ? G(n) : []);
		}
	};
	return e.addEventListener("pointermove", be), e.addEventListener("pointerdown", xe), e.addEventListener("pointercancel", W), e.addEventListener("mouseleave", W), e.addEventListener("click", we), e.addEventListener("keydown", Te), e.addEventListener("focusin", Ee), e.addEventListener("focusout", Se), ne?.addEventListener?.("loadingdone", le), de(), re(), se(), e.ownerDocument.addEventListener("pointerdown", Ce, !0), {
		interaction: _e,
		update(e) {
			if (g) return;
			xi(e.definition.tooltip);
			let t = e.measureText === void 0 && L.refresh(), n = r.definition !== e.definition, i = r.height !== e.height || r.aspectRatio !== e.aspectRatio || r.width !== e.width || r.initialWidth !== e.initialWidth, a = r.idPrefix !== e.idPrefix || r.renderer !== e.renderer || r.measureText !== e.measureText || t, s = n || i || r.ariaLabel !== e.ariaLabel || r.ariaDescription !== e.ariaDescription || r.className !== e.className || r.tabIndex !== e.tabIndex || r.idPrefix !== e.idPrefix || r.renderer !== e.renderer || r.measureText !== e.measureText || t, d = r.width !== e.width || r.height !== e.height || r.aspectRatio !== e.aspectRatio, f = r.definition.pointer !== !1 && e.definition.pointer === !1 && c === "pointer";
			r = e, de(), Re(), f && (l = null, u = null, c = null, H([])), Be() || (u = null), s ? re(!1, a ? "layout" : i ? "resize" : "update") : B() ? fe(!1) : o && U(o, G(o)), d && se();
		},
		getScene: () => i,
		destroy() {
			g || (g = !0, d?.disconnect(), j?.(), j = void 0, D?.destroy(), D = void 0, O = void 0, k = void 0, A = void 0, ne?.removeEventListener?.("loadingdone", le), p !== void 0 && F?.cancelAnimationFrame?.(p), ze(), ke(), y?.(), y = void 0, v?.destroy(), n.destroy(), e.removeEventListener("pointermove", be), e.removeEventListener("pointerdown", xe), e.removeEventListener("pointercancel", W), e.removeEventListener("mouseleave", W), e.removeEventListener("click", we), e.removeEventListener("keydown", Te), e.removeEventListener("focusin", Ee), e.removeEventListener("focusout", Se), e.ownerDocument.removeEventListener("pointerdown", Ce, !0), e.replaceChildren(), te && e.style.position === "relative" && (e.style.position = P));
		}
	};
	function De() {
		let e = oe(), t = e.width ?? (_ ? i.width : r.initialWidth ?? 640);
		return n.render(r.definition, {
			width: t,
			height: r.height ?? (Si(r.aspectRatio) ? t / r.aspectRatio : e.height ?? (_ ? i.height : 320))
		}, {
			measureText: r.measureText ?? L.measureText,
			typography: L.typography()
		});
	}
	function Oe() {
		let t = /* @__PURE__ */ new Set();
		for (let n of i.controls ?? []) {
			let r = n.extension, a = `${r.id}:${n.key}`;
			t.add(a);
			let o = E.get(a);
			o && o.extension !== r && (o.instance.destroy(), E.delete(a), o = void 0), o || (o = {
				extension: r,
				instance: r.create({
					container: e,
					surface: v
				})
			}, E.set(a, o)), o.instance.update(n, i);
		}
		for (let [e, n] of E) t.has(e) || (n.instance.destroy(), E.delete(e));
	}
	function ke() {
		for (let e of E.values()) e.instance.destroy();
		E.clear();
	}
	function Ae(e) {
		for (let t of E.values()) if (t.instance.contains?.(e)) return !0;
		return !1;
	}
	function je(e, t, n) {
		let o = Me(), s = Di(r.definition.focus), c = ii(a, s, e, t, n, o);
		if (c) return c;
		let l = v?.getPresentationPoints?.() === void 0 ? T && a === i ? T.findNearest(e, t, n) : er(a, e, t, n, o) : sn(o, e, t, n), u = l ? oi(o, l) : null;
		return u ? [u] : [];
	}
	function Me() {
		let e = v?.getPresentationPoints?.() ?? a.points;
		return tr(i, e);
	}
	function G(e, t = Me()) {
		return Di(r.definition.focus)?.group(t, { point: e }) ?? [e];
	}
	function Ne() {
		y = v?.subscribePresentationPoints?.(Pe);
	}
	function Pe(e) {
		if (g || b || x) return;
		if (B()) {
			fe(!1);
			return;
		}
		let t = tr(i, e);
		if (l && u === null) {
			H(je(l.x, l.y, Fe()), !0);
			return;
		}
		if (!o) return;
		let n = oi(t, o);
		H(n ? G(n, t) : [], !0);
	}
	function Fe() {
		return r.definition.maxFocusDistance ?? 48;
	}
	function Ie(t, n) {
		let a = xi(r.definition.tooltip);
		if (!a || !t || !v) {
			C?.hide();
			return;
		}
		if (S !== a.extension || !C) {
			ze(), S = a.extension;
			let t = v.renderer.capabilities?.tooltipMotion;
			C = a.extension.create({
				container: e,
				motion: t?.protocol === 1 ? t.createController({
					container: e,
					transition: Le
				}) : void 0,
				dismiss: me,
				bodyChange: () => r.onTooltipBodyChange
			});
		}
		let o = C;
		o.update(a.options), o.paint({
			point: t,
			points: n,
			scene: i,
			surface: v,
			pointer: l,
			focus: {
				primary: t,
				group: n,
				source: s,
				pinned: V()
			},
			pinned: V()
		});
	}
	function Le() {
		let e = r.definition.motion;
		return e === !1 ? !1 : typeof e == "function" ? void 0 : e?.transition;
	}
	function Re() {
		let e = xi(r.definition.tooltip);
		e ? e.extension === S ? C?.update(e.options) : ze() : (C?.update(vi), C?.hide());
	}
	function ze() {
		C?.destroy(), C = void 0, S = void 0;
	}
	function Be() {
		let e = xi(r.definition.tooltip);
		return !!(e && e.options.sticky !== !1);
	}
	function Ve() {
		let e = xi(r.definition.tooltip)?.options.anchor;
		return e === "pointer" || typeof e == "function" || typeof e == "object" && (e.x === "pointer" || e.y === "pointer");
	}
}
var vi = {};
function yi(e) {
	let t = new Set((e.controls ?? []).flatMap((e) => e.fallbackNodeKey ? [e.fallbackNodeKey] : []));
	return t.size ? {
		...e,
		nodes: e.nodes.filter((e) => !t.has(e.key))
	} : e;
}
function bi(e) {
	return "position" in e && "point" in e && "points" in e;
}
function xi(e) {
	if (!e) return null;
	let t = "create" in e ? e : e.use;
	if (t.__chartTooltipHost !== "dom") throw TypeError("DOM chart hosts require a tooltip extension from @tanstack/charts/tooltip.");
	let n = t;
	return "create" in e ? {
		extension: n,
		options: vi
	} : {
		extension: n,
		options: e
	};
}
function Si(e) {
	return typeof e == "number" && Number.isFinite(e) && e > 0;
}
function Ci(e) {
	return Ti(e) ?? 0;
}
function wi(e, t, n, r, i) {
	let a = Si(n) ? Ti(e) : void 0, o = a === void 0 ? (n ?? 0) - r - i : a - (t === "border-box" ? r + i : 0);
	return Si(o) ? o : void 0;
}
function Ti(e) {
	let t = /^(-?(?:\d+(?:\.\d*)?|\.\d+))px$/i.exec(e?.trim() ?? "");
	if (!t) return;
	let n = Number(t[1]);
	return Number.isFinite(n) ? n : void 0;
}
function Ei(e) {
	return Si(e) ? e : void 0;
}
function Di(e) {
	return e === !1 ? Xr : ri(e);
}
function Oi(e, t) {
	return t.x >= e.chart.x && t.x <= e.chart.x + e.chart.width && t.y >= e.chart.y && t.y <= e.chart.y + e.chart.height;
}
function ki(e, t, n) {
	let r = e === !0 ? {} : e || void 0;
	if (!r || n === "layout" || n === "resize" && r.resize !== !0 || (r.respectReducedMotion ?? !0) && t.ownerDocument.defaultView?.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
	let { resize: i, ...a } = r;
	return a;
}
// node_modules/.bun/@tanstack+charts@0.18.0+74b9eec76f411c79/node_modules/@tanstack/charts/dist/reconcile.js
var Ai = /* @__PURE__ */ new Set([
	"cx",
	"cy",
	"d",
	"fill-opacity",
	"font-size",
	"font-weight",
	"fx",
	"fy",
	"height",
	"opacity",
	"r",
	"rx",
	"stroke-opacity",
	"stroke-width",
	"transform",
	"width",
	"x",
	"x1",
	"x2",
	"y",
	"y1",
	"y2"
]);
function ji(e, t, n) {
	let r = e.ownerDocument.createElement("template");
	r.innerHTML = t;
	let i = r.content.firstElementChild;
	if (!i) return () => {};
	let a = e.firstElementChild;
	if (!a || a.namespaceURI !== i.namespaceURI || a.localName !== i.localName) return e.replaceChildren(i), () => {};
	let o = [];
	return Ni(a, i, n ? o : void 0), n ? Li(e, o, n) : () => {};
}
function Mi(e, t, n) {
	let r = e.ownerDocument.createElement("template");
	r.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg">${t}</svg>`;
	let i = r.content.firstElementChild?.firstElementChild;
	if (!i) return () => {};
	if (e.namespaceURI !== i.namespaceURI || e.localName !== i.localName) return e.replaceWith(i), () => {};
	let a = [];
	return Ni(e, i, n ? a : void 0), n ? Li(e, a, n) : () => {};
}
function Ni(e, t, n) {
	if (Pi(e, t, n), !t.firstElementChild) {
		if (e.firstElementChild) for (let t of [...e.children]) n ? Ii(t, n) : t.remove();
		else e.textContent !== t.textContent && (e.textContent = t.textContent);
		return;
	}
	let r = [...e.children], i = [...t.children], a = Vi(r), o = Hi(i), s = /* @__PURE__ */ new Set(), c = e.firstElementChild;
	i.forEach((t, r) => {
		let i = o[r], l = a.get(i), u;
		l && l.namespaceURI === t.namespaceURI && l.localName === t.localName ? (u = l, s.add(l), u !== c && e.insertBefore(u, c), Ni(u, t, n)) : l && e.localName === "defs" ? (u = t.cloneNode(!0), l.replaceWith(u), l !== c && e.insertBefore(u, c)) : (u = t.cloneNode(!0), e.insertBefore(u, c), Fi(u, t, n)), c = u.nextElementSibling;
	});
	for (let t of r) !s.has(t) && t.parentElement === e && (n ? Ii(t, n) : t.remove());
}
function Pi(e, t, n) {
	let r = new Set(t.getAttributeNames());
	for (let t of e.getAttributeNames()) r.has(t) || e.removeAttribute(t);
	for (let i of r) {
		let r = t.getAttribute(i), a = e.getAttribute(i);
		if (r === a) continue;
		let o = n && a !== null && r !== null && Ai.has(i) ? zi(i, a, r) : void 0;
		o && n ? n.push({
			element: e,
			name: i,
			interpolate: o,
			target: r
		}) : r !== null && e.setAttribute(i, r);
	}
}
function Fi(e, t, n) {
	if (!n) return;
	let r = t.getAttribute("opacity"), i = r ?? "1";
	e.setAttribute("opacity", "0"), n.push({
		element: e,
		name: "opacity",
		interpolate: (e) => String(Number(i) * Math.max(0, Math.min(1, e))),
		target: r
	});
}
function Ii(e, t) {
	let n = Number(e.getAttribute("opacity") ?? 1), r = Number.isFinite(n) ? n : 1;
	t.push({
		element: e,
		name: "opacity",
		interpolate: (e) => String(r * (1 - e)),
		target: "0",
		removeOnFinish: !0
	});
}
function Li(e, t, n) {
	if (!t.length) return () => {};
	let r = e.ownerDocument.defaultView, i = r?.requestAnimationFrame?.bind(r), a = r?.cancelAnimationFrame?.bind(r), o = Math.max(0, n.duration ?? 240);
	if (!i || !a || o === 0) return Ri(t), () => {};
	let s = 0, c = !1, l, u = Ui(n.easing ?? "ease-out"), d = (e) => {
		if (c) return;
		l ??= e;
		let n = Math.min(1, (e - l) / o), r = u(n);
		for (let e of t) e.element.setAttribute(e.name, e.interpolate(r));
		n < 1 ? s = i(d) : Ri(t);
	};
	return s = i(d), () => {
		c = !0, a(s);
	};
}
function Ri(e) {
	for (let t of e) t.removeOnFinish ? t.element.remove() : t.target === null ? t.element.removeAttribute(t.name) : t.element.setAttribute(t.name, t.target);
}
function zi(e, t, n) {
	let r = e === "d", i = Bi(t, r), a = Bi(n, r);
	if (i.skeleton !== a.skeleton || i.values.length !== a.values.length || !i.values.length) return;
	let o = a.skeleton;
	return (e) => {
		let t = 0;
		return o.replaceAll(/[#!]/g, (n) => {
			let r = i.values[t], o = a.values[t];
			return t += 1, Wi(n === "!" ? o : r + (o - r) * e);
		});
	};
}
function Bi(e, t = !1) {
	let n = [], r = "", i = "", a = 0, o = 0;
	for (; o < e.length;) {
		let s = e.slice(o), c = a % 7, l = t && /a/i.test(i) && c > 2 && c < 5, u = l ? /^[01]/u.exec(s) : /^-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/iu.exec(s);
		if (u) {
			n.push(Number(u[0])), r += l ? "!" : "#", a += 1, o += u[0].length;
			continue;
		}
		let d = e[o];
		r += d, t && /[a-z]/i.test(d) && (i = d, a = 0), o += 1;
	}
	return {
		skeleton: r,
		values: n
	};
}
function Vi(e) {
	let t = /* @__PURE__ */ new Map();
	return Hi(e).forEach((n, r) => {
		t.set(n, e[r]);
	}), t;
}
function Hi(e) {
	let t = /* @__PURE__ */ new Map();
	return e.map((e) => {
		let n = e.getAttribute("data-ts-key");
		if (n) return `key:${n}`;
		let r = t.get(e.localName) ?? 0;
		return t.set(e.localName, r + 1), `tag:${e.localName}:${r}`;
	});
}
function Ui(e) {
	if (typeof e == "function") return e;
	switch (e) {
		case "linear": return (e) => e;
		case "ease-in": return (e) => e * e;
		case "ease-in-out": return (e) => e < .5 ? 2 * e * e : 1 - (-2 * e + 2) ** 2 / 2;
		case "ease":
		case "ease-out": return (e) => 1 - (1 - e) ** 3;
	}
}
function Wi(e) {
	return String(Math.round(e * 1e3) / 1e3);
}
// node_modules/.bun/@tanstack+charts@0.18.0+74b9eec76f411c79/node_modules/@tanstack/charts/dist/markup-internal.js
function X(e) {
	return String(Math.round(e * 100) / 100);
}
var Gi = {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	"\"": "&quot;"
}, Ki = /[&<>\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]|\p{Cs}/gu;
function qi(e) {
	return Gi[e] ?? "�";
}
function Ji(e) {
	return e.replace(Ki, qi);
}
function Z(e) {
	return e.replace(Ki, qi).replace(/"/g, Gi["\""]);
}
// node_modules/.bun/@tanstack+charts@0.18.0+74b9eec76f411c79/node_modules/@tanstack/charts/dist/svg-render-context-internal.js
var Yi = /* @__PURE__ */ new WeakMap();
function Xi(e) {
	return Yi.get(e);
}
function Zi(e, t, n) {
	let r = Yi.get(e);
	Yi.set(e, t);
	try {
		return n();
	} finally {
		r ? Yi.set(e, r) : Yi.delete(e);
	}
}
// node_modules/.bun/@tanstack+charts@0.18.0+74b9eec76f411c79/node_modules/@tanstack/charts/dist/svg-renderer.js
function Qi(e, t, n) {
	let r = t.idPrefix ?? "", i = t.className ? `ts-chart ${t.className}` : "ts-chart", a = t.ariaDescription ? `<desc>${Ji(t.ariaDescription)}</desc>` : "", o = n?.renderDefinitions?.(e, r) ?? "", s = e.direction === "ltr" || e.direction === "rtl" ? ` direction="${e.direction}"` : "", c = e.theme.background === "transparent" ? "" : na({
		kind: "rect",
		key: "background",
		x: 0,
		y: 0,
		width: e.width,
		height: e.height,
		style: { fill: e.theme.background }
	}, n, r);
	return `<svg class="${Z(i)}" width="100%" height="100%" viewBox="0 0 ${X(e.width)} ${X(e.height)}" role="img" aria-roledescription="chart" aria-label="${Z(t.ariaLabel)}" tabindex="${X(t.tabIndex ?? 0)}"${s} style="display:block;overflow:visible">${a}${o}${c}${$i(e.nodes, r, n, Xi(t))}</svg>`;
}
function $i(e, t = "", n, r) {
	let i = "";
	for (let a of e) i += na(a, n, t, r);
	return i;
}
function ea(e, t, n = "", r) {
	return `<g data-ts-key="focus-guide-layer:${t}" class="ts-chart__focus-guide-layer ts-chart__focus-guide-layer--${t}" data-ts-focus-layer="${t}" data-ts-focus-guide-layer="${t}" aria-hidden="true" visibility="${e.length ? "visible" : "hidden"}">${$i(e, n, r ?? ta)}</g>`;
}
var ta = { renderGroup: aa };
function na(e, t, n, r) {
	let i = sa(e, t, n);
	switch (e.kind) {
		case "group": {
			let a = e.translateX === void 0 && e.translateY === void 0 ? "" : ` transform="translate(${X(e.translateX ?? 0)} ${X(e.translateY ?? 0)})"`, o = t?.renderGroup?.(e, n);
			return `<g${i}${a}${e.focus ? ` data-ts-focus-layer="${e.focus.placement}"${e.focus.retarget ? " data-ts-focus-retarget=\"true\"" : ""} visibility="hidden"` : ""}${o?.attributes ?? ""}>${o?.content ?? ""}${$i(r?.(e) ?? e.children, n, t, r)}</g>`;
		}
		case "rule": return `<line${i} x1="${X(e.x1)}" y1="${X(e.y1)}" x2="${X(e.x2)}" y2="${X(e.y2)}"/>`;
		case "polyline": return `<path${i} d="${Z(e.path ?? ia(e.points, !1))}" vector-effect="non-scaling-stroke"/>`;
		case "area": {
			let t = e.polygons === void 0 ? e.path ?? ia(e.points, !0) : ra(e.polygons), n = e.polygons === void 0 ? "" : " fill-rule=\"evenodd\"";
			return `<path${i} d="${Z(t)}"${n} vector-effect="non-scaling-stroke"/>`;
		}
		case "dot": return `<circle${i} cx="${X(e.x)}" cy="${X(e.y)}" r="${X(e.radius)}"/>`;
		case "rect": return e.cornerRadii === void 0 ? `<rect${i} x="${X(e.x)}" y="${X(e.y)}" width="${X(e.width)}" height="${X(e.height)}"${e.radius === void 0 ? "" : ` rx="${X(e.radius)}"`}/>` : `<path${i} d="${Kt(e.x, e.y, e.width, e.height, e.cornerRadii)}"/>`;
		case "label": {
			let t = e.rotate === void 0 ? "" : ` transform="rotate(${X(e.rotate)} ${X(e.x)} ${X(e.y)})"`, n = e.anchor ? ` text-anchor="${e.anchor}"` : "", r = e.baseline ? ` dominant-baseline="${e.baseline}"` : "", a = e.fontSize === void 0 ? "" : ` font-size="${X(e.fontSize)}"`, o = e.fontWeight === void 0 ? "" : ` font-weight="${X(e.fontWeight)}"`;
			return `<text${i} x="${X(e.x)}" y="${X(e.y)}"${n}${r}${t}${a}${o} font-family="inherit">${Ji(e.text)}</text>`;
		}
	}
}
function ra(e) {
	return e.flatMap((e) => e).filter((e) => e.length > 0).map((e) => ia(e, !0)).join("");
}
function ia(e, t) {
	return `${e.map(([e, t], n) => `${n === 0 ? "M" : "L"}${X(e)},${X(t)}`).join("")}${t ? "Z" : ""}`;
}
function aa(e, t) {
	if (!e.clip) return;
	let n = t.replaceAll(/[^a-zA-Z0-9_-]/g, ""), r = `${n ? `${n}-` : ""}ts-chart-clip-${oa(e.key)}`;
	return {
		attributes: ` clip-path="url(#${r})"`,
		content: `<defs data-ts-key="${Z(`${e.key}:clip-defs`)}"><clipPath id="${r}"><rect x="${X(e.clip.x)}" y="${X(e.clip.y)}" width="${X(e.clip.width)}" height="${X(e.clip.height)}"/></clipPath></defs>`
	};
}
function oa(e) {
	let t = 2166136261;
	for (let n = 0; n < e.length; n += 1) t = Math.imul(t ^ e.charCodeAt(n), 16777619);
	return (t >>> 0).toString(36);
}
function sa(e, t, n) {
	return `${` data-ts-key="${Z(e.key)}"`}${e.className ? ` class="${Z(e.className)}"` : ""}${e.ariaHidden ? " aria-hidden=\"true\"" : ""}${ca(e.style, t, n)}`;
}
function ca(e, t, n) {
	return e ? Q("fill", la(e.fill, t, n)) + Q("fill-opacity", e.fillOpacity) + Q("stroke", la(e.stroke, t, n)) + Q("stroke-opacity", e.strokeOpacity) + Q("stroke-width", e.strokeWidth) + Q("opacity", e.opacity) + Q("stroke-linecap", e.lineCap) + Q("stroke-linejoin", e.lineJoin) + Q("stroke-dasharray", e.strokeDasharray) : "";
}
function la(e, t, n) {
	return e && t?.resolvePaint ? t.resolvePaint(e, n) : e;
}
function Q(e, t) {
	return t == null ? "" : ` ${e}="${typeof t == "number" ? X(t) : Z(t)}"`;
}
// node_modules/.bun/@tanstack+charts@0.18.0+74b9eec76f411c79/node_modules/@tanstack/charts/dist/svg.js
function ua(e, t) {
	let n = new Set(e.gradients.map((e) => e.id));
	return Qi(e, t, {
		renderDefinitions: (e, t) => da(e, pa(t)),
		renderGroup: aa,
		resolvePaint: n.size ? (e, t) => {
			let r = /^url\(#([^)]+)\)$/.exec(e)?.[1];
			return r && n.has(r) ? `url(#${fa(pa(t), r)})` : e;
		} : void 0
	});
}
function da(e, t) {
	return e.gradients.length ? `<defs data-ts-key="gradients">${e.gradients.map((e) => {
		let n = 0, r = e.stops.map((t, r) => {
			let i = Math.max(n, ma(t.offset));
			return n = i, `<stop data-ts-key="gradient:${Z(e.id)}:stop:${r}" offset="${$(i)}" stop-color="${Z(t.color)}"${t.opacity === void 0 ? "" : ` stop-opacity="${X(t.opacity)}"`}/>`;
		}).join("");
		if (e.type === "radial") {
			let n = e.cx ?? .5, i = e.cy ?? .5;
			return `<radialGradient data-ts-key="gradient:${Z(e.id)}" id="${Z(fa(t, e.id))}" cx="${$(n)}" cy="${$(i)}" r="${$(e.r ?? .5)}" fx="${$(e.fx ?? n)}" fy="${$(e.fy ?? i)}">${r}</radialGradient>`;
		}
		return `<linearGradient data-ts-key="gradient:${Z(e.id)}" id="${Z(fa(t, e.id))}" x1="${$(e.x1 ?? 0)}" y1="${$(e.y1 ?? 1)}" x2="${$(e.x2 ?? 0)}" y2="${$(e.y2 ?? 0)}">${r}</linearGradient>`;
	}).join("")}</defs>` : "";
}
function fa(e, t) {
	return e ? `${e}-${t}` : t;
}
function pa(e) {
	return e.replaceAll(/[^a-zA-Z0-9_-]/g, "");
}
function $(e) {
	return `${X(ma(e) * 100)}%`;
}
function ma(e) {
	return Number.isNaN(e) ? 0 : Math.max(0, Math.min(1, e));
}
// node_modules/.bun/@tanstack+charts@0.18.0+74b9eec76f411c79/node_modules/@tanstack/charts/dist/scene-point-ownership-internal.js
function ha(e) {
	let t = /* @__PURE__ */ new Map(), n = /* @__PURE__ */ new Map(), r = (e, t, n) => {
		let r = e.get(t);
		r ? r.push(n) : e.set(t, [n]);
	};
	for (let i of e) {
		r(n, i.markId, i);
		let e = i.key.length;
		for (; e > 0;) r(t, i.key.slice(0, e), i), e = i.key.lastIndexOf(":", e - 1);
	}
	return {
		points: e,
		keys: t,
		marks: n
	};
}
function ga(e, t, n, r = t) {
	if (e.kind === "group") {
		let n = e.focusCandidateIndex;
		if (n !== void 0 && Number.isInteger(n) && n >= 0) {
			let e = t[n];
			if (e) return [e];
		}
	}
	if (e.pointOwner) {
		let n = va(e.pointOwner, t);
		if (n.length) return n;
	}
	if ("interaction" in e && e.interaction) {
		let n = (e.interaction.point ? [e.interaction.point] : e.interaction.points).flatMap((e) => va(e, t));
		if (n.length) return n;
	}
	return _a(e.key, t, n, r);
}
function _a(e, t, n, r = t) {
	let i = (e) => e === void 0 ? [] : t === n.points ? e : e.filter((e) => t.includes(e)), a = i(n.keys.get(e)), o = a.filter((t) => t.key === e);
	if (o.length) return o;
	let s = e;
	for (; s.includes(":");) {
		let e = s.lastIndexOf(":");
		s = s.slice(0, e);
		let t = i(n.keys.get(s)).filter((e) => e.key === s);
		if (t.length) return t;
	}
	if (a.length) return a;
	let c = i(n.marks.get(e));
	return c.length ? c : r;
}
function va(e, t) {
	let n = t.filter((t) => t === e);
	if (n.length) return n;
	let r = t.filter((t) => t.key === e.key);
	if (r.length) return r;
	let i = t.filter((t) => Object.is(t.datum, e.datum) && (ya(e.datum) || t.datumIndex === e.datumIndex));
	return i.length === 1 ? i : [];
}
function ya(e) {
	return typeof e == "object" && !!e || typeof e == "function";
}
// node_modules/.bun/@tanstack+charts@0.18.0+74b9eec76f411c79/node_modules/@tanstack/charts/dist/focus-layer.js
var ba = [];
function xa(e, t, n, r) {
	let i = [], a = [];
	if (!r && !t) return {
		under: i,
		over: a
	};
	for (let o of e.focusGuides ?? []) {
		let s = t && La(o, t) ? t : null;
		if (!r && t && !s) continue;
		let c = o.resolve({
			scene: e,
			guide: o,
			focus: s,
			pointer: n,
			cursor: r
		});
		c && (o.placement === "under" ? i : a).push(c);
	}
	return {
		under: i,
		over: a
	};
}
function Sa(e, t) {
	if (!t) return {
		scene: e,
		retargeted: !1
	};
	let n = !1, r = (e) => e.map((e) => {
		if (e.kind !== "group") return e;
		if (e.focus?.retarget) {
			let r = e.focus.points.filter((n) => ja(n, t, e.focus.match)), i = ha(e.focus.points), a = Oa(Da(e.focus.candidates ?? e.children, r, e.focus.points, i), r, e.focus.points, i, e.key);
			return a.length ? (n = !0, {
				...e,
				focus: {
					...e.focus,
					activePoints: r
				},
				children: a
			}) : e;
		}
		let i = r(e.children);
		return i.some((t, n) => t !== e.children[n]) ? {
			...e,
			children: i
		} : e;
	}), i = r(e.nodes);
	return n ? {
		scene: {
			...e,
			nodes: i
		},
		retargeted: n
	} : {
		scene: e,
		retargeted: n
	};
}
function Ca(e, t) {
	if (!e.focus || !t) return /* @__PURE__ */ new Set();
	let n = /* @__PURE__ */ new Set();
	return Ia(wa(e, t), (e) => n.add(e.key)), n;
}
function wa(e, t) {
	let n = e.focus;
	if (n.retarget) return e.children;
	if (n.anchors) {
		let r = n.anchors.filter((e) => ja(e, t, n.match));
		return Ea(e.children, r);
	}
	let r = n.points.filter((e) => ja(e, t, n.match));
	return Ta(e.children, r, n.points);
}
function Ta(e, t, n) {
	return Da(e, t, n, ha(n));
}
function Ea(e, t) {
	let n = [];
	for (let r of e) {
		if (r.kind !== "group") {
			t.some((e) => Na(r.key, e.key)) && n.push(r);
			continue;
		}
		let e = Ea(r.children, t);
		e.length ? n.push({
			...r,
			children: e
		}) : t.some((e) => e.key.startsWith(`${r.key}:`)) && n.push(r);
	}
	return n;
}
function Da(e, t, n, r) {
	let i = [];
	for (let a of e) {
		if (a.kind !== "group") {
			ga(a, n, r, ba).some((e) => t.includes(e)) && i.push(a);
			continue;
		}
		let e = Aa(a, n);
		if (e) {
			t.includes(e) && i.push(a);
			continue;
		}
		let o = ka(a, n, r);
		if (o.length) {
			o.some((e) => t.includes(e)) && i.push(a);
			continue;
		}
		let s = ga(a, n, r, ba), c = s.length ? s : n, l = Da(a.children, t, c, r);
		l.length && i.push({
			...a,
			children: l
		});
	}
	return i;
}
function Oa(e, t, n, r, i) {
	let a = new Map(t.map((e, t) => [e, t])), o = (e, t) => {
		let s = ga(e, n, r, ba).filter((e) => a.has(e)), c = s.length === 1 ? s[0] : void 0, l = e.key;
		if (c && e.key !== c.markId) {
			let n = `${i}:selection:${a.get(c) ?? 0}`;
			l = e.key === c.key ? n : e.key.startsWith(`${c.key}:`) ? `${n}${e.key.slice(c.key.length)}` : c.key.startsWith(`${e.key}:`) ? `${n}:ancestor:${t}` : `${n}:node:${t}`;
		}
		return e.kind === "group" ? {
			...e,
			key: l,
			children: e.children.map((e, n) => o(e, `${t}:${n}`))
		} : {
			...e,
			key: l
		};
	};
	return e.map((e, t) => o(e, String(t)));
}
function ka(e, t, n) {
	let r = Aa(e, t);
	if (r) return [r];
	if (e.pointOwner) {
		let r = ga(e, t, n, ba);
		if (r.length) return r;
	}
	let i = n.keys.get(e.key)?.filter((t) => t.key === e.key);
	return i === void 0 ? ba : i.filter((e) => t.includes(e));
}
function Aa(e, t) {
	let n = e.focusCandidateIndex;
	if (!(n === void 0 || !Number.isInteger(n) || n < 0)) return t[n];
}
function ja(e, t, n) {
	return n === "x" ? e.xValue !== void 0 && Pa(e.xValue, t.primary.xValue) : n === "y" ? e.yValue !== void 0 && Pa(e.yValue, t.primary.yValue) : n === "series" ? Pa(e.group, t.primary.group) : n === "key" ? e.key === t.primary.key || e.datum === t.primary.datum : n === "group" ? t.group.some((t) => Ma(e, t)) : Ma(e, t.primary);
}
function Ma(e, t) {
	return e === t || e.key === t.key ? !0 : Object.is(e.datum, t.datum) ? Fa(e.datum) || e.datumIndex === t.datumIndex : !1;
}
function Na(e, t) {
	return e === t || e.startsWith(`${t}:`) || t.startsWith(`${e}:`);
}
function Pa(e, t) {
	return K(e) === K(t);
}
function Fa(e) {
	return typeof e == "object" && !!e || typeof e == "function";
}
function Ia(e, t) {
	for (let n of e) t(n), n.kind === "group" && Ia(n.children, t);
}
function La(e, t) {
	return e.scope === void 0 || t.primary.key === e.scope || t.primary.key.startsWith(`${e.scope}:`);
}
// node_modules/.bun/@tanstack+charts@0.18.0+74b9eec76f411c79/node_modules/@tanstack/charts/dist/svg-focus-guide-serializer.js
function Ra(e, t, n, r, i, a) {
	let o = Ga(e.ownerDocument, i({
		...t,
		nodes: [n]
	}, r)), s = o && qa(o, n.key);
	if (!o || !s || s.localName !== "g") throw Error(`The SVG renderer must preserve a g[data-ts-key="${n.key}"] element when serializing focus guides.`);
	return a && (s.classList.add("ts-chart__focus-guide-layer", `ts-chart__focus-guide-layer--${a}`), s.setAttribute("data-ts-focus-layer", a), s.setAttribute("data-ts-focus-guide-layer", a), s.setAttribute("aria-hidden", "true"), s.setAttribute("visibility", n.children.length ? "visible" : "hidden"), Ba(e.ownerDocument, s, n.children, a, r.idPrefix ?? "")), Va(e, o, s, n.key), s.outerHTML;
}
function za(e, t, n, r, i, a) {
	let o = {
		kind: "group",
		key: `focus-guide-layer:${r}`,
		className: `ts-chart__focus-guide-layer ts-chart__focus-guide-layer--${r}`,
		ariaHidden: !0,
		children: n
	};
	return Ra(e, {
		...t,
		focusGuides: void 0
	}, o, i, a, r);
}
function Ba(e, t, n, r, i) {
	let a = Ka(e, ea(n, r, i));
	if (a) for (let e of Ja(a)) {
		let n = e.getAttribute("clip-path"), r = e.getAttribute("data-ts-key");
		if (!n || !r) continue;
		let i = qa(t, r);
		if (!i || i.hasAttribute("clip-path")) continue;
		i.setAttribute("clip-path", n);
		let o = qa(a, `${r}:clip-defs`);
		o && i.insertBefore(o.cloneNode(!0), i.firstChild);
	}
}
function Va(e, t, n, r) {
	let i = [...Ua(n)], a = /* @__PURE__ */ new Set(), o;
	for (; i.length;) {
		let s = i.shift();
		if (!s || a.has(s) || (a.add(s), Wa(n, s) || Ha(e, s))) continue;
		let c = Wa(t, s);
		if (!c) continue;
		o || (o = e.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "defs"), o.setAttribute("data-ts-key", `${r}:renderer-defs`), n.insertBefore(o, n.firstChild));
		let l = c.cloneNode(!0);
		o.append(l), i.push(...Ua(l));
	}
}
function Ha(e, t) {
	let n = Wa(e, t);
	return n?.closest("[data-ts-focus-guide-layer]") ? void 0 : n;
}
function Ua(e) {
	let t = /* @__PURE__ */ new Set();
	for (let n of [e, ...e.querySelectorAll("*")]) for (let e of n.attributes) {
		for (let n of e.value.matchAll(/url\(#([^)]+)\)/g)) n[1] && t.add(n[1]);
		(e.localName === "href" || e.name === "xlink:href") && e.value.startsWith("#") && t.add(e.value.slice(1));
	}
	return t;
}
function Wa(e, t) {
	return [...e.getAttribute("id") === t ? [e] : [], ...e.querySelectorAll("[id]")].find((e) => e.getAttribute("id") === t);
}
function Ga(e, t) {
	let n = e.createElement("template");
	n.innerHTML = t.trim();
	let r = n.content.firstElementChild;
	return r?.localName === "svg" ? r : void 0;
}
function Ka(e, t) {
	let n = e.createElement("template");
	return n.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg">${t}</svg>`, n.content.firstElementChild?.firstElementChild ?? void 0;
}
function qa(e, t) {
	return Ja(e).find((e) => e.getAttribute("data-ts-key") === t);
}
function Ja(e) {
	return [...e.hasAttribute("data-ts-key") ? [e] : [], ...e.querySelectorAll("[data-ts-key]")];
}
// node_modules/.bun/@tanstack+charts@0.18.0+74b9eec76f411c79/node_modules/@tanstack/charts/dist/svg-focus-guide-layer.js
function Ya(e) {
	let t = {};
	if (!e) return t;
	for (let n of ["under", "over"]) {
		let r = eo(e, n);
		r && (t[n] = r, r.remove());
	}
	return t;
}
function Xa(e, t, n = () => !0) {
	for (let r of ["under", "over"]) {
		let i = t[r];
		i && n(r) && $a(e, i, r);
	}
}
function Za(e, t) {
	let n = eo(e, t);
	if (n) return n;
	let r = e.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "g");
	return r.dataset.tsKey = `focus-guide-layer:${t}`, r.dataset.tsFocusLayer = t, r.dataset.tsFocusGuideLayer = t, r.setAttribute("class", `ts-chart__focus-guide-layer ts-chart__focus-guide-layer--${t}`), r.setAttribute("aria-hidden", "true"), r.setAttribute("visibility", "hidden"), $a(e, r, t), r;
}
function Qa(e, t) {
	eo(e, t)?.remove();
}
function $a(e, t, n) {
	if (n === "under") {
		let n = [...e.children].find((e) => e.getAttribute("data-ts-key") === "grid" || e.getAttribute("data-ts-key") === "marks" || e.classList.contains("ts-chart__grid") || e.classList.contains("ts-chart__marks"));
		e.insertBefore(t, n ?? null);
	} else e.append(t);
}
function eo(e, t) {
	return [...e.children].find((e) => e.localName === "g" && e.getAttribute("data-ts-focus-guide-layer") === t);
}
// node_modules/.bun/@tanstack+charts@0.18.0+74b9eec76f411c79/node_modules/@tanstack/charts/dist/mark-state.js
function to(e, t, n = null) {
	if (!t || !no(e.nodes)) return { scene: e };
	let r, i = {}, a = (e, o, s, c, l) => e.map((e) => {
		let u = e.kind === "group" ? e.states : void 0, d = u?.points ?? o, f = u?.definitions ?? s, p = u?.data ?? c, m = u ? ha(u.points) : l, h = d ? m ? ga(e, d, m) : d : lo, g = e.kind !== "group" && f && p && h.length ? ro(e, h, p, f, t, n) : { node: e };
		if (g.transition) {
			r = uo(r, g.transition);
			for (let e of h) i[e.markId] = uo(i[e.markId], g.transition);
		}
		let _ = g.node;
		return _.kind === "group" ? {
			..._,
			children: a(_.children, h.length ? h : d, f, p, m)
		} : _;
	}), o = a(e.nodes);
	return {
		scene: {
			...e,
			nodes: o
		},
		transition: r,
		...Object.keys(i).length ? { transitions: i } : {}
	};
}
function no(e) {
	return e.some((e) => e.kind === "group" && (e.states !== void 0 || no(e.children)));
}
function ro(e, t, n, r, i, a) {
	let o = e, s;
	for (let e of r) {
		let r = io(t, n, e, i, a);
		r && (o = oo(o, e.style, r), e.transition && (s = uo(s, e.transition)));
	}
	return {
		node: o,
		transition: s
	};
}
function io(e, t, n, r, i) {
	if (!(typeof n.when != "function" && n.when.focus === "unmatched" && e.some((e) => ja(e, r, "group")))) for (let a of e) {
		let e = {
			datum: a.datum,
			index: a.datumIndex,
			data: t,
			point: a,
			focus: r,
			pointer: i,
			matches: (e) => ja(a, r, e)
		};
		if (typeof n.when == "function" ? n.when(e) : ao(n.when, e)) return e;
	}
}
function ao(e, t) {
	let n = e.source;
	return n !== void 0 && !(Array.isArray(n) ? n.includes(t.focus.source) : n === t.focus.source) || e.pinned !== void 0 && e.pinned !== t.focus.pinned ? !1 : e.focus === "unmatched" ? !t.matches("group") : t.matches(e.focus);
}
function oo(e, t, n) {
	let r = { ...e.style };
	for (let e of so) {
		let i = co(t[e], n);
		i !== void 0 && (r[e] = i);
	}
	let i = {
		...e,
		style: r
	}, a = co(t.dx, n) ?? 0, o = co(t.dy, n) ?? 0, s = co(t.r, n), c = co(t.radius, n), l = co(t.inset, n), u = co(t.fontSize, n), d = co(t.fontWeight, n), f = co(t.rotate, n);
	switch (i.kind) {
		case "dot":
			i = {
				...i,
				x: i.x + a,
				y: i.y + o,
				radius: s ?? i.radius
			};
			break;
		case "rect": {
			let e = i.inset ?? 0, t = Math.max(0, l ?? e);
			if (Number.isFinite(i.maxThickness) && (i.insetAxis === "x" || i.insetAxis === "y")) {
				let n = (i.insetAxis === "x" ? i.width : i.height) + e * 2, r = Math.max(0, n - t * 2);
				t = (n - Math.min(r, Math.max(0, i.maxThickness))) / 2;
			}
			let n = t - e, r = i.insetAxis === "y" ? 0 : n, s = i.insetAxis === "x" ? 0 : n, u = Math.max(0, i.width - r * 2), d = Math.max(0, i.height - s * 2), f = i.cornerRadii !== void 0, p = c === void 0 ? i.cornerRadii : typeof c == "number" ? f ? [
				c,
				c,
				c,
				c
			] : void 0 : c;
			i = {
				...i,
				x: i.x + r + a,
				y: i.y + s + o,
				width: u,
				height: d,
				radius: c === void 0 ? i.radius : typeof c == "number" && !f ? c : void 0,
				cornerRadii: p,
				inset: t
			};
			break;
		}
		case "label": i = {
			...i,
			x: i.x + a,
			y: i.y + o,
			fontSize: u ?? i.fontSize,
			fontWeight: d ?? i.fontWeight,
			rotate: f ?? i.rotate
		};
	}
	return i;
}
var so = [
	"fill",
	"fillOpacity",
	"stroke",
	"strokeOpacity",
	"strokeWidth",
	"opacity",
	"strokeDasharray"
];
function co(e, t) {
	return typeof e == "function" ? e(t) : e;
}
var lo = [];
function uo(e, t) {
	return !e || e.type !== t.type ? t : e.type === "spring" && t.type === "spring" ? {
		...e,
		...t
	} : e.type !== "tween" || t.type !== "tween" ? t : {
		...e,
		...t,
		duration: Math.max(e.duration ?? 250, t.duration ?? 250)
	};
}
// node_modules/.bun/@tanstack+charts@0.18.0+74b9eec76f411c79/node_modules/@tanstack/charts/dist/mark-state-transition.js
function fo(e, t) {
	if (!e || e.type !== "tween" || (e.respectReducedMotion ?? !0) && t.ownerDocument.defaultView?.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
	let { type: n, ...r } = e;
	return r;
}
// node_modules/.bun/@tanstack+charts@0.18.0+74b9eec76f411c79/node_modules/@tanstack/charts/dist/svg-coordinates.js
function po(e, t, n, r) {
	let i = e.getScreenCTM?.();
	if (!i) {
		let i = e.getBoundingClientRect();
		return !i.width || !i.height ? null : {
			x: (n - i.left) / i.width * t.width,
			y: (r - i.top) / i.height * t.height
		};
	}
	let a;
	try {
		a = i.inverse();
	} catch {
		return null;
	}
	let o = a.a * n + a.c * r + a.e, s = a.b * n + a.d * r + a.f;
	return !Number.isFinite(o) || !Number.isFinite(s) ? null : {
		x: o,
		y: s
	};
}
// node_modules/.bun/@tanstack+charts@0.18.0+74b9eec76f411c79/node_modules/@tanstack/charts/dist/svg-surface.js
function mo(e = ua) {
	let t = {
		id: "svg",
		prerender: (t, n) => go(t, n, null, e),
		mount(n) {
			let r = () => {}, i = () => {}, a, o, s, c = !1, l = !1, u = null, d = !1, f = () => {
				let e = n.querySelector("svg.ts-chart");
				if (!e) throw Error("The SVG renderer must produce an svg.ts-chart root element.");
				return e;
			}, p = () => {
				d || (d = !0, a && o && ho(f(), a, u, o, e, "all"));
			};
			return {
				renderer: t,
				get element() {
					return f();
				},
				render(t, m) {
					let h = !!(a && zn(a, t));
					m.animation && p(), r(), i(), i = () => {};
					let g = !!a?.focusGuides?.length, _ = g ? Ya(f()) : {};
					r = ji(n, d ? e(t, m) : go(t, m, u, e), h ? void 0 : m.animation), g && Xa(f(), _, (e) => t.focusGuides?.some((t) => t.placement === e) === !0), a = t, o = m, s = void 0, c = !1, l = !1;
				},
				clientToScene(e, t, n) {
					return po(f(), e, t, n);
				},
				paintFocus(t, m, h) {
					if (!a || !o) return;
					let g = to(a, t, m), _ = Sa(g.scene, t), v = s, y = fo(g.transition ?? v, n);
					if (y && p(), _.scene !== a || c || l || v) {
						i(), i = () => {};
						let a = Ya(f());
						r(), r = ji(n, d ? e(_.scene, o) : go(_.scene, o, t, e), y), Xa(f(), a);
					}
					return l = _.retargeted, c = !!(t && g.scene !== a), s = t ? g.transition ?? v : void 0, u = t, ho(f(), _.scene, t, o, e, !d), i(), i = _o(f(), _.scene, t, m, h, o, e), _.scene;
				},
				destroy() {
					r(), i();
				}
			};
		}
	};
	return t;
}
function ho(e, t, n, r, i, a) {
	let o = vo(t.nodes);
	e.querySelectorAll("[data-ts-focus-layer]:not([data-ts-focus-guide-layer])").forEach((s, c) => {
		let l = o[c];
		if (l && a && Wn(l)) {
			let o = a === "all" ? l.children : n ? wa(l, n) : [], c = [...s.children].filter((e) => e.localName === "circle");
			(c.length !== o.length || c.some((e, t) => e.getAttribute("data-ts-key") !== o[t]?.key)) && Mi(s, Ra(e, t, {
				...l,
				children: o
			}, r, i));
		}
		let u = l ? Ca(l, n) : /* @__PURE__ */ new Set();
		s.setAttribute("visibility", n && u.size ? "visible" : "hidden"), s.querySelectorAll("[data-ts-key]").forEach((e) => {
			let t = e.dataset.tsKey;
			e.setAttribute("visibility", t && u.has(t) ? "visible" : "hidden");
		});
	});
}
function go(e, t, n, r) {
	return Zi(t, (e) => Wn(e) ? n ? wa(e, n) : [] : void 0, () => r(e, t));
}
function _o(e, t, n, r, i, a, o) {
	let s = xa(t, n, r, i), c = [];
	for (let n of ["under", "over"]) {
		if (!t.focusGuides?.some((e) => e.placement === n)) {
			Qa(e, n);
			continue;
		}
		let r = Za(e, n), i = s[n];
		if (!i.length) {
			r.setAttribute("visibility", "hidden");
			continue;
		}
		let l = o === ua ? ea(i, n, a.idPrefix ?? "") : za(e, t, i, n, a, o);
		c.push(Mi(r, l));
	}
	return () => c.forEach((e) => e());
}
function vo(e) {
	let t = [];
	for (let n of e) n.kind === "group" && (n.focus ? t.push(n) : t.push(...vo(n.children)));
	return t;
}
// node_modules/.bun/@tanstack+charts@0.18.0+74b9eec76f411c79/node_modules/@tanstack/charts/dist/adapter-renderer.js
function yo(e) {
	let t = zr(), n = e, r, i = () => t ??= zr();
	return {
		prerender() {
			let e = Vr(n), t = i().render(n.definition, {
				width: e.initialWidth,
				height: e.initialHeight
			}, { measureText: n.measureText });
			return pi(t, n.renderer).prerender(t, {
				ariaLabel: n.ariaLabel,
				ariaDescription: n.ariaDescription,
				className: n.className,
				tabIndex: Hr(n.definition, n.tabIndex),
				idPrefix: n.idPrefix
			});
		},
		mount(e) {
			if (r) throw Error("This chart adapter is already mounted.");
			r = _i(e, n, i());
		},
		update(e) {
			n = e, r?.update(e);
		},
		getScene() {
			return r?.getScene();
		},
		destroy() {
			r ? (r.destroy(), r = void 0, t = void 0) : t &&= (t.destroy(), void 0);
		}
	};
}
// node_modules/.bun/@tanstack+charts@0.18.0+74b9eec76f411c79/node_modules/@tanstack/charts/dist/rect-radius-state-internal.js
function bo(e) {
	return e?.some(({ style: e }) => {
		let t = e.radius;
		return typeof t == "function" || Array.isArray(t);
	}) ?? !1;
}
function xo(e, t) {
	return e === void 0 ? t ? { cornerRadii: [
		0,
		0,
		0,
		0
	] } : {} : typeof e == "number" ? t ? { cornerRadii: [
		e,
		e,
		e,
		e
	] } : { radius: e } : { cornerRadii: e };
}
// node_modules/.bun/@tanstack+charts@0.18.0+74b9eec76f411c79/node_modules/@tanstack/charts/dist/scene-motion-internal.js
var So = /* @__PURE__ */ Symbol("scene-motion-node");
// node_modules/.bun/@tanstack+charts@0.18.0+74b9eec76f411c79/node_modules/@tanstack/charts/dist/stack-ends-internal.js
function Co(e, t, n, r, i, a = {}, o = "value") {
	let s = Eo(e, t, n, r, i, o), c = Do(s, a.order);
	a.reverse && c.reverse();
	let l = new Map(c.map((e, t) => [K(e), t])), u = [...s].sort((e, t) => l.get(K(e.series)) - l.get(K(t.series))), d = Array.from({ length: e.length }), f = wo(s), p = wo(u), m = a.offset === void 0 || a.offset === "diverging";
	for (let [e, t] of p) {
		let n = f.get(e);
		if (m) {
			let e = Math.min(...t.flatMap((e) => [e.start, e.end]));
			Math.max(...t.flatMap((e) => [e.start, e.end])) > 0 && To(t, n, "max", d), e < 0 && To(t, n, "min", d);
		} else {
			let e = t[0].start, r = t.at(-1).end, i;
			if (r < e) i = "min";
			else if (r > e) i = "max";
			else {
				let n = Math.min(...t.flatMap((e) => [e.start, e.end])), r = Math.max(...t.flatMap((e) => [e.start, e.end]));
				i = e - n > r - e ? "min" : "max";
			}
			To(t, n, i, d);
		}
	}
	return d;
}
function wo(e) {
	let t = /* @__PURE__ */ new Map();
	for (let n of e) {
		if (n.value === 0 || n.start === n.end) continue;
		let e = K(n.position), r = t.get(e);
		r ? r.push(n) : t.set(e, [n]);
	}
	return t;
}
function To(e, t, n, r) {
	if (e.length === 0) return;
	let i = Math[n](...e.flatMap((e) => [e.start, e.end]));
	for (let e of t) {
		let t = e.start === i, n = e.end === i;
		if (!t && !n) continue;
		let a = r[e.index];
		r[e.index] = {
			start: a?.start === !0 || t,
			end: a?.end === !0 || n
		};
	}
}
function Eo(e, t, n, r, i, a) {
	let o = [];
	for (let s = 0; s < e.length; s += 1) {
		let c = e[s], l = t[s], u = r[s], d = i[s];
		if (!ko(c) || !Ao(l) || !Ao(u) || !Ao(d)) continue;
		let f = n[s];
		o.push({
			index: s,
			position: c,
			value: l,
			start: u,
			end: d,
			series: Oo(f) ? f : a === "index" ? s : "value"
		});
	}
	return o;
}
function Do(e, t) {
	let n = [], r = /* @__PURE__ */ new Set();
	for (let t of e) {
		let e = K(t.series);
		r.has(e) || (r.add(e), n.push(t.series));
	}
	if (Array.isArray(t)) {
		let e = [...t], r = new Set(e.map(K));
		return [...e, ...n.filter((e) => !r.has(K(e)))];
	}
	if (t === "inside-out") {
		let t = [], r = /* @__PURE__ */ new Map();
		for (let n of e) {
			let e = K(n.position);
			r.has(e) || (r.set(e, t.length), t.push(n.position));
		}
		return at(n.map((n) => {
			let i = K(n), a = t.map(() => [0, 0]);
			for (let t of e) K(t.series) === i && (a[r.get(K(t.position))][1] = t.value);
			return a;
		})).map((e) => n[e]);
	}
	if (t !== "ascending" && t !== "descending") return n;
	let i = new Map(n.map((e) => [K(e), 0]));
	for (let t of e) {
		let e = K(t.series);
		i.set(e, (i.get(e) ?? 0) + Math.abs(t.value));
	}
	return n.sort((e, n) => {
		let r = (i.get(K(e)) ?? 0) - (i.get(K(n)) ?? 0);
		return t === "ascending" ? r : -r;
	});
}
function Oo(e) {
	return typeof e == "string" || typeof e == "number";
}
function ko(e) {
	return typeof e == "string" || Ao(e) || e instanceof Date && Number.isFinite(e.getTime());
}
function Ao(e) {
	return typeof e == "number" && Number.isFinite(e);
}
// node_modules/.bun/@tanstack+charts@0.18.0+74b9eec76f411c79/node_modules/@tanstack/charts/dist/bar.js
function jo(e, t = {}) {
	let n = Array.isArray(e) ? e : Array.from(e), r = t.xScale ?? "x", i = t.yScale ?? "y", a = typeof t.radius == "function" || bo(t.states);
	return Ge(({ markIndex: e }) => {
		let o = t.id ?? `bar-y-${e}`, s = Ze(n, t.x, (e, { index: t }) => t), c = Vo(n, t.y ?? t.y2, (e) => typeof e == "number" ? e : void 0), l = Ze(n, t.z, () => null), u = t.color === void 0 ? l : Ze(n, t.color, () => null), d = t.z === void 0 && t.color !== void 0 ? u : l, f = t.y1 !== void 0 || t.y2 !== void 0;
		if (f && t.layout?.type === "stack") throw TypeError("A bar with explicit y1 or y2 endpoints cannot also configure a stack layout");
		let p = t.layout?.type === "group";
		No(t.radius, f, p, "y");
		let m = t.layout?.type === "stack" ? t.layout : void 0, h = Fo(t.radius) ? t.radius : void 0, g = m?.offset === void 0 || m.offset === "diverging", _ = !f && !p ? dt(s, c, d, m, "index") : void 0, v = _ && h && (h.stack ?? "outer") === "outer" ? Co(s, c, d, _.starts, _.ends, m, "index") : void 0, y = f ? Vo(n, t.y1, () => 0) : _?.starts ?? n.map(() => 0), b = f ? Vo(n, t.y2 ?? t.y, () => void 0) : p ? c : _.ends, x = zo(s), S = p || !f && x ? d : l, C = Qe(n, t.key, {
			groups: S,
			candidates: [s],
			markId: o,
			warningIdentity: t
		});
		return {
			id: o,
			states: Ye(n, t.states),
			seriesFromColor: t.z === void 0 && t.color !== void 0 && (p || x),
			channels: {
				x: {
					scale: r,
					values: s.filter(We)
				},
				y: {
					scale: i,
					values: [...b.filter(q), ...y.filter(q)],
					includeZero: t.y1 === void 0
				},
				color: {
					scale: "color",
					values: u.filter(Le)
				}
			},
			render: ({ scales: e, chart: l, color: d }) => {
				let f = e[r].bandwidth || Bo(e[r], s, l.width, n.length), p = Ro(t.layout?.type === "group" ? t.layout : void 0, S, f), m = p?.bandwidth ?? f, h = Lo(m, t.inset, t.maxThickness), x = [];
				return n.forEach((l, w) => {
					let T = s[w], E = c[w], D = y[w], O = b[w];
					if (!We(T) || !q(E) || !q(D) || !q(O)) return;
					let k = S[w] ?? null, A = p?.map(k) ?? 0, ee = d(u[w]), j = Xe(t.fill, l, w, n, ee), M = Xe(t.stroke, l, w, n, "none"), N = Xe(t.strokeDasharray, l, w, n, "none"), P = e[r].map(T), F = e[i].map(D), I = e[i].map(O), te = _ && g && E < 0 ? "start" : "end", L = te === "start" ? F : I, ne = te === "start" ? I : F, re = v?.[w], R = P - f / 2 + A + h.inset, ie = Math.min(F, I), ae = h.size, oe = Math.abs(F - I), z = `${o}:${K(k)}:${K(C[w])}`, se = Po(t.radius, l, w, n, "y", L, ne, v !== void 0, re, F, I, a), ce = {
						key: z,
						markId: o,
						group: k,
						groupLabel: k == null ? o : String(k),
						datum: l,
						datumIndex: w,
						xValue: T,
						yValue: E,
						y1Value: D,
						y2Value: O,
						yInterval: "difference",
						x: P - f / 2 + A + m / 2,
						y: L,
						color: j
					}, le = {
						kind: "rect",
						key: z,
						x: R,
						y: ie,
						width: ae,
						height: oe,
						...se,
						inset: h.inset,
						insetAxis: "x",
						...h.maximum === void 0 ? {} : { maxThickness: h.maximum },
						interaction: {
							point: ce,
							affinity: "x"
						},
						style: {
							fill: j,
							fillOpacity: t.fillOpacity,
							stroke: M,
							strokeOpacity: t.strokeOpacity,
							strokeWidth: t.strokeWidth,
							strokeDasharray: N
						},
						[So]: { bar: { baseline: ne } }
					};
					x.push(le);
				}), { nodes: [{
					kind: "group",
					key: o,
					className: "ts-chart__bar ts-chart__bar-y",
					ariaHidden: !0,
					children: x
				}] };
			}
		};
	}, t.motion, t.renderer);
}
function Mo(e, t = {}) {
	let n = Array.isArray(e) ? e : Array.from(e), r = t.xScale ?? "x", i = t.yScale ?? "y", a = typeof t.radius == "function" || bo(t.states);
	return Ge(({ markIndex: e }) => {
		let o = t.id ?? `bar-x-${e}`, s = Vo(n, t.x ?? t.x2, (e) => typeof e == "number" ? e : void 0), c = Ze(n, t.y, (e, { index: t }) => t), l = Ze(n, t.z, () => null), u = t.color === void 0 ? l : Ze(n, t.color, () => null), d = t.z === void 0 && t.color !== void 0 ? u : l, f = t.x1 !== void 0 || t.x2 !== void 0;
		if (f && t.layout?.type === "stack") throw TypeError("A bar with explicit x1 or x2 endpoints cannot also configure a stack layout");
		let p = t.layout?.type === "group";
		No(t.radius, f, p, "x");
		let m = t.layout?.type === "stack" ? t.layout : void 0, h = Fo(t.radius) ? t.radius : void 0, g = m?.offset === void 0 || m.offset === "diverging", _ = !f && !p ? dt(c, s, d, m, "index") : void 0, v = _ && h && (h.stack ?? "outer") === "outer" ? Co(c, s, d, _.starts, _.ends, m, "index") : void 0, y = f ? Vo(n, t.x1, () => 0) : _?.starts ?? n.map(() => 0), b = f ? Vo(n, t.x2 ?? t.x, () => void 0) : p ? s : _.ends, x = zo(c), S = p || !f && x ? d : l, C = Qe(n, t.key, {
			groups: S,
			candidates: [c],
			markId: o,
			warningIdentity: t
		});
		return {
			id: o,
			states: Ye(n, t.states),
			seriesFromColor: t.z === void 0 && t.color !== void 0 && (p || x),
			channels: {
				x: {
					scale: r,
					values: [...b.filter(q), ...y.filter(q)],
					includeZero: t.x1 === void 0
				},
				y: {
					scale: i,
					values: c.filter(We)
				},
				color: {
					scale: "color",
					values: u.filter(Le)
				}
			},
			render: ({ scales: e, chart: l, color: d }) => {
				let f = e[i].bandwidth || Bo(e[i], c, l.height, n.length), p = Ro(t.layout?.type === "group" ? t.layout : void 0, S, f), m = p?.bandwidth ?? f, h = Lo(m, t.inset, t.maxThickness), x = [];
				return n.forEach((l, w) => {
					let T = s[w], E = y[w], D = b[w], O = c[w];
					if (!q(T) || !q(E) || !q(D) || !We(O)) return;
					let k = S[w] ?? null, A = p?.map(k) ?? 0, ee = d(u[w]), j = Xe(t.fill, l, w, n, ee), M = Xe(t.stroke, l, w, n, "none"), N = Xe(t.strokeDasharray, l, w, n, "none"), P = e[r].map(E), F = e[r].map(D), I = _ && g && T < 0 ? "start" : "end", te = I === "start" ? P : F, L = I === "start" ? F : P, ne = v?.[w], re = e[i].map(O), R = re - f / 2 + A + h.inset, ie = Math.min(P, F), ae = Math.abs(P - F), oe = h.size, z = `${o}:${K(k)}:${K(C[w])}`, se = Po(t.radius, l, w, n, "x", te, L, v !== void 0, ne, P, F, a), ce = {
						key: z,
						markId: o,
						group: k,
						groupLabel: k == null ? o : String(k),
						datum: l,
						datumIndex: w,
						xValue: T,
						yValue: O,
						x1Value: E,
						x2Value: D,
						xInterval: "difference",
						x: te,
						y: re - f / 2 + A + m / 2,
						color: j
					}, le = {
						kind: "rect",
						key: z,
						x: ie,
						y: R,
						width: ae,
						height: oe,
						...se,
						inset: h.inset,
						insetAxis: "y",
						...h.maximum === void 0 ? {} : { maxThickness: h.maximum },
						interaction: {
							point: ce,
							affinity: "y"
						},
						style: {
							fill: j,
							fillOpacity: t.fillOpacity,
							stroke: M,
							strokeOpacity: t.strokeOpacity,
							strokeWidth: t.strokeWidth,
							strokeDasharray: N
						},
						[So]: { bar: { baseline: L } }
					};
					x.push(le);
				}), { nodes: [{
					kind: "group",
					key: o,
					className: "ts-chart__bar ts-chart__bar-x",
					ariaHidden: !0,
					children: x
				}] };
			}
		};
	}, t.motion, t.renderer);
}
function No(e, t, n, r) {
	if (Fo(e) && e.stack === "outer") {
		if (t) throw TypeError(`Bar radius stack "outer" requires an implicit ${r} extent`);
		if (n) throw TypeError("Bar radius stack \"outer\" cannot be used with a group layout");
	}
}
function Po(e, t, n, r, i, a, o, s, c, l, u, d) {
	if (e === void 0) return xo(void 0, d);
	if (Fo(e)) {
		let d = Xe(e.end, t, n, r, 0);
		if (a === o) return { cornerRadii: [
			0,
			0,
			0,
			0
		] };
		if (s) {
			if (!c) return { cornerRadii: [
				0,
				0,
				0,
				0
			] };
			if (c.start && c.end) return { cornerRadii: [
				d,
				d,
				d,
				d
			] };
			let e = c.start;
			return { cornerRadii: Io(d, i, e ? l : u, e ? u : l) };
		}
		return { cornerRadii: Io(d, i, a, o) };
	}
	return xo(Xe(e, t, n, r, 0), d);
}
function Fo(e) {
	return typeof e == "object" && !!e && !Array.isArray(e);
}
function Io(e, t, n, r) {
	return t === "y" ? n <= r ? [
		e,
		e,
		0,
		0
	] : [
		0,
		0,
		e,
		e
	] : n <= r ? [
		e,
		0,
		0,
		e
	] : [
		0,
		e,
		e,
		0
	];
}
function Lo(e, t, n) {
	let r = Math.max(0, t ?? 0), i = Math.max(0, e), a = Math.max(0, i - r * 2), o = Number.isFinite(n), s = o ? Math.max(0, n) : a, c = Math.min(a, s);
	return {
		inset: (i - c) / 2,
		maximum: o ? s : void 0,
		size: c
	};
}
function Ro(e, t, n) {
	if (!e) return;
	let r = Ae(e.scale ?? (() => y().padding(Number.isFinite(e.padding) ? Math.max(0, e.padding) : .1)), { values: t });
	r.range([0, n]);
	let i = r.bandwidth?.();
	if (i === void 0) throw TypeError("A grouped bar layout requires a D3 band scale");
	return {
		bandwidth: i,
		map(e) {
			if (e === null) throw TypeError("A grouped bar requires an explicit z channel or a discrete color channel");
			let t = r(e);
			if (t === void 0 || !Number.isFinite(t)) throw TypeError(`Bar group value "${String(e)}" is outside the group layout scale domain`);
			return t;
		}
	};
}
function zo(e) {
	let t = /* @__PURE__ */ new Set();
	for (let n of e) {
		if (!We(n)) continue;
		let e = K(n);
		if (t.has(e)) return !0;
		t.add(e);
	}
	return !1;
}
function Bo(e, t, n, r) {
	let i = [...new Set(t.filter(We).map(e.map).filter((e) => Number.isFinite(e)))].sort((e, t) => e - t), a = Infinity;
	for (let e = 1; e < i.length; e += 1) a = Math.min(a, i[e] - i[e - 1]);
	return Number.isFinite(a) ? a * .8 : Math.min(48, n / Math.max(2, r + 1) * .8);
}
function Vo(e, t, n) {
	return typeof t == "number" ? e.map(() => t) : Ze(e, t, n);
}
// node_modules/.bun/@tanstack+charts@0.18.0+74b9eec76f411c79/node_modules/@tanstack/charts/dist/react/RendererChart.js
var Ho = () => () => {}, Uo = () => !1, Wo = () => !0, Go = typeof document > "u" ? b.useEffect : b.useLayoutEffect, Ko = b.memo(b.forwardRef(function({ markup: e }, t) {
	return /* @__PURE__ */ D("div", {
		ref: t,
		className: "ts-chart-surface",
		style: {
			width: "100%",
			height: "100%"
		},
		dangerouslySetInnerHTML: { __html: e }
	});
}), () => !0);
function qo(e) {
	let { ariaLabel: t, ariaDescription: n, height: r, aspectRatio: i, width: a, initialWidth: o = 640, className: s, style: c, tabIndex: l, idPrefix: u, renderer: d, measureText: f, onFocusChange: p, onFocusGroupChange: m, onSelect: h, onRender: g, onTooltipBodyChange: _ } = e, v = b.useId(), y = u ?? `ts-chart-${v.replaceAll(/[^a-zA-Z0-9_-]/g, "")}`, x = typeof i == "number" && Number.isFinite(i) && i > 0 ? i : void 0, S = x === void 0 ? void 0 : String(x), C = b.useRef(null), w = b.useRef(null), T = {
		renderer: d,
		ariaLabel: t,
		ariaDescription: n,
		height: r,
		aspectRatio: x,
		width: a,
		initialWidth: o,
		tabIndex: l,
		idPrefix: y,
		measureText: f,
		onFocusChange: p,
		onFocusGroupChange: m,
		onSelect: h,
		onRender: g,
		onTooltipBodyChange: _,
		definition: e.definition
	};
	w.current ??= yo(T);
	let E = w.current, O = b.useSyncExternalStore(Ho, Uo, Wo), k = b.useRef(null);
	k.current ??= O ? E.prerender() : "";
	let A = b.useRef(!1);
	return Go(() => {
		let e = C.current;
		e && (E.update(T), A.current ||= (E.mount(e), !0));
	}, [E, T]), Go(() => () => {
		E.destroy(), A.current = !1;
	}, [E]), /* @__PURE__ */ D("div", {
		className: s ? `ts-chart-host ${s}` : "ts-chart-host",
		style: {
			position: "relative",
			width: a === void 0 ? "100%" : a,
			height: r ?? (x ? void 0 : 320),
			aspectRatio: r === void 0 ? S : void 0,
			...c
		},
		children: /* @__PURE__ */ D(Ko, {
			ref: C,
			markup: k.current
		})
	});
}
// node_modules/.bun/@tanstack+charts@0.18.0+74b9eec76f411c79/node_modules/@tanstack/charts/dist/react/Chart.js
function Jo(e) {
	return /* @__PURE__ */ D(Yo, { ...e });
}
function Yo(e) {
	let t = e.renderSvg ?? ua, n = b.useMemo(() => mo(t), [t]), r = b.useMemo(() => {
		if (e.onRender) return (t) => {
			let n = t.surface.defaultElement ?? t.surface.element, r = t.container.ownerDocument.defaultView?.SVGSVGElement;
			if (!r || !(n instanceof r)) throw TypeError("Expected the SVG chart surface.");
			e.onRender?.({
				container: t.container,
				scene: t.scene,
				surface: t.surface,
				svg: n,
				interaction: t.interaction
			});
		};
	}, [e.onRender]), i = {
		...e,
		renderer: n,
		onRender: r
	};
	return /* @__PURE__ */ D(qo, { ...i });
}
// node_modules/.bun/@tanstack+charts@0.18.0+74b9eec76f411c79/node_modules/@tanstack/charts/dist/scales/intern.js
function Xo(e) {
	return e instanceof Date ? `date:${e.getTime()}` : `${typeof e}:${String(e)}`;
}
function Zo(e) {
	let t = [], n = /* @__PURE__ */ new Map();
	for (let r of e) {
		let e = Xo(r);
		n.has(e) || (n.set(e, t.length), t.push(r));
	}
	return {
		domain: t,
		index: n
	};
}
// node_modules/.bun/@tanstack+charts@0.18.0+74b9eec76f411c79/node_modules/@tanstack/charts/dist/scales/band-kernel.js
function Qo(e, t, n) {
	let r = [], i = /* @__PURE__ */ new Map(), a = [], o = [0, 1], s = 1, c = +!e, l = !1, u = +!!e, d = 0, f = .5, p = ((e) => {
		let t = i.get(Xo(e));
		return t === void 0 ? void 0 : a[t];
	}), m = () => {
		let e = r.length, t = o[1] < o[0], n = t ? o[1] : o[0], i = t ? o[0] : o[1];
		return s = (i - n) / Math.max(1, e - u + d * 2), l && (s = Math.floor(s)), n += (i - n - s * (e - u)) * f, c = s * (1 - u), l && (n = Math.round(n), c = Math.round(c)), a = Array.from({ length: e }, (e, t) => n + s * t), t && a.reverse(), p;
	};
	if (p.domain = ((e) => {
		if (e === void 0) return r.slice();
		let t = Zo(e);
		return r = t.domain, i = t.index, m();
	}), p.range = ((e) => e === void 0 ? [...o] : (o = $o(e), m())), p.rangeRound = (e) => (o = $o(e), l = !0, m()), p.bandwidth = () => c, p.step = () => s, p.round = ((e) => e === void 0 ? l : (l = !!e, m())), p.padding = ((e) => e === void 0 ? u : (d = es(e), u = Math.min(1, d), m())), p.paddingInner = ((e) => e === void 0 ? u : (u = Math.min(1, es(e)), m())), p.paddingOuter = ((e) => e === void 0 ? d : (d = es(e), m())), p.align = ((e) => e === void 0 ? f : (f = Math.max(0, Math.min(1, es(e))), m())), p.copy = () => Qo(!1, r, o).round(l).paddingInner(u).paddingOuter(d).align(f), e) {
		let e = p;
		e.bandwidth = () => 0, e.padding = p.paddingOuter, e.copy = () => Qo(!0, r, o).round(l).padding(d).align(f), delete e.paddingInner, delete e.paddingOuter;
	}
	return m(), n === void 0 ? t !== void 0 && p.range(t) : p.domain(t).range(n), p;
}
function $o(e) {
	let t = Array.from(e, es);
	if (t.length !== 2 || t.some((e) => !Number.isFinite(e))) throw TypeError("A scale range requires exactly two finite numbers");
	return [t[0], t[1]];
}
function es(e) {
	return Number(e);
}
// node_modules/.bun/@tanstack+charts@0.18.0+74b9eec76f411c79/node_modules/@tanstack/charts/dist/scales/band.js
function ts(e, t) {
	return Qo(!1, e, t);
}
// node_modules/.bun/@tanstack+charts@0.18.0+74b9eec76f411c79/node_modules/@tanstack/charts/dist/scales/ticks.js
var ns = [
	1,
	2,
	5,
	10
];
function rs(e, t, n) {
	if (!(n > 0)) return [];
	if (e === t) return [e];
	let r = t < e, i = os(r ? t : e, r ? e : t, n);
	return i.lastIndex >= i.firstIndex ? Array.from({ length: i.lastIndex - i.firstIndex + 1 }, (e, t) => ds(r ? i.lastIndex - t : i.firstIndex + t, i.interval)) : [];
}
function is(e, t, n) {
	return os(e, t, n).interval;
}
function as(e, t, n) {
	let r = t < e, i = is(r ? t : e, r ? e : t, n), a = i < 0 ? -1 / i : i;
	return r ? -a : a;
}
function os(e, t, n) {
	let r = n;
	for (;;) {
		let n = ss(e, t, r), i = ls(e, n), a = us(t, n);
		if (a >= i || !(r >= .5 && r < 2)) return {
			firstIndex: i,
			lastIndex: a,
			interval: n
		};
		r *= 2;
	}
}
function ss(e, t, n) {
	let r = (t - e) / Math.max(0, n), i = Math.floor(Math.log10(r)), a = 10 ** i, o = cs(r / a);
	return i < 0 ? -(10 ** -i) / o : a * o;
}
function cs(e) {
	let t = ns[0];
	for (let n of ns.slice(1)) {
		if (!(e >= Math.sqrt(t * n))) break;
		t = n;
	}
	return t;
}
function ls(e, t) {
	let n = t < 0 ? e * -t : e / t, r = Math.round(n);
	return r < n ? r + 1 : r;
}
function us(e, t) {
	let n = t < 0 ? e * -t : e / t, r = Math.round(n);
	return r > n ? r - 1 : r;
}
function ds(e, t) {
	return t < 0 ? e / -t : e * t;
}
// node_modules/.bun/@tanstack+charts@0.18.0+74b9eec76f411c79/node_modules/@tanstack/charts/dist/scales/linear.js
function fs(e, t) {
	let n = [0, 1], r = [0, 1], i = !1, a = ((e) => {
		if (e != null && Number.isFinite(Number(e))) return ps(Number(e), n, r, i);
	});
	return a.domain = ((e) => e === void 0 ? [...n] : (n = ms(e, "domain"), a)), a.range = ((e) => e === void 0 ? [...r] : (r = ms(e, "range"), a)), a.invert = (e) => ps(e, r, n, i), a.clamp = ((e) => e === void 0 ? i : (i = !!e, a)), a.ticks = (e = 10) => rs(n[0], n[1], e), a.tickFormat = (e = 10) => {
		let t = Math.abs(as(n[0], n[1], e)), r = t > 0 && t < 1 ? Math.min(20, Math.max(0, -Math.floor(Math.log10(t)))) : 0;
		return (e) => {
			let t = r ? e.toFixed(r) : String(e);
			return t === "-0" ? "0" : t;
		};
	}, a.nice = (e = 10) => {
		let t = n[0], r = n[1], i = 0, o = 1;
		r < t && ([t, r] = [r, t], [i, o] = [o, i]);
		let s;
		for (let a = 10; a > 0; a--) {
			let a = is(t, r, e);
			if (a === s) {
				let e = [...n];
				e[i] = t, e[o] = r, n = e;
				break;
			}
			if (a > 0) t = Math.floor(t / a) * a, r = Math.ceil(r / a) * a;
			else if (a < 0) t = Math.ceil(t * a) / a, r = Math.floor(r * a) / a;
			else break;
			s = a;
		}
		return a;
	}, a.copy = () => fs(n, r).clamp(i), t === void 0 ? e !== void 0 && a.range(e) : a.domain(e).range(t), a;
}
function ps(e, t, n, r) {
	let i = t[1] - t[0], a = i ? (e - t[0]) / i : .5;
	return r && (a = Math.max(0, Math.min(1, a))), n[0] + a * (n[1] - n[0]);
}
function ms(e, t) {
	let n = Array.from(e, Number);
	if (n.length !== 2 || n.some((e) => !Number.isFinite(e))) throw TypeError(`A linear scale ${t} requires exactly two finite numbers`);
	return [n[0], n[1]];
}
// .pstdio/extensions/social-radar/src/webview/charts.tsx
var hs = (e) => E.token.var(`colors.${e}`), gs = hs("blue.solid"), _s = {
	negative: "red.solid",
	neutral: "gray.emphasized",
	positive: "blue.solid"
}, vs = {
	negative: "Negative",
	neutral: "Neutral",
	positive: "Positive"
}, ys = { height: "100%" }, bs = (e) => {
	let { height: t, children: n } = e;
	return t ? /* @__PURE__ */ D(C, {
		color: "fg.muted",
		textStyle: "label/XS",
		children: n
	}) : /* @__PURE__ */ D(C, {
		color: "fg.muted",
		textStyle: "label/XS",
		flex: "1",
		minH: "0",
		overflow: "hidden",
		children: n
	});
}, xs = (e) => {
	let { days: t, label: n } = e, r = Kn({
		marks: [jo(t, {
			x: "day",
			y: "count",
			fill: gs,
			inset: 4,
			radius: 2
		})],
		scales: {
			x: {
				scale: () => ts().padding(.2),
				axis: { ticks: { format: (e) => String(Number(e.slice(8))) } }
			},
			y: {
				scale: fs,
				nice: !0,
				axis: !1
			}
		}
	});
	return /* @__PURE__ */ D(bs, { children: /* @__PURE__ */ D(Jo, {
		definition: r,
		ariaLabel: n,
		style: ys
	}) });
}, Ss = (e) => {
	let { rows: t, label: n, fixedHeight: r = !1 } = e, i = r ? Math.max(t.length * 24, 48) : void 0, a = Kn({
		marks: [Mo(t, {
			x: "count",
			y: "label",
			fill: gs,
			maxThickness: 10,
			radius: 2
		})],
		scales: {
			x: {
				scale: fs,
				nice: !0,
				axis: !1
			},
			y: { scale: () => ts().domain(t.map((e) => e.label)).padding(.3) }
		}
	});
	return /* @__PURE__ */ D(bs, {
		height: i,
		children: /* @__PURE__ */ D(Jo, {
			definition: a,
			height: i,
			ariaLabel: n,
			style: i ? void 0 : ys
		})
	});
}, Cs = (e) => {
	let { counts: t, label: n } = e, r = [
		"negative",
		"neutral",
		"positive"
	].map((e) => ({
		sentiment: e,
		row: n,
		count: t[e]
	})), i = Kn({
		marks: [Mo(r, {
			x: "count",
			y: "row",
			z: "sentiment",
			fill: (e) => hs(_s[e.sentiment]),
			inset: 1
		})],
		scales: {
			x: {
				scale: fs,
				axis: !1
			},
			y: {
				scale: () => ts().padding(0),
				axis: !1
			}
		}
	});
	return /* @__PURE__ */ O(C, { children: [/* @__PURE__ */ D(Jo, {
		definition: i,
		height: 12,
		ariaLabel: n
	}), /* @__PURE__ */ D(w, {
		gap: "md",
		mt: "xs",
		children: r.map((e) => /* @__PURE__ */ O(w, {
			gap: "2xs",
			children: [/* @__PURE__ */ D(C, {
				boxSize: "2",
				borderRadius: "2xs",
				bg: _s[e.sentiment]
			}), /* @__PURE__ */ O(T, {
				textStyle: "label/XS",
				color: "fg.muted",
				children: [
					vs[e.sentiment],
					" ",
					e.count
				]
			})]
		}, e.sentiment))
	})] });
};
export { me as _, ke as a, we as c, ye as d, ge as f, fe as g, he as h, _s as i, Se as l, de as m, Ss as n, Te as o, _e as p, Cs as r, Ce as s, xs as t, be as u, U as v, ue as y };

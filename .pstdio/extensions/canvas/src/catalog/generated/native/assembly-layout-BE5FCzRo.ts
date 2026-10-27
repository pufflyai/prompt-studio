// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
// clients/landing-page/src/content/settled-shape-positions.ts
var e = [
	{
		x: -96.2289,
		y: -13.9296,
		angle: -88.9395
	},
	{
		x: 6.313,
		y: -20.5908,
		angle: 2.1617
	},
	{
		x: 54.304,
		y: -7.0831,
		angle: .4891
	},
	{
		x: -50.1481,
		y: -12.4248,
		angle: .0639
	},
	{
		x: 60.9787,
		y: -31.8962,
		angle: 148.6029
	},
	{
		x: 127.2341,
		y: -16.9166,
		angle: 78.0103
	},
	{
		x: -127.2661,
		y: -16.7112,
		angle: -1.446
	},
	{
		x: -29.0137,
		y: -36.0461,
		angle: -74.7563
	},
	{
		x: 93.4196,
		y: -12.8944,
		angle: 26.8415
	},
	{
		x: -77.7505,
		y: -34.7721,
		angle: 11.0661
	},
	{
		x: 41.0943,
		y: -49.906,
		angle: -18.9587
	},
	{
		x: 98.1863,
		y: -38.2777,
		angle: -34.374
	},
	{
		x: -108.0947,
		y: -49.9284,
		angle: 36.1295
	},
	{
		x: 2.9943,
		y: -60.0842,
		angle: -84.358
	},
	{
		x: 79.1046,
		y: -65.8244,
		angle: 5.5681
	},
	{
		x: -59.8256,
		y: -47.4043,
		angle: 40.2295
	},
	{
		x: 44.3584,
		y: -75.6524,
		angle: -8.7798
	},
	{
		x: 87.1345,
		y: -88.5046,
		angle: 106.3654
	},
	{
		x: -129.4984,
		y: -80.4033,
		angle: -95.8026
	},
	{
		x: -37.0262,
		y: -74.314,
		angle: 6.153
	},
	{
		x: 116.6539,
		y: -59.3651,
		angle: 58.676
	},
	{
		x: -87.4219,
		y: -79.7419,
		angle: 15.4641
	},
	{
		x: 24.5425,
		y: -94.2429,
		angle: -40.1435
	},
	{
		x: 127.0883,
		y: -88.219,
		angle: 25.8872
	},
	{
		x: -69.154,
		y: -106.11,
		angle: -30.1329
	},
	{
		x: -3.7421,
		y: -97.2081,
		angle: 55.7529
	},
	{
		x: 58.6904,
		y: -89.9522,
		angle: -134.9963
	},
	{
		x: -34.7395,
		y: -111.8835,
		angle: 34.2679
	}
], t = [
	{
		id: "agents",
		slug: "coding-agent-dashboard",
		name: "Coding agent dashboard",
		description: "Manage tickets across coding agents. Commands update the board, skills guide the work, and hooks and schedules keep it moving.",
		blocks: [
			{
				kind: "page",
				purpose: "Track tickets and agent sessions on a kanban board."
			},
			{
				kind: "command",
				purpose: "Create tickets, update their status, and list work to pick up or review."
			},
			{
				kind: "skill",
				purpose: "Teach agents how to implement a ticket and review a change."
			},
			{
				kind: "hook",
				purpose: "Move a ticket to review when an agent finishes."
			},
			{
				kind: "automation",
				purpose: "Pick up queued tickets each morning and prepare a review summary each afternoon."
			}
		]
	},
	{
		id: "icons",
		slug: "icon-set-editor",
		name: "Icon set editor",
		description: "Browse, rename, and organise the icons you use across your tools.",
		blocks: [
			{
				kind: "page",
				purpose: "Browse and search your icon set."
			},
			{
				kind: "editor",
				purpose: "Inspect an icon, its name, and its codepoint."
			},
			{
				kind: "command",
				purpose: "Rename an icon across your set."
			}
		]
	},
	{
		id: "shaders",
		slug: "shader-editor",
		name: "Shader editor",
		description: "Edit a fragment shader and shape its animation with a live preview.",
		blocks: [
			{
				kind: "page",
				purpose: "Watch flowing ribbons of color respond to scale and speed."
			},
			{
				kind: "editor",
				purpose: "Edit the shader to change its colors and motion."
			},
			{
				kind: "hook",
				purpose: "Refresh the preview as you change the shader."
			}
		]
	},
	{
		id: "formulas",
		slug: "financial-formulas",
		name: "Financial formulas",
		description: "Explore financial formulas and let agents use them to answer questions.",
		blocks: [
			{
				kind: "page",
				purpose: "Explore savings plans, loan repayment, and discounted cash flow."
			},
			{
				kind: "editor",
				purpose: "Adjust the inputs and explore what each formula does."
			},
			{
				kind: "command",
				purpose: "Let an agent call a formula to answer a question with calculated results."
			}
		]
	}
], n = {
	page: "var(--chakra-colors-illustration-page)",
	command: "var(--chakra-colors-illustration-command)",
	editor: "var(--chakra-colors-illustration-editor)",
	skill: "var(--chakra-colors-illustration-skill)",
	hook: "var(--chakra-colors-illustration-hook)",
	automation: "var(--chakra-colors-illustration-automation)"
}, r = {
	page: 1,
	command: 88 / 24,
	editor: 1,
	skill: 2,
	hook: 1,
	automation: 1
}, i = [
	"icons",
	"shaders",
	"agents",
	"formulas"
].map((e) => t.find((t) => t.id === e)), a = [
	"page",
	"editor",
	"command",
	"skill",
	"hook",
	"automation"
], o = [
	"Claude",
	"Codex",
	"OpenCode"
], s = {
	page: 35,
	editor: 35,
	command: 13,
	skill: 23,
	hook: 35,
	automation: 34
}, c = e.map((e, t) => {
	let n = a[t % a.length], i = s[n] * (.8 + t * 17 % 9 / 20);
	return {
		id: `block-${t}`,
		kind: n,
		height: i,
		width: i * r[n],
		source: e
	};
}), l = {
	width: 1200,
	height: 900
}, u = {
	width: 480,
	height: 672
}, d = 1200, f = (e, t) => ({
	x: e + 80 + t * 40,
	y: 80 + t * 70
}), p = 140, m = {
	wide: .85,
	narrow: .95
}, h = (e) => ({
	height: s[e] * 1.2,
	width: s[e] * r[e] * 1.2
}), g = Math.max(...i.map((e) => e.blocks.length)), _ = Math.max(...i.map((e) => e.blocks.reduce((e, t) => e + h(t.kind).width, 0))), v = (e, t = i[0]) => {
	let n = t.blocks.reduce((e, t) => e + h(t.kind).width, 0), r = 640 * e.unitScale * e.scale, o = (r - _) / (g + 1), s = (r - n - o * (t.blocks.length + 1)) / 2;
	return a.map((n) => {
		let r = t.blocks.findIndex((e) => e.kind === n), { width: i, height: a } = h(n), c = t.blocks.slice(0, Math.max(0, r)).reduce((e, t) => e + h(t.kind).width, 0);
		return {
			id: n,
			kind: n,
			x: e.x + s + c + o * (Math.max(0, r) + 1) + i / 2,
			y: e.y + 384 * e.unitScale * e.scale + 39,
			width: i,
			height: a
		};
	});
}, y = (e, t = u, n = i[0], r = 1) => {
	let a = e.width >= d * r, o = a ? e.width - t.width - 48 : e.width - 32, s = a ? 24 : t.height + 24, c = Math.max(1, e.height - s - 78 - p), l = (a ? m.wide : m.narrow) * Math.min(o / (640 * r), c / (384 * r)), f = 640 * r * l, h = a ? t.width + 24 + (o - f) / 2 : (e.width - f) / 2, g = 384 * r * l + 78, _ = {
		x: h,
		y: a ? (e.height - g) / 2 : s,
		scale: l,
		unitScale: r
	};
	return {
		board: _,
		slots: v(_, n)
	};
}, b = (e, t = y(e).board) => {
	let n = t.x + 640 * t.unitScale * t.scale / 2;
	return c.map((t) => ({
		...t,
		source: {
			...t.source,
			x: n + t.source.x,
			y: e.height + t.source.y
		}
	}));
};
export { y as a, b as c, c as d, r as f, l as i, o as l, t as m, m as n, v as o, n as p, u as r, f as s, d as t, i as u };

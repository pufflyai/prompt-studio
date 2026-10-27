// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { createGlyphIcon as e } from "@pstdio/ui";
// clients/landing-page/src/content/shader-demo-content.ts
var t = "vec3 shade(vec2 uv) {\n  vec2 p = (uv - 0.5) * u_scale * 0.35;\n  float time = u_time * 0.4;\n  p += 0.18 * sin(p.yx * 1.7 + vec2(time, -time));\n  vec3 color = vec3(0.012, 0.018, 0.04);\n\n  for (int i = 0; i < 6; i++) {\n    float layer = float(i);\n    float wave = sin(p.x * 1.6 + time + layer * 0.7) * 0.4;\n    wave += sin(p.x * 2.8 - time * 0.8 + layer) * 0.16;\n    float ribbon = p.y - wave + (layer - 2.5) * 0.24;\n    float glow = 0.018 / (abs(ribbon) + 0.025);\n    vec3 tint = 0.5 + 0.5 * cos(\n      vec3(0.2, 2.1, 4.3) + layer * 0.75 + p.x * 0.45 + time * 0.3\n    );\n    color += tint * glow * 0.55;\n  }\n  return 1.0 - exp(-color * 1.4);\n}", n = "vec3 shade(vec2 uv) {\n  vec2 cell = uv * u_scale;\n  float column = floor(cell.x);\n  float seed = fract(sin(column * 13.13) * 17.17);\n  float row = floor(cell.y);\n  float phase = mod(row + u_time * mix(1.2, 3.2, seed) + seed * 18.0, 18.0);\n  float trail = exp(-phase * 0.32) * smoothstep(0.0, 0.8, phase);\n  float headDistance = (phase - 1.0) * 1.5;\n  float head = exp(-headDistance * headDistance);\n  float icon = texture2D(u_icon, cell).a;\n\n  vec3 green = vec3(0.04, 0.65, 0.28);\n  vec3 mint = vec3(0.76, 1.0, 0.86);\n  vec3 ink = mix(green, mint, head);\n  return vec3(0.018, 0.04, 0.027)\n    + ink * icon * (0.035 + trail);\n}", r = {
	filename: "aurora.frag",
	source: t,
	scale: 8,
	speed: .6,
	maxSpeed: 2
}, i = {
	filename: "icon-matrix.frag",
	source: n,
	scale: 16,
	speed: 1.8,
	maxSpeed: 4
}, a = [
	{
		name: "cloud-add",
		codepoint: "E800"
	},
	{
		name: "history",
		codepoint: "E802"
	},
	{
		name: "add-circle",
		codepoint: "E808"
	},
	{
		name: "metrics",
		codepoint: "E80D"
	},
	{
		name: "folder",
		codepoint: "E880"
	},
	{
		name: "global",
		codepoint: "E885"
	},
	{
		name: "notification",
		codepoint: "E88E"
	},
	{
		name: "grid-4",
		codepoint: "E894"
	},
	{
		name: "code",
		codepoint: "E8D7"
	},
	{
		name: "component",
		codepoint: "E8E2"
	},
	{
		name: "magicpen",
		codepoint: "E9E4"
	},
	{
		name: "star",
		codepoint: "EB07"
	}
].map((t) => ({
	...t,
	id: t.name,
	icon: e(t.name)
})), o = [
	"cloud-add",
	"folder",
	"component",
	"star"
];
export { i as a, t as i, o as n, r, a as t };

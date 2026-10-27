// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { m as e } from "./assembly-layout-BE5FCzRo.ts";
import { i as t, r as n } from "./landing-content-Dr_aPkzK.ts";
// clients/landing-page/src/content/landing-pages.ts
var r = [
	{
		path: "/",
		view: "start",
		label: n.start.label,
		title: t.title,
		description: t.description
	},
	{
		path: "/what-is-prompt-studio/",
		view: "what-is-prompt-studio",
		label: n["what-is-prompt-studio"].label,
		title: "What is Prompt Studio? | A workbench for your tools",
		description: "Give the tools you build a place to live. Combine pages, editors, commands, skills, hooks, and workflows in your own workbench."
	},
	...e.map((e) => ({
		path: `/examples/${e.slug}/`,
		view: "examples",
		exampleId: e.id,
		label: n.examples.label,
		title: `${e.name} example | Prompt Studio`,
		description: e.description
	})),
	{
		path: "/features/",
		view: "features",
		label: n.features.label,
		title: "Shared features for your tools | Prompt Studio",
		description: "Try shared search, notifications, navigation, extension management, and themes. Build tools on the features already included in Prompt Studio."
	},
	{
		path: "/privacy/",
		view: "legal",
		label: "Privacy policy",
		title: "Privacy policy | Prompt Studio",
		description: "Read how Pufflig AB handles information when you use Prompt Studio and its website."
	},
	{
		path: "/terms/",
		view: "legal",
		label: "Terms of service",
		title: "Terms of service | Prompt Studio",
		description: "Read the terms that apply to using Prompt Studio and its website, provided by Pufflig AB."
	},
	{
		path: "/imprint/",
		view: "legal",
		label: "Imprint",
		title: "Imprint | Prompt Studio",
		description: "Company and contact details for Pufflig AB, the publisher of Prompt Studio."
	},
	{
		path: "/docs/",
		view: "docs",
		label: "Docs home",
		title: "Docs | Prompt Studio",
		description: "Guides and references for Prompt Studio: install it, learn how it works, build extensions, and look up the CLI, SDK, and extension API."
	},
	{
		path: "/blog/",
		view: "blog",
		label: "All posts",
		title: "Blog | Prompt Studio",
		description: "Releases, thoughts, and tool showcases from the people who build Prompt Studio."
	}
], i = (e) => r.find((t) => t.view === e).path, a = (e) => r.find((t) => t.view === "examples" && t.exampleId === e).path, o = (e, t) => {
	let n = `${t.split(/[?#]/)[0].replace(/\/+$/, "")}/`;
	return n === "/examples/" ? e.find((e) => e.view === "examples") : e.find((e) => e.path === n);
}, s = {
	studio: "/",
	docs: "/docs/",
	blog: "/blog/"
}, c = (e) => e.view === "docs" || e.view === "doc" ? "docs" : e.view === "blog" || e.view === "post" ? "blog" : "studio", l = (e) => [
	"legal",
	"doc",
	"post"
].includes(e.view);
export { i as a, a as i, l as n, c as o, o as r, r as s, s as t };

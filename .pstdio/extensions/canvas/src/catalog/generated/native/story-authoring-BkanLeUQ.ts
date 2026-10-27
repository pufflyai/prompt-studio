// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e, r as t } from "./native-document-blocks-9wQwzhjL.ts";
import { createElement as n } from "react";
import { Fragment as r, jsx as i, jsxs as a } from "react/jsx-runtime";
// packages/ui/src/docs/agents/story-authoring.mdx
function o(e) {
	let n = {
		code: "code",
		h1: "h1",
		h2: "h2",
		li: "li",
		ol: "ol",
		p: "p",
		ul: "ul",
		...e.components
	};
	return a(r, { children: [
		i(t, { title: "Agent Guide/Story Authoring" }),
		"\n",
		i(n.h1, { children: "Story Authoring" }),
		"\n",
		i(n.p, { children: "Stories are executable documentation for agents and visual review for humans." }),
		"\n",
		i(n.h2, { children: "Canonical story order" }),
		"\n",
		i(n.p, { children: "Place the three most useful stories first because Storybook MCP surfaces the first few examples prominently." }),
		"\n",
		a(n.ol, { children: [
			"\n",
			i(n.li, { children: "Default or primary usage." }),
			"\n",
			i(n.li, { children: "Common configured usage." }),
			"\n",
			i(n.li, { children: "Important edge state such as empty, loading, disabled, selected, long content, or error." }),
			"\n"
		] }),
		"\n",
		i(n.h2, { children: "Manifest curation" }),
		"\n",
		a(n.p, { children: [
			"Keep canonical component and pattern stories in the manifest. Exclude performance, regression-only, fixture-library, and internal instruction stories with ",
			i(n.code, { children: "tags: [\"!manifest\"]" }),
			"."
		] }),
		"\n",
		i(n.h2, { children: "Story contents" }),
		"\n",
		a(n.ul, { children: [
			"\n",
			i(n.li, { children: "Use realistic Prompt Studio data." }),
			"\n",
			i(n.li, { children: "Keep stories deterministic and local." }),
			"\n",
			a(n.li, { children: [
				"Add ",
				i(n.code, { children: "play" }),
				" functions for meaningful interactions."
			] }),
			"\n",
			i(n.li, { children: "Avoid tests that assert generated wording or bundled copy." }),
			"\n",
			i(n.li, { children: "Prefer colocated fixtures when story files start to grow." }),
			"\n"
		] }),
		"\n",
		i(n.h2, { children: "Metadata" }),
		"\n",
		a(n.p, { children: [
			"Use concise ",
			i(n.code, { children: "parameters.docs.description.component" }),
			" and story descriptions when a component needs usage guidance beyond props and examples. Keep descriptions practical: when to use it, required host state, and important constraints."
		] })
	] });
}
function s(e = {}) {
	let { wrapper: t } = e.components || {};
	return t ? i(t, {
		...e,
		children: i(o, { ...e })
	}) : o(e);
}
function c() {
	return n(e, {
		component: s,
		annotations: {}.default
	});
}
export { c as default };

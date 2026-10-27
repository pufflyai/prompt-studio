// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e, r as t } from "./native-document-blocks-ZX3UlLq0.ts";
import { createElement as n } from "react";
import { Fragment as r, jsx as i, jsxs as a } from "react/jsx-runtime";
// packages/ui/src/docs/agents/overview.mdx
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
		i(t, { title: "Agent Guide/Overview" }),
		"\n",
		i(n.h1, { children: "Agent Guide" }),
		"\n",
		a(n.p, { children: [i(n.code, { children: "@pstdio/ui" }), " is the shared React and Chakra UI package for Prompt Studio surfaces. Treat this Storybook as the source of truth for available components, patterns, design tokens, examples, and usage constraints."] }),
		"\n",
		i(n.h2, { children: "Agent workflow" }),
		"\n",
		a(n.ol, { children: [
			"\n",
			i(n.li, { children: "Use Storybook MCP documentation before writing UI." }),
			"\n",
			a(n.li, { children: [
				"Use Chakra components directly when ",
				i(n.code, { children: "psTheme" }),
				" provides the recipe or token styling for that primitive."
			] }),
			"\n",
			i(n.li, { children: "Verify props through Storybook docs, source types, or example stories before using them." }),
			"\n",
			i(n.li, { children: "Use stories to inspect realistic states, then compose the smallest UI that matches the existing patterns." }),
			"\n",
			i(n.li, { children: "Add or update colocated stories for user-visible UI changes." }),
			"\n"
		] }),
		"\n",
		i(n.h2, { children: "Component sources" }),
		"\n",
		a(n.p, { children: [
			i(n.code, { children: "@pstdio/ui" }),
			" intentionally uses Chakra as part of the public composition surface. Import recipe-backed primitives such as\n",
			i(n.code, { children: "Button" }),
			", ",
			i(n.code, { children: "Input" }),
			", ",
			i(n.code, { children: "Textarea" }),
			", ",
			i(n.code, { children: "Menu" }),
			", ",
			i(n.code, { children: "Popover" }),
			", ",
			i(n.code, { children: "Field" }),
			", and ",
			i(n.code, { children: "InputGroup" }),
			" from ",
			i(n.code, { children: "@chakra-ui/react" }),
			"; update the local theme\nrecipes when their shared styling needs to change. Prefer exported ",
			i(n.code, { children: "@pstdio/ui" }),
			" components for custom behavior, richer\nproduct patterns, and package-owned composites."
		] }),
		"\n",
		i(n.h2, { children: "Do not guess" }),
		"\n",
		i(n.p, { children: "Do not invent component props from common design-system conventions. If a prop is not documented or shown in source types, do not use it. Choose a supported prop, compose with Chakra layout primitives, or ask for product direction." }),
		"\n",
		i(n.h2, { children: "Where to look" }),
		"\n",
		a(n.ul, { children: [
			"\n",
			a(n.li, { children: [i(n.code, { children: "Agent Guide/Foundations" }), ": tokens, theme, layout, and styling rules."] }),
			"\n",
			a(n.li, { children: [i(n.code, { children: "Agent Guide/Component Map" }), ": component categories and default choices."] }),
			"\n",
			a(n.li, { children: [i(n.code, { children: "Agent Guide/Patterns" }), ": higher-level workflows and composed UI."] }),
			"\n",
			a(n.li, { children: [i(n.code, { children: "Agent Guide/Story Authoring" }), ": story structure and manifest curation rules."] }),
			"\n",
			a(n.li, { children: [i(n.code, { children: "Foundations/Component Gallery / Foundations" }), ": lightweight components, tokens, and primitive states."] }),
			"\n",
			a(n.li, { children: [i(n.code, { children: "Foundations/Component Gallery / Composites" }), ": advanced component examples for assembled product workflows."] }),
			"\n"
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

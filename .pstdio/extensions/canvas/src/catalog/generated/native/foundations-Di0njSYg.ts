// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e, r as t } from "./native-document-blocks-ZX3UlLq0.ts";
import { createElement as n } from "react";
import { Fragment as r, jsx as i, jsxs as a } from "react/jsx-runtime";
// packages/ui/src/docs/agents/foundations.mdx
function o(e) {
	let n = {
		code: "code",
		h1: "h1",
		h2: "h2",
		li: "li",
		p: "p",
		ul: "ul",
		...e.components
	};
	return a(r, { children: [
		i(t, { title: "Agent Guide/Foundations" }),
		"\n",
		i(n.h1, { children: "Foundations" }),
		"\n",
		a(n.p, { children: [
			"Use the ",
			i(n.code, { children: "psTheme" }),
			" Chakra system and package tokens instead of hard-coded visual values."
		] }),
		"\n",
		i(n.h2, { children: "Theme and tokens" }),
		"\n",
		a(n.ul, { children: [
			"\n",
			a(n.li, { children: [
				"Use semantic tokens such as ",
				i(n.code, { children: "bg" }),
				", ",
				i(n.code, { children: "fg" }),
				", ",
				i(n.code, { children: "fg.muted" }),
				", ",
				i(n.code, { children: "border.subtle" }),
				", and ",
				i(n.code, { children: "colorPalette.*" }),
				"."
			] }),
			"\n",
			a(n.li, { children: [
				"Use package text styles like ",
				i(n.code, { children: "paragraph/S/regular" }),
				", ",
				i(n.code, { children: "label/XS" }),
				", and ",
				i(n.code, { children: "label/L/medium" }),
				"."
			] }),
			"\n",
			a(n.li, { children: [
				"Treat Chakra recipe-backed primitives as part of the UI system; import them from ",
				i(n.code, { children: "@chakra-ui/react" }),
				" and change shared\nstyling in ",
				i(n.code, { children: "packages/ui/src/theme/recipes" }),
				"."
			] }),
			"\n",
			i(n.li, { children: "Prefer Chakra layout props and local layout components over bespoke CSS." }),
			"\n",
			a(n.li, { children: [
				"Do not change border radius for local preference. Default to ",
				i(n.code, { children: "xs" }),
				" and use the existing recipe radius unless a component\nguide explicitly calls for another radius."
			] }),
			"\n",
			i(n.li, { children: "Preserve theme preference behavior by rendering stories under the configured Storybook decorators." }),
			"\n"
		] }),
		"\n",
		i(n.h2, { children: "Layout defaults" }),
		"\n",
		a(n.ul, { children: [
			"\n",
			i(n.li, { children: "Use compact, work-focused layouts for product UI." }),
			"\n",
			a(n.li, { children: [
				"Prefer ",
				i(n.code, { children: "Stack" }),
				", ",
				i(n.code, { children: "HStack" }),
				", ",
				i(n.code, { children: "Flex" }),
				", ",
				i(n.code, { children: "SimpleGrid" }),
				", and package layout helpers for structure."
			] }),
			"\n",
			a(n.li, { children: [
				"Use local components for repeated UI concepts: ",
				i(n.code, { children: "EmptyState" }),
				", ",
				i(n.code, { children: "ListRow" }),
				", ",
				i(n.code, { children: "TreeList" }),
				", ",
				i(n.code, { children: "KanbanRenderer" }),
				", ",
				i(n.code, { children: "Palette" }),
				", ",
				i(n.code, { children: "Sidenav" }),
				", and chat components."
			] }),
			"\n",
			i(n.li, { children: "Keep fixed-format controls stable with explicit sizing, gaps, and responsive constraints." }),
			"\n"
		] }),
		"\n",
		i(n.h2, { children: "Control sizing" }),
		"\n",
		a(n.ul, { children: [
			"\n",
			a(n.li, { children: [
				i(n.code, { children: "Button" }),
				" defaults to ",
				i(n.code, { children: "size=\"sm\"" }),
				" in the theme. Do not restate it unless a local context needs a different density."
			] }),
			"\n",
			a(n.li, { children: [
				"Use ",
				i(n.code, { children: "size=\"xs\"" }),
				" for button-like controls inside tabs, param-editor rows, table/list/tree rows, and other dense row-scoped controls."
			] }),
			"\n",
			a(n.li, { children: [
				"Use ",
				i(n.code, { children: "size=\"2xs\"" }),
				" only for compact icon-only affordances inside rows where the row itself provides the surrounding hit area."
			] }),
			"\n"
		] }),
		"\n",
		i(n.h2, { children: "Visual states" }),
		"\n",
		i(n.p, { children: "Document meaningful states in stories: default, empty, loading, error, disabled, selected, long content, and dense data. Avoid stories that only demonstrate implementation details." })
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

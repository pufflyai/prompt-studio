// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e, r as t } from "./native-document-blocks-ZX3UlLq0.ts";
import { createElement as n } from "react";
import { Fragment as r, jsx as i, jsxs as a } from "react/jsx-runtime";
// packages/ui/src/docs/agents/component-map.mdx
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
		i(t, { title: "Agent Guide/Component Map" }),
		"\n",
		i(n.h1, { children: "Component Map" }),
		"\n",
		i(n.p, { children: "Use this map to choose the first component to inspect through Storybook MCP." }),
		"\n",
		i(n.h2, { children: "Inputs" }),
		"\n",
		a(n.ul, { children: [
			"\n",
			a(n.li, { children: [
				"Chakra recipe-backed ",
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
				" are valid public\nbuilding blocks when their styling comes from ",
				i(n.code, { children: "psTheme" }),
				"."
			] }),
			"\n",
			a(n.li, { children: [
				i(n.code, { children: "Checkbox" }),
				", ",
				i(n.code, { children: "Radio" }),
				", ",
				i(n.code, { children: "Switch" }),
				", and ",
				i(n.code, { children: "Slider" }),
				" cover package-owned controls with local behavior or styling beyond Chakra defaults."
			] }),
			"\n",
			a(n.li, { children: [
				i(n.code, { children: "ParamEditor" }),
				" and ",
				i(n.code, { children: "TagEditor" }),
				" cover structured editing flows."
			] }),
			"\n",
			i(n.li, { children: "Use icon buttons for compact tool actions and provide accessible labels." }),
			"\n"
		] }),
		"\n",
		i(n.h2, { children: "Navigation and lists" }),
		"\n",
		a(n.ul, { children: [
			"\n",
			a(n.li, { children: [i(n.code, { children: "Breadcrumb" }), " handles hierarchical page context."] }),
			"\n",
			a(n.li, { children: [
				i(n.code, { children: "Tabs" }),
				" handles dense in-surface navigation; tab triggers should stay at ",
				i(n.code, { children: "xs" }),
				" density."
			] }),
			"\n",
			a(n.li, { children: [i(n.code, { children: "SearchableMenu" }), " handles filtered action and selection menus."] }),
			"\n",
			a(n.li, { children: [
				i(n.code, { children: "ColumnFileBrowser" }),
				", ",
				i(n.code, { children: "Sidenav" }),
				", ",
				i(n.code, { children: "TreeList" }),
				", and ",
				i(n.code, { children: "ListRow" }),
				" cover navigable resource structures."
			] }),
			"\n",
			a(n.li, { children: [
				"Use ",
				i(n.code, { children: "TreeList" }),
				" for hierarchical sections and ",
				i(n.code, { children: "ListRow" }),
				" for individual row composition."
			] }),
			"\n"
		] }),
		"\n",
		i(n.h2, { children: "Pannable workspaces" }),
		"\n",
		a(n.ul, { children: [
			"\n",
			a(n.li, { children: [
				"Use ",
				i(n.code, { children: "Canvas" }),
				" from ",
				i(n.code, { children: "@pstdio/ui/canvas" }),
				" for the dotted background, fixed timeline-style zoom controls, pointer pan, wheel/pinch zoom, and keyboard navigation of a timeline or live-design workspace."
			] }),
			"\n",
			a(n.li, { children: [
				"Canvas callers own their content, camera, and saved layout. Pass the current ",
				i(n.code, { children: "zoom" }),
				", and update it from ",
				i(n.code, { children: "onZoom" }),
				". Configure positive ",
				i(n.code, { children: "minZoom" }),
				" and ",
				i(n.code, { children: "maxZoom" }),
				" bounds (defaults 0.25 and 1); every zoom input uses them. Pass the same limits to ",
				i(n.code, { children: "zoomCanvas" }),
				" when applying anchored zoom to a camera. The percentage button resets to 100%, clamped to those bounds."
			] }),
			"\n",
			a(n.li, { children: [i(n.code, { children: "onPan" }), " receives content movement in screen pixels; native-scroll callers negate it. The forwarded ref points to the scroll viewport. Floating controls and the dot pattern stay fixed while content scrolls."] }),
			"\n",
			a(n.li, { children: [
				"Mark interactive content or separate drag targets with ",
				i(n.code, { children: "data-canvas-control" }),
				". This preserves native input while Space-drag and middle-drag still pan over those regions. Keep portals in their native roots."
			] }),
			"\n",
			a(n.li, { children: [
				"Start from ",
				i(n.code, { children: "Components/Layout/Canvas" }),
				" stories for both native scrolling with sticky headers and transformed live previews. Ordinary lists and documents still use ",
				i(n.code, { children: "ScrollArea" }),
				"."
			] }),
			"\n",
			a(n.li, { children: [
				"Use ",
				i(n.code, { children: "DependencyTimeline" }),
				" from ",
				i(n.code, { children: "@pstdio/ui/dependency-timeline" }),
				" for dependency cards arranged in milestone sections and collapsible tracks. It uses ",
				i(n.code, { children: "Canvas" }),
				" and owns card measurement, dependency arrows, sticky headers, and windowed rendering. Supply ",
				i(n.code, { children: "TimelineSection" }),
				", ",
				i(n.code, { children: "TimelineTrack" }),
				", and ",
				i(n.code, { children: "TimelineItem" }),
				" data with your own card content, headers, editors, and action callbacks. Keep domain data and saved presentation in the caller. See ",
				i(n.code, { children: "Components/Layout/Dependency Timeline" }),
				"."
			] }),
			"\n"
		] }),
		"\n",
		i(n.h2, { children: "Data display" }),
		"\n",
		a(n.ul, { children: [
			"\n",
			a(n.li, { children: [i(n.code, { children: "DataTable" }), " handles tabular data."] }),
			"\n",
			a(n.li, { children: [i(n.code, { children: "KanbanRenderer" }), " handles switchable board/list data views with filtering, grouping, and ordering."] }),
			"\n",
			a(n.li, { children: [
				i(n.code, { children: "Avatar" }),
				", ",
				i(n.code, { children: "KanbanRendererCard" }),
				", ",
				i(n.code, { children: "KanbanRendererList" }),
				", ",
				i(n.code, { children: "ResourceBadge" }),
				", ",
				i(n.code, { children: "WorkspaceBadge" }),
				", ",
				i(n.code, { children: "InfoCard" }),
				", and ",
				i(n.code, { children: "Activity" }),
				" cover common data surfaces."
			] }),
			"\n",
			a(n.li, { children: [
				"Use ",
				i(n.code, { children: "Foundations/Component Gallery / Composites" }),
				" for advanced examples before composing ",
				i(n.code, { children: "KanbanRenderer" }),
				", ",
				i(n.code, { children: "ParamEditor" }),
				", or ",
				i(n.code, { children: "Activity" }),
				" from scratch."
			] }),
			"\n"
		] }),
		"\n",
		i(n.h2, { children: "Feedback and overlays" }),
		"\n",
		a(n.ul, { children: [
			"\n",
			a(n.li, { children: [
				i(n.code, { children: "AlertMessage" }),
				", ",
				i(n.code, { children: "EmptyState" }),
				", ",
				i(n.code, { children: "SessionIndicator" }),
				", and ",
				i(n.code, { children: "Toaster" }),
				" cover status and feedback."
			] }),
			"\n",
			a(n.li, { children: [
				i(n.code, { children: "DeleteConfirmationModal" }),
				", ",
				i(n.code, { children: "Palette" }),
				", and ",
				i(n.code, { children: "RepoPickerDialog" }),
				" cover overlay interactions."
			] }),
			"\n"
		] }),
		"\n",
		i(n.h2, { children: "Text and agent UI" }),
		"\n",
		a(n.ul, { children: [
			"\n",
			a(n.li, { children: [
				i(n.code, { children: "MarkdownEditor" }),
				", ",
				i(n.code, { children: "PromptEditor" }),
				", ",
				i(n.code, { children: "RichMessage" }),
				", and collaborative editor stories cover rich-text surfaces."
			] }),
			"\n",
			a(n.li, { children: [
				i(n.code, { children: "ChatPanel" }),
				", ",
				i(n.code, { children: "ChatInput" }),
				", ",
				i(n.code, { children: "ChatMessage" }),
				", ",
				i(n.code, { children: "ChatPrimitives" }),
				", ",
				i(n.code, { children: "AttachmentList" }),
				", and ",
				i(n.code, { children: "ToolInvocationTimeline" }),
				" cover agent conversation UI."
			] }),
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

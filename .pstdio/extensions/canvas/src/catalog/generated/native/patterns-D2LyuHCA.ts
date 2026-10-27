// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e, r as t } from "./native-document-blocks-ZX3UlLq0.ts";
import { createElement as n } from "react";
import { Fragment as r, jsx as i, jsxs as a } from "react/jsx-runtime";
// packages/ui/src/docs/agents/patterns.mdx
function o(e) {
	let n = {
		code: "code",
		h1: "h1",
		h2: "h2",
		p: "p",
		...e.components
	};
	return a(r, { children: [
		i(t, { title: "Agent Guide/Patterns" }),
		"\n",
		i(n.h1, { children: "Patterns" }),
		"\n",
		i(n.p, { children: "Patterns are composed UI surfaces. Prefer these when building product workflows instead of assembling primitives from scratch." }),
		"\n",
		a(n.p, { children: [
			"Use ",
			i(n.code, { children: "Foundations/Component Gallery / Composites" }),
			" as the quickest visual reference for advanced components before building a new workflow surface."
		] }),
		"\n",
		i(n.h2, { children: "Chat" }),
		"\n",
		a(n.p, { children: [
			"Use ",
			i(n.code, { children: "ChatPanel" }),
			" for full conversation surfaces. It owns the message list, empty/loading states, sticky user-message behavior, workspace hub slot, approval prompt slot, attachment rendering, and input area. Use lower-level chat components only when a host already owns the conversation shell."
		] }),
		"\n",
		a(n.p, { children: [
			"Show follow-ups submitted during active work in ",
			i(n.code, { children: "queuedFollowUps" }),
			" immediately. Set ",
			i(n.code, { children: "sending: true" }),
			" until the server accepts the request. Sending rows show their prompt and attachments, and disable editing, removal, and drag actions. Saved rows remain usable while another row is sending. Replace the sending row with the saved request after acceptance; keep failed-send recovery in the conversation."
		] }),
		"\n",
		i(n.h2, { children: "Kanban Renderer" }),
		"\n",
		a(n.p, { children: [
			"Use ",
			i(n.code, { children: "KanbanRenderer" }),
			" when users need list and board views over the same rows. Provide stable row ids, an explicit ",
			i(n.code, { children: "storageKey" }),
			", typed attributes, and host callbacks for row updates, reordering, creation, and context actions."
		] }),
		"\n",
		a(n.p, { children: [
			"Kanban and data tables share saved-view tabs. A custom ",
			i(n.code, { children: "CollectionViewsSource" }),
			" can provide ",
			i(n.code, { children: "onReorderViews(ids)" }),
			" to enable dragging and Alt+Left/Right moves. Save every view ID in its new order and update the source optimistically. Sources without this callback keep their fixed order."
		] }),
		"\n",
		i(n.h2, { children: "Tree and row navigation" }),
		"\n",
		a(n.p, { children: [
			"Use ",
			i(n.code, { children: "TreeList" }),
			" for hierarchical resources with sections, expansion, selection, drag ordering, and context menus. Use ",
			i(n.code, { children: "ListRow" }),
			" when a custom surface needs the same row density, icons, actions, menus, and navigation behavior without a full tree."
		] }),
		"\n",
		i(n.h2, { children: "Editors" }),
		"\n",
		i(n.p, { children: "Use the editor patterns for markdown, prompt input, and rich-message rendering. Keep editor stories deterministic and avoid real network or collaboration backends unless the story explicitly mocks the boundary." }),
		"\n",
		i(n.h2, { children: "Diff" }),
		"\n",
		i(n.p, { children: "Use the diff patterns for changed-file navigation, file summaries, and drawer-based review flows. Prefer documented diff components over building ad hoc file-change cards." }),
		"\n",
		i(n.h2, { children: "Dialogs and parameter help" }),
		"\n",
		a(n.p, { children: [
			"Use ",
			i(n.code, { children: "Dialog.Title" }),
			", the shared ",
			i(n.code, { children: "CloseButton" }),
			", and ",
			i(n.code, { children: "Dialog.Footer" }),
			" with grouped actions for creation dialogs.\nThe workbench overlay owns its close button; widgets supply the header, body, and footer.\nPut parameter explanations in ",
			i(n.code, { children: "description" }),
			". ",
			i(n.code, { children: "ParamEditorLabel" }),
			" shows a tooltip on hover or keyboard focus of its\ninfo button. Escape uses the shared overlay behavior and can also dismiss a containing dialog. Labels do not add an asterisk; required validation\nstays in the form."
		] }),
		"\n",
		a(n.p, { children: [
			"Selection dropdowns disable themselves when no enabled option or group change can change the value. A sole unset\noption can still be selected. Clearable single selections and multi-selections can still remove their selected value.\nAction menus keep an enabled selected action available so it can run again.\nDeclare icons on options and workspace providers; iconless choices stay iconless. Use ",
			i(n.code, { children: "git-commit-horizontal" }),
			" for\nbranches, ",
			i(n.code, { children: "git-branch" }),
			" for Git worktrees, and ",
			i(n.code, { children: "level-low" }),
			", ",
			i(n.code, { children: "level-mid" }),
			", ",
			i(n.code, { children: "level-high" }),
			", ",
			i(n.code, { children: "level-xhigh" }),
			" for effort levels."
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

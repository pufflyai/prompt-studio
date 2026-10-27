// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { i as e, n as t, r as n, t as r } from "./native-document-blocks-9wQwzhjL.ts";
import { t as i } from "./onboarding-sources-D_wLzQ74.ts";
import a, { TwoResourceKinds as o, n as s, t as c } from "./resource-menu-slots.stories-GyQsFtmr.ts";
import { createElement as l } from "react";
import { Fragment as u, jsx as d, jsxs as f } from "react/jsx-runtime";
// packages/pstdio-workbench/src/examples/onboarding/18-palette-resources.docs.mdx
function p(t) {
	let a = {
		code: "code",
		h1: "h1",
		h2: "h2",
		li: "li",
		p: "p",
		ul: "ul",
		...t.components
	};
	return f(u, { children: [
		d(n, {
			of: c,
			name: "Guide"
		}),
		"\n",
		d(a.h1, { children: "Add actions to resource menus" }),
		"\n",
		d(a.p, { children: "Resource menus expose commands for one resource kind. The primary slot holds common actions. The context slot holds the\nfull right-click menu. Both invoke registered commands with the active resource context." }),
		"\n",
		f(a.p, { children: [
			"This guide uses the Extension API from ",
			d(a.code, { children: "@pstdio/sdk/extensions" }),
			". The diagram below shows how two resource kinds resolve\ntheir declared menu slots. An unresolved slot remains visible as a host diagnostic."
		] }),
		"\n",
		d(r, {
			of: o,
			sourceState: "none"
		}),
		"\n",
		d(a.h2, { children: "Extension code" }),
		"\n",
		d(e, {
			code: i.resourceMenuSlots,
			language: "tsx"
		}),
		"\n",
		d(a.p, { children: "Contribute command ids, not React buttons. This keeps visibility rules, keybindings, and command execution consistent." }),
		"\n",
		d(a.h2, { children: "Story source" }),
		"\n",
		d(a.p, { children: "The canvas uses this host-side diagnostic view to show resolved and unresolved slots." }),
		"\n",
		d(e, {
			code: s,
			language: "tsx"
		}),
		"\n",
		d(a.h2, { children: "What each field means" }),
		"\n",
		f(a.p, { children: [d(a.code, { children: "defineResourceKind(...)" }), " declares one kind of domain object:"] }),
		"\n",
		f(a.ul, { children: [
			"\n",
			f(a.li, { children: [d(a.code, { children: "id" }), " is the stable kind identity inside the extension."] }),
			"\n",
			f(a.li, { children: [d(a.code, { children: "label" }), " is the user-facing name."] }),
			"\n",
			f(a.li, { children: [d(a.code, { children: "menuSlots" }), " lists the menu areas this kind owns. Each slot is a named place where commands can appear."] }),
			"\n"
		] }),
		"\n",
		d(a.p, { children: "Each menu slot entry:" }),
		"\n",
		f(a.ul, { children: [
			"\n",
			f(a.li, { children: [d(a.code, { children: "id" }), " names the slot. Commands target the slot by this name."] }),
			"\n",
			f(a.li, { children: [
				d(a.code, { children: "placement" }),
				" picks the built-in menu area: ",
				d(a.code, { children: "\"header-primary\"" }),
				" for common header actions, ",
				d(a.code, { children: "\"header-overflow\"" }),
				" for the\nheader's overflow menu, or ",
				d(a.code, { children: "\"context-menu\"" }),
				" for the right-click menu."
			] }),
			"\n",
			f(a.li, { children: [
				d(a.code, { children: "access" }),
				" controls who may contribute. ",
				d(a.code, { children: "\"owner\"" }),
				" accepts commands only from the extension that declares the kind.\n",
				d(a.code, { children: "\"public\"" }),
				" also accepts commands from other extensions."
			] }),
			"\n"
		] }),
		"\n",
		f(a.p, { children: [d(a.code, { children: "defineCommand(...)" }), " declares the action:"] }),
		"\n",
		f(a.ul, { children: [
			"\n",
			f(a.li, { children: [d(a.code, { children: "id" }), " is the stable command identity."] }),
			"\n",
			f(a.li, { children: [d(a.code, { children: "title" }), " is the command's user-facing name, shown in surfaces such as the command palette."] }),
			"\n",
			f(a.li, { children: [d(a.code, { children: "menus" }), " lists where the command appears. Each entry targets one slot."] }),
			"\n",
			f(a.li, { children: [
				d(a.code, { children: "run(ctx)" }),
				" executes the command. ",
				d(a.code, { children: "ctx.resource" }),
				" carries the resource the menu was opened on, so the handler knows\nwhich ticket to act on."
			] }),
			"\n"
		] }),
		"\n",
		d(a.p, { children: "Each menu entry:" }),
		"\n",
		f(a.ul, { children: [
			"\n",
			f(a.li, { children: [
				d(a.code, { children: "slot" }),
				" is the target, built with ",
				d(a.code, { children: "resourceMenuSlotRef(kindRef, slotId)" }),
				". The helper pairs a resource kind reference\nwith one of its slot ids."
			] }),
			"\n",
			f(a.li, { children: [d(a.code, { children: "label" }), " is the text shown in the menu."] }),
			"\n",
			f(a.li, { children: [
				d(a.code, { children: "presentation" }),
				" picks how the entry renders: a ",
				d(a.code, { children: "\"button\"" }),
				", an ",
				d(a.code, { children: "\"icon-button\"" }),
				", or a ",
				d(a.code, { children: "\"menu-item\"" }),
				" row."
			] }),
			"\n"
		] }),
		"\n",
		f(a.p, { children: [d(a.code, { children: "defineExtension({ resourceKinds, commands })" }), " packages the contributions. The host resolves each menu entry against\nthe declared slots. An entry that targets an unknown slot stays visible as an unresolved diagnostic instead of failing\nsilently."] })
	] });
}
function m(e = {}) {
	let { wrapper: t } = e.components || {};
	return t ? d(t, {
		...e,
		children: d(p, { ...e })
	}) : p(e);
}
function h() {
	return l(t, {
		component: m,
		annotations: a
	});
}
export { h as default };

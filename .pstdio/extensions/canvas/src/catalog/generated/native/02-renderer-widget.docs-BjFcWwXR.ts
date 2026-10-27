// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { i as e, n as t, r as n, t as r } from "./native-document-blocks-9wQwzhjL.ts";
import i, { Views as a, t as o } from "./onboarding.stories-Now-_M4N.ts";
import { t as s } from "./views-pBNdu9p-.ts";
import { createElement as c } from "react";
import { Fragment as l, jsx as u, jsxs as d } from "react/jsx-runtime";
// packages/pstdio-workbench/src/examples/onboarding/02-renderer-widget.docs.mdx
function f(t) {
	let i = {
		code: "code",
		h1: "h1",
		h2: "h2",
		li: "li",
		ol: "ol",
		p: "p",
		strong: "strong",
		ul: "ul",
		...t.components
	};
	return d(l, { children: [
		u(n, {
			of: o,
			name: "2. Views"
		}),
		"\n",
		u(i.h1, { children: "2. Define and place Views" }),
		"\n",
		u(i.p, { children: "A View defines reusable content. Registering one has no layout side effect: nothing opens until a placement or an\naction shows it. A placement decides where a View appears, who owns it, and how it opens and closes." }),
		"\n",
		u(i.p, { children: "This example registers two Views and three placements:" }),
		"\n",
		d(i.ol, { children: [
			"\n",
			d(i.li, { children: [
				"The ",
				u(i.strong, { children: "Guide" }),
				" View fills the Main region. Its placement is ",
				u(i.code, { children: "presence: \"fixed\"" }),
				", so it always shows and has no close\nbutton."
			] }),
			"\n",
			d(i.li, { children: [
				"The ",
				u(i.strong, { children: "Instance details" }),
				" View is registered once and placed twice. The Side Panel placement is ",
				u(i.code, { children: "presence: \"open\"" }),
				";\nclose it and reopen it from the region's add menu. The Secondary Panel placement is ",
				u(i.code, { children: "presence: \"closed\"" }),
				", so it\nwaits in the add menu until you open it."
			] }),
			"\n"
		] }),
		"\n",
		u(i.p, { children: "Each visible placement gets its own render input, so the two Instance details panels show different placement\nidentities even though they share one View." }),
		"\n",
		u(r, {
			of: a,
			sourceState: "none"
		}),
		"\n",
		u(i.h2, { children: "Complete example" }),
		"\n",
		u(e, {
			code: s,
			language: "tsx"
		}),
		"\n",
		u(i.h2, { children: "What each field means" }),
		"\n",
		u(i.p, { children: "The outer setup creates and owns the module:" }),
		"\n",
		d(i.ul, { children: [
			"\n",
			d(i.li, { children: [u(i.code, { children: "createWorkbench()" }), " creates one workbench service container."] }),
			"\n",
			d(i.li, { children: [u(i.code, { children: "registerModule(...)" }), " groups registrations under one owner so the workbench can remove them together."] }),
			"\n",
			d(i.li, { children: [
				"the module ",
				u(i.code, { children: "id" }),
				" is that owner's stable identity."
			] }),
			"\n",
			d(i.li, { children: [
				u(i.code, { children: "activate(ctx)" }),
				" runs once when the host installs the module. ",
				u(i.code, { children: "ctx" }),
				" exposes the Core contribution APIs and tracks\nevery registration made through them."
			] }),
			"\n"
		] }),
		"\n",
		d(i.p, { children: [u(i.code, { children: "ctx.views.registerView(...)" }), " defines the content:"] }),
		"\n",
		d(i.ul, { children: [
			"\n",
			d(i.li, { children: [u(i.code, { children: "id" }), " is the stable View identity. Placements refer to this value."] }),
			"\n",
			d(i.li, { children: [u(i.code, { children: "title" }), " is the default user-facing label. A placement instance may supply a more specific title."] }),
			"\n",
			d(i.li, { children: [u(i.code, { children: "body" }), " selects how the workbench renders the View."] }),
			"\n",
			d(i.li, { children: [
				u(i.code, { children: "body.kind: \"react\"" }),
				" allows trusted host code to return React. Extensions instead declare native renderer bodies\nsuch as ",
				u(i.code, { children: "tree" }),
				", ",
				u(i.code, { children: "file" }),
				", ",
				u(i.code, { children: "kanban" }),
				", ",
				u(i.code, { children: "dataTable" }),
				", and ",
				u(i.code, { children: "controls" }),
				", or an isolated ",
				u(i.code, { children: "webview" }),
				"."
			] }),
			"\n",
			d(i.li, { children: [u(i.code, { children: "render" }), " creates the content for one visible placement instance."] }),
			"\n",
			d(i.li, { children: [u(i.code, { children: "instance" }), " describes that use of the View: the resolved title, resource, placement identity, and instance identity.\nOne View rendered in two placements receives two different instances."] }),
			"\n"
		] }),
		"\n",
		d(i.p, { children: [u(i.code, { children: "ctx.shellPlacements.registerPlacement(...)" }), " places the content:"] }),
		"\n",
		d(i.ul, { children: [
			"\n",
			d(i.li, { children: [u(i.code, { children: "id" }), " is the stable identity of this shell-owned placement. It is separate from the View id; two placements here\nreuse one View."] }),
			"\n",
			d(i.li, { children: [u(i.code, { children: "item.kind: \"view\"" }), " says this is one static View rather than a resource-bound set of instances."] }),
			"\n",
			d(i.li, { children: [u(i.code, { children: "item.view" }), " names the registered View to render."] }),
			"\n",
			d(i.li, { children: [
				u(i.code, { children: "item.presence" }),
				" sets the initial state: ",
				u(i.code, { children: "\"fixed\"" }),
				" always shows and cannot close, ",
				u(i.code, { children: "\"open\"" }),
				" starts open and the user\nmay close it, ",
				u(i.code, { children: "\"closed\"" }),
				" stays hidden until the user or an action opens it. A saved user choice wins over ",
				u(i.code, { children: "\"open\"" }),
				"\nand ",
				u(i.code, { children: "\"closed\"" }),
				" on the next visit."
			] }),
			"\n",
			d(i.li, { children: [
				u(i.code, { children: "region" }),
				" puts the placement in ",
				u(i.code, { children: "main" }),
				", ",
				u(i.code, { children: "side" }),
				", ",
				u(i.code, { children: "secondary" }),
				", or another shell region."
			] }),
			"\n"
		] }),
		"\n",
		d(i.p, { children: [
			u(i.code, { children: "Stack" }),
			", ",
			u(i.code, { children: "Text" }),
			", ",
			u(i.code, { children: "Code" }),
			", ",
			u(i.code, { children: "gap" }),
			", ",
			u(i.code, { children: "p" }),
			", and ",
			u(i.code, { children: "bg" }),
			" come from the UI component library. They style the React body and are\nnot part of the View or placement API."
		] }),
		"\n",
		u(i.p, { children: "Keep domain identity in a resource when the same View opens tickets, files, sessions, or other objects. The next guide\nshows that form." })
	] });
}
function p(e = {}) {
	let { wrapper: t } = e.components || {};
	return t ? u(t, {
		...e,
		children: u(f, { ...e })
	}) : f(e);
}
function m() {
	return c(t, {
		component: p,
		annotations: i
	});
}
export { m as default };

// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { i as e, n as t, r as n, t as r } from "./native-document-blocks-9wQwzhjL.ts";
import i, { HostTerminal as a, t as o } from "./onboarding.stories-Now-_M4N.ts";
import { t as s } from "./host-terminal-story-DEt3KhcK.ts";
import { createElement as c } from "react";
import { Fragment as l, jsx as u, jsxs as d } from "react/jsx-runtime";
// packages/pstdio-workbench/src/examples/onboarding/20-controls-renderer.docs.mdx
function f(t) {
	let i = {
		code: "code",
		h1: "h1",
		h2: "h2",
		li: "li",
		p: "p",
		strong: "strong",
		ul: "ul",
		...t.components
	};
	return d(l, { children: [
		u(n, {
			of: o,
			name: "16. Host terminal"
		}),
		"\n",
		u(i.h1, { children: "16. Connect the native terminal" }),
		"\n",
		u(i.p, { children: "The workbench owns terminal panels and interaction. The host supplies process operations because only the host can\ncreate a PTY safely. Extensions request a terminal panel without receiving direct process access." }),
		"\n",
		u(i.p, { children: "The adapter must forward output events and release sessions when panels close. Keep operating-system details outside\nthe renderer." }),
		"\n",
		d(i.p, { children: [
			"The story opens Terminal 1 at startup. Press ",
			u(i.strong, { children: "Open another terminal" }),
			" in Main to create Terminal 2, Terminal 3, and as\nmany later tabs as you need. The + menu in the Secondary panel runs the same command."
		] }),
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
		u(i.p, { children: "The host connects a process adapter and activates the terminal module:" }),
		"\n",
		d(i.ul, { children: [
			"\n",
			d(i.li, { children: [
				u(i.code, { children: "createScriptedTerminalBridge({ initial })" }),
				" builds a scripted stand-in for a real PTY bridge. ",
				u(i.code, { children: "initial" }),
				" lists the\noutput the terminal shows first. A real host replaces this with an adapter that spawns processes."
			] }),
			"\n",
			d(i.li, { children: [u(i.code, { children: "ctx.terminal.setSessionOpener((request) => ...)" }), " registers the host callback that opens one terminal session. The\nworkbench calls it whenever a terminal panel needs a process."] }),
			"\n",
			d(i.li, { children: [u(i.code, { children: "createWorkbenchTerminalModule().activate(ctx)" }), " registers the terminal Views and placements. It returns\ndisposables the module passes back so deactivation cleans them up."] }),
			"\n"
		] }),
		"\n",
		u(i.p, { children: "The demo places a launcher in Main and a plain notes View beside terminals in the Secondary panel:" }),
		"\n",
		d(i.ul, { children: [
			"\n",
			d(i.li, { children: [
				"\n",
				d(i.p, { children: [
					"the launcher calls ",
					u(i.code, { children: "workbench.commands.executeCommand(WORKBENCH_TERMINAL_OPEN_COMMAND_ID)" }),
					" each time you press its\nbutton."
				] }),
				"\n"
			] }),
			"\n",
			d(i.li, { children: [
				"\n",
				d(i.p, { children: [u(i.code, { children: "createWorkbenchTerminalModule()" }), " connects the same command to the terminal placement's Add action, so the Secondary\npanel + menu can also create another terminal."] }),
				"\n"
			] }),
			"\n",
			d(i.li, { children: [
				"\n",
				d(i.p, { children: [
					u(i.code, { children: "ctx.views.registerView(...)" }),
					" defines the notes View with a React ",
					u(i.code, { children: "body" }),
					"."
				] }),
				"\n"
			] }),
			"\n",
			d(i.li, { children: [
				"\n",
				d(i.p, { children: [
					u(i.code, { children: "ctx.shellPlacements.registerPlacement(...)" }),
					" places it. ",
					u(i.code, { children: "item.kind: \"view\"" }),
					" places one static View, ",
					u(i.code, { children: "item.view" }),
					"\nnames it, and ",
					u(i.code, { children: "region: \"secondary\"" }),
					" targets the Secondary Panel region."
				] }),
				"\n"
			] }),
			"\n",
			d(i.li, { children: [
				"\n",
				d(i.p, { children: [u(i.code, { children: "item.presence: \"closed\"" }), " keeps the placement hidden until the user or an action opens it. The Add panel offers it."] }),
				"\n"
			] }),
			"\n"
		] }),
		"\n",
		u(i.p, { children: "The story-level setup opens panels and shows persistence:" }),
		"\n",
		d(i.ul, { children: [
			"\n",
			d(i.li, { children: [
				u(i.code, { children: "createWorkbench({ layoutPersistence })" }),
				" creates the workbench, optionally with a layout persistence adapter. The\nadapter has ",
				u(i.code, { children: "getLayout(scope)" }),
				" and ",
				u(i.code, { children: "setLayout(layout, scope)" }),
				"."
			] }),
			"\n",
			d(i.li, { children: [u(i.code, { children: "openWorkbenchTerminal(workbench)" }), " opens Terminal 1 before the story renders."] }),
			"\n",
			u(i.li, { children: "each launcher click runs the registered open command, which creates a new terminal resource and tab." }),
			"\n",
			d(i.li, { children: [u(i.code, { children: "workbench.shellPlacements.openPlacement({ placementId })" }), " opens a declared placement by id. The example uses it to\nopen the closed notes placement."] }),
			"\n",
			d(i.li, { children: [u(i.code, { children: "workbench.layout.setPersistenceScope(scope)" }), " selects which persisted layout is active. The restored story writes a\nlayout under one scope, then creates a second workbench on the same scope to show the layout coming back."] }),
			"\n"
		] })
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

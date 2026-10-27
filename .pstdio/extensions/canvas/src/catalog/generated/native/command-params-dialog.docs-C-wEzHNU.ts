// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { i as e, n as t, r as n, t as r } from "./native-document-blocks-ZX3UlLq0.ts";
import i, { EveryControl as a, FilesParameter as o, NumberParameter as s, RefineTicket as c, RunFailed as l, n as u, t as d } from "./command-params-dialog.stories-DGsFJk8U.ts";
import { createElement as f } from "react";
import { Fragment as p, jsx as m, jsxs as h } from "react/jsx-runtime";
// packages/pstdio-workbench/src/react/command-palette/command-params-dialog.docs.mdx
function g(t) {
	let i = {
		code: "code",
		h1: "h1",
		h2: "h2",
		p: "p",
		strong: "strong",
		...t.components
	};
	return h(p, { children: [
		m(n, {
			of: d,
			name: "Guide"
		}),
		"\n",
		m(i.h1, { children: "Command parameters" }),
		"\n",
		m(i.p, { children: "Command parameter schemas describe values that must be collected before a command runs. The workbench renders one\nshared dialog from the schema, applies defaults, validates required values, and passes normalized arguments to the\ncommand handler." }),
		"\n",
		h(i.p, { children: [
			"Each example now lives on this guide page. Press ",
			m(i.strong, { children: "Open parameter form" }),
			" to try it, then compare the schema with the\nform the workbench created."
		] }),
		"\n",
		m(i.h2, { children: "One number" }),
		"\n",
		m(i.p, { children: "Use a number parameter when a command needs a count or limit." }),
		"\n",
		m(r, {
			of: s,
			sourceState: "none"
		}),
		"\n",
		m(e, {
			code: u.number,
			language: "tsx"
		}),
		"\n",
		m(i.h2, { children: "A real command form" }),
		"\n",
		m(i.p, { children: "This example combines a template picker with optional long text. The command receives both values in its parameter\nobject." }),
		"\n",
		m(r, {
			of: c,
			sourceState: "none"
		}),
		"\n",
		m(e, {
			code: u.refineTicket,
			language: "tsx"
		}),
		"\n",
		m(i.h2, { children: "Shared control types" }),
		"\n",
		m(i.p, { children: "Text, selection, multiple selection, number, boolean, and long text fields all come from the same parameter schema." }),
		"\n",
		m(r, {
			of: a,
			sourceState: "none"
		}),
		"\n",
		m(e, {
			code: u.everyControl,
			language: "tsx"
		}),
		"\n",
		m(i.h2, { children: "Files" }),
		"\n",
		m(i.p, { children: "The files parameter lets the host upload selected files before the command runs. The command receives file references,\nnot browser file objects." }),
		"\n",
		m(r, {
			of: o,
			sourceState: "none"
		}),
		"\n",
		m(e, {
			code: u.files,
			language: "tsx"
		}),
		"\n",
		m(i.h2, { children: "When a command fails" }),
		"\n",
		h(i.p, { children: [
			"When the command throws, the dialog stays open and shows the error message in an error box above the actions. The\nfield values stay, so the user can fix the cause and press ",
			m(i.strong, { children: "Run" }),
			" again. Press ",
			m(i.strong, { children: "Open parameter form" }),
			", then ",
			m(i.strong, { children: "Run" }),
			", to\nsee the planner's \"Run attempt\" refusing a ticket that waits on another one."
		] }),
		"\n",
		m(r, {
			of: l,
			sourceState: "none"
		}),
		"\n",
		m(i.h2, { children: "Rules" }),
		"\n",
		m(i.p, { children: "Define parameters on the command. Do not build another form beside the command surface." }),
		"\n",
		h(i.p, { children: [
			"Parameters with ",
			m(i.code, { children: "resolvedFrom: \"resource\"" }),
			" are supplied by the active resource and are not shown to the user. Use host\nfield renderers only for structured parameter types that the shared editor cannot render."
		] })
	] });
}
function _(e = {}) {
	let { wrapper: t } = e.components || {};
	return t ? m(t, {
		...e,
		children: m(g, { ...e })
	}) : g(e);
}
function v() {
	return f(t, {
		component: _,
		annotations: i
	});
}
export { v as default };

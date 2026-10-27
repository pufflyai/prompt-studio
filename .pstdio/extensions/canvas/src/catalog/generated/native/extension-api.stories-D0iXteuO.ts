// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e } from "./rolldown-runtime-CwxnZyOB.ts";
import { t } from "./extension-preview-CoFgn7XM.ts";
import { n, r, t as i } from "./page-extension-DNMEVn7b.ts";
import { t as a } from "./onboarding-frame-Ba7jPTby.ts";
import { jsx as o } from "react/jsx-runtime";
// packages/pstdio-workbench/src/examples/reference/extension-api.stories.tsx
var s = /* @__PURE__ */ e({
	RunnableExample: () => l,
	default: () => c
}), c = {
	title: "pstdio-workbench/Reference/Extension API",
	tags: ["!dev"],
	parameters: { layout: "padded" }
}, l = {
	name: "Runnable example",
	parameters: { docs: {
		description: { story: "An extension declares native file views, pages, and sidebar navigation items." },
		source: {
			code: i,
			language: "tsx",
			type: "code"
		}
	} },
	render: () => /* @__PURE__ */ o(a, { createWorkbench: () => t(r, n.id) })
};
export { l as RunnableExample, c as default, s as t };

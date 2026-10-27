// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./host-BKbqlzxa.ts";
import { t } from "./workbench-story-B6F8bQqu.ts";
import { n, t as r } from "./runtime-html-58iwVa6z.ts";
import { t as i } from "./fullscreen.fixture-B9vrzI0p.ts";
import { jsx as a } from "react/jsx-runtime";
// packages/pstdio-workbench/src/react/workbench/fullscreen-iframe.stories.tsx
var o = URL.createObjectURL(new Blob([r(n)], { type: "text/html" })), s = "data:text/javascript;charset=utf-8,export%20default%20%7B%20mount(root)%20%7B%0A%20%20const%20input%20%3D%20document.createElement('input')%3B%20input.setAttribute('aria-label'%2C%20'Guest%20draft')%3B%20root.append(input)%3B%0A%20%20const%20button%20%3D%20document.createElement('button')%3B%20button.textContent%20%3D%20'Open%20nested%20dialog'%3B%20root.append(button)%3B%0A%20%20const%20dialog%20%3D%20document.createElement('dialog')%3B%20dialog.textContent%20%3D%20'Guest%20dialog'%3B%20root.append(dialog)%3B%0A%20%20button.onclick%20%3D%20()%20%3D%3E%20%7B%0A%20%20%20%20dialog.showModal()%3B%0A%20%20%20%20document.addEventListener('keydown'%2C%20event%20%3D%3E%20%7B%20if%20(event.key%20%3D%3D%3D%20'Escape')%20%7B%20event.preventDefault()%3B%20dialog.close()%3B%20%7D%20%7D%2C%20%7B%20once%3A%20true%20%7D)%3B%0A%20%20%7D%3B%0A%20%20return%20()%20%3D%3E%20root.replaceChildren()%3B%0A%7D%20%7D%3B", { w: c } = i("attached", !0, { renderEditor: (t) => t === "Editor" || t === "Session" ? /* @__PURE__ */ a(e, {
	title: `${t} extension`,
	theme: "dark",
	props: {},
	view: {
		id: t,
		label: t,
		extensionId: "fullscreen",
		webview: {
			runtimeUrl: o,
			moduleUrl: s,
			styles: []
		}
	}
}) : null }), l = {
	title: "pstdio-workbench/Reference/Core API/Main fullscreen iframe",
	component: t,
	parameters: { layout: "fullscreen" }
}, u = { args: { workbench: c } };
export { u as GuestKeyboard, l as default };

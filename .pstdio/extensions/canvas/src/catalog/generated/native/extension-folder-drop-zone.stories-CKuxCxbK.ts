// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./extension-folder-drop-zone-CaZTla_c.ts";
// packages/pstdio-dashboard/src/modules/settings/components/extension-folder-drop-zone.stories.tsx
var t = {
	title: "ProjectSettings/ExtensionFolderDropZone",
	component: e,
	args: { onDropFolder: () => {} }
}, n = {}, r = { play: async ({ canvasElement: e }) => {
	let t = new DataTransfer();
	t.items.add(new File(["{}"], "package.json")), e.querySelector("[data-testid=\"extension-folder-drop-zone\"]")?.dispatchEvent(new DragEvent("dragenter", {
		bubbles: !0,
		cancelable: !0,
		dataTransfer: t
	}));
} }, i = { args: { addingName: "my-extension" } };
export { r as DragOver, n as Idle, i as Uploading, t as default };

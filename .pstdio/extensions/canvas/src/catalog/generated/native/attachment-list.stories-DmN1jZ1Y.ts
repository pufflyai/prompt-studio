// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./attachment-list-BxV5Ln_Q.ts";
// packages/ui/src/components/chat-ui/components/attachment-list.stories.tsx
var t = {
	title: "Patterns/Chat/Attachment List",
	component: e,
	parameters: { layout: "padded" }
}, n = { args: {
	attachments: ["workspace/analysis/report.md", "workspace/data/users.csv"],
	onSelect: (e) => console.log("Selected:", e),
	onRemove: (e) => console.log("Remove:", e)
} };
export { n as Default, t as default };

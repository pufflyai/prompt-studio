// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, p as t, r as n } from "./test-whhQHjQi.ts";
import { t as r } from "./timeline-kzOAeaXW.ts";
// packages/ui/src/components/chat-ui/components/timeline.stories.tsx
var i = {
	title: "Patterns/Chat/Timeline",
	component: r,
	parameters: { layout: "padded" }
}, a = {
	args: { data: { items: [{
		title: [{
			kind: "text",
			text: "Updated greeting"
		}],
		blocks: [{
			type: "diff",
			language: "typescript",
			original: "const greeting = \"hello\";\n",
			modified: "const greeting = \"welcome\";\n"
		}]
	}] } },
	play: async ({ canvasElement: r }) => {
		let i = e(r);
		await t.click(i.getByText("Updated greeting")), await n(await i.findByRole("row", { name: /welcome/ })).toBeVisible();
	}
};
export { a as Diff, i as default };

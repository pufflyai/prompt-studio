// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { createSlotRecipeContext as e, defineSlotRecipe as t } from "@chakra-ui/react";
// packages/ui/src/components/chat-ui/components/ai-message.tsx
var n = t({
	className: "ai-message",
	slots: ["root", "content"],
	base: {
		root: {
			display: "flex",
			width: "full",
			alignItems: "end",
			justifyContent: "end",
			gap: "sm",
			"&:has(+ [data-scope='ai-message'][data-part='root'])": { mb: 0 }
		},
		content: {
			display: "flex",
			flexDirection: "column",
			gap: "sm",
			textStyle: "sm",
			overflow: "hidden",
			borderRadius: "0"
		}
	},
	variants: {
		from: {
			user: {
				root: {
					mb: "md",
					flexDirection: "row"
				},
				content: {
					"--chat-message-bg": "{colors.bg.subtle}",
					bg: "var(--chat-message-bg)",
					px: "xs",
					py: "xs",
					width: "full",
					borderRadius: "0"
				}
			},
			assistant: {
				root: {
					mb: "md",
					flexDirection: "row",
					justifyContent: "start"
				},
				content: {
					width: "full",
					px: "xs"
				}
			},
			developer: {
				root: {
					width: "full",
					flexDirection: "row-reverse"
				},
				content: { width: "full" }
			}
		},
		size: {
			sm: {
				root: { gap: "xs" },
				content: { textStyle: "xs" }
			},
			md: {},
			lg: {
				root: { gap: "md" },
				content: { textStyle: "md" }
			}
		},
		delivery: {
			sent: {},
			unsent: { content: { opacity: .6 } }
		},
		shape: {
			rounded: { content: { rounded: "0" } },
			pill: { content: { rounded: "0" } },
			square: { content: { rounded: "0" } }
		}
	},
	defaultVariants: {
		from: "user",
		size: "md",
		shape: "rounded",
		delivery: "sent"
	}
}), { withProvider: r, withContext: i } = e({ recipe: n }), a = {
	Root: r("div", "root"),
	Content: i("div", "content")
};
export { a as t };

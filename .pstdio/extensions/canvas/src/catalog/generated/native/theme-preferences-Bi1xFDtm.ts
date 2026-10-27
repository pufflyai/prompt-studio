// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { createThemePreferenceFromVsCodeTheme as e } from "@pstdio/ui";
// extensions/pstdio-base-themes/stories/theme-preferences.ts
var t = [
	{
		id: "solarized-light",
		mode: "light",
		theme: {
			name: "Solarized Light",
			type: "light",
			colors: {
				foreground: "#2E454D",
				descriptionForeground: "#3D535A",
				disabledForeground: "#627269",
				focusBorder: "#196B9B",
				border: "#7C887F",
				"editor.background": "#FDF6E3",
				"editor.foreground": "#2E454D",
				"editor.lineHighlightBackground": "#D7D2BF",
				"editor.selectionBackground": "#C6C5B3",
				"editorCursor.foreground": "#2E454D",
				"editorWhitespace.foreground": "#627269",
				"editorIndentGuide.background1": "#E4DECB",
				"editorIndentGuide.activeBackground1": "#7C887F",
				"sideBar.background": "#EEE8D5",
				"panel.background": "#EEE8D5",
				"editorWidget.background": "#EEE8D5",
				"input.background": "#FDF6E3",
				"input.foreground": "#2E454D",
				"input.border": "#7C887F",
				"dropdown.background": "#EEE8D5",
				"menu.background": "#EEE8D5",
				"menu.foreground": "#2E454D",
				"menu.selectionBackground": "#C6C5B3",
				"badge.background": "#E4DECB",
				"badge.foreground": "#3D535A",
				"button.background": "#196B9B",
				"button.hoverBackground": "#12577F",
				"button.foreground": "#FDF6E3",
				"diffEditor.insertedTextBackground": "#85990026",
				"diffEditor.removedTextBackground": "#dc322f26",
				"gitDecoration.addedResourceForeground": "#3B5400",
				"gitDecoration.deletedResourceForeground": "#991B1B",
				"selection.background": "#C6C5B3",
				"panel.border": "#7C887F",
				"activityBar.background": "#EEE8D5",
				"statusBar.background": "#EEE8D5",
				"statusBar.foreground": "#3D535A",
				"dropdown.foreground": "#2E454D",
				"dropdown.border": "#7C887F",
				"menu.border": "#7C887F",
				"menu.selectionForeground": "#2E454D",
				"list.hoverBackground": "#D7D2BF",
				"list.hoverForeground": "#2E454D",
				"list.focusBackground": "#D7D2BF",
				"list.focusForeground": "#2E454D",
				"list.activeSelectionBackground": "#C6C5B3",
				"list.activeSelectionForeground": "#2E454D",
				"list.inactiveSelectionBackground": "#C6C5B3",
				"list.inactiveSelectionForeground": "#2E454D",
				"list.highlightForeground": "#196B9B"
			},
			tokenColors: [
				{
					scope: "comment",
					settings: {
						foreground: "#93a1a1",
						fontStyle: "italic"
					}
				},
				{
					scope: "string",
					settings: { foreground: "#2aa198" }
				},
				{
					scope: ["keyword", "storage"],
					settings: { foreground: "#859900" }
				},
				{
					scope: ["entity.name.function", "support.function"],
					settings: { foreground: "#268bd2" }
				},
				{
					scope: ["variable", "constant"],
					settings: { foreground: "#b58900" }
				},
				{
					scope: "number",
					settings: { foreground: "#d33682" }
				},
				{
					scope: "entity.name.type",
					settings: { foreground: "#cb4b16" }
				}
			],
			pstdio: { colors: {
				"bg.elevated": "#FDF6E3",
				"bg.emphasized": "#C6C5B3",
				"bg.inverted": "#2E454D",
				"fg.inverted": "#FDF6E3",
				"border.subtle": "#CECAB8",
				"border.inverted": "#7C887F",
				"border.accent-light": "#196B9B",
				"border.button.primary": "#196B9B",
				"bg.button.primary.pressed": "#0B486C",
				"bg.accent-primary.pressed": "#0B486C",
				"bg.accent-primary.very-light": "#E4DECB",
				"bg.accent-primary.light": "#196B9B",
				"bg.accent-primary.medium": "#12577F",
				"bg.accent-primary.dark": "#0B486C",
				"bg.accent-subtle": "#C6C5B3",
				"bg.accent-secondary.blue-medium": "#C6C5B3",
				"text.selectable.primary": "#2E454D",
				"bg.info": "#E0E8DF",
				"fg.info": "#145886",
				"border.info": "#145886",
				"bg.warning": "#F1E4BD",
				"fg.warning": "#745000",
				"border.warning": "#745000",
				"border.success": "#3B5400",
				"border.error": "#991B1B"
			} }
		}
	},
	{
		id: "solarized-dark",
		mode: "dark",
		theme: {
			name: "Solarized Dark",
			type: "dark",
			colors: {
				foreground: "#DAE3DF",
				descriptionForeground: "#B3C6C6",
				disabledForeground: "#789397",
				focusBorder: "#2AA198",
				border: "#63868A",
				"selection.background": "#28545D",
				"editor.background": "#002B36",
				"editor.foreground": "#DAE3DF",
				"editor.lineHighlightBackground": "#1B4852",
				"editor.selectionBackground": "#28545D",
				"editorCursor.foreground": "#DAE3DF",
				"editorWhitespace.foreground": "#789397",
				"editorIndentGuide.background1": "#16424B",
				"editorIndentGuide.activeBackground1": "#63868A",
				"editorWidget.background": "#073642",
				"sideBar.background": "#073642",
				"panel.background": "#073642",
				"panel.border": "#63868A",
				"activityBar.background": "#073642",
				"statusBar.background": "#073642",
				"statusBar.foreground": "#B3C6C6",
				"input.background": "#002B36",
				"input.foreground": "#DAE3DF",
				"input.border": "#63868A",
				"dropdown.background": "#073642",
				"dropdown.border": "#63868A",
				"menu.background": "#073642",
				"menu.foreground": "#DAE3DF",
				"menu.selectionBackground": "#28545D",
				"list.activeSelectionBackground": "#28545D",
				"list.hoverBackground": "#1B4852",
				"list.inactiveSelectionBackground": "#28545D",
				"list.highlightForeground": "#2AA198",
				"badge.background": "#16424B",
				"badge.foreground": "#B3C6C6",
				"button.background": "#2AA198",
				"button.hoverBackground": "#4CB9AE",
				"button.foreground": "#00181E",
				"diffEditor.insertedTextBackground": "#85990033",
				"diffEditor.removedTextBackground": "#dc322f33",
				"gitDecoration.addedResourceForeground": "#B3C95A",
				"gitDecoration.deletedResourceForeground": "#FFB3A8",
				"dropdown.foreground": "#DAE3DF",
				"menu.border": "#63868A",
				"menu.selectionForeground": "#DAE3DF",
				"list.hoverForeground": "#DAE3DF",
				"list.focusBackground": "#1B4852",
				"list.focusForeground": "#DAE3DF",
				"list.activeSelectionForeground": "#DAE3DF",
				"list.inactiveSelectionForeground": "#DAE3DF"
			},
			tokenColors: [
				{
					scope: "comment",
					settings: {
						foreground: "#586e75",
						fontStyle: "italic"
					}
				},
				{
					scope: "string",
					settings: { foreground: "#2aa198" }
				},
				{
					scope: ["keyword", "storage"],
					settings: { foreground: "#859900" }
				},
				{
					scope: ["entity.name.function", "support.function"],
					settings: { foreground: "#268bd2" }
				},
				{
					scope: ["variable", "constant"],
					settings: { foreground: "#b58900" }
				},
				{
					scope: "number",
					settings: { foreground: "#d33682" }
				},
				{
					scope: "entity.name.type",
					settings: { foreground: "#cb4b16" }
				}
			],
			pstdio: { colors: {
				"bg.elevated": "#0F3D48",
				"bg.emphasized": "#28545D",
				"bg.inverted": "#DAE3DF",
				"fg.inverted": "#002B36",
				"border.subtle": "#31515A",
				"border.inverted": "#63868A",
				"border.accent-light": "#2AA198",
				"border.button.primary": "#2AA198",
				"bg.button.primary.pressed": "#238E86",
				"bg.accent-primary.pressed": "#238E86",
				"bg.accent-primary.very-light": "#16424B",
				"bg.accent-primary.light": "#2AA198",
				"bg.accent-primary.medium": "#4CB9AE",
				"bg.accent-primary.dark": "#238E86",
				"bg.accent-subtle": "#28545D",
				"bg.accent-secondary.blue-medium": "#2AA198",
				"text.selectable.primary": "#DAE3DF",
				"bg.info": "#123F50",
				"fg.info": "#8FCBEE",
				"border.info": "#8FCBEE",
				"bg.warning": "#423C20",
				"fg.warning": "#E6C46A",
				"border.warning": "#E6C46A",
				"border.success": "#B3C95A",
				"border.error": "#FFB3A8"
			} }
		}
	},
	{
		id: "dracula",
		mode: "dark",
		theme: {
			name: "Dracula",
			type: "dark",
			colors: {
				foreground: "#F8F8F2",
				descriptionForeground: "#D0C9DC",
				disabledForeground: "#9395AF",
				focusBorder: "#BD93F9",
				border: "#7A7D96",
				"editor.background": "#282A36",
				"editor.foreground": "#F8F8F2",
				"editor.lineHighlightBackground": "#414558",
				"editor.selectionBackground": "#505469",
				"editorCursor.foreground": "#F8F8F2",
				"editorWhitespace.foreground": "#9395AF",
				"editorIndentGuide.background1": "#383B4C",
				"editorIndentGuide.activeBackground1": "#7A7D96",
				"sideBar.background": "#21222C",
				"panel.background": "#21222C",
				"editorWidget.background": "#21222C",
				"input.background": "#282A36",
				"input.foreground": "#F8F8F2",
				"input.border": "#7A7D96",
				"dropdown.background": "#21222C",
				"menu.background": "#21222C",
				"menu.foreground": "#F8F8F2",
				"menu.selectionBackground": "#505469",
				"badge.background": "#383B4C",
				"badge.foreground": "#D0C9DC",
				"button.background": "#BD93F9",
				"button.hoverBackground": "#D6ACFF",
				"button.foreground": "#282A36",
				"diffEditor.insertedTextBackground": "#50FA7B26",
				"diffEditor.removedTextBackground": "#FF555526",
				"gitDecoration.addedResourceForeground": "#50FA7B",
				"gitDecoration.deletedResourceForeground": "#FFB9B9",
				"selection.background": "#505469",
				"panel.border": "#7A7D96",
				"activityBar.background": "#21222C",
				"statusBar.background": "#21222C",
				"statusBar.foreground": "#D0C9DC",
				"dropdown.foreground": "#F8F8F2",
				"dropdown.border": "#7A7D96",
				"menu.border": "#7A7D96",
				"menu.selectionForeground": "#F8F8F2",
				"list.hoverBackground": "#414558",
				"list.hoverForeground": "#F8F8F2",
				"list.focusBackground": "#414558",
				"list.focusForeground": "#F8F8F2",
				"list.activeSelectionBackground": "#505469",
				"list.activeSelectionForeground": "#F8F8F2",
				"list.inactiveSelectionBackground": "#505469",
				"list.inactiveSelectionForeground": "#F8F8F2",
				"list.highlightForeground": "#BD93F9"
			},
			tokenColors: [
				{
					scope: "comment",
					settings: {
						foreground: "#6272A4",
						fontStyle: "italic"
					}
				},
				{
					scope: "string",
					settings: { foreground: "#F1FA8C" }
				},
				{
					scope: ["keyword", "storage"],
					settings: { foreground: "#FF79C6" }
				},
				{
					scope: ["entity.name.function", "support.function"],
					settings: { foreground: "#50FA7B" }
				},
				{
					scope: ["variable", "constant"],
					settings: { foreground: "#8BE9FD" }
				},
				{
					scope: "number",
					settings: { foreground: "#BD93F9" }
				}
			],
			pstdio: { colors: {
				"bg.elevated": "#343746",
				"bg.emphasized": "#505469",
				"bg.inverted": "#F8F8F2",
				"fg.inverted": "#282A36",
				"border.subtle": "#4B4E62",
				"border.inverted": "#7A7D96",
				"border.accent-light": "#BD93F9",
				"border.button.primary": "#BD93F9",
				"bg.button.primary.pressed": "#AA80E5",
				"bg.accent-primary.pressed": "#AA80E5",
				"bg.accent-primary.very-light": "#383B4C",
				"bg.accent-primary.light": "#BD93F9",
				"bg.accent-primary.medium": "#D6ACFF",
				"bg.accent-primary.dark": "#AA80E5",
				"bg.accent-subtle": "#505469",
				"bg.accent-secondary.blue-medium": "#BD93F9",
				"text.selectable.primary": "#F8F8F2",
				"bg.info": "#293D49",
				"fg.info": "#8BE9FD",
				"border.info": "#8BE9FD",
				"bg.warning": "#42432F",
				"fg.warning": "#F1FA8C",
				"border.warning": "#F1FA8C",
				"border.success": "#50FA7B",
				"border.error": "#FFB9B9"
			} }
		}
	},
	{
		id: "monokai",
		mode: "dark",
		theme: {
			name: "Monokai",
			type: "dark",
			colors: {
				foreground: "#F8F8F2",
				descriptionForeground: "#D0CCB9",
				disabledForeground: "#969780",
				focusBorder: "#E6DB74",
				border: "#7E8170",
				"editor.background": "#272822",
				"editor.foreground": "#F8F8F2",
				"editor.lineHighlightBackground": "#434439",
				"editor.selectionBackground": "#535449",
				"editorCursor.foreground": "#F8F8F2",
				"editorWhitespace.foreground": "#969780",
				"editorIndentGuide.background1": "#393A30",
				"editorIndentGuide.activeBackground1": "#7E8170",
				"sideBar.background": "#1F201B",
				"panel.background": "#1F201B",
				"editorWidget.background": "#1F201B",
				"input.background": "#272822",
				"input.foreground": "#F8F8F2",
				"input.border": "#7E8170",
				"dropdown.background": "#1F201B",
				"menu.background": "#1F201B",
				"menu.foreground": "#F8F8F2",
				"menu.selectionBackground": "#535449",
				"badge.background": "#393A30",
				"badge.foreground": "#D0CCB9",
				"button.background": "#E6DB74",
				"button.hoverBackground": "#F4E98A",
				"button.foreground": "#272822",
				"diffEditor.insertedTextBackground": "#A6E22E26",
				"diffEditor.removedTextBackground": "#F9267226",
				"gitDecoration.addedResourceForeground": "#A6E22E",
				"gitDecoration.deletedResourceForeground": "#FFB0CC",
				"selection.background": "#535449",
				"panel.border": "#7E8170",
				"activityBar.background": "#1F201B",
				"statusBar.background": "#1F201B",
				"statusBar.foreground": "#D0CCB9",
				"dropdown.foreground": "#F8F8F2",
				"dropdown.border": "#7E8170",
				"menu.border": "#7E8170",
				"menu.selectionForeground": "#F8F8F2",
				"list.hoverBackground": "#434439",
				"list.hoverForeground": "#F8F8F2",
				"list.focusBackground": "#434439",
				"list.focusForeground": "#F8F8F2",
				"list.activeSelectionBackground": "#535449",
				"list.activeSelectionForeground": "#F8F8F2",
				"list.inactiveSelectionBackground": "#535449",
				"list.inactiveSelectionForeground": "#F8F8F2",
				"list.highlightForeground": "#E6DB74"
			},
			tokenColors: [
				{
					scope: "comment",
					settings: {
						foreground: "#75715E",
						fontStyle: "italic"
					}
				},
				{
					scope: "string",
					settings: { foreground: "#E6DB74" }
				},
				{
					scope: ["keyword", "storage"],
					settings: { foreground: "#F92672" }
				},
				{
					scope: ["entity.name.function", "support.function"],
					settings: { foreground: "#A6E22E" }
				},
				{
					scope: ["variable", "constant"],
					settings: { foreground: "#66D9EF" }
				},
				{
					scope: "number",
					settings: { foreground: "#AE81FF" }
				},
				{
					scope: "entity.name.type",
					settings: { foreground: "#FD971F" }
				}
			],
			pstdio: { colors: {
				"bg.elevated": "#323329",
				"bg.emphasized": "#535449",
				"bg.inverted": "#F8F8F2",
				"fg.inverted": "#272822",
				"border.subtle": "#505144",
				"border.inverted": "#7E8170",
				"border.accent-light": "#E6DB74",
				"border.button.primary": "#E6DB74",
				"bg.button.primary.pressed": "#C6BB5E",
				"bg.accent-primary.pressed": "#C6BB5E",
				"bg.accent-primary.very-light": "#393A30",
				"bg.accent-primary.light": "#E6DB74",
				"bg.accent-primary.medium": "#F4E98A",
				"bg.accent-primary.dark": "#C6BB5E",
				"bg.accent-subtle": "#535449",
				"bg.accent-secondary.blue-medium": "#E6DB74",
				"text.selectable.primary": "#F8F8F2",
				"bg.info": "#293D40",
				"fg.info": "#8FE4F4",
				"border.info": "#8FE4F4",
				"bg.warning": "#423925",
				"fg.warning": "#FFD08A",
				"border.warning": "#FFD08A",
				"border.success": "#A6E22E",
				"border.error": "#FFB0CC"
			} }
		}
	}
].map(({ id: t, mode: n, theme: r }) => {
	let i = e({
		id: t,
		mode: n,
		theme: r
	});
	return {
		...i,
		title: r.name,
		tokens: {
			...i.tokens,
			...Object.fromEntries(Object.entries(r.pstdio.colors).map(([e, t]) => [`colors.${e}`, t]))
		}
	};
});
export { t };

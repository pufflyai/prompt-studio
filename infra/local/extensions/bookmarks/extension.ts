import { defineExtension } from "@pstdio/sdk/extensions";
import { addBookmark, deleteBookmarks, listBookmarks, toggleRead } from "./src/commands";
import { bookmarksNavigation, bookmarksPage, bookmarkTable } from "./src/view";

export default defineExtension({
  commands: [addBookmark, listBookmarks, toggleRead, deleteBookmarks],
  views: [bookmarkTable],
  pages: [bookmarksPage],
  navigationItems: [bookmarksNavigation],
});

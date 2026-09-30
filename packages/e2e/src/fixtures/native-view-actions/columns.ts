import { defineView } from "@pstdio/sdk/extensions";

export const columns = defineView({
  id: "columns",
  title: "Fixed columns",
  body: {
    kind: "kanban",
    attributes: [
      {
        id: "site",
        label: "Site",
        type: { kind: "string" },
        displayable: true,
        display: { kind: "text" },
        listColumn: { placement: "start", size: "sm" },
      },
      {
        id: "mention",
        label: "Mention",
        type: { kind: "string" },
        displayable: true,
        display: { kind: "text" },
        listColumn: { placement: "start", size: "2xs" },
      },
      {
        id: "ideas",
        label: "Ideas",
        type: { kind: "string" },
        displayable: true,
        display: { kind: "text" },
        listColumn: { placement: "end", size: "lg" },
      },
      {
        id: "url",
        label: "Open source",
        type: { kind: "string" },
        displayable: true,
        display: { kind: "link" },
        listColumn: { placement: "end", size: "xs" },
      },
      {
        id: "date",
        label: "Date",
        type: { kind: "string" },
        displayable: true,
        display: { kind: "text" },
        listColumn: { placement: "end", size: "md", align: "end" },
      },
      {
        id: "tag",
        label: "Tag",
        type: { kind: "string" },
        displayable: true,
      },
    ],
    defaultSettings: {
      viewMode: "list",
      columnGrouping: "none",
      rowGrouping: "none",
      ordering: { attributeId: "title", direction: "asc" },
      displayProperties: ["site", "mention", "ideas", "url", "date", "tag"],
    },
    query: () => ({
      rows: [
        {
          id: "one",
          title: "Anyone built internal tools?",
          attributes: {
            site: "RDT",
            tag: "Long ordinary badge",
            ideas: "1 idea",
            url: "https://example.com/one",
            date: "07:12",
          },
        },
        {
          id: "two",
          title: "Prompt Studio on Windows",
          attributes: {
            site: "X",
            mention: "@",
            url: "https://example.com/two",
            date: "05:58",
          },
        },
        {
          id: "three",
          title: "A new tool for agent review",
          attributes: {
            site: "BSKY",
            ideas: "Demo",
            date: "07:10",
          },
        },
      ],
    }),
    onRowActivate: async (ctx, { row }) => {
      await ctx.notify.toast({ type: "info", title: "Opened row", message: row.title });
    },
  },
});

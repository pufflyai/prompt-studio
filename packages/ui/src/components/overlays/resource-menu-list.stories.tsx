import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useRef } from "react";
import { expect, fireEvent, screen, userEvent, waitFor, within } from "storybook/test";
import { ResourceContextMenu } from "./resource-context-menu";

const LazyList = () => {
  const failed = useRef(false);
  return (
    <ResourceContextMenu
      actions={[
        { key: "new", label: "New session" },
        {
          key: "list",
          label: "Search sessions",
          list: {
            id: "project:sessions",
            searchLabel: "Search sessions",
            emptyLabel: "No sessions yet",
            loadPage: async ({ query, cursor, signal }) => {
              await new Promise<void>((resolve, reject) => {
                const timer = setTimeout(resolve, query === "slow" ? 1000 : 10);
                signal.addEventListener(
                  "abort",
                  () => {
                    clearTimeout(timer);
                    reject(new Error("Cancelled"));
                  },
                  { once: true },
                );
              });
              if (cursor === "20" && !failed.current) {
                failed.current = true;
                throw new Error("Could not load more sessions.");
              }
              const entries = Array.from({ length: 120 }, (_, index) => ({
                key: String(index),
                label: `Conversation ${index + 1}`,
              })).filter((item) => item.label.toLowerCase().includes(query.toLowerCase()));
              const offset = Number(cursor ?? 0);
              return {
                items: entries.slice(offset, offset + 20),
                nextCursor: offset + 20 < entries.length ? String(offset + 20) : undefined,
              };
            },
          },
        },
        { key: "all", label: "View all sessions" },
      ]}
    >
      <Box tabIndex={0} p="md">
        Session list target
      </Box>
    </ResourceContextMenu>
  );
};
const meta = { title: "Overlays/ResourceMenuList", component: LazyList } satisfies Meta<typeof LazyList>;
export default meta;
export const LoadingRetryAndCancellation: StoryObj<typeof meta> = {
  play: async ({ canvasElement }) => {
    const open = () => fireEvent.contextMenu(within(canvasElement).getByText("Session list target"));
    await open();
    const results = await screen.findByRole("group", { name: "Search sessions" });
    const rows = () => within(results).getAllByRole("menuitem");
    await waitFor(() => expect(rows()).toHaveLength(20));
    results.scrollTop = results.scrollHeight;
    await fireEvent.scroll(results);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Could not load more sessions."));
    await expect(rows()).toHaveLength(20);
    await expect(screen.getByRole("menuitem", { name: "New session" })).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(rows()).toHaveLength(40));
    const search = screen.getByRole("textbox", { name: "Search sessions" });
    await userEvent.type(search, "Conversation 77");
    await waitFor(() => expect(rows().map((row) => row.textContent)).toEqual(["Conversation 77"]));
    await expect(search).toHaveFocus();
    await userEvent.clear(search);
    await userEvent.type(search, "missing");
    await waitFor(() => expect(within(results).getByRole("status")).toHaveTextContent("No matching results"));
    await userEvent.clear(search);
    await userEvent.type(search, "slow");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    await open();
    await waitFor(() =>
      expect(screen.getByRole("group", { name: "Search sessions" }).querySelectorAll('[role="menuitem"]')).toHaveLength(
        20,
      ),
    );
    await userEvent.keyboard("{Escape}");
  },
};

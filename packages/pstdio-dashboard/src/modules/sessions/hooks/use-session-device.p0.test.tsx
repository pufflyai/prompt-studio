import { expect, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AccountDevice } from "pstdio-api-contracts";
import { renderToStaticMarkup } from "react-dom/server";
import { useSessionDevice } from "./use-session-device";

const owner = { id: "laptop", name: "Laptop", ownerId: "account" };
const laptop: AccountDevice = {
  id: "laptop",
  name: "Laptop",
  current: false,
  online: true,
  platform: "macos",
  createdAt: "",
  lastSeenAt: "",
};
const DeviceAccess = () => {
  const access = useSessionDevice(owner);
  return <output data-offline={access.offline} data-unavailable={access.unavailable} />;
};
const readAccess = (client: QueryClient) =>
  renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <DeviceAccess />
    </QueryClientProvider>,
  );

test("pending device presence is unavailable without claiming that the owner is offline", () => {
  const client = new QueryClient();
  try {
    const html = readAccess(client);
    expect(html).toContain('data-offline="false"');
    expect(html).toContain('data-unavailable="true"');
  } finally {
    client.clear();
  }
});

test("a failed presence poll retains the last known online owner", async () => {
  const client = new QueryClient();
  try {
    client.setQueryData(["account-devices"], [laptop]);
    await client
      .fetchQuery({
        queryKey: ["account-devices"],
        retry: false,
        queryFn: () => {
          throw new Error("Presence unavailable");
        },
      })
      .catch(() => {});
    expect(client.getQueryState(["account-devices"])?.status).toBe("error");
    const html = readAccess(client);
    expect(html).toContain('data-offline="false"');
    expect(html).toContain('data-unavailable="false"');
  } finally {
    client.clear();
  }
});

test("a failed initial presence read stays unknown and blocks remote commands", async () => {
  const client = new QueryClient();
  try {
    await client
      .fetchQuery({
        queryKey: ["account-devices"],
        retry: false,
        queryFn: () => {
          throw new Error("Presence unavailable");
        },
      })
      .catch(() => {});
    expect(client.getQueryState(["account-devices"])?.status).toBe("error");
    const html = readAccess(client);
    expect(html).toContain('data-offline="false"');
    expect(html).toContain('data-unavailable="true"');
  } finally {
    client.clear();
  }
});

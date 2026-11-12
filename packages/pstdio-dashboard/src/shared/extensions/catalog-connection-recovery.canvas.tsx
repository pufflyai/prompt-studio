import { Button, Stack, Text } from "@chakra-ui/react";
import { PstdioConnectionError } from "@pstdio/sdk/client";
import { createScopedQueryClient } from "@pstdio/sdk/extensions";
import { useScopedQuery } from "@pstdio/sdk/extensions/react";
import { AlertMessage } from "@pstdio/ui";
import { useEffect, useState } from "react";

const CatalogConnectionRecovery = () => {
  const [backend] = useState(() => ({ available: false, failure: new PstdioConnectionError("Dropped response") }));
  const [attempts, setAttempts] = useState(0);
  const [active, setActive] = useState(true);
  const [queries] = useState(() => createScopedQueryClient({ runtimeId: "canvas", extensionId: "catalog" }));
  const query = queries.query({
    id: "extensions",
    read: () => {
      setAttempts((count) => count + 1);
      if (!backend.available) throw backend.failure;
      return "Loaded extensions";
    },
  });
  const snapshot = useScopedQuery(query, active);
  useEffect(() => () => queries.dispose(), [queries]);
  return (
    <Stack gap="md" p="md">
      <Text>Read attempts {attempts}</Text>
      <Button
        onClick={() => {
          backend.available = true;
        }}
      >
        Restore response
      </Button>
      <Button onClick={() => setActive(!active)}>{active ? "Hide page" : "Show page"}</Button>
      {active ? (
        <>
          {snapshot.error ? <AlertMessage status="error">{snapshot.error.message}</AlertMessage> : null}
          {snapshot.loading ? <Text>Loading extensions</Text> : null}
          {snapshot.data ? <Text>{snapshot.data}</Text> : null}
        </>
      ) : null}
    </Stack>
  );
};

export default {
  title: "Product/Settings/Extensions/Connection recovery",
  component: CatalogConnectionRecovery,
  description:
    "Displayed catalog reads recover quietly. Hiding the page stops its retries; imperative query errors still settle normally.",
};
export const InitialConnectionFailure = {};

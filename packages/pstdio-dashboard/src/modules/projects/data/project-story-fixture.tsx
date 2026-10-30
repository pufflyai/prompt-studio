import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";

export const ProjectStoryFixture = (props: { children: ReactNode }) => {
  const { children } = props;
  const [client] = useState(() => {
    const client = new QueryClient({ defaultOptions: { queries: { enabled: false } } });
    client.setQueryData(["account-status"], { cloudProjects: [] });
    return client;
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};

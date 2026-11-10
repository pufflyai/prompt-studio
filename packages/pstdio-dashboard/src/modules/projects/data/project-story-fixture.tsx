import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { getDashboardAccountStatusQuery } from "@/lib/scoped-queries";

export const ProjectStoryFixture = (props: { children: ReactNode }) => {
  const { children } = props;
  const [client] = useState(() => {
    const client = new QueryClient({ defaultOptions: { queries: { enabled: false } } });
    getDashboardAccountStatusQuery().accept({
      login: null,
      features: null,
      cloudProjects: [],
      cloudProjectsLoaded: true,
    });
    return client;
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};

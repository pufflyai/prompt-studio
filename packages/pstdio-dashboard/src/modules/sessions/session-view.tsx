import { Spinner } from "@chakra-ui/react";
import type { WorkbenchModuleContext } from "@pstdio/workbench";
import { lazy, Suspense } from "react";
import type { DashboardSessionDraftPersistence } from "@/shared/app/session-draft-persistence";

const SessionWidget = lazy(() =>
  import("./components/session-widget").then((module) => ({ default: module.SessionWidget })),
);

// Navigation identities stay with their owners; presentation has one owner.
export const registerSessionView = (
  ctx: WorkbenchModuleContext,
  id: string,
  drafts?: DashboardSessionDraftPersistence,
) =>
  ctx.views.registerView(
    {
      id,
      title: "Session",
      icon: "MessageCircle",
      body: {
        kind: "react",
        render: (input) => (
          <Suspense fallback={<Spinner />}>
            <SessionWidget input={input} drafts={drafts} />
          </Suspense>
        ),
      },
    },
    { priority: 40 },
  );

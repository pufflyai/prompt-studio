import { Toaster } from "@pstdio/ui";
import { Outlet } from "@tanstack/react-router";
import { SessionBubbleButton } from "@/features/sessions/components/session-bubble-button";

export const Layout = () => {
  return (
    <>
      <Outlet />
      <Toaster />
      <SessionBubbleButton />
    </>
  );
};

import { Toaster } from "@pstdio/ui";
import { Outlet } from "@tanstack/react-router";

export const Layout = () => {
  return (
    <>
      <Outlet />
      <Toaster />
    </>
  );
};

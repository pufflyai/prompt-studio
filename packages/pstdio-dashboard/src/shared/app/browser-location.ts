export const resolveDashboardViewPath = (pathname: string) => {
  const match = pathname.match(/^\/projects\/[^/]+\/(.+?)\/?$/);
  return match?.[1];
};

export const relayResponse = (value: unknown, status = 200, extra?: Record<string, string>) => {
  const headers = new Headers(extra);
  headers.set("cache-control", "no-store");
  return Response.json(value, { status, headers });
};

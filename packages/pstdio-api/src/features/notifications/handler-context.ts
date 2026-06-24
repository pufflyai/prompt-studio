export type NotificationHandlerContext = {
  req: {
    valid(target: "param" | "query" | "json"): unknown;
  };
  json(body: unknown, status: number): unknown;
};

export const asNotificationHandlerContext = (context: unknown) => context as NotificationHandlerContext;

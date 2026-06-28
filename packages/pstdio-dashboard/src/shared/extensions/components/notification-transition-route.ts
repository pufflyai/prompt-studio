export const notificationStatusRouteVerb = (status: "done" | "dismissed" | "expired") =>
  status === "dismissed" ? "dismiss" : status;

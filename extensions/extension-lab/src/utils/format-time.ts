export const formatTime = (timestamp: number) => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
};

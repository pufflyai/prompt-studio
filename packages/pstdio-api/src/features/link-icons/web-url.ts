// Link icons fetch only plain web URLs. Credentials in a URL would be sent to the site.
export const webUrl = (value: string, base?: string) => {
  try {
    const url = new URL(value, base);
    if ((url.protocol === "http:" || url.protocol === "https:") && !url.username && !url.password) return url;
  } catch {}
  return null;
};

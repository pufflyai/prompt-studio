// A service may run under a path of a shared address, such as https://base.prompt.studio/relay.
export const serviceAddress = (input: string) => {
  const url = new URL(input);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !(
      url.protocol === "https:" ||
      (url.protocol === "http:" && ["127.0.0.1", "[::1]", "localhost"].includes(url.hostname))
    )
  )
    throw new Error("Invalid service address");
  return url.href.replace(/\/+$/, "");
};

// Service routes are absolute paths; resolve them under the address path, not at its origin.
export const serviceUrl = (address: string, path: string) =>
  new URL(path.replace(/^\/+/, ""), `${serviceAddress(address)}/`);

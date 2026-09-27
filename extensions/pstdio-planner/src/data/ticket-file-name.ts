export const validateTicketFileName = (name: string) => {
  if (
    name.split("/").some((part) => !part.trim() || part === "." || part === "..") ||
    /[\\:]/.test(name) ||
    name.includes("\0")
  ) {
    throw new Error(`Invalid ticket file name: ${JSON.stringify(name)}. Use a path inside the ticket files folder.`);
  }
  return name;
};

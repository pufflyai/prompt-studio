import type { CloudDeviceProviderInput } from "pstdio-api-contracts";
import { z } from "zod";

export class CloudDeviceRequestError extends Error {}
const dropletSchema = z.object({ id: z.number().int().positive(), status: z.string(), tags: z.array(z.string()) });
export const cloudDeviceTag = (deviceId: string) => `pstdio-device-${deviceId}`;

export const cloudDeviceUserData = (image: string, envelope: unknown) => {
  const commands = [
    "install -d -m 0700 -o 1000 -g 1000 /opt/pstdio/home /opt/pstdio/home/.pstdio",
    "mv /opt/pstdio/bootstrap.json /opt/pstdio/home/.pstdio/bootstrap.json",
    "chown 1000:1000 /opt/pstdio/home/.pstdio/bootstrap.json",
    `docker run -d --restart unless-stopped --name pstdio-device --mount type=bind,src=/opt/pstdio/home,dst=/home/bun -e PSTDIO_CLOUD_BOOTSTRAP_FILE=/home/bun/.pstdio/bootstrap.json ${image}`,
  ];
  return [
    "#cloud-config",
    "package_update: true",
    "packages: [docker.io]",
    "write_files:",
    "  - path: /opt/pstdio/bootstrap.json",
    '    permissions: "0600"',
    `    content: ${JSON.stringify(JSON.stringify(envelope))}`,
    "runcmd:",
    ...commands.map((command) => `  - ${JSON.stringify(command)}`),
    "",
  ].join("\n");
};

export const createCloudDeviceProvider = (
  config: CloudDeviceProviderInput,
  origin = "https://api.digitalocean.com",
) => {
  const call = async (path: string, body?: unknown) => {
    try {
      const response = await fetch(`${origin}/v2${path}`, {
        method: body === undefined ? "GET" : "POST",
        redirect: "error",
        headers: { authorization: `Bearer ${config.token}`, "content-type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) throw new Error();
      return await response.json();
    } catch {
      throw new CloudDeviceRequestError(
        "Cloud provider request failed. Check your provider settings and refresh before starting again.",
      );
    }
  };
  const owned = (value: unknown, id: string) => {
    const droplet = dropletSchema.parse(value);
    if (!droplet.tags.includes(cloudDeviceTag(id)))
      throw new CloudDeviceRequestError("This provider resource belongs to another device.");
    return droplet;
  };
  return {
    async find(id: string, providerId?: string | null) {
      if (providerId) {
        const response = z
          .object({ droplet: z.unknown() })
          .parse(await call(`/droplets/${encodeURIComponent(providerId)}`));
        return owned(response.droplet, id);
      }
      const response = z
        .object({
          droplets: z.array(dropletSchema),
          links: z.object({ pages: z.object({ next: z.string().optional() }).optional() }).optional(),
        })
        .parse(await call(`/droplets?tag_name=${cloudDeviceTag(id)}&per_page=200`));
      const found = response.droplets.filter((droplet) => droplet.tags.includes(cloudDeviceTag(id)));
      if (found.length > 1 || response.links?.pages?.next)
        throw new CloudDeviceRequestError(
          "Multiple provider resources need reconciliation. Inspect your provider account before continuing.",
        );
      return found[0] ?? null;
    },
    async create(id: string, envelope: unknown) {
      const response = z.object({ droplet: z.unknown() }).parse(
        await call("/droplets", {
          name: `pstdio-${id}`,
          region: config.region,
          size: config.size,
          image: "ubuntu-24-04-x64",
          tags: [cloudDeviceTag(id)],
          monitoring: true,
          backups: false,
          user_data: cloudDeviceUserData(config.image, envelope),
        }),
      );
      return owned(response.droplet, id);
    },
    action: (providerId: string, type: "power_on" | "shutdown") =>
      call(`/droplets/${encodeURIComponent(providerId)}/actions`, { type }),
  };
};

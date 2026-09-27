# Temporary CI Docker Hub mirror

Proposed: 2026-09-27

## Status

Accepted as a temporary workaround.

## Intended design

The CI `build_docker` job builds the API and landing page images from their Dockerfiles exactly as a developer or the release workflow would. Base images come from their normal registry, and a build fails only when our Dockerfiles or sources are wrong.

## External limitation

The Dockerfiles use `node:24-bookworm-slim`, `nginx:1.27-alpine`, `oven/bun:1.4.2` and `oven/bun:1.4.2-slim` from Docker Hub. CI pulls them anonymously. Docker Hub rate-limits anonymous pulls per IP, and GitHub-hosted runners share IPs. Pulls sometimes fail before any of our code runs, for example on #764 ([run 36308658281](https://github.com/pufflyai/prompt-studio/actions/runs/36308658281)):

```
failed to fetch oauth token: Post "https://auth.docker.io/token": ... connection reset by peer
```

The repository does not control Docker Hub's limits or the runners' network. Retrying inside the Dockerfile is not possible, because the failure happens while resolving the base image.

## Temporary workaround

Before building, the `build_docker` job adds `https://mirror.gcr.io` to the runner's Docker daemon `registry-mirrors` and restarts the daemon. It keeps any mirrors the runner already had. `mirror.gcr.io` is Google's public read-only cache of Docker Hub images. The daemon tries the mirror first and falls back to Docker Hub when the mirror does not have an image, so a build now fails only if both sources fail.

Trade-offs:

- Images can come from a cache instead of Docker Hub. The cache serves the same content-addressed digests, so the build inputs do not change.
- The daemon restart adds a few seconds to the job.
- Credentials, the Dockerfiles, and the release workflow (`publish-containers.yml`) are unchanged.

## Isolation

The step lives only in the `build_docker` job of `.github/workflows/test-and-build.yml`. Do not add it to the Dockerfiles, local development, or the release workflow.

## Removal

Remove the step when CI pulls base images with authenticated Docker Hub credentials, or when the base images move to a registry without anonymous pull limits. Before removing it, run `build_docker` several times without the mirror and confirm the pulls succeed.

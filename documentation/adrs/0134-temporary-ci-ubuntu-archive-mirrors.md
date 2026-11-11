# Temporary CI Ubuntu archive mirrors

Proposed: 2026-11-04

Status: Temporarily superseded during the Canonical DNS outage by [ADR 0144](0144-temporary-ci-ubuntu-dns-mirrors.md). The Azure transfer limitation and its separate removal condition remain applicable after DNS recovery.

## Intended design

Linux CI installs the unchanged browser system packages and all selected Playwright engines within the existing job allowances. The runner image supplies working, signed Ubuntu repositories.

## External limitation

In [settings qualification 41878243467](https://github.com/pufflyai/prompt-studio/actions/runs/41878243467/job/126743716958), metadata downloaded at normal speed, but Azure archive transfers consumed about 29 minutes before the 30-minute job allowance expired. The planned 181 new packages/114 MB were only partly downloaded; browsers and tests never started.

[Runner-images issue #14823](https://github.com/actions/runner-images/issues/14823) tracks the same slow-transfer behavior. [The image configuration](https://github.com/actions/runner-images/blob/main/images/ubuntu/scripts/build/configure-apt-sources.sh) places Azure first in `/etc/apt/apt-mirrors.txt`, followed by Ubuntu archive and security sources. A transfer that keeps trickling data does not activate stalled-connection failover. The repository cannot repair that external endpoint.

## Temporary workaround

Shared CI setup removes only the Azure entry when the runner's mirror-list file exists. APT continues using the image's existing Ubuntu archive/security fallbacks, package versions, repository signatures and keys. The unchanged Playwright installer then installs the same libraries and engines. No cache, retry, timeout, budget, platform or workload changes.

This affects only ephemeral Linux CI runners using this shared action. Source lists, local development, product code and non-Linux jobs stay unchanged. Ubuntu's remaining mirrors become the external dependency; their performance must be established by corrected-head CI.

## Removal

Remove this step after upstream resolves the slow archive path and ordinary first-attempt native CI observations show the complete browser setup and selected tests finishing within the existing allowance using the runner's original mirror list. Do not use retries or reliability loops as evidence.

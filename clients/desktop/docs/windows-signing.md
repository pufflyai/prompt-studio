# Windows signing with Azure Artifact Signing

Azure keeps the private key. There is no `.pfx` file to download or upload to GitHub. The build creates `metadata.json` from account settings; this file contains resource names, not a private key.

## Find the existing account

1. Sign in at <https://portal.azure.com> using the directory that owns the paid signing account.
2. Search for **Artifact Signing** (formerly **Trusted Signing**) and open the account.
3. On **Overview**, copy the account name, endpoint, and subscription ID. Use the endpoint shown by Azure; it must match the account region.
4. Under **Identity validations**, confirm the company identity is approved.
5. Under **Certificate profiles**, open the profile. Its type must be **Public Trust**, not Public Trust Test. Copy its name.

Do not create another paid account if the existing one is ready.

## Connect GitHub without a stored password

Use a Microsoft Entra app registration dedicated to `pufflyai/prompt-studio` signing. Record its application/client ID and tenant ID. Create its service principal if it does not already exist.

Add a federated credential with:

- Issuer: `https://token.actions.githubusercontent.com`
- Audience: `api://AzureADTokenExchange`
- Subject for production: `repo:pufflyai/prompt-studio:ref:refs/heads/main`
- For the PS-3 candidate, a separate credential with subject `repo:pufflyai/prompt-studio:ref:refs/heads/feature/ps-3-native-desktop-support`. Remove this credential after acceptance.

Grant that service principal **Artifact Signing Certificate Profile Signer** on the specific Public Trust certificate profile. It does not need subscription Contributor or Owner access. Keep the main branch protected: code in an authorized branch can request signatures.

Set these GitHub repository Actions variables. They are identifiers, not secrets:

| Variable | Value |
| --- | --- |
| `AZURE_CLIENT_ID` | Dedicated app registration application/client ID |
| `AZURE_TENANT_ID` | Directory/tenant ID |
| `AZURE_SUBSCRIPTION_ID` | Subscription containing the signing account |
| `AZURE_SIGNING_ENDPOINT` | Account endpoint from Overview |
| `AZURE_SIGNING_ACCOUNT` | Signing account name |
| `AZURE_SIGNING_PROFILE` | Public Trust certificate profile name |

No client secret or certificate password is required. GitHub uses a short-lived identity token, and Azure checks the repository and branch before accepting it.

## Verify before publishing

Run **Verify Windows signing** from GitHub Actions on the authorized branch. A new workflow must first exist on the default branch to appear in the manual workflow list. During PR development, a temporary push trigger scoped to the implementation branch can run the same job after the Azure connection is ready; remove that trigger before merging.

The job builds with Forge, signs the app and native runtime, then records the runtime's final checksum before Squirrel builds the installer. Squirrel signs its installer and generated executables. SHA-256 and the Microsoft timestamp service are used. Signing failures fail the build.

The verifier checks trusted signatures and timestamps for the packaged app, runtime, installer, and the app/runtime extracted from the full update package. It validates the runtime checksum and version in both locations. It then runs the packaged application tests and uploads the installer as a GitHub Actions artifact. It does not publish a release.

Download `windows-signed-candidate` for manual installation. Follow [manual platform validation](manual-platform-validation.md), including a real update between two signed versions and verification of the installed updater. An archive signature check is not an install/update test. Windows remains excluded from the production release matrix until acceptance is complete.

The production desktop workflow uses the same Azure setup action and Forge configuration. Once Windows is enabled, the release must run from the authorized `main` branch even though it checks out the package release tag.

## References

- [Microsoft signing integrations](https://learn.microsoft.com/en-us/azure/artifact-signing/how-to-signing-integrations)
- [Microsoft Artifact Signing quickstart](https://learn.microsoft.com/en-us/azure/artifact-signing/quickstart)
- [Microsoft GitHub OIDC instructions](https://github.com/Azure/artifact-signing-action/blob/main/docs/OIDC.md)

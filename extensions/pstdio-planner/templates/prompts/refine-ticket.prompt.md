Refine ticket {{ticket}}.
{{#templateName}}Use the {{templateName}} template.{{/templateName}}
{{#additionalContext}}Use this added context:
{{additionalContext}}{{/additionalContext}}

Follow the refine-ticket skill. Read the project policy with `pst pstdio-planner refinement-policy` and check `pst --help` for `pstdio-artifacts`.
If the ticket adds a new feature with UX changes, `generateArtifactPrototype` is enabled, and Artifacts is installed and enabled for this project, create and publish an interactive HTML prototype before completing refinement. Use the publish-artifact skill and link the returned dashboard URL in the ticket. Reuse that URL when updating an existing prototype.
If the policy disables prototypes or Artifacts is unavailable, record why the prototype was skipped. Do not install an extension automatically. If the policy cannot be read, resolve or report the failure before completing refinement.

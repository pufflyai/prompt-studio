export const chapterFixtures = [
  {
    title: "Workspaces",
    group: "Core",
    topics: [
      [
        "Keep workspace context visible",
        "Tasks identify the workspace in which they run.",
        "A reader can identify the task's active workspace.",
      ],
      [
        "Isolate parallel work",
        "Independent workspaces keep their local files and processes separate.",
        "An edit in one workspace does not alter another workspace's working files.",
      ],
      [
        "Return to ongoing work",
        "Returning to a workspace restores its active resources.",
        "The previously selected resource can be reopened.",
      ],
    ],
    test: "packages/pstdio/src/adapters/cli/commands/workspace/create.p0.test.ts",
  },
  {
    title: "Sessions",
    group: "Core",
    topics: [
      [
        "Start a session in a workspace",
        "A session identifies the workspace and agent in which its work runs.",
        "Creating a session retains the requested workspace and agent.",
      ],
      [
        "Continue ongoing work",
        "A follow-up message continues the selected session with its retained context.",
        "A follow-up targets the selected session.",
      ],
      [
        "Stop active work",
        "A person can stop a running session without deleting its conversation.",
        "Stopping execution preserves the session record.",
      ],
    ],
    test: "packages/pstdio/src/adapters/cli/commands/sessions/create.p0.test.ts",
  },
  {
    title: "Agents",
    group: "Core",
    topics: [
      [
        "Show active work",
        "Agent progress remains inspectable while a task runs.",
        "The current task exposes its progress and elapsed time.",
      ],
      [
        "Respect granted permissions",
        "Agents operate within the permissions of the active project.",
        "A denied capability cannot be used through another interface.",
      ],
      [
        "Keep task results accessible",
        "Completed agent work retains its result and supporting context.",
        "The result remains readable after execution ends.",
      ],
    ],
    test: "packages/pstdio/src/adapters/cli/commands/agents/setup.p0.test.ts",
  },
  {
    title: "Resources",
    group: "Core",
    topics: [
      [
        "Open resources by reference",
        "A stable resource reference opens the record it identifies.",
        "Opening a resource resolves its declared identity and view.",
      ],
      [
        "Search across tools",
        "Global resource search includes every registered requirement-book entry.",
        "Searching an RB reference opens that rule regardless of the current chapter.",
      ],
      [
        "Keep relationships navigable",
        "A linked resource remains reachable from the record that references it.",
        "Activating a resource tag opens its target.",
      ],
    ],
    test: "packages/pstdio-workbench/src/react/resource-links/global-panel-navigation.p0.test.ts",
  },
  {
    title: "Navigation",
    group: "Core",
    topics: [
      [
        "Keep references stable",
        "A resource reference continues to identify the same resource after a move.",
        "A moved resource still opens from an existing reference.",
      ],
      [
        "Use contextual navigation",
        "A page's navigation replaces the project tree while that page is active.",
        "Entering and leaving the page restores the expected navigation.",
      ],
      [
        "Preserve reading context",
        "Following a related reference does not discard the reader's place.",
        "Returning restores the selected chapter and rule.",
      ],
    ],
    test: "packages/pstdio-workbench/src/core/registries/navigation/navigation-registry.p0.test.ts",
  },
  {
    title: "Extension platform",
    group: "Core",
    topics: [
      [
        "Use public interfaces",
        "Extensions use supported platform interfaces.",
        "An extension runs without importing host internals.",
      ],
      [
        "Declare capabilities",
        "Extension capabilities are declared before they are used.",
        "The host can identify the permissions an extension requests.",
      ],
      [
        "Keep tools replaceable",
        "First-party tools follow the same extension contracts as external tools.",
        "A first-party tool requires no private platform interface.",
      ],
    ],
    test: "packages/pstdio-api/src/services/extension-service.p1.test.ts",
  },
  {
    title: "Storage",
    group: "Core",
    topics: [
      [
        "Keep extension data scoped",
        "Extension-owned files remain within the extension's project storage.",
        "An extension's file API cannot escape its storage directory.",
      ],
      [
        "Persist durable records",
        "Durable records survive normal application restarts.",
        "A saved record can be retrieved after reopening the application.",
      ],
      [
        "Report write failures",
        "A failed write does not appear as successful persistence.",
        "The affected view retains the failure and recovery control.",
      ],
    ],
    test: "packages/pstdio-sync/src/records/document-storage.p0.test.ts",
  },
  {
    title: "Synchronization",
    group: "Core",
    topics: [
      [
        "Converge connected clients",
        "Connected clients receive accepted updates to shared records.",
        "A second client can retrieve the accepted update.",
      ],
      [
        "Retain pending work",
        "Temporary disconnection preserves pending local work.",
        "Pending updates remain available when the connection returns.",
      ],
      [
        "Expose conflicts",
        "Overlapping updates cannot silently discard accepted work.",
        "A conflicting update exposes the competing versions.",
      ],
    ],
    test: "packages/pstdio-sync/src/text/text-document-edits.p0.test.ts",
  },
  {
    title: "Permissions",
    group: "Core",
    topics: [
      [
        "Scope access to the task",
        "A capability grants only the access it declares.",
        "Access outside the declared scope is denied.",
      ],
      [
        "Explain denied actions",
        "Permission failures identify the blocked capability.",
        "The affected control presents an actionable error.",
      ],
      [
        "Honor revocation",
        "Revoked access stops further use of the capability.",
        "A subsequent request cannot reuse revoked access.",
      ],
    ],
    test: "packages/pstdio-extensions/src/bridge/host/iframe-permissions.p0.test.ts",
  },
  {
    title: "Notifications",
    group: "Core",
    topics: [
      [
        "Direct attention to pending work",
        "A notification links to the resource that needs attention.",
        "A created notification retains its target resource.",
      ],
      [
        "Retain read state",
        "A dismissed notification does not repeatedly interrupt the person.",
        "Changing notification status retains the selected state.",
      ],
      [
        "Keep action context",
        "A notification identifies the action that requires a response.",
        "The target action can be retrieved from its notification.",
      ],
    ],
    test: "packages/pstdio-api/src/features/notifications/endpoints/create-notification.p1.test.ts",
  },
  {
    title: "Notes",
    group: "Extensions",
    topics: [
      [
        "Preserve edits automatically",
        "Edits request persistence without requiring a separate save action. Persistence work must not block local typing.",
        "Typing remains available while a persistence request is pending.",
      ],
      [
        "Keep typing local",
        "Applying an edit updates the local document before waiting for synchronization.",
        "An interrupted connection does not prevent local edits.",
      ],
      [
        "Make save state visible",
        "The editor distinguishes pending persistence, saved work and a failed save.",
        "A failed save exposes a retry action beside the document.",
      ],
      [
        "Define the save workload",
        "Responsiveness measurements state the document size, edit workload and execution environment.",
        "A reported result includes its workload, environment and measurement method.",
      ],
      [
        "Retain unsynchronized edits",
        "Local edits remain recoverable when synchronization is interrupted.",
        "Reconnecting retains the unsynchronized edits and resumes synchronization.",
      ],
      [
        "Recover after reopening",
        "Reopening a document restores recoverable local edits.",
        "An interrupted session can reopen the document without silently discarding local work.",
      ],
      [
        "Surface conflicting edits",
        "Conflicting document updates remain visible until the user or an authorized agent resolves them.",
        "A conflict cannot silently replace one version with another.",
      ],
      [
        "Keep document identity stable",
        "Moving or renaming a document preserves its identity and existing links.",
        "An existing link resolves after the document is renamed.",
      ],
    ],
    test: "extensions/pstdio-notes/src/text-source.p0.test.ts",
  },
  {
    title: "Planner",
    group: "Extensions",
    topics: [
      [
        "Create actionable tickets",
        "A ticket retains its title, scope and acceptance criteria.",
        "Creating a ticket returns a stable ticket reference.",
      ],
      [
        "Keep dependencies explicit",
        "A ticket identifies the work that must precede it.",
        "An unmet dependency remains visible in readiness.",
      ],
      [
        "Retain planning context",
        "A ticket's linked workspace and sessions remain reachable.",
        "A related session can be opened from the ticket.",
      ],
    ],
    test: "extensions/pstdio-planner/src/timeline/commands/create-ticket.p0.test.ts",
  },
  {
    title: "Artifacts",
    group: "Extensions",
    topics: [
      [
        "Keep artifacts addressable",
        "Every artifact has a stable resource identity.",
        "An artifact can be retrieved by its reference.",
      ],
      [
        "Retain artifact content",
        "Saving an artifact preserves its declared content and metadata.",
        "The saved content can be read after creation.",
      ],
      [
        "Open shared output",
        "People can open an artifact produced by an agent.",
        "The artifact's resource view displays its retained content.",
      ],
    ],
    test: "extensions/pstdio-artifacts/src/resources.p0.test.ts",
  },
  {
    title: "UI Canvas",
    group: "Extensions",
    topics: [
      [
        "Explore component states",
        "Canvas displays the frames exported by a project's canvas files.",
        "A canvas build discovers the exported frames.",
      ],
      [
        "Keep previews isolated",
        "Preview interactions use synthetic state without creating project records.",
        "Resetting a frame restores its initial state.",
      ],
      [
        "Retain frame inputs",
        "A frame's declared inputs remain available for exploration.",
        "Input values are resolved from the frame declaration.",
      ],
    ],
    test: "packages/canvas/src/parameters.p0.test.ts",
  },
  {
    title: "Requirement book",
    group: "Extensions",
    topics: [
      [
        "Keep one authoritative book",
        "Accepted requirements have one authoritative home in the repository.",
        "Each accepted requirement has one stable reference.",
      ],
      [
        "Separate intent from evidence",
        "Evidence describes observed behavior without becoming accepted intent.",
        "Mapping evidence does not assign a compliance verdict.",
      ],
      [
        "Navigate across chapters",
        "Related requirements remain reachable across chapter boundaries.",
        "A reference opens its target even when a search excludes it.",
      ],
    ],
    test: "packages/ui/src/proposals/PS-104/book-model.p1.test.ts",
  },
  {
    title: "Skills",
    group: "Extensions",
    topics: [
      [
        "Install reusable guidance",
        "A skill installation retains its instructions and supporting files.",
        "The installed skill can be found in the configured location.",
      ],
      [
        "Keep sources identifiable",
        "An installed skill retains its source.",
        "The installation identifies the source repository or package.",
      ],
      [
        "Respect project scope",
        "Project skill installation does not overwrite unrelated guidance.",
        "Installation writes within the selected destination.",
      ],
    ],
    test: "packages/pstdio/src/features/skills/install-skills.p0.test.ts",
  },
  {
    title: "Reports",
    group: "Extensions",
    topics: [
      [
        "Retain task evidence",
        "A report keeps the result and supporting evidence together.",
        "Saving a report preserves its body and attachments.",
      ],
      [
        "Keep reports addressable",
        "A saved report can be retrieved by reference.",
        "Reading a report resolves the requested identity.",
      ],
      [
        "Link reports to their work",
        "A report retains the task context it documents.",
        "The report exposes its originating task reference.",
      ],
    ],
    test: "extensions/pstdio-reports/src/commands/save-report.p0.test.ts",
  },
  {
    title: "Home",
    group: "Extensions",
    topics: [
      [
        "Return to recent work",
        "Home exposes recently used resources across tools.",
        "The recent-resource list retains valid resource references.",
      ],
      [
        "Keep recent work current",
        "A removed resource no longer appears as available recent work.",
        "Refreshing recent resources excludes removed records.",
      ],
      [
        "Open the original resource",
        "A recent item opens the same record that created it.",
        "Activating the item resolves its retained resource reference.",
      ],
    ],
    test: "extensions/pstdio-home/src/recent-resources.p0.test.ts",
  },
  {
    title: "Performance",
    group: "Extensions",
    topics: [
      [
        "State measurement conditions",
        "A performance claim identifies its workload and environment.",
        "The result includes enough context to repeat the measurement.",
      ],
      [
        "Keep idle work bounded",
        "Inactive views avoid unnecessary continuous renderer work.",
        "An idle view performs no avoidable polling or animation work.",
      ],
      [
        "Protect interaction",
        "Background work does not block primary user interactions.",
        "The user can continue the primary task during background work.",
      ],
    ],
    test: "extensions/pstdio-performance/src/performance-history.p0.test.ts",
  },
  {
    title: "Onboarding",
    group: "Extensions",
    topics: [
      [
        "Guide initial setup",
        "A new project can choose the extensions needed for its work.",
        "Setup retains the selected extension choices.",
      ],
      [
        "Retain setup progress",
        "Completed setup steps remain completed when setup is reopened.",
        "The setup state survives a normal reload.",
      ],
      [
        "Explain available tools",
        "Each extension choice identifies the tool it enables.",
        "The available choices include their names and purposes.",
      ],
    ],
    test: "extensions/pstdio-onboarding/src/extension-choices.p0.test.ts",
  },
];

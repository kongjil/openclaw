import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { defineConfig } from "vitest/config";
import { resolveLocalVitestMaxWorkers } from "./scripts/test-planner/runtime-profile.mjs";
import {
  behaviorManifestPath,
  unitMemoryHotspotManifestPath,
  unitTimingManifestPath,
} from "./scripts/test-runner-manifest.mjs";
import { loadVitestExperimentalConfig } from "./vitest.performance-config.ts";

export { resolveLocalVitestMaxWorkers };

const repoRoot = path.dirname(fileURLToPath(import.meta.url));
const isCI = process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true";
const isWindows = process.platform === "win32";
const localWorkers = resolveLocalVitestMaxWorkers();
const ciWorkers = isWindows ? 2 : 3;

// Keep this ordered: the base `openclaw/plugin-sdk` alias is a prefix match.
const fallbackPluginSdkSubpaths = [
  "account-id",
  "command-auth",
  "config-paths",
  "core",
  "fetch-auth",
  "file-lock",
  "group-access",
  "json-store",
  "llm-task",
  "onboarding",
  "pairing-access",
  "persistent-dedupe",
  "provider-auth-result",
  "reply-payload",
  "run-command",
  "runtime",
  "slack-message-actions",
  "ssrf-policy",
  "status-helpers",
  "temp-path",
  "text-chunking",
  "tool-send",
  "voice-call",
  "webhook-path",
  "webhook-targets",
] as const;

const pluginSdkEntriesPath = path.join(repoRoot, "scripts", "lib", "plugin-sdk-entries.mjs");
const pluginSdkSubpaths = existsSync(pluginSdkEntriesPath)
  ? ((await import(pathToFileURL(pluginSdkEntriesPath).href))
      .pluginSdkSubpaths as readonly string[])
  : fallbackPluginSdkSubpaths;

export default defineConfig({
  resolve: {
    // Keep this ordered: the base `openclaw/plugin-sdk` alias is a prefix match.
    alias: [
      {
        find: "openclaw/extension-api",
        replacement: path.join(repoRoot, "src", "extensionAPI.ts"),
      },
      ...pluginSdkSubpaths.map((subpath) => ({
        find: `openclaw/plugin-sdk/${subpath}`,
        replacement: path.join(repoRoot, "src", "plugin-sdk", `${subpath}.ts`),
      })),
      {
        find: "openclaw/plugin-sdk",
        replacement: path.join(repoRoot, "src", "plugin-sdk", "index.ts"),
      },
    ],
  },
  test: {
    testTimeout: 120_000,
    hookTimeout: isWindows ? 180_000 : 120_000,
    // Many suites rely on `vi.stubEnv(...)` and expect it to be scoped to the test.
    // Keep env restoration automatic so shared-worker runs do not leak state.
    unstubEnvs: true,
    // Same rationale as unstubEnvs: avoid cross-test pollution from shared globals.
    unstubGlobals: true,
    pool: "forks",
    maxWorkers: isCI ? ciWorkers : localWorkers,
    forceRerunTriggers: [
      "package.json",
      "pnpm-lock.yaml",
      "test/setup.ts",
      "scripts/test-parallel.mjs",
      "scripts/test-planner/catalog.mjs",
      "scripts/test-planner/executor.mjs",
      "scripts/test-planner/planner.mjs",
      "scripts/test-planner/runtime-profile.mjs",
      "scripts/test-runner-manifest.mjs",
      "vitest.channel-paths.mjs",
      "vitest.channels.config.ts",
      "vitest.config.ts",
      "vitest.contracts.config.ts",
      "vitest.e2e.config.ts",
      "vitest.extensions.config.ts",
      "vitest.gateway.config.ts",
      "vitest.live.config.ts",
      "vitest.performance-config.ts",
      "vitest.scoped-config.ts",
      "vitest.unit.config.ts",
      "vitest.unit-paths.mjs",
      behaviorManifestPath,
      unitTimingManifestPath,
      unitMemoryHotspotManifestPath,
    ],
    include: [
      "src/**/*.test.ts",
      "extensions/**/*.test.ts",
      "packages/**/*.test.ts",
      "test/**/*.test.ts",
      "ui/src/ui/app-chat.test.ts",
      "ui/src/ui/chat/**/*.test.ts",
      "ui/src/ui/views/agents-utils.test.ts",
      "ui/src/ui/views/channels.test.ts",
      "ui/src/ui/views/chat.test.ts",
      "ui/src/ui/views/nodes.devices.test.ts",
      "ui/src/ui/views/usage-render-details.test.ts",
      "ui/src/ui/controllers/agents.test.ts",
      "ui/src/ui/controllers/chat.test.ts",
      "ui/src/ui/controllers/sessions.test.ts",
      "ui/src/ui/views/sessions.test.ts",
      "ui/src/ui/app-gateway.sessions.node.test.ts",
    ],
    setupFiles: ["test/setup.ts"],
    exclude: [
      "dist/**",
      "test/fixtures/**",
      "apps/macos/**",
      "apps/macos/.build/**",
      "**/node_modules/**",
      "**/vendor/**",
      "dist/OpenClaw.app/**",
      "**/*.live.test.ts",
      "**/*.e2e.test.ts",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      all: false,
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 55,
        statements: 70,
      },
      include: ["./src/**/*.ts"],
      exclude: [
        "extensions/**",
        "apps/**",
        "ui/**",
        "test/**",
        "src/**/*.test.ts",
        "src/entry.ts",
        "src/index.ts",
        "src/runtime.ts",
        "src/channel-web.ts",
        "src/logging.ts",
        "src/cli/**",
        "src/commands/**",
        "src/daemon/**",
        "src/hooks/**",
        "src/macos/**",
        "src/acp/**",
        "src/agents/**",
        "src/channels/**",
        "src/gateway/**",
        "src/line/**",
        "src/media-understanding/**",
        "src/node-host/**",
        "src/plugins/**",
        "src/providers/**",
        "src/agents/model-scan.ts",
        "src/agents/pi-embedded-runner.ts",
        "src/agents/sandbox-paths.ts",
        "src/agents/sandbox.ts",
        "src/agents/skills-install.ts",
        "src/agents/pi-tool-definition-adapter.ts",
        "src/agents/tools/discord-actions*.ts",
        "src/agents/tools/slack-actions.ts",
        "src/infra/state-migrations.ts",
        "src/infra/skills-remote.ts",
        "src/infra/update-check.ts",
        "src/infra/ports-inspect.ts",
        "src/infra/outbound/outbound-session.ts",
        "src/memory/batch-gemini.ts",
        "src/gateway/control-ui.ts",
        "src/gateway/server-bridge.ts",
        "src/gateway/server-channels.ts",
        "src/gateway/server-methods/config.ts",
        "src/gateway/server-methods/send.ts",
        "src/gateway/server-methods/skills.ts",
        "src/gateway/server-methods/talk.ts",
        "src/gateway/server-methods/web.ts",
        "src/gateway/server-methods/wizard.ts",
        "src/gateway/call.ts",
        "src/process/tau-rpc.ts",
        "src/process/exec.ts",
        "src/tui/**",
        "src/wizard/**",
        "src/browser/**",
        "src/channels/web/**",
        "src/webchat/**",
        "src/gateway/server.ts",
        "src/gateway/client.ts",
        "src/gateway/protocol/**",
        "src/infra/tailscale.ts",
      ],
    },
    ...loadVitestExperimentalConfig(),
  },
});

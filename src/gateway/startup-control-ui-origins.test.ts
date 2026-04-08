import { describe, expect, it, vi } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import { maybeSeedControlUiAllowedOriginsAtStartup } from "./startup-control-ui-origins.js";

describe("maybeSeedControlUiAllowedOriginsAtStartup", () => {
  it("persists seeded allowedOrigins for non-loopback binds", async () => {
    const writeConfig = vi.fn(async () => undefined);
    const info = vi.fn();
    const warn = vi.fn();

    const config = {
      gateway: {
        bind: "lan",
        port: 18789,
      },
    } satisfies OpenClawConfig;

    const result = await maybeSeedControlUiAllowedOriginsAtStartup({
      config,
      writeConfig,
      log: { info, warn },
    });

    expect(writeConfig).toHaveBeenCalledTimes(1);
    expect(writeConfig).toHaveBeenCalledWith({
      gateway: {
        bind: "lan",
        port: 18789,
        controlUi: {
          allowedOrigins: ["http://localhost:18789", "http://127.0.0.1:18789"],
        },
      },
    });
    expect(result.gateway?.controlUi?.allowedOrigins).toEqual([
      "http://localhost:18789",
      "http://127.0.0.1:18789",
    ]);
    expect(info).toHaveBeenCalledTimes(1);
    expect(warn).not.toHaveBeenCalled();
  });

  it("warns and keeps seeded runtime config when persistence fails", async () => {
    const writeConfig = vi.fn(async () => {
      throw new Error("EACCES");
    });
    const info = vi.fn();
    const warn = vi.fn();

    const result = await maybeSeedControlUiAllowedOriginsAtStartup({
      config: {
        gateway: {
          bind: "lan",
          port: 18789,
        },
      } satisfies OpenClawConfig,
      writeConfig,
      log: { info, warn },
    });

    expect(writeConfig).toHaveBeenCalledTimes(1);
    expect(result.gateway?.controlUi?.allowedOrigins).toEqual([
      "http://localhost:18789",
      "http://127.0.0.1:18789",
    ]);
    expect(info).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain(
      "failed to persist gateway.controlUi.allowedOrigins seed",
    );
    expect(warn.mock.calls[0]?.[0]).toContain("config was not saved");
    expect(warn.mock.calls[0]?.[0]).toContain("restart");
  });
});

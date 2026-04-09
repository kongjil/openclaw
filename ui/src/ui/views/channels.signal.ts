import { html, nothing } from "lit";
import { formatRelativeTimestamp } from "../format.ts";
import type { SignalStatus } from "../types.ts";
import { renderChannelConfigSection } from "./channels.config.ts";
import {
  formatNullableBoolean,
  renderSingleAccountChannelCard,
  resolveChannelConfigured,
} from "./channels.shared.ts";
import type { ChannelsProps } from "./channels.types.ts";

export function renderSignalCard(params: {
  props: ChannelsProps;
  signal?: SignalStatus | null;
  accountCountLabel: unknown;
}) {
  const { props, signal, accountCountLabel } = params;
  const configured = resolveChannelConfigured("signal", props);

  return renderSingleAccountChannelCard({
    title: "Signal",
    subtitle: "signal-cli 状态与通道配置。",
    accountCountLabel,
    statusRows: [
      { label: "已配置", value: formatNullableBoolean(configured) },
      { label: "运行中", value: signal?.running ? "是" : "否" },
      { label: "Base URL", value: signal?.baseUrl ?? "暂无" },
      {
        label: "最近启动",
        value: signal?.lastStartAt ? formatRelativeTimestamp(signal.lastStartAt) : "暂无",
      },
      {
        label: "最近探测",
        value: signal?.lastProbeAt ? formatRelativeTimestamp(signal.lastProbeAt) : "暂无",
      },
    ],
    lastError: signal?.lastError,
    secondaryCallout: signal?.probe
      ? html`<div class="callout" style="margin-top: 12px;">
          探测${signal.probe.ok ? "正常" : "失败"} · ${signal.probe.status ?? ""}
          ${signal.probe.error ?? ""}
        </div>`
      : nothing,
    configSection: renderChannelConfigSection({ channelId: "signal", props }),
    footer: html`<div class="row" style="margin-top: 12px;">
      <button class="btn" @click=${() => props.onRefresh(true)}>探测</button>
    </div>`,
  });
}

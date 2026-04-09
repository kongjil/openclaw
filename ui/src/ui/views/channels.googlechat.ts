import { html, nothing } from "lit";
import { formatRelativeTimestamp } from "../format.ts";
import type { GoogleChatStatus } from "../types.ts";
import { renderChannelConfigSection } from "./channels.config.ts";
import {
  formatNullableBoolean,
  renderSingleAccountChannelCard,
  resolveChannelConfigured,
} from "./channels.shared.ts";
import type { ChannelsProps } from "./channels.types.ts";

export function renderGoogleChatCard(params: {
  props: ChannelsProps;
  googleChat?: GoogleChatStatus | null;
  accountCountLabel: unknown;
}) {
  const { props, googleChat, accountCountLabel } = params;
  const configured = resolveChannelConfigured("googlechat", props);

  return renderSingleAccountChannelCard({
    title: "Google Chat",
    subtitle: "Chat API Webhook 状态与通道配置。",
    accountCountLabel,
    statusRows: [
      { label: "已配置", value: formatNullableBoolean(configured) },
      {
        label: "运行中",
        value: googleChat ? (googleChat.running ? "是" : "否") : "暂无",
      },
      { label: "凭据", value: googleChat?.credentialSource ?? "暂无" },
      {
        label: "受众",
        value: googleChat?.audienceType
          ? `${googleChat.audienceType}${googleChat.audience ? ` · ${googleChat.audience}` : ""}`
          : "暂无",
      },
      {
        label: "最近启动",
        value: googleChat?.lastStartAt ? formatRelativeTimestamp(googleChat.lastStartAt) : "暂无",
      },
      {
        label: "最近探测",
        value: googleChat?.lastProbeAt ? formatRelativeTimestamp(googleChat.lastProbeAt) : "暂无",
      },
    ],
    lastError: googleChat?.lastError,
    secondaryCallout: googleChat?.probe
      ? html`<div class="callout" style="margin-top: 12px;">
          探测${googleChat.probe.ok ? "正常" : "失败"} · ${googleChat.probe.status ?? ""}
          ${googleChat.probe.error ?? ""}
        </div>`
      : nothing,
    configSection: renderChannelConfigSection({ channelId: "googlechat", props }),
    footer: html`<div class="row" style="margin-top: 12px;">
      <button class="btn" @click=${() => props.onRefresh(true)}>探测</button>
    </div>`,
  });
}

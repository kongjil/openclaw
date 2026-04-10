import { html, nothing } from "lit";
import type { AppViewState } from "../app-view-state.ts";
import type {
  ExecApprovalRequest,
  ExecApprovalRequestPayload,
} from "../controllers/exec-approval.ts";

function formatRemaining(ms: number): string {
  const remaining = Math.max(0, ms);
  const totalSeconds = Math.floor(remaining / 1000);
  if (totalSeconds < 60) {
    return `${totalSeconds} 秒`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  if (minutes < 60) {
    return `${minutes} 分钟`;
  }
  const hours = Math.floor(minutes / 60);
  return `${hours} 小时`;
}

function renderMetaRow(label: string, value?: string | null) {
  if (!value) {
    return nothing;
  }
  return html`<div class="exec-approval-meta-row"><span>${label}</span><span>${value}</span></div>`;
}

function renderExecBody(request: ExecApprovalRequestPayload) {
  return html`
    <div class="exec-approval-command mono">${request.command}</div>
    <div class="exec-approval-meta">
      ${renderMetaRow("主机", request.host)} ${renderMetaRow("代理", request.agentId)}
      ${renderMetaRow("会话", request.sessionKey)} ${renderMetaRow("工作目录", request.cwd)}
      ${renderMetaRow("解析后路径", request.resolvedPath)}
      ${renderMetaRow("安全级别", request.security)} ${renderMetaRow("审批模式", request.ask)}
    </div>
  `;
}

function renderPluginBody(active: ExecApprovalRequest) {
  return html`
    ${active.pluginDescription
      ? html`<pre class="exec-approval-command mono" style="white-space:pre-wrap">
${active.pluginDescription}</pre
        >`
      : nothing}
    <div class="exec-approval-meta">
      ${renderMetaRow("严重级别", active.pluginSeverity)} ${renderMetaRow("插件", active.pluginId)}
      ${renderMetaRow("代理", active.request.agentId)}
      ${renderMetaRow("会话", active.request.sessionKey)}
    </div>
  `;
}

export function renderExecApprovalPrompt(state: AppViewState) {
  const active = state.execApprovalQueue[0];
  if (!active) {
    return nothing;
  }
  const request = active.request;
  const remainingMs = active.expiresAtMs - Date.now();
  const remaining = remainingMs > 0 ? `将在 ${formatRemaining(remainingMs)} 后过期` : "已过期";
  const queueCount = state.execApprovalQueue.length;
  const isPlugin = active.kind === "plugin";
  const title = isPlugin ? (active.pluginTitle ?? "需要插件审批") : "需要执行审批";
  return html`
    <div class="exec-approval-overlay" role="dialog" aria-live="polite">
      <div class="exec-approval-card">
        <div class="exec-approval-header">
          <div>
            <div class="exec-approval-title">${title}</div>
            <div class="exec-approval-sub">${remaining}</div>
          </div>
          ${queueCount > 1
            ? html`<div class="exec-approval-queue">${queueCount} 条待处理</div>`
            : nothing}
        </div>
        ${isPlugin ? renderPluginBody(active) : renderExecBody(request)}
        ${state.execApprovalError
          ? html`<div class="exec-approval-error">${state.execApprovalError}</div>`
          : nothing}
        <div class="exec-approval-actions">
          <button
            class="btn primary"
            ?disabled=${state.execApprovalBusy}
            @click=${() => state.handleExecApprovalDecision("allow-once")}
          >
            允许一次
          </button>
          <button
            class="btn"
            ?disabled=${state.execApprovalBusy}
            @click=${() => state.handleExecApprovalDecision("allow-always")}
          >
            始终允许
          </button>
          <button
            class="btn danger"
            ?disabled=${state.execApprovalBusy}
            @click=${() => state.handleExecApprovalDecision("deny")}
          >
            拒绝
          </button>
        </div>
      </div>
    </div>
  `;
}

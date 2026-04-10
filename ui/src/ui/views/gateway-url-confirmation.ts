import { html, nothing } from "lit";
import type { AppViewState } from "../app-view-state.ts";

export function renderGatewayUrlConfirmation(state: AppViewState) {
  const { pendingGatewayUrl } = state;
  if (!pendingGatewayUrl) {
    return nothing;
  }

  return html`
    <div class="exec-approval-overlay" role="dialog" aria-modal="true" aria-live="polite">
      <div class="exec-approval-card">
        <div class="exec-approval-header">
          <div>
            <div class="exec-approval-title">更改网关 URL</div>
            <div class="exec-approval-sub">这会重新连接到另一个网关服务器</div>
          </div>
        </div>
        <div class="exec-approval-command mono">${pendingGatewayUrl}</div>
        <div class="callout danger" style="margin-top: 12px;">
          仅在你信任此 URL 时才确认。恶意 URL 可能危及你的系统。
        </div>
        <div class="exec-approval-actions">
          <button class="btn primary" @click=${() => state.handleGatewayUrlConfirm()}>确认</button>
          <button class="btn" @click=${() => state.handleGatewayUrlCancel()}>取消</button>
        </div>
      </div>
    </div>
  `;
}

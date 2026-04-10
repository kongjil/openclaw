import { html, nothing } from "lit";
import { formatRelativeTimestamp } from "../format.ts";
import { icons } from "../icons.ts";
import { pathForTab } from "../navigation.ts";
import { formatSessionTokens } from "../presenter.ts";
import type { GatewaySessionRow, SessionsListResult } from "../types.ts";

export type SessionsProps = {
  loading: boolean;
  result: SessionsListResult | null;
  error: string | null;
  activeMinutes: string;
  limit: string;
  includeGlobal: boolean;
  includeUnknown: boolean;
  basePath: string;
  searchQuery: string;
  sortColumn: "key" | "kind" | "updated" | "tokens";
  sortDir: "asc" | "desc";
  page: number;
  pageSize: number;
  selectedKeys: Set<string>;
  onFiltersChange: (next: {
    activeMinutes: string;
    limit: string;
    includeGlobal: boolean;
    includeUnknown: boolean;
  }) => void;
  onSearchChange: (query: string) => void;
  onSortChange: (column: "key" | "kind" | "updated" | "tokens", dir: "asc" | "desc") => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onRefresh: () => void;
  onPatch: (
    key: string,
    patch: {
      label?: string | null;
      thinkingLevel?: string | null;
      fastMode?: boolean | null;
      verboseLevel?: string | null;
      reasoningLevel?: string | null;
    },
  ) => void;
  onToggleSelect: (key: string) => void;
  onSelectPage: (keys: string[]) => void;
  onDeselectPage: (keys: string[]) => void;
  onDeselectAll: () => void;
  onDeleteSelected: () => void;
  onNavigateToChat?: (sessionKey: string) => void;
};

const THINK_LEVELS = ["", "off", "minimal", "low", "medium", "high", "xhigh"] as const;
const BINARY_THINK_LEVELS = ["", "off", "on"] as const;
const VERBOSE_LEVELS = [
  { value: "", label: "继承" },
  { value: "off", label: "off（显式）" },
  { value: "on", label: "on" },
  { value: "full", label: "full" },
] as const;
const FAST_LEVELS = [
  { value: "", label: "继承" },
  { value: "on", label: "on" },
  { value: "off", label: "off" },
] as const;
const REASONING_LEVELS = ["", "off", "on", "stream"] as const;
const PAGE_SIZES = [10, 25, 50, 100] as const;

function normalizeProviderId(provider?: string | null): string {
  if (!provider) {
    return "";
  }
  const normalized = provider.trim().toLowerCase();
  if (normalized === "z.ai" || normalized === "z-ai") {
    return "zai";
  }
  return normalized;
}

function isBinaryThinkingProvider(provider?: string | null): boolean {
  return normalizeProviderId(provider) === "zai";
}

function resolveThinkLevelOptions(provider?: string | null): readonly string[] {
  return isBinaryThinkingProvider(provider) ? BINARY_THINK_LEVELS : THINK_LEVELS;
}

function withCurrentOption(options: readonly string[], current: string): string[] {
  if (!current) {
    return [...options];
  }
  if (options.includes(current)) {
    return [...options];
  }
  return [...options, current];
}

function withCurrentLabeledOption(
  options: readonly { value: string; label: string }[],
  current: string,
): Array<{ value: string; label: string }> {
  if (!current) {
    return [...options];
  }
  if (options.some((option) => option.value === current)) {
    return [...options];
  }
  return [...options, { value: current, label: `${current} (custom)` }];
}

function resolveThinkLevelDisplay(value: string, isBinary: boolean): string {
  if (!isBinary) {
    return value;
  }
  if (!value || value === "off") {
    return value;
  }
  return "on";
}

function resolveThinkLevelPatchValue(value: string, isBinary: boolean): string | null {
  if (!value) {
    return null;
  }
  if (!isBinary) {
    return value;
  }
  if (value === "on") {
    return "low";
  }
  return value;
}

function filterRows(rows: GatewaySessionRow[], query: string): GatewaySessionRow[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return rows;
  }
  return rows.filter((row) => {
    const key = (row.key ?? "").toLowerCase();
    const label = (row.label ?? "").toLowerCase();
    const kind = (row.kind ?? "").toLowerCase();
    const displayName = (row.displayName ?? "").toLowerCase();
    return key.includes(q) || label.includes(q) || kind.includes(q) || displayName.includes(q);
  });
}

function sortRows(
  rows: GatewaySessionRow[],
  column: "key" | "kind" | "updated" | "tokens",
  dir: "asc" | "desc",
): GatewaySessionRow[] {
  const cmp = dir === "asc" ? 1 : -1;
  return [...rows].toSorted((a, b) => {
    let diff = 0;
    switch (column) {
      case "key":
        diff = (a.key ?? "").localeCompare(b.key ?? "");
        break;
      case "kind":
        diff = (a.kind ?? "").localeCompare(b.kind ?? "");
        break;
      case "updated": {
        const au = a.updatedAt ?? 0;
        const bu = b.updatedAt ?? 0;
        diff = au - bu;
        break;
      }
      case "tokens": {
        const at = a.totalTokens ?? a.inputTokens ?? a.outputTokens ?? 0;
        const bt = b.totalTokens ?? b.inputTokens ?? b.outputTokens ?? 0;
        diff = at - bt;
        break;
      }
    }
    return diff * cmp;
  });
}

function paginateRows<T>(rows: T[], page: number, pageSize: number): T[] {
  const start = page * pageSize;
  return rows.slice(start, start + pageSize);
}

function formatCompactNumber(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  }
  return String(value);
}

function sessionTokenStatusTitle(kind: "stale" | "pressure" | "overflow" | "higher"): string {
  switch (kind) {
    case "stale":
      return "这是最近一次保存下来的 token 快照，不一定等于当前这轮实时请求的上下文大小。";
    case "pressure":
      return "当前实时输入已经接近上下文上限；虽然未必已经溢出，但继续增长就可能出问题。";
    case "overflow":
      return "当前实时输入已经超过上下文窗口；即使前面的总量数字看起来没满，这条会话也可能已经非常危险。";
    case "higher":
      return "当前实时输入明显高于已保存的总量快照，说明表格里的总量数字偏滞后。";
  }
}

function renderSessionTokenCell(row: GatewaySessionRow) {
  const total = row.totalTokens ?? null;
  const input = row.inputTokens ?? null;
  const context = row.contextTokens ?? null;
  const totalStale = total != null && row.totalTokensFresh === false;
  const livePressureRatio = input != null && context ? input / context : 0;
  const livePressure = input != null && context != null && livePressureRatio >= 0.85;
  const liveOverflow = input != null && context != null && input > context;
  const liveDivergesFromStored =
    total != null && input != null && input > Math.max(total * 1.25, total + 20_000);

  return html`
    <div class="session-tokens-cell">
      <div>${formatSessionTokens(row)}</div>
      ${totalStale
        ? html`
            <div class="session-tokens-cell__meta">
              <span class="chip chip-warn" title=${sessionTokenStatusTitle("stale")}>已存快照</span>
            </div>
          `
        : nothing}
      ${livePressure
        ? html`
            <div class="session-tokens-cell__meta">
              <span
                class=${`chip ${liveOverflow ? "chip-danger" : "chip-warn"}`}
                title=${sessionTokenStatusTitle(liveOverflow ? "overflow" : "pressure")}
              >
                ${liveOverflow ? "实时溢出风险" : "实时压力高"}
              </span>
              <span class="muted" title="这里显示的是本轮实时输入 token 与上下文窗口上限的对比。"
                >输入 ${formatCompactNumber(input)} / ${formatCompactNumber(context)}</span
              >
            </div>
          `
        : nothing}
      ${liveDivergesFromStored && !livePressure
        ? html`
            <div class="session-tokens-cell__meta">
              <span class="chip chip-warn" title=${sessionTokenStatusTitle("higher")}
                >实时输入更高</span
              >
              <span class="muted" title="这里显示的是当前实时输入 token。"
                >输入 ${formatCompactNumber(input)}</span
              >
            </div>
          `
        : nothing}
    </div>
  `;
}

export function renderSessions(props: SessionsProps) {
  const rawRows = props.result?.sessions ?? [];
  const filtered = filterRows(rawRows, props.searchQuery);
  const sorted = sortRows(filtered, props.sortColumn, props.sortDir);
  const totalRows = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / props.pageSize));
  const page = Math.min(props.page, totalPages - 1);
  const paginated = paginateRows(sorted, page, props.pageSize);

  const sortHeader = (
    col: "key" | "kind" | "updated" | "tokens",
    label: string,
    extraClass = "",
  ) => {
    const isActive = props.sortColumn === col;
    const nextDir = isActive && props.sortDir === "asc" ? ("desc" as const) : ("asc" as const);
    return html`
      <th
        class=${extraClass}
        data-sortable
        data-sort-dir=${isActive ? props.sortDir : ""}
        @click=${() => props.onSortChange(col, isActive ? nextDir : "desc")}
      >
        ${label}
        <span class="data-table-sort-icon">${icons.arrowUpDown}</span>
      </th>
    `;
  };

  return html`
    <section class="card">
      <div class="row" style="justify-content: space-between; margin-bottom: 12px;">
        <div>
          <div class="card-title">会话</div>
          <div class="card-sub">
            ${props.result ? `存储位置：${props.result.path}` : "活跃会话 key 与逐会话覆盖项。"}
          </div>
        </div>
        <button class="btn" ?disabled=${props.loading} @click=${props.onRefresh}>
          ${props.loading ? "加载中…" : "刷新"}
        </button>
      </div>

      <div class="filters" style="margin-bottom: 12px;">
        <label class="field-inline">
          <span>活跃</span>
          <input
            style="width: 72px;"
            placeholder="min"
            .value=${props.activeMinutes}
            @input=${(e: Event) =>
              props.onFiltersChange({
                activeMinutes: (e.target as HTMLInputElement).value,
                limit: props.limit,
                includeGlobal: props.includeGlobal,
                includeUnknown: props.includeUnknown,
              })}
          />
        </label>
        <label class="field-inline">
          <span>上限</span>
          <input
            style="width: 64px;"
            .value=${props.limit}
            @input=${(e: Event) =>
              props.onFiltersChange({
                activeMinutes: props.activeMinutes,
                limit: (e.target as HTMLInputElement).value,
                includeGlobal: props.includeGlobal,
                includeUnknown: props.includeUnknown,
              })}
          />
        </label>
        <label class="field-inline checkbox">
          <input
            type="checkbox"
            .checked=${props.includeGlobal}
            @change=${(e: Event) =>
              props.onFiltersChange({
                activeMinutes: props.activeMinutes,
                limit: props.limit,
                includeGlobal: (e.target as HTMLInputElement).checked,
                includeUnknown: props.includeUnknown,
              })}
          />
          <span>全局</span>
        </label>
        <label class="field-inline checkbox">
          <input
            type="checkbox"
            .checked=${props.includeUnknown}
            @change=${(e: Event) =>
              props.onFiltersChange({
                activeMinutes: props.activeMinutes,
                limit: props.limit,
                includeGlobal: props.includeGlobal,
                includeUnknown: (e.target as HTMLInputElement).checked,
              })}
          />
          <span>未知</span>
        </label>
      </div>

      ${props.error
        ? html`<div class="callout danger" style="margin-bottom: 12px;">${props.error}</div>`
        : nothing}

      <div class="data-table-wrapper">
        <div class="data-table-toolbar">
          <div class="data-table-search">
            <input
              type="text"
              placeholder="按 key、标签、类型筛选…"
              .value=${props.searchQuery}
              @input=${(e: Event) => props.onSearchChange((e.target as HTMLInputElement).value)}
            />
          </div>
        </div>

        ${props.selectedKeys.size > 0
          ? html`
              <div class="data-table-bulk-bar">
                <span>已选 ${props.selectedKeys.size} 项</span>
                <button class="btn btn--sm" @click=${props.onDeselectAll}>取消选择</button>
                <button
                  class="btn btn--sm danger"
                  ?disabled=${props.loading}
                  @click=${props.onDeleteSelected}
                >
                  ${icons.trash} 删除
                </button>
              </div>
            `
          : nothing}

        <div class="data-table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th class="data-table-checkbox-col">
                  ${paginated.length > 0
                    ? html`<input
                        type="checkbox"
                        .checked=${paginated.length > 0 &&
                        paginated.every((r) => props.selectedKeys.has(r.key))}
                        .indeterminate=${paginated.some((r) => props.selectedKeys.has(r.key)) &&
                        !paginated.every((r) => props.selectedKeys.has(r.key))}
                        @change=${() => {
                          const allSelected = paginated.every((r) => props.selectedKeys.has(r.key));
                          if (allSelected) {
                            props.onDeselectPage(paginated.map((r) => r.key));
                          } else {
                            props.onSelectPage(paginated.map((r) => r.key));
                          }
                        }}
                        aria-label="选择本页全部"
                      />`
                    : nothing}
                </th>
                ${sortHeader("key", "Key", "data-table-key-col")}
                <th>标签</th>
                ${sortHeader("kind", "类型")} ${sortHeader("updated", "更新时间")}
                ${sortHeader("tokens", "令牌")}
                <th>思考</th>
                <th>快速</th>
                <th>详细</th>
                <th>推理</th>
              </tr>
            </thead>
            <tbody>
              ${paginated.length === 0
                ? html`
                    <tr>
                      <td
                        colspan="10"
                        style="text-align: center; padding: 48px 16px; color: var(--muted)"
                      >
                        暂无会话。
                      </td>
                    </tr>
                  `
                : paginated.map((row) =>
                    renderRow(
                      row,
                      props.basePath,
                      props.onPatch,
                      props.selectedKeys.has(row.key),
                      props.onToggleSelect,
                      props.loading,
                      props.onNavigateToChat,
                    ),
                  )}
            </tbody>
          </table>
        </div>

        ${totalRows > 0
          ? html`
              <div class="data-table-pagination">
                <div class="data-table-pagination__info">
                  ${page * props.pageSize + 1}-${Math.min((page + 1) * props.pageSize, totalRows)} /
                  共 ${totalRows} 行
                </div>
                <div class="data-table-pagination__controls">
                  <select
                    style="height: 32px; padding: 0 8px; font-size: 13px; border-radius: var(--radius-md); border: 1px solid var(--border); background: var(--card);"
                    .value=${String(props.pageSize)}
                    @change=${(e: Event) =>
                      props.onPageSizeChange(Number((e.target as HTMLSelectElement).value))}
                  >
                    ${PAGE_SIZES.map((s) => html`<option value=${s}>每页 ${s} 条</option>`)}
                  </select>
                  <button ?disabled=${page <= 0} @click=${() => props.onPageChange(page - 1)}>
                    上一页
                  </button>
                  <button
                    ?disabled=${page >= totalPages - 1}
                    @click=${() => props.onPageChange(page + 1)}
                  >
                    下一页
                  </button>
                </div>
              </div>
            `
          : nothing}
      </div>
    </section>
  `;
}

function renderRow(
  row: GatewaySessionRow,
  basePath: string,
  onPatch: SessionsProps["onPatch"],
  selected: boolean,
  onToggleSelect: SessionsProps["onToggleSelect"],
  disabled: boolean,
  onNavigateToChat?: (sessionKey: string) => void,
) {
  const updated = row.updatedAt ? formatRelativeTimestamp(row.updatedAt) : "暂无";
  const rawThinking = row.thinkingLevel ?? "";
  const isBinaryThinking = isBinaryThinkingProvider(row.modelProvider);
  const thinking = resolveThinkLevelDisplay(rawThinking, isBinaryThinking);
  const thinkLevels = withCurrentOption(resolveThinkLevelOptions(row.modelProvider), thinking);
  const fastMode = row.fastMode === true ? "on" : row.fastMode === false ? "off" : "";
  const fastLevels = withCurrentLabeledOption(FAST_LEVELS, fastMode);
  const verbose = row.verboseLevel ?? "";
  const verboseLevels = withCurrentLabeledOption(VERBOSE_LEVELS, verbose);
  const reasoning = row.reasoningLevel ?? "";
  const reasoningLevels = withCurrentOption(REASONING_LEVELS, reasoning);
  const displayName =
    typeof row.displayName === "string" && row.displayName.trim().length > 0
      ? row.displayName.trim()
      : null;
  const showDisplayName = Boolean(
    displayName &&
    displayName !== row.key &&
    displayName !== (typeof row.label === "string" ? row.label.trim() : ""),
  );
  const canLink = row.kind !== "global";
  const chatUrl = canLink
    ? `${pathForTab("chat", basePath)}?session=${encodeURIComponent(row.key)}`
    : null;
  const badgeClass =
    row.kind === "direct"
      ? "data-table-badge--direct"
      : row.kind === "group"
        ? "data-table-badge--group"
        : row.kind === "global"
          ? "data-table-badge--global"
          : "data-table-badge--unknown";

  return html`
    <tr>
      <td class="data-table-checkbox-col">
        <input
          type="checkbox"
          .checked=${selected}
          @change=${() => onToggleSelect(row.key)}
          aria-label="选择会话"
        />
      </td>
      <td class="data-table-key-col">
        <div class="mono session-key-cell">
          ${canLink
            ? html`<a
                href=${chatUrl}
                class="session-link"
                @click=${(e: MouseEvent) => {
                  if (
                    e.defaultPrevented ||
                    e.button !== 0 ||
                    e.metaKey ||
                    e.ctrlKey ||
                    e.shiftKey ||
                    e.altKey
                  ) {
                    return;
                  }
                  if (onNavigateToChat) {
                    e.preventDefault();
                    onNavigateToChat(row.key);
                  }
                }}
                >${row.key}</a
              >`
            : row.key}
          ${showDisplayName
            ? html`<span class="muted session-key-display-name">${displayName}</span>`
            : nothing}
        </div>
      </td>
      <td>
        <input
          .value=${row.label ?? ""}
          ?disabled=${disabled}
          placeholder="（可选）"
          style="width: 100%; max-width: 140px; padding: 6px 10px; font-size: 13px; border: 1px solid var(--border); border-radius: var(--radius-sm);"
          @change=${(e: Event) => {
            const value = (e.target as HTMLInputElement).value.trim();
            onPatch(row.key, { label: value || null });
          }}
        />
      </td>
      <td>
        <span class="data-table-badge ${badgeClass}">${row.kind}</span>
      </td>
      <td>${updated}</td>
      <td>${renderSessionTokenCell(row)}</td>
      <td>
        <select
          ?disabled=${disabled}
          style="padding: 6px 10px; font-size: 13px; border: 1px solid var(--border); border-radius: var(--radius-sm); min-width: 90px;"
          @change=${(e: Event) => {
            const value = (e.target as HTMLSelectElement).value;
            onPatch(row.key, {
              thinkingLevel: resolveThinkLevelPatchValue(value, isBinaryThinking),
            });
          }}
        >
          ${thinkLevels.map(
            (level) =>
              html`<option value=${level} ?selected=${thinking === level}>
                ${level || "继承"}
              </option>`,
          )}
        </select>
      </td>
      <td>
        <select
          ?disabled=${disabled}
          style="padding: 6px 10px; font-size: 13px; border: 1px solid var(--border); border-radius: var(--radius-sm); min-width: 90px;"
          @change=${(e: Event) => {
            const value = (e.target as HTMLSelectElement).value;
            onPatch(row.key, { fastMode: value === "" ? null : value === "on" });
          }}
        >
          ${fastLevels.map(
            (level) =>
              html`<option value=${level.value} ?selected=${fastMode === level.value}>
                ${level.label}
              </option>`,
          )}
        </select>
      </td>
      <td>
        <select
          ?disabled=${disabled}
          style="padding: 6px 10px; font-size: 13px; border: 1px solid var(--border); border-radius: var(--radius-sm); min-width: 90px;"
          @change=${(e: Event) => {
            const value = (e.target as HTMLSelectElement).value;
            onPatch(row.key, { verboseLevel: value || null });
          }}
        >
          ${verboseLevels.map(
            (level) =>
              html`<option value=${level.value} ?selected=${verbose === level.value}>
                ${level.label}
              </option>`,
          )}
        </select>
      </td>
      <td>
        <select
          ?disabled=${disabled}
          style="padding: 6px 10px; font-size: 13px; border: 1px solid var(--border); border-radius: var(--radius-sm); min-width: 90px;"
          @change=${(e: Event) => {
            const value = (e.target as HTMLSelectElement).value;
            onPatch(row.key, { reasoningLevel: value || null });
          }}
        >
          ${reasoningLevels.map(
            (level) =>
              html`<option value=${level} ?selected=${reasoning === level}>
                ${level || "继承"}
              </option>`,
          )}
        </select>
      </td>
    </tr>
  `;
}

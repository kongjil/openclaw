/**
 * Only treat the user as "at bottom" when they're effectively pinned to the end.
 * We intentionally keep this tiny and only update the flag from real scroll events,
 * so streaming/long-message reflows do not re-classify the user as wanting stick-to-bottom.
 */
const AT_BOTTOM_EPSILON = 2;

type ScrollHost = {
  updateComplete: Promise<unknown>;
  querySelector: (selectors: string) => Element | null;
  style: CSSStyleDeclaration;
  chatScrollFrame: number | null;
  chatScrollTimeout: number | null;
  chatHasAutoScrolled: boolean;
  chatUserNearBottom: boolean;
  chatLastScrollTop: number | null;
  chatNewMessagesBelow: boolean;
  logsScrollFrame: number | null;
  logsAtBottom: boolean;
  topbarObserver: ResizeObserver | null;
};

function queryHost(host: Partial<ScrollHost>, selectors: string): Element | null {
  return typeof host.querySelector === "function" ? host.querySelector(selectors) : null;
}

function cancelPendingChatScroll(host: ScrollHost) {
  if (host.chatScrollFrame) {
    cancelAnimationFrame(host.chatScrollFrame);
    host.chatScrollFrame = null;
  }
  if (host.chatScrollTimeout != null) {
    clearTimeout(host.chatScrollTimeout);
    host.chatScrollTimeout = null;
  }
}

export function scheduleChatScroll(host: ScrollHost, force = false, smooth = false) {
  cancelPendingChatScroll(host);
  const pickScrollTarget = () => {
    const container = queryHost(host, ".chat-thread") as HTMLElement | null;
    if (container) {
      const overflowY = getComputedStyle(container).overflowY;
      const canScroll =
        overflowY === "auto" ||
        overflowY === "scroll" ||
        container.scrollHeight - container.clientHeight > 1;
      if (canScroll) {
        return container;
      }
    }
    return (document.scrollingElement ?? document.documentElement) as HTMLElement | null;
  };
  // Wait for Lit render to complete, then scroll
  void host.updateComplete.then(() => {
    host.chatScrollFrame = requestAnimationFrame(() => {
      host.chatScrollFrame = null;
      const target = pickScrollTarget();
      if (!target) {
        return;
      }

      // force=true only overrides when we haven't auto-scrolled yet (initial load).
      // After initial load, respect the user's scroll position.
      const effectiveForce = force && !host.chatHasAutoScrolled;
      const shouldStick = effectiveForce || host.chatUserNearBottom;

      if (!shouldStick) {
        // User is scrolled up — flag that new content arrived below.
        host.chatNewMessagesBelow = true;
        return;
      }
      if (effectiveForce) {
        host.chatHasAutoScrolled = true;
      }
      const smoothEnabled =
        smooth &&
        (typeof window === "undefined" ||
          typeof window.matchMedia !== "function" ||
          !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
      const scrollTop = target.scrollHeight;
      if (typeof target.scrollTo === "function") {
        target.scrollTo({ top: scrollTop, behavior: smoothEnabled ? "smooth" : "auto" });
      } else {
        target.scrollTop = scrollTop;
      }
      host.chatUserNearBottom = true;
      host.chatNewMessagesBelow = false;
    });
  });
}

export function scheduleLogsScroll(host: ScrollHost, force = false) {
  if (host.logsScrollFrame) {
    cancelAnimationFrame(host.logsScrollFrame);
  }
  void host.updateComplete.then(() => {
    host.logsScrollFrame = requestAnimationFrame(() => {
      host.logsScrollFrame = null;
      const container = queryHost(host, ".log-stream") as HTMLElement | null;
      if (!container) {
        return;
      }
      const distanceFromBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight;
      const shouldStick = force || distanceFromBottom < 80;
      if (!shouldStick) {
        return;
      }
      container.scrollTop = container.scrollHeight;
    });
  });
}

export function handleChatScroll(host: ScrollHost, event: Event) {
  const container = event.currentTarget as HTMLElement | null;
  if (!container) {
    return;
  }
  const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
  const wasAtBottom = host.chatUserNearBottom;
  const previousScrollTop = host.chatLastScrollTop;
  const scrolledUp = previousScrollTop != null && container.scrollTop < previousScrollTop;

  if (scrolledUp) {
    cancelPendingChatScroll(host);
  }

  if (distanceFromBottom <= AT_BOTTOM_EPSILON) {
    host.chatUserNearBottom = true;
    host.chatNewMessagesBelow = false;
  } else if (scrolledUp || wasAtBottom) {
    // As soon as the user scrolls upward away from bottom, release stickiness.
    host.chatUserNearBottom = false;
  }

  host.chatLastScrollTop = container.scrollTop;
}

export function handleLogsScroll(host: ScrollHost, event: Event) {
  const container = event.currentTarget as HTMLElement | null;
  if (!container) {
    return;
  }
  const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
  host.logsAtBottom = distanceFromBottom < 80;
}

export function resetChatScroll(host: ScrollHost) {
  host.chatHasAutoScrolled = false;
  host.chatUserNearBottom = true;
  host.chatLastScrollTop = null;
  host.chatNewMessagesBelow = false;
}

export function exportLogs(lines: string[], label: string) {
  if (lines.length === 0) {
    return;
  }
  const blob = new Blob([`${lines.join("\n")}\n`], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  anchor.href = url;
  anchor.download = `openclaw-logs-${label}-${stamp}.log`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function observeTopbar(host: ScrollHost) {
  if (typeof ResizeObserver === "undefined") {
    return;
  }
  const topbar = queryHost(host, ".topbar");
  if (!topbar) {
    return;
  }
  const update = () => {
    const { height } = topbar.getBoundingClientRect();
    host.style.setProperty("--topbar-height", `${height}px`);
  };
  update();
  host.topbarObserver = new ResizeObserver(() => update());
  host.topbarObserver.observe(topbar);
}

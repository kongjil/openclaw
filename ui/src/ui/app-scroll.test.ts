import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleChatScroll, scheduleChatScroll, resetChatScroll } from "./app-scroll.ts";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Minimal ScrollHost stub for unit tests. */
function createScrollHost(
  overrides: {
    scrollHeight?: number;
    scrollTop?: number;
    clientHeight?: number;
    overflowY?: string;
  } = {},
) {
  const {
    scrollHeight = 2000,
    scrollTop = 1500,
    clientHeight = 500,
    overflowY = "auto",
  } = overrides;

  const container = {
    scrollHeight,
    scrollTop,
    clientHeight,
    style: { overflowY } as unknown as CSSStyleDeclaration,
  };

  // Make getComputedStyle return the overflowY value
  vi.spyOn(window, "getComputedStyle").mockReturnValue({
    overflowY,
  } as unknown as CSSStyleDeclaration);

  const host = {
    updateComplete: Promise.resolve(),
    querySelector: vi.fn().mockReturnValue(container),
    style: { setProperty: vi.fn() } as unknown as CSSStyleDeclaration,
    chatScrollFrame: null as number | null,
    chatScrollTimeout: null as number | null,
    chatHasAutoScrolled: false,
    chatUserNearBottom: true,
    chatLastScrollTop: null as number | null,
    chatNewMessagesBelow: false,
    logsScrollFrame: null as number | null,
    logsAtBottom: true,
    topbarObserver: null as ResizeObserver | null,
  };

  return { host, container };
}

function createScrollEvent(scrollHeight: number, scrollTop: number, clientHeight: number) {
  return {
    currentTarget: { scrollHeight, scrollTop, clientHeight },
  } as unknown as Event;
}

/* ------------------------------------------------------------------ */
/*  handleChatScroll – bottom detection tests                          */
/* ------------------------------------------------------------------ */

describe("handleChatScroll", () => {
  it("sets chatUserNearBottom=true when exactly at bottom", () => {
    const { host } = createScrollHost({});
    // distanceFromBottom = 2000 - 1600 - 400 = 0 → pinned to bottom
    const event = createScrollEvent(2000, 1600, 400);
    handleChatScroll(host, event);
    expect(host.chatUserNearBottom).toBe(true);
  });

  it("keeps chatUserNearBottom=true within tiny bottom epsilon", () => {
    const { host } = createScrollHost({});
    // distanceFromBottom = 2000 - 1598 - 400 = 2 → still effectively at bottom
    const event = createScrollEvent(2000, 1598, 400);
    handleChatScroll(host, event);
    expect(host.chatUserNearBottom).toBe(true);
  });

  it("sets chatUserNearBottom=false once user leaves the bottom by more than epsilon", () => {
    const { host } = createScrollHost({});
    // distanceFromBottom = 2000 - 1597 - 400 = 3 → user has left bottom
    const event = createScrollEvent(2000, 1597, 400);
    handleChatScroll(host, event);
    expect(host.chatUserNearBottom).toBe(false);
  });

  it("releases stickiness as soon as user scrolls upward away from bottom", () => {
    const { host } = createScrollHost({});
    host.chatUserNearBottom = true;
    host.chatLastScrollTop = 1600;

    // User lightly scrolls up while still visually close to bottom.
    const event = createScrollEvent(2000, 1599, 400);
    handleChatScroll(host, event);

    expect(host.chatUserNearBottom).toBe(false);
    expect(host.chatLastScrollTop).toBe(1599);
  });

  it("cancels pending auto-stick retry as soon as user scrolls upward", () => {
    const { host } = createScrollHost({});
    host.chatUserNearBottom = true;
    host.chatLastScrollTop = 1600;
    host.chatScrollTimeout = window.setTimeout(() => undefined, 120);

    const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");
    const event = createScrollEvent(2000, 1599, 400);
    handleChatScroll(host, event);

    expect(clearTimeoutSpy).toHaveBeenCalled();
    expect(host.chatScrollTimeout).toBe(null);
    expect(host.chatUserNearBottom).toBe(false);
  });

  it("sets chatUserNearBottom=false when scrolled well above bottom", () => {
    const { host } = createScrollHost({});
    // distanceFromBottom = 2000 - 500 - 400 = 1100 → clearly not at bottom
    const event = createScrollEvent(2000, 500, 400);
    handleChatScroll(host, event);
    expect(host.chatUserNearBottom).toBe(false);
  });

  it("clears near-bottom state after user scrolls up past one long message", () => {
    const { host } = createScrollHost({});
    const event = createScrollEvent(2000, 1100, 400);
    handleChatScroll(host, event);
    expect(host.chatUserNearBottom).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  scheduleChatScroll – respects user scroll position                 */
/* ------------------------------------------------------------------ */

describe("scheduleChatScroll", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      cb(0);
      return 1;
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("scrolls to bottom when user is near bottom (no force)", async () => {
    const { host, container } = createScrollHost({
      scrollHeight: 2000,
      scrollTop: 1600,
      clientHeight: 400,
    });
    // distanceFromBottom = 2000 - 1600 - 400 = 0 → near bottom
    host.chatUserNearBottom = true;

    scheduleChatScroll(host);
    await host.updateComplete;

    expect(container.scrollTop).toBe(container.scrollHeight);
  });

  it("does not schedule a delayed retry after auto-scrolling", async () => {
    const { host } = createScrollHost({
      scrollHeight: 2000,
      scrollTop: 1600,
      clientHeight: 400,
    });
    host.chatUserNearBottom = true;

    scheduleChatScroll(host);
    await host.updateComplete;

    expect(host.chatScrollTimeout).toBe(null);
  });

  it("does NOT scroll when user is scrolled up and no force", async () => {
    const { host, container } = createScrollHost({
      scrollHeight: 2000,
      scrollTop: 500,
      clientHeight: 400,
    });
    // distanceFromBottom = 2000 - 500 - 400 = 1100 → not near bottom
    host.chatUserNearBottom = false;
    const originalScrollTop = container.scrollTop;

    scheduleChatScroll(host);
    await host.updateComplete;

    expect(container.scrollTop).toBe(originalScrollTop);
  });

  it("does NOT scroll with force=true when user has explicitly scrolled up", async () => {
    const { host, container } = createScrollHost({
      scrollHeight: 2000,
      scrollTop: 500,
      clientHeight: 400,
    });
    // User has scrolled up — chatUserNearBottom is false
    host.chatUserNearBottom = false;
    host.chatHasAutoScrolled = true; // Already past initial load
    const originalScrollTop = container.scrollTop;

    scheduleChatScroll(host, true);
    await host.updateComplete;

    // force=true should still NOT override explicit user scroll-up after initial load
    expect(container.scrollTop).toBe(originalScrollTop);
  });

  it("DOES scroll with force=true on initial load (chatHasAutoScrolled=false)", async () => {
    const { host, container } = createScrollHost({
      scrollHeight: 2000,
      scrollTop: 500,
      clientHeight: 400,
    });
    host.chatUserNearBottom = false;
    host.chatHasAutoScrolled = false; // Initial load

    scheduleChatScroll(host, true);
    await host.updateComplete;

    // On initial load, force should work regardless
    expect(container.scrollTop).toBe(container.scrollHeight);
  });

  it("does NOT scroll when layout leaves user close to bottom but they already scrolled up", async () => {
    const { host, container } = createScrollHost({
      scrollHeight: 2000,
      scrollTop: 1569,
      clientHeight: 400,
    });
    // distanceFromBottom = 31 → previously easy to misclassify as "near bottom" during reflow.
    host.chatUserNearBottom = false;
    host.chatHasAutoScrolled = true;
    const originalScrollTop = container.scrollTop;

    scheduleChatScroll(host);
    await host.updateComplete;

    expect(container.scrollTop).toBe(originalScrollTop);
  });

  it("sets chatNewMessagesBelow when not scrolling due to user position", async () => {
    const { host } = createScrollHost({
      scrollHeight: 2000,
      scrollTop: 500,
      clientHeight: 400,
    });
    host.chatUserNearBottom = false;
    host.chatHasAutoScrolled = true;
    host.chatNewMessagesBelow = false;

    scheduleChatScroll(host);
    await host.updateComplete;

    expect(host.chatNewMessagesBelow).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  Streaming: rapid chatStream changes should not reset scroll        */
/* ------------------------------------------------------------------ */

describe("streaming scroll behavior", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      cb(0);
      return 1;
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("multiple rapid scheduleChatScroll calls do not scroll when user is scrolled up", async () => {
    const { host, container } = createScrollHost({
      scrollHeight: 2000,
      scrollTop: 500,
      clientHeight: 400,
    });
    host.chatUserNearBottom = false;
    host.chatHasAutoScrolled = true;
    const originalScrollTop = container.scrollTop;

    // Simulate rapid streaming token updates
    scheduleChatScroll(host);
    scheduleChatScroll(host);
    scheduleChatScroll(host);
    await host.updateComplete;

    expect(container.scrollTop).toBe(originalScrollTop);
  });

  it("streaming scrolls correctly when user IS at bottom", async () => {
    const { host, container } = createScrollHost({
      scrollHeight: 2000,
      scrollTop: 1600,
      clientHeight: 400,
    });
    host.chatUserNearBottom = true;
    host.chatHasAutoScrolled = true;

    // Simulate streaming
    scheduleChatScroll(host);
    await host.updateComplete;

    expect(container.scrollTop).toBe(container.scrollHeight);
  });
});

/* ------------------------------------------------------------------ */
/*  resetChatScroll                                                    */
/* ------------------------------------------------------------------ */

describe("resetChatScroll", () => {
  it("resets state for new chat session", () => {
    const { host } = createScrollHost({});
    host.chatHasAutoScrolled = true;
    host.chatUserNearBottom = false;

    resetChatScroll(host);

    expect(host.chatHasAutoScrolled).toBe(false);
    expect(host.chatUserNearBottom).toBe(true);
  });
});

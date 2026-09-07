import webchatCss from "./botpressWebchat.css?raw";

const INJECT_SRC = "https://cdn.botpress.cloud/webchat/v3.7/inject.js";
const CONFIG_SRC =
  "https://files.bpcontent.cloud/2026/09/06/14/20260906142905-0XF6DLJ1.js";

const READY_CLASS = "nm-webchat-ready";

type BotpressEvent =
  | "webchat:initialized"
  | "webchat:opened"
  | "webchat:closed"
  | string;

type BotpressWebchat = {
  init: (config: unknown) => void;
  open?: () => void;
  close?: () => void;
  on?: (event: BotpressEvent, handler: () => void) => (() => void) | void;
};

declare global {
  interface Window {
    botpress?: BotpressWebchat;
  }
}

type Listener = () => void;

let loadPromise: Promise<void> | null = null;
let webchatOpen = false;
let lifecycleBound = false;
const openListeners = new Set<Listener>();

function emitOpen() {
  for (const listener of openListeners) listener();
}

function setWebchatOpen(next: boolean) {
  if (webchatOpen === next) return;
  webchatOpen = next;
  emitOpen();
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${src}"]`,
    );
    if (existing) {
      if (existing.dataset.bpLoaded === "1") {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error(`Failed to load ${src}`)),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = false;
    script.addEventListener("load", () => {
      script.dataset.bpLoaded = "1";
      resolve();
    });
    script.addEventListener("error", () =>
      reject(new Error(`Failed to load ${src}`)),
    );
    document.body.appendChild(script);
  });
}

function webchatHost(): Element | null {
  return document.querySelector(".bpChatContainer");
}

function webchatShadowRoot(): ShadowRoot | null {
  const host = webchatHost();
  if (!host) return null;
  if (host.shadowRoot) return host.shadowRoot;
  return host.firstElementChild?.shadowRoot ?? null;
}

function syncOpenFromDom() {
  const shadow = webchatShadowRoot();
  const chat = shadow?.querySelector(".bpWebchat");
  setWebchatOpen(Boolean(chat?.classList.contains("bpOpen")));
}

function revealWebchat() {
  webchatHost()?.classList.add(READY_CLASS);
}

function injectCompactFab(): boolean {
  const shadow = webchatShadowRoot();
  if (!shadow) return false;
  if (!shadow.getElementById("nextmove-webchat-skin")) {
    const style = document.createElement("style");
    style.id = "nextmove-webchat-skin";
    style.textContent = webchatCss;
    shadow.appendChild(style);
  }
  revealWebchat();
  syncOpenFromDom();
  return true;
}

function bindLifecycle() {
  const bp = window.botpress;
  if (!bp?.on || lifecycleBound) return;
  lifecycleBound = true;
  bp.on("webchat:opened", () => setWebchatOpen(true));
  bp.on("webchat:closed", () => setWebchatOpen(false));
}

function watchForWebchat() {
  if (injectCompactFab()) return;

  let attempts = 0;
  const tick = window.setInterval(() => {
    attempts += 1;
    if (injectCompactFab() || attempts > 80) {
      window.clearInterval(tick);
      if (attempts > 80) revealWebchat();
    }
  }, 50);
}

export function isBotpressOpen(): boolean {
  syncOpenFromDom();
  return webchatOpen;
}

export function subscribeBotpressOpen(listener: Listener): () => void {
  openListeners.add(listener);
  return () => {
    openListeners.delete(listener);
  };
}

export function ensureBotpressLoaded(): Promise<void> {
  if (!loadPromise) {
    watchForWebchat();
    loadPromise = (async () => {
      await loadScript(INJECT_SRC);
      bindLifecycle();
      await loadScript(CONFIG_SRC);
      injectCompactFab();
    })().catch((error) => {
      loadPromise = null;
      throw error;
    });
  }
  return loadPromise;
}

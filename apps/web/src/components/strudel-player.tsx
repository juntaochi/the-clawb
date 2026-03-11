"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { SandboxBridge } from "../lib/sandbox-bridge";

interface StrudelPlayerProps {
  /** Strudel live-coding string to evaluate and play. */
  code: string;
  /** Called after Strudel's AudioContext is initialized and ready. */
  onReady?: () => void;
  /**
   * Called when the sandbox sends audio analysis data (FFT, scope, freq).
   * This replaces the old useStrudelAudioBridge hook — audio data now
   * arrives via postMessage from the sandboxed iframe.
   */
  onAudioData?: (data: { fft: number[]; scope: number[]; freq: number[] }) => void;
}

/**
 * Audio-only Strudel player running in a sandboxed iframe.
 *
 * The Strudel engine runs inside `<iframe sandbox="allow-scripts">` which
 * prevents eval'd code from accessing the parent document, cookies,
 * localStorage, or fetching against the parent origin.
 *
 * Renders a "Click to start audio" overlay until the user initiates playback
 * (browsers require a user gesture to unlock AudioContext). Once started,
 * it sends the `code` prop to the sandbox whenever it changes.
 *
 * Renders nothing visible once audio is active -- visual code display is
 * handled by a separate component.
 */
export function StrudelPlayer({ code, onReady, onAudioData }: StrudelPlayerProps) {
  const [started, setStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const bridgeRef = useRef<SandboxBridge | null>(null);
  const readyRef = useRef<Promise<void> | null>(null);
  const lastCodeRef = useRef<string>("");
  const startingRef = useRef(false);

  // Use refs for callbacks to avoid stale closures in the bridge handlers
  const onAudioDataRef = useRef(onAudioData);
  onAudioDataRef.current = onAudioData;
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const codeRef = useRef(code);
  codeRef.current = code;

  const start = useCallback(async () => {
    if (startingRef.current) return;
    startingRef.current = true;

    const iframe = iframeRef.current;
    if (!iframe) {
      startingRef.current = false;
      return;
    }

    try {
      // Create bridge if not already created
      if (!bridgeRef.current) {
        const bridge = new SandboxBridge(iframe);
        bridgeRef.current = bridge;

        // Listen for errors from the sandbox
        bridge.on("error", (data) => {
          const msg = typeof data.message === "string" ? data.message : String(data.message);
          console.warn("[StrudelPlayer] sandbox error:", msg);
          setError(msg);
        });

        // Listen for audio analysis data from the sandbox
        bridge.on("audio", (data) => {
          onAudioDataRef.current?.(data as { fft: number[]; scope: number[]; freq: number[] });
        });
      }

      const bridge = bridgeRef.current;

      // Tell the sandbox to initialize Strudel (needs user gesture context)
      bridge.send("init");

      // Wait for the sandbox to report ready
      readyRef.current = bridge.waitReady();
      await readyRef.current;

      // Evaluate initial code if provided
      const currentCode = codeRef.current;
      if (currentCode) {
        lastCodeRef.current = currentCode;
        bridge.send("eval", { code: currentCode });
      }

      setStarted(true);
      setError(null);
      onReadyRef.current?.();
    } catch (err) {
      console.error("[StrudelPlayer] init error:", err);
      setError(err instanceof Error ? err.message : String(err));
      startingRef.current = false; // allow retry on next interaction
    }
  }, []);

  // Re-evaluate whenever `code` changes (after initial start)
  useEffect(() => {
    if (!started || !bridgeRef.current) return;
    if (!code || code === lastCodeRef.current) return;

    lastCodeRef.current = code;
    bridgeRef.current.send("eval", { code });
  }, [code, started]);

  // Start audio on first user interaction (required by browser autoplay policy)
  useEffect(() => {
    if (started) return;
    const handler = (e: Event) => {
      // Ignore modifier keys — they don't count as user intent to start audio
      if (e instanceof KeyboardEvent) {
        if (["Meta", "Shift", "Alt", "Control"].includes(e.key)) return;
      }
      start();
    };
    const events = ["click", "keydown", "touchstart"] as const;
    events.forEach((ev) => document.addEventListener(ev, handler));
    return () => {
      events.forEach((ev) => document.removeEventListener(ev, handler as EventListener));
    };
  }, [started, start]);

  // Cleanup: silence on unmount
  useEffect(() => {
    return () => {
      bridgeRef.current?.send("hush");
      bridgeRef.current?.destroy();
      bridgeRef.current = null;
    };
  }, []);

  return (
    <>
      {/* Hidden iframe running the Strudel audio engine in a sandbox */}
      <iframe
        ref={iframeRef}
        sandbox="allow-scripts"
        src="/sandbox/strudel-sandbox.html"
        style={{
          width: 0,
          height: 0,
          border: "none",
          position: "fixed",
          top: -9999,
          left: -9999,
        }}
        title="Strudel audio sandbox"
      />

      {started ? (
        error ? (
          <div
            role="alert"
            className="fixed bottom-4 right-4 bg-red-900/80 text-red-200 text-xs px-3 py-1.5 rounded font-mono max-w-sm truncate z-50"
            title={error}
          >
            strudel: {error}
          </div>
        ) : null
      ) : (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 cursor-pointer bg-black/60 backdrop-blur-sm">
          <span className="text-white/50 text-sm font-mono">
            Hi there, human. Welcome to The Clawb.
          </span>
          <span className="code-line text-white/70 text-sm font-mono tracking-widest">
            click anywhere to start
          </span>
        </div>
      )}
    </>
  );
}

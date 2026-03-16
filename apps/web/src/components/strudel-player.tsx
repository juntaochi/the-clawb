"use client";

import { useEffect, useRef, useState } from "react";
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
  /** CSS class for the container when started (iframe fills this area). */
  className?: string;
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
export function StrudelPlayer({ code, onReady, onAudioData, className }: StrudelPlayerProps) {
  const [started, setStarted] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const bridgeRef = useRef<SandboxBridge | null>(null);
  const readyRef = useRef<Promise<void> | null>(null);
  const lastCodeRef = useRef<string>("");

  // Use refs for callbacks to avoid stale closures in the bridge handlers
  const onAudioDataRef = useRef(onAudioData);
  onAudioDataRef.current = onAudioData;
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const codeRef = useRef(code);
  codeRef.current = code;

  // Set up bridge on mount — the iframe's own click handler triggers init
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || bridgeRef.current) return;

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

    // When the sandbox reports ready (after user clicks inside the iframe),
    // evaluate initial code and mark as started
    readyRef.current = bridge.waitReady();
    readyRef.current.then(() => {
      const currentCode = codeRef.current;
      if (currentCode) {
        lastCodeRef.current = currentCode;
        bridge.send("eval", { code: currentCode });
      }
      setStarted(true);
      setError(null);
      onReadyRef.current?.();
    }).catch((err) => {
      console.error("[StrudelPlayer] init error:", err);
      setError(err instanceof Error ? err.message : String(err));
    });

    return () => {
      bridge.send("hush");
      bridge.destroy();
      bridgeRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-evaluate whenever `code` changes (after initial start)
  useEffect(() => {
    if (!started || !bridgeRef.current) return;
    if (!code || code === lastCodeRef.current) return;

    lastCodeRef.current = code;
    bridgeRef.current.send("eval", { code });
  }, [code, started]);

  // Note: No parent-side click handler needed — the iframe captures
  // the user gesture directly (required for AudioContext to unlock).
  // Cleanup is handled in the bridge setup effect above.

  return (
    <>
      {/* Single iframe — repositioned based on state, never remounted.
          Before init: fullscreen invisible overlay to capture user gesture.
          After init: fills the className container, showing code + visualizations. */}
      <div className={started ? className : "fixed inset-0 z-[60]"}>
        <iframe
          ref={iframeRef}
          sandbox="allow-scripts"
          src="/sandbox/strudel-sandbox.html"
          onLoad={() => setIframeLoaded(true)}
          className="w-full h-full border-none"
          style={started ? {
            background: "transparent",
          } : {
            opacity: 0.01,
            cursor: "pointer",
            pointerEvents: iframeLoaded ? "auto" : "none",
          }}
          title="Strudel audio sandbox"
        />
      </div>

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
            {iframeLoaded ? "click anywhere to start" : "loading..."}
          </span>
        </div>
      )}
    </>
  );
}

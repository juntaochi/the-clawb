"use client";

import { useEffect, useRef, useCallback } from "react";
import { SandboxBridge } from "../lib/sandbox-bridge";

/**
 * HydraCanvas -- renders audio-reactive Hydra visuals in a sandboxed iframe.
 *
 * Props:
 *   code      - Hydra code string (e.g. "osc(4,0.1,1.2).out()")
 *   className - optional CSS class for the wrapper div
 *   onBridgeReady - called with a function that sends FFT data to the Hydra sandbox
 *
 * The Hydra engine runs inside `<iframe sandbox="allow-scripts">` which
 * prevents eval'd code from accessing the parent document, cookies,
 * localStorage, or fetching against the parent origin.
 *
 * Communication is exclusively via postMessage through SandboxBridge.
 */

interface HydraCanvasProps {
  code: string;
  className?: string;
  /** Called once the Hydra sandbox is ready, providing a function to send FFT data. */
  onBridgeReady?: (sendFft: (fft: number[]) => void) => void;
}

export function HydraCanvas({ code, className, onBridgeReady }: HydraCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const bridgeRef = useRef<SandboxBridge | null>(null);
  const readyRef = useRef<Promise<void> | null>(null);
  const lastCodeRef = useRef<string>("");

  // Stable eval function that waits for the sandbox to be ready
  const evalCode = useCallback(async (newCode: string) => {
    if (readyRef.current) {
      await readyRef.current;
    }
    const bridge = bridgeRef.current;
    if (!bridge || !newCode) return;

    bridge.send("eval", { code: newCode });
  }, []);

  // Initialize the sandbox bridge on mount
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || bridgeRef.current) return;

    const bridge = new SandboxBridge(iframe);
    bridgeRef.current = bridge;
    readyRef.current = bridge.waitReady();

    // Listen for errors from the sandbox
    bridge.on("error", (data) => {
      console.warn("[HydraCanvas] sandbox error:", data.message);
    });

    // Notify parent when ready, providing the FFT sender
    readyRef.current.then(() => {
      onBridgeReady?.((fft: number[]) => {
        bridge.send("audio", { fft });
      });
    });

    return () => {
      bridge.destroy();
      bridgeRef.current = null;
      readyRef.current = null;
    };
  // onBridgeReady is intentionally excluded — we only bind it once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-evaluate whenever code changes
  useEffect(() => {
    if (code && code !== lastCodeRef.current) {
      lastCodeRef.current = code;
      evalCode(code);
    }
  }, [code, evalCode]);

  // ResizeObserver: send resize messages to the iframe
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let rafId: number | null = null;
    const ro = new ResizeObserver((entries) => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          const w = Math.round(width);
          const h = Math.round(height);
          if (w > 0 && h > 0) {
            bridgeRef.current?.send("resize", { width: w, height: h });
          }
        }
      });
    });

    ro.observe(container);
    return () => {
      ro.disconnect();
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div ref={containerRef} className={className} style={{ overflow: "hidden" }}>
      <iframe
        ref={iframeRef}
        sandbox="allow-scripts"
        src="/sandbox/hydra-sandbox.html"
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          border: "none",
        }}
        title="Hydra visual sandbox"
      />
    </div>
  );
}

"use client";

import { useEffect, useRef, useCallback } from "react";
import type HydraRenderer from "hydra-synth";

const A_STUB_BINS = 5;

/** Ensure window.a exists with a fft Float32Array and no-op methods. */
function ensureAStub() {
  const existing = (globalThis as Record<string, unknown>)["a"] as
    | { fft?: Float32Array }
    | null
    | undefined;
  if (existing?.fft instanceof Float32Array) return; // already a live stub
  const fft = new Float32Array(A_STUB_BINS);
  (globalThis as Record<string, unknown>)["a"] = {
    fft,
    setSmooth: () => {}, setScale: () => {}, setCutoff: () => {},
    setBands: () => {}, setBins: () => {}, show: () => {}, hide: () => {},
  };
}

/**
 * HydraCanvas -- renders audio-reactive Hydra visuals on a <canvas>.
 *
 * Props:
 *   code      - Hydra code string (e.g. "osc(4,0.1,1.2).out()")
 *   className - optional CSS class for the wrapper div
 *
 * Internally we dynamic-import `hydra-synth` (it requires browser globals)
 * and create a single HydraRenderer instance attached to our canvas.
 * When `code` changes, we hush the previous visuals and eval the new code.
 *
 * Audio reactivity is enabled by default (uses Meyda + getUserMedia).
 * The a0..a3 functions are available in Hydra code for FFT-driven visuals.
 */

interface HydraCanvasProps {
  code: string;
  className?: string;
}

export function HydraCanvas({ code, className }: HydraCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hydraRef = useRef<HydraRenderer | null>(null);
  const initPromiseRef = useRef<Promise<void> | null>(null);

  // Stable eval function that waits for init before evaluating
  const evalCode = useCallback(async (newCode: string) => {
    // Wait for any pending init
    if (initPromiseRef.current) {
      await initPromiseRef.current;
    }
    const hydra = hydraRef.current;
    if (!hydra || !newCode) return;

    try {
      hydra.hush();
      hydra.eval(newCode);
    } catch (err) {
      console.warn("[HydraCanvas] eval error:", err);
    }
  }, []);

  // Initialize hydra-synth once on mount
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || hydraRef.current) return;

    initPromiseRef.current = (async () => {
      try {
        // Dynamic import — hydra-synth uses browser globals (navigator, window, document)
        // and ships raw ESM source, so it must be client-only.
        const { default: Hydra } = await import("hydra-synth");

        const hydra = new Hydra({
          canvas,
          width: canvas.width,
          height: canvas.height,
          detectAudio: false, // We bridge Strudel audio → a0–a3 ourselves
          makeGlobal: true, // required — eval sandbox uses globalThis.eval and needs generators on window
          autoLoop: true,
          enableStreamCapture: false,
          numSources: 4,
          numOutputs: 4,
        });

        hydraRef.current = hydra;

        // hydra-synth with makeGlobal:true + detectAudio:false sets window.a = undefined,
        // overwriting any stub we set earlier. Re-establish it so a.fft[] doesn't throw.
        ensureAStub();
      } catch (err) {
        console.error("[HydraCanvas] failed to initialize hydra-synth:", err);
      }
    })();

    return () => {
      // On unmount, hush to stop rendering
      if (hydraRef.current) {
        try {
          hydraRef.current.hush();
        } catch {
          // ignore cleanup errors
        }
        hydraRef.current = null;
      }
    };
  }, []);

  // Re-evaluate whenever code changes
  useEffect(() => {
    if (code) {
      evalCode(code);
    }
  }, [code, evalCode]);

  // Resize canvas to match container (debounced to avoid hydra-synth log spam)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let rafId: number | null = null;
    const ro = new ResizeObserver((entries) => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          const w = Math.round(width);
          const h = Math.round(height);
          if (w > 0 && h > 0 && (canvas.width !== w || canvas.height !== h)) {
            canvas.width = w;
            canvas.height = h;
            hydraRef.current?.setResolution(w, h);
          }
        }
      });
    });

    ro.observe(canvas);
    return () => {
      ro.disconnect();
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div className={className} style={{ overflow: "hidden" }}>
      <canvas
        ref={canvasRef}
        width={1280}
        height={720}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          imageRendering: "auto",
        }}
      />
    </div>
  );
}

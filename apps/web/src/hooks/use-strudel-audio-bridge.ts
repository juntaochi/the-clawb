"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const NUM_BINS = 5;
const FFT_SIZE = 4096;

// Logarithmic frequency boundaries for 5 bins (Hz):
// [0] sub-bass 20-80  [1] bass 80-250  [2] low-mid 250-1k  [3] mid 1k-4k  [4] high 4k-20k
const FREQ_EDGES = [20, 80, 250, 1000, 4000, 20000];

/**
 * Bridges Strudel's audio output to Hydra's `a0()`–`a3()` globals
 * and exposes the AnalyserNode for scope visualization.
 *
 * Call `activate()` after Strudel has initialized its AudioContext.
 */
// Zero-filled stub so Hydra code using a.fft[] doesn't throw before audio starts
function initAStub(numBins: number) {
  const fft = new Float32Array(numBins);
  (globalThis as Record<string, unknown>)["a"] = {
    fft,
    setSmooth: (_v: number) => {},
    setScale: (_v: number) => {},
    setCutoff: (_v: number) => {},
    setBands: (_v: number) => {},
    setBins: (_v: number) => {},
    show: () => {},
    hide: () => {},
  };
  return fft;
}

export function useStrudelAudioBridge() {
  const [bridgeActive, setBridgeActive] = useState(false);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const activatedRef = useRef(false);
  const fftRef = useRef<Float32Array>(initAStub(NUM_BINS));

  const activate = useCallback(async () => {
    if (activatedRef.current) return;
    activatedRef.current = true;

    // Dynamic import — types may not include these exports, but they exist at runtime
    const strudel = await import("@strudel/web");
    const getAudioContext = (strudel as Record<string, unknown>)["getAudioContext"] as () => AudioContext;
    const getController = (strudel as Record<string, unknown>)["getSuperdoughAudioController"] as
      | (() => { output?: { destinationGain?: GainNode } })
      | undefined;

    if (!getAudioContext || !getController) {
      console.warn("[AudioBridge] required Strudel exports not found");
      activatedRef.current = false;
      return;
    }

    const ctx = getAudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    analyser.smoothingTimeConstant = 0.4;

    // Tap into superdough's destinationGain — all Strudel audio flows through it.
    // Path: controller.output (wS instance) → .destinationGain (GainNode)
    // Retry a few times — the controller may not be fully wired until audio plays.
    let controller = getController();
    let retries = 0;
    while ((!controller?.output?.destinationGain) && retries < 10) {
      await new Promise((r) => setTimeout(r, 200));
      controller = getController();
      retries++;
    }
    if (controller?.output?.destinationGain) {
      controller.output.destinationGain.connect(analyser);
    } else {
      console.warn("[AudioBridge] destinationGain not available after retries");
      activatedRef.current = false;
      return;
    }

    setAnalyserNode(analyser);

    // Start rAF loop that feeds Hydra's a.fft[] array
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Float32Array(bufferLength);
    const sampleRate = ctx.sampleRate;
    const binHz = sampleRate / FFT_SIZE; // Hz per FFT bin

    // Precompute FFT index ranges for each frequency band
    const binRanges: [number, number][] = [];
    for (let i = 0; i < NUM_BINS; i++) {
      const lo = Math.max(0, Math.round(FREQ_EDGES[i]! / binHz));
      const hi = Math.min(bufferLength - 1, Math.round(FREQ_EDGES[i + 1]! / binHz));
      binRanges.push([lo, hi]);
    }

    // Re-set window.a with a fresh live fft array
    const fft = new Float32Array(NUM_BINS);
    fftRef.current = fft;
    (globalThis as Record<string, unknown>)["a"] = {
      fft,
      setSmooth: (_v: number) => {}, setScale: (_v: number) => {},
      setCutoff: (_v: number) => {}, setBands: (_v: number) => {},
      setBins: (_v: number) => {}, show: () => {}, hide: () => {},
    };

    function loop() {
      analyser.getFloatFrequencyData(dataArray);

      // Always write to the CURRENT window.a.fft — it may have been replaced
      const liveA = (globalThis as Record<string, unknown>)["a"] as
        | { fft?: Float32Array }
        | undefined;
      const liveFft = liveA?.fft;

      for (let i = 0; i < NUM_BINS; i++) {
        const [lo, hi] = binRanges[i]!;
        let sum = 0;
        const count = hi - lo + 1;
        for (let j = lo; j <= hi; j++) {
          sum += dataArray[j]!;
        }
        const avgDb = sum / count;
        // Map -70dB...-10dB → 0...1 for punchier response
        const normalized = Math.max(0, Math.min(1, (avgDb + 70) / 60));

        fft[i] = normalized;
        if (liveFft && liveFft !== fft) liveFft[i] = normalized;
      }

      rafRef.current = requestAnimationFrame(loop);
    }

    loop();
    setBridgeActive(true);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (analyserNode) {
        try {
          analyserNode.disconnect();
        } catch {
          // ignore
        }
      }
    };
  }, [analyserNode]);

  return { activate, bridgeActive, analyserNode };
}

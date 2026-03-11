"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const NUM_BINS = 5;
const FFT_SIZE = 1024;

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
    analyser.smoothingTimeConstant = 0.8;

    // Tap into superdough's destinationGain — all Strudel audio flows through it.
    // SuperdoughAudioController.output is a SuperdoughOutput, and destinationGain lives on that.
    const controller = getController();
    if (controller?.output?.destinationGain) {
      controller.output.destinationGain.connect(analyser);
    } else {
      console.warn("[AudioBridge] destinationGain not available");
      activatedRef.current = false;
      return;
    }

    setAnalyserNode(analyser);

    // Start rAF loop that feeds Hydra's a0–a3 globals AND a.fft[] array
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Float32Array(bufferLength);
    const binSize = Math.floor(bufferLength / NUM_BINS);

    // Re-set window.a with a fresh live fft array.
    // Hydra may have overwritten window.a (to undefined) during init with detectAudio:false.
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

      for (let i = 0; i < NUM_BINS; i++) {
        let sum = 0;
        for (let j = i * binSize; j < (i + 1) * binSize; j++) {
          sum += dataArray[j]!;
        }
        const avgDb = sum / binSize;
        const normalized = Math.max(0, Math.min(1, (avgDb + 100) / 100));

        fft[i] = normalized;

        // Also expose a0–a3 for legacy / alternative Hydra patterns
        (globalThis as Record<string, unknown>)[`a${i}`] = (
          scale = 1,
          offset = 0,
        ) => () => normalized * scale + offset;
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

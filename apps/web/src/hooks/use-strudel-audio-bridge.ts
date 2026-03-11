"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const NUM_BINS = 4;
const FFT_SIZE = 1024;

/**
 * Bridges Strudel's audio output to Hydra's `a0()`–`a3()` globals
 * and exposes the AnalyserNode for scope visualization.
 *
 * Call `activate()` after Strudel has initialized its AudioContext.
 */
export function useStrudelAudioBridge() {
  const [bridgeActive, setBridgeActive] = useState(false);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const activatedRef = useRef(false);

  const activate = useCallback(async () => {
    if (activatedRef.current) return;
    activatedRef.current = true;

    // Dynamic import — types may not include these exports, but they exist at runtime
    const strudel = await import("@strudel/web");
    const getAudioContext = (strudel as Record<string, unknown>)["getAudioContext"] as () => AudioContext;
    const getController = (strudel as Record<string, unknown>)["getSuperdoughAudioController"] as () => { destinationGain?: GainNode } | undefined;

    if (!getAudioContext || !getController) {
      console.warn("[AudioBridge] required Strudel exports not found");
      activatedRef.current = false;
      return;
    }

    const ctx = getAudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    analyser.smoothingTimeConstant = 0.8;

    // Tap into superdough's destinationGain — all Strudel audio flows through it
    const controller = getController();
    if (controller?.destinationGain) {
      controller.destinationGain.connect(analyser);
    } else {
      console.warn("[AudioBridge] destinationGain not available");
      activatedRef.current = false;
      return;
    }

    setAnalyserNode(analyser);

    // Start rAF loop that feeds Hydra's a0–a3 globals
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Float32Array(bufferLength);
    const binSize = Math.floor(bufferLength / NUM_BINS);

    function loop() {
      analyser.getFloatFrequencyData(dataArray);

      for (let i = 0; i < NUM_BINS; i++) {
        let sum = 0;
        for (let j = i * binSize; j < (i + 1) * binSize; j++) {
          sum += dataArray[j]!;
        }
        const avgDb = sum / binSize;
        const normalized = Math.max(0, Math.min(1, (avgDb + 100) / 100));
        const val = normalized;

        // Hydra expects: a0(scale, offset) => () => value * scale + offset
        (globalThis as Record<string, unknown>)[`a${i}`] = (
          scale = 1,
          offset = 0,
        ) => () => val * scale + offset;
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

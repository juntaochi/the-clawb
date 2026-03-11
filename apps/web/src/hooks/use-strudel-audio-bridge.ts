"use client";

import { useRef, useState, useCallback } from "react";

const NUM_BINS = 5;

/**
 * Audio data received from the sandboxed Strudel iframe via postMessage.
 *
 * The Strudel sandbox performs FFT analysis internally and posts:
 *   - fft: 5 normalized (0-1) frequency band values for Hydra audio reactivity
 *   - scope: 512 time-domain samples for waveform visualization
 *   - freq: 256 raw frequency-domain samples for spectrum visualization
 */
export interface AudioBridgeData {
  fft: number[];
  scope: number[];
  freq: number[];
}

/**
 * Bridges Strudel's audio output to Hydra's `a.fft[]` globals
 * and provides raw audio data for scope visualization.
 *
 * In the sandboxed architecture, FFT analysis runs inside the Strudel
 * iframe and is sent to the parent via postMessage. This hook:
 *   1. Receives audio data from the StrudelPlayer's onAudioData callback
 *   2. Forwards the 5-bin FFT to the Hydra sandbox via the hydra bridge
 *   3. Exposes scope/freq data for the StrudelScope component
 */
export function useStrudelAudioBridge() {
  const [bridgeActive, setBridgeActive] = useState(false);
  const scopeDataRef = useRef<Float32Array>(new Float32Array(512));
  const freqDataRef = useRef<Float32Array>(new Float32Array(256));
  const fftRef = useRef<Float32Array>(new Float32Array(NUM_BINS));
  // Callback ref for sending FFT to Hydra sandbox
  const hydraFftSenderRef = useRef<((fft: number[]) => void) | null>(null);

  /**
   * Register the Hydra bridge's FFT sender so we can forward audio data
   * from the Strudel sandbox to the Hydra sandbox.
   */
  const setHydraFftSender = useCallback((sender: (fft: number[]) => void) => {
    hydraFftSenderRef.current = sender;
  }, []);

  /**
   * Handle audio data arriving from the Strudel sandbox.
   * Pass this as the `onAudioData` prop to StrudelPlayer.
   */
  const handleAudioData = useCallback((data: AudioBridgeData) => {
    // Update FFT bins
    const { fft, scope, freq } = data;
    if (fft) {
      for (let i = 0; i < NUM_BINS && i < fft.length; i++) {
        fftRef.current[i] = fft[i]!;
      }
      // Forward to Hydra sandbox
      hydraFftSenderRef.current?.(fft);
    }

    // Update scope data for visualization
    if (scope) {
      const dst = scopeDataRef.current;
      for (let i = 0; i < dst.length && i < scope.length; i++) {
        dst[i] = scope[i]!;
      }
    }

    // Update frequency data for visualization
    if (freq) {
      const dst = freqDataRef.current;
      for (let i = 0; i < dst.length && i < freq.length; i++) {
        dst[i] = freq[i]!;
      }
    }

    if (!bridgeActive) setBridgeActive(true);
  }, [bridgeActive]);

  return {
    handleAudioData,
    setHydraFftSender,
    bridgeActive,
    scopeData: scopeDataRef,
    freqData: freqDataRef,
    fftData: fftRef,
  };
}

"use client";

import { useEffect, useRef } from "react";

interface StrudelScopeProps {
  analyserNode: AnalyserNode | null;
  className?: string;
}

const PEAK_DECAY = 0.994; // how slowly peaks fall

export function StrudelScope({ analyserNode, className }: StrudelScopeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !analyserNode) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const timeData = new Float32Array(analyserNode.fftSize);
    const freqData = new Float32Array(analyserNode.frequencyBinCount);
    const BAR_COUNT = 80;
    const peaks = new Float32Array(BAR_COUNT);

    function draw() {
      const w = canvas!.width;
      const h = canvas!.height;
      const scopeH = Math.round(h * 0.35); // top 35% — waveform
      const specH = h - scopeH;             // bottom 65% — spectrum

      analyserNode!.getFloatTimeDomainData(timeData);
      analyserNode!.getFloatFrequencyData(freqData);

      // --- Background ---
      ctx!.clearRect(0, 0, w, h);

      // --- Waveform ---
      const sliceW = w / timeData.length;

      ctx!.strokeStyle = "rgba(255,255,255,0.6)";
      ctx!.lineWidth = 1;
      ctx!.beginPath();
      for (let i = 0; i < timeData.length; i++) {
        const v = timeData[i]!;
        const y = scopeH * 0.5 + v * scopeH * 0.42;
        if (i === 0) ctx!.moveTo(0, y);
        else ctx!.lineTo(i * sliceW, y);
      }
      ctx!.stroke();

      // Divider
      ctx!.strokeStyle = "rgba(255,255,255,0.08)";
      ctx!.lineWidth = 1;
      ctx!.beginPath();
      ctx!.moveTo(0, scopeH);
      ctx!.lineTo(w, scopeH);
      ctx!.stroke();

      // --- Spectrum bars ---
      const binCount = freqData.length;
      const barW = w / BAR_COUNT;

      for (let i = 0; i < BAR_COUNT; i++) {
        const binIndex = Math.floor(
          Math.pow(i / BAR_COUNT, 1.8) * binCount
        );
        const db = freqData[Math.min(binIndex, binCount - 1)]!;
        const normalized = Math.max(0, (db + 100) / 100);
        const barH = normalized * specH * 0.92;

        ctx!.fillStyle = `rgba(255,255,255,${0.15 + normalized * 0.45})`;
        ctx!.fillRect(
          i * barW,
          scopeH + specH - barH,
          Math.max(barW - 1, 1),
          barH
        );

        // Peak hold
        peaks[i] = Math.max(peaks[i]! * PEAK_DECAY, normalized);
        const peakY = scopeH + specH - peaks[i]! * specH * 0.92;
        ctx!.fillStyle = "rgba(255,255,255,0.5)";
        ctx!.fillRect(i * barW, peakY, Math.max(barW - 1, 1), 1);
      }

      rafRef.current = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [analyserNode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const w = Math.round(width);
        const h = Math.round(height);
        if (w > 0 && h > 0 && (canvas.width !== w || canvas.height !== h)) {
          canvas.width = w;
          canvas.height = h;
        }
      }
    });

    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  if (!analyserNode) return null;

  return (
    <div className={className} style={{ position: "relative", overflow: "hidden" }}>
      <canvas
        ref={canvasRef}
        width={400}
        height={120}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </div>
  );
}

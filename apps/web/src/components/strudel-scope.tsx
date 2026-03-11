"use client";

import { useEffect, useRef } from "react";

interface StrudelScopeProps {
  analyserNode: AnalyserNode | null;
  className?: string;
}

const WAVEFORM_COLOR = "#00ff88";
const BG_COLOR = "rgba(0, 0, 0, 0.85)";

/**
 * Renders a waveform (top) + frequency spectrum (bottom) visualization
 * from a Web Audio AnalyserNode. Designed for the DJ panel.
 */
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

    function draw() {
      const w = canvas!.width;
      const h = canvas!.height;
      const halfH = h / 2;

      // Clear
      ctx!.fillStyle = BG_COLOR;
      ctx!.fillRect(0, 0, w, h);

      analyserNode!.getFloatTimeDomainData(timeData);
      analyserNode!.getFloatFrequencyData(freqData);

      // --- Waveform (top half) ---
      ctx!.strokeStyle = WAVEFORM_COLOR;
      ctx!.lineWidth = 1.5;
      ctx!.beginPath();

      const sliceWidth = w / timeData.length;
      let x = 0;
      for (let i = 0; i < timeData.length; i++) {
        const v = timeData[i]!;
        const y = halfH / 2 + v * halfH * 0.4;
        if (i === 0) ctx!.moveTo(x, y);
        else ctx!.lineTo(x, y);
        x += sliceWidth;
      }
      ctx!.stroke();

      // --- Spectrum (bottom half) ---
      const barCount = Math.min(freqData.length, 128);
      const barWidth = w / barCount;

      for (let i = 0; i < barCount; i++) {
        // Normalize dB: -100 → 0, 0 → 1
        const db = freqData[i]!;
        const normalized = Math.max(0, (db + 100) / 100);
        const barHeight = normalized * halfH * 0.9;

        // Gradient from cyan to green based on frequency
        const hue = 140 + (i / barCount) * 40; // 140 (cyan-ish) to 180 (green)
        ctx!.fillStyle = `hsla(${hue}, 100%, 50%, 0.7)`;
        ctx!.fillRect(
          i * barWidth,
          h - barHeight,
          barWidth - 1,
          barHeight,
        );
      }

      // Divider line
      ctx!.strokeStyle = "rgba(255, 255, 255, 0.15)";
      ctx!.lineWidth = 1;
      ctx!.beginPath();
      ctx!.moveTo(0, halfH);
      ctx!.lineTo(w, halfH);
      ctx!.stroke();

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

  // Resize canvas to match container
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
        style={{
          width: "100%",
          height: "100%",
          display: "block",
        }}
      />
    </div>
  );
}

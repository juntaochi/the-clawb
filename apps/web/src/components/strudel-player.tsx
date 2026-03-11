"use client";

import { useEffect, useRef, useState, useCallback } from "react";

type StrudelApi = typeof import("@strudel/web");

interface StrudelPlayerProps {
  /** Strudel live-coding string to evaluate and play. */
  code: string;
  /** Called after Strudel's AudioContext is initialized and ready. */
  onReady?: () => void;
}

/**
 * Audio-only Strudel player.
 *
 * Renders a "Click to start audio" button until the user initiates playback
 * (browsers require a user gesture to unlock AudioContext). Once started,
 * it evaluates the `code` prop whenever it changes, producing audio output.
 *
 * Renders nothing visible once audio is active -- visual code display is
 * handled by a separate component.
 */
export function StrudelPlayer({ code, onReady }: StrudelPlayerProps) {
  const [started, setStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const apiRef = useRef<StrudelApi | null>(null);
  const readyRef = useRef<Promise<unknown> | null>(null);
  const lastCodeRef = useRef<string>("");

  const start = useCallback(async () => {
    try {
      // Dynamic import -- only runs in the browser
      const strudel: StrudelApi = await import("@strudel/web");
      apiRef.current = strudel;

      // initStrudel sets up the AudioContext, synth sounds, and eval scope.
      // It also installs a "resume on first click" handler via initAudioOnFirstClick.
      readyRef.current = strudel.initStrudel();
      await readyRef.current;

      setStarted(true);
      setError(null);
      onReady?.();

      // If code was already provided before start, evaluate it now
      if (code) {
        lastCodeRef.current = code;
        await strudel.evaluate(code);
      }
    } catch (err) {
      console.error("[StrudelPlayer] init error:", err);
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [code, onReady]);

  // Re-evaluate whenever `code` changes (after initial start)
  useEffect(() => {
    if (!started || !apiRef.current || !readyRef.current) return;
    if (!code || code === lastCodeRef.current) return;

    lastCodeRef.current = code;
    let cancelled = false;

    readyRef.current
      .then(() => {
        if (cancelled) return;
        return apiRef.current!.evaluate(code);
      })
      .then(() => {
        if (!cancelled) setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        // Strudel evaluation errors are common (transient bad code from AI).
        // Log but don't break the component -- next code update may fix it.
        console.warn("[StrudelPlayer] eval error:", err);
        setError(err instanceof Error ? err.message : String(err));
      });

    return () => {
      cancelled = true;
    };
  }, [code, started]);

  // Cleanup: silence on unmount
  useEffect(() => {
    return () => {
      try {
        apiRef.current?.hush();
      } catch {
        // Ignore -- component is unmounting
      }
    };
  }, []);

  if (started) {
    // Audio-only: render nothing visible.
    // Optionally surface eval errors as a small toast-like element for debugging.
    return error ? (
      <div
        role="alert"
        className="fixed bottom-4 right-4 bg-red-900/80 text-red-200 text-xs px-3 py-1.5 rounded font-mono max-w-sm truncate z-50"
        title={error}
      >
        strudel: {error}
      </div>
    ) : null;
  }

  return (
    <button
      onClick={start}
      className="fixed bottom-4 right-4 bg-white/10 hover:bg-white/20 text-white text-sm px-4 py-2 rounded font-mono transition-colors z-50"
    >
      Click to start audio
    </button>
  );
}

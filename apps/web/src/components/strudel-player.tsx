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
  const startingRef = useRef(false);

  const start = useCallback(async () => {
    if (startingRef.current) return;
    startingRef.current = true;
    try {
      // Dynamic import -- only runs in the browser
      const strudel: StrudelApi = await import("@strudel/web");
      apiRef.current = strudel;

      // initStrudel sets up the AudioContext, synth sounds, and eval scope.
      // It also does Object.assign(globalThis, ...) which overwrites Hydra's
      // globals (osc, noise, src, etc.) AND properties Hydra reads every frame
      // via sandbox.tick() — speed, bpm, fps, update, afterUpdate.
      // If window.speed becomes a function/undefined, Hydra's time goes NaN
      // and all shaders break → solid color fill.
      // Save and restore critical globals around init.
      const hydraGlobals: Record<string, unknown> = {};
      const keysToProtect = [
        // Hydra sandbox.tick() reads these every frame (userProps)
        "speed", "bpm", "fps", "update", "afterUpdate",
        // Hydra generator functions used by eval'd code
        "osc", "noise", "shape", "solid", "gradient", "src", "voronoi",
        // Hydra output/source refs
        "o0", "o1", "o2", "o3", "s0", "s1", "s2", "s3",
        // Hydra utilities (NOT "a" — the audio bridge manages window.a separately)
        "render", "hush", "setResolution", "time", "mouse",
      ];
      for (const k of keysToProtect) {
        if (k in globalThis) hydraGlobals[k] = (globalThis as Record<string, unknown>)[k];
      }

      // readyRef gates the useEffect — it must not resolve until samples are loaded
      let resolveReady: () => void;
      readyRef.current = new Promise<void>((r) => { resolveReady = r; });

      await strudel.initStrudel();

      // Ensure AudioContext is running (may be suspended without user gesture)
      const getAudioContext = (strudel as Record<string, unknown>)["getAudioContext"] as
        | (() => AudioContext)
        | undefined;
      if (getAudioContext) {
        const ctx = getAudioContext();
        if (ctx.state === "suspended") await ctx.resume();
      }

      // Restore Hydra's globals that Strudel may have overwritten.
      // "speed" and "bpm" are special: Strudel needs them as functions (pattern
      // constructors) while Hydra reads them as numbers every frame via
      // sandbox.tick().  We create hybrid function objects with valueOf() so
      // that `speed("1.05")` works (Strudel) AND `dt * speed` coerces to a
      // number (Hydra).
      const dualUseKeys = new Set(["speed", "bpm"]);
      for (const k of keysToProtect) {
        if (!(k in hydraGlobals)) continue;
        if (dualUseKeys.has(k)) {
          const strudelFn = (globalThis as Record<string, unknown>)[k];
          const hydraVal = hydraGlobals[k];
          if (typeof strudelFn === "function" && typeof hydraVal === "number") {
            // Wrap: callable for Strudel, coerces to number for Hydra
            const hybrid = function (this: unknown, ...args: unknown[]) {
              return (strudelFn as Function).apply(this, args);
            };
            hybrid.valueOf = () => hydraVal;
            Object.defineProperty(hybrid, Symbol.toPrimitive, { value: () => hydraVal });
            (globalThis as Record<string, unknown>)[k] = hybrid;
            continue;
          }
        }
        (globalThis as Record<string, unknown>)[k] = hydraGlobals[k];
      }

      // Load default drum samples from CDN BEFORE marking ready
      await strudel.evaluate(`await samples('github:tidalcycles/dirt-samples')`);

      // Evaluate code first so audio is actually playing —
      // superdough's destinationGain only exists after the first sound triggers.
      if (code) {
        lastCodeRef.current = code;
        await strudel.evaluate(code);
      }

      // Now audio is flowing — safe to activate the bridge
      resolveReady!();
      setStarted(true);
      setError(null);
      onReady?.();
    } catch (err) {
      console.error("[StrudelPlayer] init error:", err);
      setError(err instanceof Error ? err.message : String(err));
      startingRef.current = false; // allow retry on next interaction
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

  // Start audio on first user interaction (required by browser autoplay policy)
  useEffect(() => {
    if (started) return;
    const handler = () => { start(); };
    const events = ["click", "keydown", "touchstart"] as const;
    events.forEach((e) => document.addEventListener(e, handler));
    return () => {
      events.forEach((e) => document.removeEventListener(e, handler));
    };
  }, [started, start]);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center cursor-pointer bg-black/60 backdrop-blur-sm">
      <span className="code-line text-white/70 text-sm font-mono tracking-widest">
        click anywhere to start
      </span>
    </div>
  );
}

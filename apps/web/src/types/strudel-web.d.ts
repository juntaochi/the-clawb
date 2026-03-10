declare module "@strudel/web" {
  /** Initialize the Strudel audio engine (AudioContext, synth sounds, eval scope). */
  export function initStrudel(options?: {
    /** Custom prebake function run after default initialization. */
    prebake?: () => Promise<void>;
    /** Whether to register mini-notation string interpolation (default: true). */
    miniAllStrings?: boolean;
    [key: string]: unknown;
  }): Promise<unknown>;

  /** Evaluate a Strudel code string and optionally start playback. */
  export function evaluate(code: string, autoplay?: boolean): Promise<unknown>;

  /** Stop all playback immediately. */
  export function hush(): void;

  /** Run default prebake (registers core modules and synth sounds). */
  export function defaultPrebake(): Promise<void>;
}

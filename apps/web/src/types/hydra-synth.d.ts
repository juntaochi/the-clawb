declare module "hydra-synth" {
  interface HydraOptions {
    canvas?: HTMLCanvasElement;
    width?: number;
    height?: number;
    numSources?: number;
    numOutputs?: number;
    makeGlobal?: boolean;
    autoLoop?: boolean;
    detectAudio?: boolean;
    enableStreamCapture?: boolean;
    precision?: "lowp" | "mediump" | "highp";
    pb?: unknown;
    extendTransforms?: Record<string, unknown>;
  }

  interface HydraAudio {
    hide: () => void;
    show: () => void;
    fft: number[];
    setBins: (n: number) => void;
    setCutoff: (c: number) => void;
    setSmooth: (s: number) => void;
    setScale: (s: number) => void;
  }

  interface HydraSynth {
    time: number;
    bpm: number;
    width: number;
    height: number;
    speed: number;
    fps: number | undefined;
    a?: HydraAudio;
    render: (output?: unknown) => void;
    setResolution: (w: number, h: number) => void;
    update: (dt: number) => void;
    hush: () => void;
    screencap: () => void;
  }

  class HydraRenderer {
    constructor(options?: HydraOptions);
    eval(code: string): void;
    hush(): void;
    setResolution(width: number, height: number): void;
    synth: HydraSynth;
    canvas: HTMLCanvasElement;
  }

  export default HydraRenderer;
}

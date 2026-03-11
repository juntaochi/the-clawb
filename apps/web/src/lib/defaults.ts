export const DEFAULT_DJ_CODE = `setcpm(128/4)

stack(
  // Kick — 4-on-the-floor, ghost on "and" of 4
  sound("bd ~ ~ ~ bd ~ ~ [bd ~]")
    .gain(0.82)
    .orbit(0),

  // Clap — 2 & 4, tight room
  sound("~ ~ cp ~ ~ ~ cp ~")
    .gain(0.50)
    .room(0.22)
    .orbit(0),

  // Closed hats — 16ths, velocity breathes with LFO
  sound("hh*16")
    .gain(sine.range(0.13, 0.27))
    .hpf(5800)
    .pan(sine.range(0.42, 0.58))
    .orbit(1),

  // Open hat — punctuates every 2 bars
  sound("~ ~ ~ ~ ~ ~ ~ oh")
    .gain(0.20)
    .lpf(9000)
    .orbit(1),

  // Sub bass — root lock, felt not heard
  note("a1*4")
    .sound("sine")
    .lpf(95)
    .gain(0.60)
    .orbit(2),

  // Mid bass — melodic, filter moves slowly
  note("<a2 a2 [c3 b2] a2>/1")
    .sound("sawtooth")
    .lpf(sine.range(350, 900))
    .gain(0.36)
    .room(0.08)
    .orbit(2),

  // Pad — airy, arrives late in the phrase
  note("<~ ~ c3 [~ eb3]>/2")
    .sound("sine")
    .gain(0.16)
    .lpf(1600)
    .delay(0.42)
    .delaytime(0.375)
    .delayfeedback(0.35)
    .room(0.70)
    .pan(0.44)
    .orbit(3)
)`;

export const DEFAULT_HYDRA_CODE = `// Audio sensitivity tuning
a.setSmooth(0.85)
a.setScale(6)
a.setCutoff(0.3)

osc(() => 3 + a.fft[0] * 18, 0.03, () => a.fft[2] * Math.PI)
  .color(
    () => 0.05 + a.fft[0] * 0.55,
    () => 0.08 + a.fft[1] * 0.15,
    () => 0.35 + a.fft[2] * 0.50
  )
  .modulate(
    noise(() => 1.5 + a.fft[2] * 7),
    () => a.fft[0] * 0.22
  )
  .blend(
    src(o0)
      .scale(() => 1.002 + a.fft[0] * 0.006)
      .rotate(() => a.fft[1] * 0.003)
      .brightness(-0.014),
    () => 0.84 - a.fft[0] * 0.20
  )
  .kaleid(6)
  .saturate(() => 1.1 + a.fft[0] * 2.2)
  .brightness(() => -0.08 + a.fft[0] * 0.15)
  .out(o0)`;

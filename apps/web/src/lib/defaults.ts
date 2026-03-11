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

export const DEFAULT_HYDRA_CODE = `a.setBins(5)
a.setSmooth(0.75)
a.setScale(5)
a.setCutoff(0.3)
a.hide()

shape([4, 5, 6].fast(0.1).smooth(1), 0.000001, [0.2, 0.7].smooth(1))
  .color(0.2, 0.4, 0.3)
  .scrollX(() => Math.sin(time * 0.27) + a.fft[0] * 0.5)
  .add(shape([4, 5, 6].fast(0.1).smooth(1), 0.000001, [0.2, 0.7, 0.5, 0.3].smooth(1))
    .color(0.6, 0.2, 0.5)
    .scrollY(0.35 + a.fft[4] * 0.5)
    .scrollX(() => Math.sin(time * 0.33) + a.fft[4] * 0.5))
  .add(shape([4, 5, 6].fast(0.1).smooth(1), 0.000001, [0.2, 0.7, 0.3].smooth(1))
    .color(0.2, 0.4, 0.6)
    .scrollY(-0.35 - a.fft[0] * 0.5)
    .scrollX(() => Math.sin(time * 0.41) * -1 + a.fft[0] * 0.5))
  .blend(src(o0)
    .shift(0.001, 0.001, 0.001)
    .scrollX([0.05, -0.05].fast(0.1).smooth(1))
    .scale([1.05, 0.9].fast(0.3).smooth(1.726), [1.05, 0.9, 1].fast(0.29).smooth(1)), 0.85)
  .modulate(voronoi(10, 2, 2))
  .out()`;

export const DEFAULT_DJ_CODE = `samples('github:tidalcycles/dirt-samples')
samples({
  'slap': 'https://cdn.freesound.org/previews/495/495416_10350281-lq.mp3',
  'whirl': 'https://cdn.freesound.org/previews/495/495313_10350281-lq.mp3',
  'attack': 'https://cdn.freesound.org/previews/494/494947_10350281-lq.mp3'
})

setcps(1.25)

note("[c2 ~](3,8)*2,eb,g,bb,d").s("sawtooth")
  .noise(0.3)
  .lpf(perlin.range(800,2000).mul(0.6))
  .lpenv(perlin.range(1,5)).lpa(.25).lpd(.1).lps(0)
  .add.mix(note("<0!3 [1 <4!3 12>]>")).late(.5)
  .vib("4:.2")
  .room(1).roomsize(4).slow(4)
  .stack(
    s("bd").late("<0.01 .251>"),
    s("breaks165:1/2").fit()
    .chop(4).sometimesBy(.4, ply("2"))
    .sometimesBy(.1, ply("4")).release(.01)
    .gain(1.5).sometimes(mul(speed("1.05"))).cut(1)
    ,
    s("<whirl attack>?").delay(".8:.1:.8").room(2).slow(8).cut(2),
  ).reset("<x@30 [x*[8 [8 [16 32]]]]@2>".late(2))`;

// All a.fft[] reads MUST be inside () => arrow functions so they update each frame.
export const DEFAULT_VJ_CODE = `a.setBins(5)
a.setSmooth(0.75)
a.setScale(5)
a.setCutoff(0.3)
a.hide()
shape([4, 5, 6].fast(0.1).smooth(1), 0.000001, [0.2, 0.7].smooth(1))
  .color(0.2, 0.4, 0.3)
  .scrollX(() => Math.sin(time * 0.27) + a.fft[0] * 0.8)
  .add(shape([4, 5, 6].fast(0.1).smooth(1), 0.000001, [0.2, 0.7, 0.5, 0.3].smooth(1))
    .color(0.6, 0.2, 0.5)
    .scrollY(() => 0.35 + a.fft[4] * 0.8)
    .scrollX(() => Math.sin(time * 0.33) + a.fft[4] * 0.8))
  .add(shape([4, 5, 6].fast(0.1).smooth(1), 0.000001, [0.2, 0.7, 0.3].smooth(1))
    .color(0.2, 0.4, 0.6)
    .scrollY(() => -0.35 - a.fft[0] * 0.8)
    .scrollX(() => Math.sin(time * 0.41) * -1 + a.fft[0] * 0.8))
  .add(src(o0)
    .shift(0.001, 0.001, 0.001)
    .scrollX([0.05, -0.05].fast(0.1).smooth(1))
    .scale([1.05, 0.9].fast(0.3).smooth(1.726), [1.05, 0.9, 1].fast(0.29).smooth(1)), 0.85)
  .modulate(voronoi(10, 2, 2))
  .out()`;

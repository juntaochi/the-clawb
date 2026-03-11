# Strudel Syntax Guide for AI DJs

Strudel is a live coding music environment. You write patterns that describe rhythmic and melodic sequences, then chain effects to shape the sound.

## Basic Patterns

### Notes

```js
note("c3 e3 g3")          // play three notes per cycle
note("c3 e3 g3 b3")       // four notes per cycle
note("c3").sound("piano")  // specify instrument
```

### Drums / Samples

```js
sound("bd sd hh sd")       // kick, snare, hihat, snare
sound("bd*4")              // four kicks per cycle
sound("hh*8")              // eight hihats per cycle
```

## Mini-Notation

The mini-notation is the pattern language inside the quotes.

| Syntax | Meaning | Example |
|---|---|---|
| `a b c` | Sequence (equal time) | `"bd sd hh"` |
| `a*n` | Repeat n times | `"hh*8"` — 8 hihats |
| `a/n` | Slow down by n | `"c3/2"` — plays every 2 cycles |
| `[a b]` | Subdivide (fit in one step) | `"bd [sd sd]"` — two snares in half the time |
| `<a b c>` | Alternate each cycle | `"<c3 e3 g3>"` — different note each cycle |
| `a?` | Random chance (50%) | `"hh*8?"` — random gaps |
| `a(n,m)` | Euclidean rhythm | `"bd(3,8)"` — 3 hits in 8 slots |
| `a:n` | Sample number | `"bd:2"` — third kick variant |
| `~` | Rest/silence | `"bd ~ sd ~"` |

## Sounds

Common built-in sounds:

- **Drums:** `bd`, `sd`, `hh`, `oh`, `cp`, `rim`, `tom`
- **Synths:** `sine`, `sawtooth`, `square`, `triangle`
- **Melodic:** `piano`, `bass`, `pluck`, `metal`

## Effects

Chain effects after a pattern with `.effect(value)`:

| Effect | Range | Description |
|---|---|---|
| `.gain(v)` | 0-1 | Volume |
| `.lpf(freq)` | 20-20000 | Low-pass filter cutoff (Hz) |
| `.hpf(freq)` | 20-20000 | High-pass filter cutoff (Hz) |
| `.delay(time)` | 0-1 | Delay wet amount |
| `.delaytime(t)` | 0-1 | Delay time |
| `.delayfeedback(f)` | 0-0.95 | Delay feedback |
| `.room(size)` | 0-1 | Reverb room size |
| `.pan(pos)` | 0-1 | Stereo pan (0.5 = center) |
| `.speed(rate)` | -2 to 2 | Playback speed |
| `.vowel(v)` | "a","e","i","o","u" | Vowel filter |
| `.crush(bits)` | 1-16 | Bitcrusher |

## Pattern Operations

### `stack()` — Layer patterns simultaneously

```js
stack(
  note("c3 e3 g3").sound("sine"),
  sound("bd sd bd sd"),
  sound("hh*8").gain(0.4)
)
```

### `cat()` — Sequence patterns across cycles

```js
cat(
  note("c3 e3 g3"),
  note("d3 f3 a3")
)  // alternates each cycle
```

### `.rev()` — Reverse pattern

```js
note("c3 e3 g3 b3").rev()
```

### `.jux(fn)` — Apply function to right channel only

```js
note("c3 e3 g3").jux(rev)  // original left, reversed right
```

### `.every(n, fn)` — Apply function every n cycles

```js
sound("bd sd hh sd").every(4, rev)  // reverse every 4th cycle
```

### `.sometimes(fn)` — Apply function randomly (50%)

```js
note("c3 e3 g3").sometimes(x => x.speed(2))
```

### `.fast(n)` / `.slow(n)` — Speed up or slow down

```js
sound("bd sd hh sd").fast(2)   // double speed
sound("bd sd hh sd").slow(2)   // half speed
```

## Transition Techniques

These are essential for smooth DJ sets:

### Filter Sweep

```js
// Gradually open the filter over several pushes:
note("c3 e3 g3").sound("sawtooth").lpf(400)   // push 1: muffled
note("c3 e3 g3").sound("sawtooth").lpf(800)   // push 2: opening up
note("c3 e3 g3").sound("sawtooth").lpf(2000)  // push 3: bright
```

### Volume Fade

```js
// Bring in a new element quietly, then raise it:
sound("hh*8").gain(0.1)   // push 1: barely audible
sound("hh*8").gain(0.3)   // push 2: present
sound("hh*8").gain(0.6)   // push 3: prominent
```

### Gradual Complexity

```js
// Start simple, add layers:
sound("bd bd bd bd")                                    // push 1: just kicks
stack(sound("bd bd bd bd"), sound("hh*8").gain(0.3))   // push 2: add hats
```

## Tempo / BPM

Strudel works in **cycles**, not beats. To convert BPM:

```js
setcpm(120/4)   // 120 BPM with 4 beats per cycle (most common)
setcpm(90/4)    // 90 BPM with 4 beats per cycle
setcpm(140/4)   // 140 BPM techno
```

Or per-pattern (doesn't change global tempo):
```js
s("bd sd hh sd").cpm(90)   // = 90 CPM for this pattern only
```

Rule of thumb: if your pattern has 4 steps and you want 120 BPM, use `setcpm(120/4)`.

Default is `setcpm(30)` — 1 cycle every 2 seconds (equivalent to 120 BPM in 4/4 time if your cycle has 4 beats). Not "30 BPM".

## Signal Oscillators as Pattern Values

Use LFOs to animate parameters over time:

```js
sine.range(200, 4000)    // sine wave oscillating between 200 and 4000
saw.range(0.1, 0.9)      // sawtooth from 0.1 to 0.9
rand.range(0.2, 0.9)     // random value between 0.2 and 0.9 each cycle
```

Examples:
```js
note("c3*8").sound("sawtooth").lpf(sine.range(300, 3000))  // filter sweep
sound("hh*8").pan(sine.range(0, 1))                        // auto-pan
sound("bd*4").gain(saw.range(0.4, 0.9))                    // rising gain
```

## Common Pitfalls (AI-specific)

These are frequent mistakes LLMs make with Strudel:

| Wrong | Correct | Why |
|---|---|---|
| `bpm(120)` | `setcpm(120/4)` | No `bpm()` function in Strudel |
| `setcps(2)` for 120 BPM | `setcpm(120/4)` | `setcps` is Hz, not intuitive |
| `{bd sd}` | `[bd sd]` | `{}` is TidalCycles polyrhythm, not Strudel |
| `note("c4") # gain 0.5` | `note("c4").gain(0.5)` | `#` is Haskell, not JS |
| `d1 $ sound "bd"` | `sound("bd")` | `d1 $` is TidalCycles, not Strudel |
| `note("c")` | `note("c4")` | Always include octave number |
| `.sound("sawtooth wave")` | `.sound("sawtooth")` | No "wave" suffix |
| `stack([pat1, pat2])` | `stack(pat1, pat2)` | `stack` takes spread args, not array |

**Mini-notation confusion:**
- `"a b"` = sequence (a then b, equal time)
- `"[a b]"` = sub-sequence (a and b squeezed into one step)
- `"<a b>"` = alternate (a on cycle 1, b on cycle 2)
- `","` = parallel (use inside `sound()` or wrap with `stack()`)

## Complete Examples

```js
### Coastline by Eddyflux
// "coastline" @by eddyflux
// @version 1.0
samples('github:eddyflux/crate')
setcps(.75)
let chords = chord("<Bbm9 Fm9>/4").dict('ireal')
stack(
  stack( // DRUMS
    s("bd").struct("<[x*<1 2> [~@3 x]] x>"),
    s("~ [rim, sd:<2 3>]").room("<0 .2>"),
    n("[0 <1 3>]*<2!3 4>").s("hh"),
    s("rd:<1!3 2>*2").mask("<0 0 1 1>/16").gain(.5)
  ).bank('crate')
  .mask("<[0 1] 1 1 1>/16".early(.5))
  , // CHORDS
  chords.offset(-1).voicing().s("gm_epiano1:1")
  .phaser(4).room(.5)
  , // MELODY
  n("<0!3 1*2>").set(chords).mode("root:g2")
  .voicing().s("gm_acoustic_bass"),
  chords.n("[0 <4 3 <2 5>>*2](<3 5>,8)")
  .anchor("D5").voicing()
  .segment(4).clip(rand.range(.4,.8))
  .room(.75).shape(.3).delay(.25)
  .fm(sine.range(3,8).slow(8))
  .lpf(sine.range(500,1000).slow(8)).lpq(5)
  .rarely(ply("2")).chunk(4, fast(2))
  .gain(perlin.range(.6, .9))
  .mask("<0 1 1 0>/16")
)
.late("[0 .01]*4").late("[0 .01]*2").size(4)
```

### Break Beat

```js
// "broken cut 1" @by froos
// @version 1.0

samples('github:tidalcycles/dirt-samples')
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
  ).reset("<x@30 [x*[8 [8 [16 32]]]]@2>".late(2))
```

### Acid House

```js
// "acidic tooth" @by eddyflux
// @version 1.0
  setcps(1)
  stack(
    note("[<g1 f1>/8](<3 5>,8)")
    .clip(perlin.range(.15,1.5))
    .release(.1)
    .s("sawtooth")
    .lpf(sine.range(400,800).slow(16))
    .lpq(cosine.range(6,14).slow(3))
    .lpenv(sine.mul(4).slow(4))
    .lpd(.2).lpa(.02)
    .ftype('24db')
    .rarely(add(note(12)))
    .room(.2).shape(.3).postgain(.5)
    .superimpose(x=>x.add(note(12)).delay(.5).bpf(1000))
    .gain("[.2 1@3]*2") // fake sidechain
    ,
    stack(
      s("bd*2").mask("<0@4 1@16>"),
      s("hh*8").gain(saw.mul(saw.fast(2))).clip(sine)
      .mask("<0@8 1@16>")
    ).bank('RolandTR909')
  )
```

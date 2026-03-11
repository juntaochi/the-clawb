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

### Filter Envelopes

Shape the filter cutoff over each note's lifetime. This is the secret to acid bass, plucky synths, and evolving pads.

```js
// Acid bass — high envelope depth, fast decay
note("c2 <eb2 g2>").s("sawtooth")
  .lpf(300)        // base cutoff
  .lpq(8)          // high resonance
  .lpenv(4)        // envelope depth (multiplier of lpf)
  .lpa(0.01)       // attack
  .lpd(0.15)       // decay
  .lps(0)          // sustain at 0 = plucky
  .ftype("24db")   // steeper filter slope

// Slow pad filter
note("c3 e3 g3 b3").s("sawtooth")
  .lpf(sine.slow(8).range(400, 2000))
  .lpq(2)
```

### Amplitude Envelope (ADSR)

```js
// Plucky sound
note("c3 e3 g3").s("triangle")
  .attack(0.01).decay(0.2).sustain(0).release(0.1)

// Pad
note("c3 e3 g3").s("sawtooth")
  .attack(0.5).decay(0.3).sustain(0.7).release(1)

// .clip(value) — hard clip note duration (0-1 of cycle step)
note("c3*8").s("sawtooth").clip(0.5)   // staccato
```

### FM Synthesis

```js
// .fm(amount) — frequency modulation depth
note("c3 e3 g3").s("sine")
  .fm(2)                              // metallic timbre
  .fm(sine.range(1, 6).slow(8))       // evolving FM
```

### Additional Effects

| Effect | Range | Description |
|--------|-------|-------------|
| `.phaser(speed)` | 0.1-10 | Phaser modulation speed |
| `.phaserdepth(d)` | 0-1 | Phaser sweep depth |
| `.distort(amount)` | 0-1 | Soft distortion |
| `.shape(amount)` | 0-1 | Wave shaping distortion |
| `.compressor(threshold)` | -60 to 0 | Dynamic compression (dB) |
| `.bpf(freq)` | 20-20000 | Bandpass filter center freq |
| `.bpq(q)` | 0.1-20 | Bandpass filter Q |
| `.hpq(q)` | 0.1-20 | Highpass filter Q/resonance |
| `.noise(amount)` | 0-1 | Add noise to oscillator |
| `.vib(pattern)` | `"rate:depth"` | Vibrato, e.g. `"4:.2"` |
| `.postgain(v)` | 0-2 | Gain after effects chain |
| `.cut(group)` | integer | Cut group — new note in same group cuts previous |

### `.cut()` — Cut Groups

Useful for open/closed hihats and monophonic bass:

```js
stack(
  s("hh*8").cut(1),       // closed hihat
  s("oh*2").cut(1),       // open hihat — cuts closed, and vice versa
  note("c2 ~ eb2 ~").s("sawtooth").cut(2)  // mono bass
)
```

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

## Tonal & Harmonic Functions

Strudel has powerful built-in tonal features. Use these to create chord progressions, melodies over scales, and proper voice leading — not just raw note sequences.

### Chord Progressions

```js
// Chord symbols → automatic voicing with smooth voice leading
chord("<Am7 Dm7 G7 C^7>").voicing().s("piano")

// Use .dict() for different voicing dictionaries
chord("<Bbm9 Fm9>/4").dict('ireal').voicing().s("gm_epiano1")

// Rhythmic chords with .struct()
chord("<Am7 Dm7 G7 C^7>")
  .struct("[~ x]*2")     // off-beat stabs
  .voicing()
  .s("sawtooth").lpf(800).room(0.5)
```

### Voicing Controls

```js
// .anchor() sets the target pitch center for voice leading
chord("<C Am F G>").anchor("D5").voicing()

// .mode() controls voicing placement relative to anchor
//   "below" — top note at/below anchor
//   "above" — bottom note at/above anchor
//   "root"  — root of chord near anchor
chord("<C^7 A7b13 Dm7 G7>").mode("root:g2").voicing()

// .n() selects individual chord tones (0 = root, 1 = third, etc.)
n("0 1 2 3").chord("<C Am F G>").voicing()

// .set() inherits chord context for melodic lines
n("<0!3 1*2>").set(chords).mode("root:g2").voicing().s("gm_acoustic_bass")
```

### Scales & Melodic Lines

```js
// Scale-based melodies — n() picks scale degree, .scale() sets the scale
n("<3 0 -2 -1>*4")
  .scale("G:minor")
  .s("gm_synth_bass_1")

// .scaleTranspose() shifts through scale degrees
n("0 2 4 6").scale("C:major")
  .scaleTranspose("<0 -1 2 1>*4")

// Combine scales with chords for melodic movement over changes
"[-8 [2,4,6]]*4"
  .scale("C major")
  .scaleTranspose("<0 -1 2 1>*4")
```

### Common Chord Symbols

| Symbol | Meaning | Example |
|--------|---------|---------|
| `C` | Major triad | `chord("C")` |
| `Cm` / `Cm7` | Minor / minor 7th | `chord("Cm7")` |
| `C^7` | Major 7th | `chord("C^7")` |
| `C7` | Dominant 7th | `chord("C7")` |
| `C7b13` | Dominant with alterations | `chord("C7b13")` |
| `Cdim` / `Co` | Diminished | `chord("Co")` |
| `Cm7b5` | Half-diminished | `chord("Cm7b5")` |
| `Csus4` | Suspended 4th | `chord("Csus4")` |

### Complete Harmonic Example

```js
// Jazz-influenced electronic — chords + bass + melody from same progression
let chords = chord("<Am7 Dm7 G7 C^7>").dict('ireal')
stack(
  // Chords — rhythmic stabs
  chords.struct("[~ x]*2").voicing()
    .s("sawtooth").lpf(600).room(0.5).gain(0.3),
  // Bass — root notes
  n("0").set(chords).mode("root:g2").voicing()
    .s("sawtooth").lpf(400).gain(0.5),
  // Melody — scale tones over changes
  n("[0 <4 3 <2 5>>*2](<3 5>,8)")
    .set(chords).anchor("D5").voicing()
    .s("sine").delay(0.3).room(0.4).gain(0.4)
)
```

## Advanced Pattern Manipulation

### `.superimpose(fn)` — Layer a transformed copy on top

Creates a second copy of the pattern with a transformation applied, both play simultaneously. Essential for thickness and harmonic richness.

```js
// Octave doubling
note("c2 eb2 g2").s("sawtooth")
  .superimpose(x => x.add(12))

// Slight detune for chorus effect
note("c3 e3 g3").s("sawtooth")
  .superimpose(x => x.add(0.05))

// Delayed fifth above
note("c3 e3 g3").s("sine")
  .superimpose(x => x.add(7).delay(0.25).gain(0.4))
```

### `.off(time, fn)` — Offset echo with transformation

Creates a time-shifted copy with a transformation. Great for call-and-response and canon-like effects.

```js
// Echo an octave up, offset by 1/8 cycle
note("c3 e3 g3").s("triangle")
  .off(1/8, x => x.add(12).gain(0.5))

// Multiple offsets for arpeggiated texture
note("c3 e3 g3")
  .off(1/8, x => x.add(7))
  .off(1/4, x => x.add(12).gain(0.3))
```

### `.layer(fn1, fn2, ...)` — Multiple transformations simultaneously

Like superimpose but with multiple layers. Each function receives the pattern and all results play together.

```js
note("c3 e3 g3").layer(
  x => x.s("sawtooth"),
  x => x.s("square").add(12),
  x => x.s("sine").sub(12)
)
```

### `.struct(pattern)` — Apply rhythmic structure

Imposes a rhythmic template onto a pattern. `x` = play, `~` = rest.

```js
// Offbeat pattern
note("c3 e3 g3 bb3").struct("~ x ~ x")

// Complex rhythm
chord("<Am7 Dm7>").voicing().struct("x ~ [x x] ~ x x ~ ~")
```

### `.mask(pattern)` — Toggle pattern on/off over time

Like struct but uses `1`/`0` and applies across cycles for longer-form arrangement.

```js
// Only plays in the second half of a 16-cycle phrase
s("hh*8").gain(0.5).mask("<0@8 1@8>")

// Gradual introduction
s("bd*4").mask("<0@4 1@16>")
```

### `.ply(n)` — Repeat each event n times

Each event in the pattern is repeated n times within its time slot.

```js
// Each note stutters twice
note("c3 e3 g3").ply(2)

// Alternating ply creates rhythmic interest
s("bd sd hh sd").ply("<1 1 2 1>")
```

### `.degradeBy(amount)` — Randomly remove events

Removes events with given probability (0-1). Creates organic variation.

```js
s("hh*16").degradeBy(0.3)   // remove 30% of hihats randomly
```

### `.palindrome()` — Play forward then backward

```js
note("c3 d3 e3 f3 g3").palindrome()
```

### Advanced Mini-Notation

| Syntax | Meaning | Example |
|--------|---------|---------|
| `!n` | Repeat previous element n times | `"c3!3 e3"` = `"c3 c3 c3 e3"` |
| `@n` | Give element n units of time | `"c3@3 e3"` = c3 gets 3/4, e3 gets 1/4 |
| `{a b c}%n` | Polyrhythm (n steps) | `"{c3 e3 g3}%8"` |
| `,` | Parallel patterns in mini-notation | `"c3,e3,g3"` = chord |

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

## Visual Feedback

Strudel has built-in visualization functions. **Always use `.pianoroll()` on your patterns** — it gives the audience (and you) visual feedback of what's playing. There are two rendering modes:

- **Global (background):** `.pianoroll()` — renders behind the code editor
- **Inline (embedded):** `._pianoroll()` — renders below the pattern in the code

### `.pianoroll(options?)`

Scrolling piano roll showing note events over time. This is the primary visual feedback tool.

```js
// Basic pianoroll
note("c3 e3 g3 b3").s("sawtooth").pianoroll()

// With labels showing note names
note("c2 a2 eb2").euclid(5,8).s("sawtooth")
  .lpenv(4).lpf(300)
  .pianoroll({ labels: 1 })

// Inline pianoroll (below the pattern)
note("c3 e3 g3")._pianoroll()
```

#### Pianoroll Options

| Option | Type | Description |
|--------|------|-------------|
| `labels` | 0/1 | Show note name labels |
| `vertical` | 0/1 | Vertical orientation |
| `fold` | 0/1 | Fold notes into single octave |
| `smear` | 0/1 | Trail effect on notes |
| `cycles` | number | How many cycles to show |
| `autorange` | 0/1 | Auto-fit to note range |
| `active` | string | Color for active notes |
| `inactive` | string | Color for past notes |
| `background` | string | Background color |
| `playheadColor` | string | Playhead line color |

### `._scope(options?)`

Oscilloscope showing the audio waveform in real time.

```js
s("sawtooth").note("c3 e3 g3")._scope()

// With options
s("bd sd hh sd")._scope({ color: "cyan", thickness: 2, scale: 0.5 })
```

### `._punchcard()`

Alternative to pianoroll — shows pattern events as colored dots.

```js
note("c3 a3 f3 e3").color("cyan")._punchcard()
```

### Using Visual Feedback in a Full Pattern

```js
stack(
  note("c3 e3 g3 b3").s("sawtooth")
    .lpf(sine.range(300, 2000).slow(8))
    .superimpose(x => x.add(0.05))
    .pianoroll({ labels: 1 }),
  s("bd sd [~ bd] sd, hh*8").gain(0.6)
)
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

### Deep House with Chord Progression

```js
// "deep house foundation" — chord-driven with bass and percussion
setcpm(124/4)
let chords = chord("<Fm9 Bbm7 Eb7 Ab^7>").dict('ireal')
stack(
  // Pad — voiced chords with phaser
  chords.struct("[~ x]*2").voicing()
    .s("sawtooth").lpf(900).room(0.5).phaser(2)
    .superimpose(x => x.add(0.04))
    .gain(0.2),
  // Bass — root notes, filter envelope
  n("0").set(chords).mode("root:g2").voicing()
    .s("sawtooth").lpf(300).lpq(6)
    .lpenv(3).lpd(0.2).lps(0)
    .gain(0.5),
  // Melody — chord tones with delay
  n("[0 <4 3 2>*2](<3 5>,8)")
    .set(chords).anchor("D5").voicing()
    .s("sine").delay(0.3).room(0.4)
    .clip(perlin.range(0.3, 0.8))
    .gain(0.35),
  // Drums
  stack(
    s("bd*4"),
    s("~ sd").room(0.2),
    s("hh*8").gain(saw.mul(saw.fast(2))).degradeBy(0.2)
  ).bank('RolandTR909')
).pianoroll({ labels: 1 })
```

### Ambient Techno with Scales

```js
// "ambient pulse" — scale-based melody over evolving texture
setcpm(118/4)
stack(
  // Melodic sequence — scale degrees
  n("<0 2 4 7 9 11 7 4>")
    .scale("D:dorian")
    .s("triangle")
    .off(1/8, x => x.add(12).gain(0.3))
    .lpf(sine.range(500, 3000).slow(16))
    .delay(0.4).delaytime(3/8).delayfeedback(0.5)
    .room(0.6).gain(0.35),
  // Sub bass
  n("<0 3>/2").scale("D:dorian")
    .s("sine").gain(0.5)
    .lpf(200),
  // Percussion
  stack(
    s("bd ~ [bd ~] ~"),
    s("~ cp").room(0.3).delay(0.25),
    s("hh*8").struct("x ~ x x ~ x ~ x").gain(0.3)
  ).sometimes(ply(2))
).pianoroll({ labels: 1, smear: 1 })
```

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

## Complete Examples

### Minimal Techno

```js
stack(
  sound("bd ~ bd ~").gain(0.8),
  sound("~ sd ~ sd").gain(0.5),
  sound("hh*8").gain(0.3).lpf(3000),
  note("<c2 c2 eb2 c2>/4").sound("sawtooth").lpf(600).gain(0.4)
)
```

### Ambient Pad

```js
note("<c3 e3 g3 b3>/4")
  .sound("sine")
  .gain(0.3)
  .lpf(800)
  .delay(0.5)
  .room(0.8)
```

### Breakbeat

```js
stack(
  sound("bd ~ [bd bd] ~").gain(0.8),
  sound("~ sd ~ [sd sd:2]").gain(0.6),
  sound("hh*8?").gain(0.3).pan(sine.range(0.3, 0.7)),
  note("c2*4").sound("bass").lpf(400).gain(0.5)
)
```

### Acid House

```js
stack(
  sound("bd*4").gain(0.8),
  sound("~ cp ~ ~").gain(0.5).room(0.3),
  note("c2 [c2 c2] eb2 [c2 g1]")
    .sound("sawtooth")
    .lpf(sine.range(300, 3000))
    .gain(0.5)
    .crush(4),
  sound("hh*8").gain(0.25).lpf(5000)
)
```

### Dub

```js
stack(
  sound("bd ~ bd ~").gain(0.7),
  sound("~ sd:3 ~ ~").gain(0.4).delay(0.6).delaytime(0.375).delayfeedback(0.5),
  note("<c2 ~ eb2 ~>/2").sound("bass").lpf(300).gain(0.5),
  sound("rim:2*4?").gain(0.2).delay(0.4).pan(sine.range(0.2, 0.8))
)
```

### Glitch Hop

```js
stack(
  sound("bd [~ bd] ~ bd:2").gain(0.8),
  sound("~ sd ~ [sd:3 ~]").every(3, rev).gain(0.5),
  note("c3 [e3 g3] c3 [b2 g2]")
    .sound("pluck")
    .gain(0.4)
    .delay(0.3)
    .jux(rev),
  sound("hh*8").sometimes(x => x.speed(2)).gain(0.25)
)
```

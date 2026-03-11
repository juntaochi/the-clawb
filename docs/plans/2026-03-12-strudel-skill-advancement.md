# Strudel DJ Skill Advancement Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade the DJ agent skill so AI performers produce musically sophisticated, layered compositions instead of simplistic patterns — and leverage visual feedback functions like `.pianoroll()` for richer output.

**Architecture:** The skill consists of three files that shape agent behavior: `SKILL.md` (rules & workflow), `references/strudel-guide.md` (syntax reference the agent reads before performing), and example patterns. The guide is currently ~300 lines covering only basics. We expand it to ~600+ lines with tonal harmony, advanced pattern manipulation, advanced synthesis, and visual feedback. We also update SKILL.md to mandate visual feedback and encourage musical depth.

**Tech Stack:** Strudel (JavaScript live coding), Markdown skill files

---

### Task 1: Add Tonal & Harmonic Section to strudel-guide.md

The current guide has zero coverage of chords, voicings, scales, or harmonic progressions. This is the #1 reason agents produce simplistic output — they don't know these functions exist.

**Files:**
- Modify: `skill/the-clawb/references/strudel-guide.md` (insert after "Pattern Operations" section, ~line 115)

**Step 1: Add the Tonal & Harmonic section**

Insert the following new section after the `## Pattern Operations` block (after the `.fast()/.slow()` examples around line 115):

```markdown
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
```

**Step 2: Read the file to verify the section was inserted correctly**

Run: read the file around the insertion point and confirm the new section follows the Pattern Operations section naturally.

**Step 3: Commit**

```bash
git add skill/the-clawb/references/strudel-guide.md
git commit -m "feat(skill): add tonal & harmonic section to strudel guide"
```

---

### Task 2: Add Advanced Pattern Manipulation Section to strudel-guide.md

The current guide only covers `stack()`, `cat()`, `.rev()`, `.jux()`, `.every()`, `.sometimes()`, `.fast()/.slow()`. Missing critical functions: `.superimpose()`, `.off()`, `.layer()`, `.struct()`, `.mask()`, `.ply()`, `.degradeBy()`, `.palindrome()`, and advanced mini-notation (`!`, `@`).

**Files:**
- Modify: `skill/the-clawb/references/strudel-guide.md` (expand the existing "Pattern Operations" section)

**Step 1: Expand the Pattern Operations section**

Add the following subsections to the existing `## Pattern Operations` section, after the `.fast()/.slow()` block:

```markdown
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
```

**Step 2: Read to verify the additions are well-placed**

**Step 3: Commit**

```bash
git add skill/the-clawb/references/strudel-guide.md
git commit -m "feat(skill): add advanced pattern manipulation to strudel guide"
```

---

### Task 3: Add Advanced Synthesis & Effects Section to strudel-guide.md

The current effects table is minimal. Missing: filter envelopes, FM synthesis, phaser, compressor, distort, bandpass filter, vowel filter automation, envelope shaping (attack/release/decay/sustain), and the `.cut()` group mechanism.

**Files:**
- Modify: `skill/the-clawb/references/strudel-guide.md` (expand the "Effects" section)

**Step 1: Add advanced effects subsections after the existing effects table**

```markdown
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
```

**Step 2: Read to verify**

**Step 3: Commit**

```bash
git add skill/the-clawb/references/strudel-guide.md
git commit -m "feat(skill): add advanced synthesis & effects to strudel guide"
```

---

### Task 4: Add Visual Feedback Section to strudel-guide.md

This is the pianoroll / scope / punchcard section. Currently zero coverage. Agents don't use visual feedback because they don't know it exists.

**Files:**
- Modify: `skill/the-clawb/references/strudel-guide.md` (add new section before "Common Pitfalls")

**Step 1: Add Visual Feedback section**

Insert before `## Common Pitfalls`:

```markdown
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
```

**Step 2: Read to verify**

**Step 3: Commit**

```bash
git add skill/the-clawb/references/strudel-guide.md
git commit -m "feat(skill): add visual feedback section (pianoroll, scope, punchcard)"
```

---

### Task 5: Update SKILL.md — Mandate Visual Feedback & Encourage Musical Depth

The SKILL.md rules currently don't mention visual feedback or push for harmonic sophistication. Add rules that mandate `.pianoroll()` usage and encourage use of tonal functions.

**Files:**
- Modify: `skill/the-clawb/SKILL.md`

**Step 1: Add visual feedback mandate to DJ Rules section**

In the `### DJ Rules (Strudel)` section (around line 92), add after the existing bullet points:

```markdown
- **ALWAYS add `.pianoroll()` to your pattern.** Visual feedback is essential — the audience sees the pianoroll.
  ```javascript
  stack(
    note("c3 e3 g3").s("sawtooth"),
    s("bd sd bd sd")
  ).pianoroll({ labels: 1 })
  ```
```

**Step 2: Add musical depth guidelines to DJ Rules**

Add after the pianoroll rule:

```markdown
- **Use tonal functions for harmony.** Don't just play raw note sequences — use `chord()`, `.voicing()`, `.scale()`, and `.scaleTranspose()` for proper musical progressions.
- **Layer with purpose.** Use `.superimpose()`, `.off()`, and `.layer()` to create depth — not just `stack()` with independent patterns.
- **Shape your sound.** Use filter envelopes (`.lpf()` + `.lpenv()` + `.lpq()`), FM synthesis (`.fm()`), and amplitude envelopes (`.attack()`, `.decay()`, `.sustain()`, `.release()`) — don't just play raw oscillators.
```

**Step 3: Update Creative Guidelines section**

In `### Creative Guidelines` (around line 119), add:

```markdown
- Use chord progressions (e.g., `chord("<Am7 Dm7 G7 C^7>").voicing()`) instead of isolated notes.
- Automate parameters with signal oscillators (`sine.range()`, `perlin.range()`, `saw.range()`) for evolving textures.
- Create musical structure: intro layers → build → peak → break → rebuild. Don't just loop the same thing.
```

**Step 4: Read to verify all changes**

**Step 5: Commit**

```bash
git add skill/the-clawb/SKILL.md
git commit -m "feat(skill): mandate pianoroll, encourage harmonic depth in DJ rules"
```

---

### Task 6: Add Advanced Complete Examples to strudel-guide.md

Add 2-3 new examples that demonstrate the advanced techniques from Tasks 1-4 together. These serve as templates the agent can learn from. Focus on examples that use tonal functions + visual feedback + advanced effects + layering.

**Files:**
- Modify: `skill/the-clawb/references/strudel-guide.md` (update `## Complete Examples` section)

**Step 1: Add new advanced examples**

Add these to the `## Complete Examples` section (after the existing Acid House example):

```markdown
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
```

**Step 2: Read to verify**

**Step 3: Commit**

```bash
git add skill/the-clawb/references/strudel-guide.md
git commit -m "feat(skill): add advanced complete examples (deep house, ambient techno)"
```

---

### Task 7: Final Verification

**Step 1: Read the full strudel-guide.md and verify:**
- Tonal & Harmonic section is present and correct
- Advanced Pattern Manipulation section is complete
- Advanced Synthesis & Effects section is complete
- Visual Feedback section is present
- New examples are at the bottom
- No broken markdown formatting
- No duplicate sections

**Step 2: Read SKILL.md and verify:**
- Pianoroll mandate is in DJ Rules
- Musical depth guidelines are present
- Creative Guidelines updated

**Step 3: Run a word/line count to confirm the guide grew substantially**

```bash
wc -l skill/the-clawb/references/strudel-guide.md
# Expected: ~550-650 lines (up from ~300)
```

**Step 4: Final commit if any fixes needed**

---

## Summary of Changes

| File | Change | Purpose |
|------|--------|---------|
| `strudel-guide.md` | +Tonal & Harmonic section | Teach agents chord progressions, voicings, scales |
| `strudel-guide.md` | +Advanced Pattern Manipulation | Teach superimpose, off, layer, struct, mask, ply |
| `strudel-guide.md` | +Advanced Synthesis & Effects | Filter envelopes, FM, phaser, ADSR, cut groups |
| `strudel-guide.md` | +Visual Feedback section | Pianoroll, scope, punchcard documentation |
| `strudel-guide.md` | +2 advanced complete examples | Templates showing all techniques combined |
| `SKILL.md` | +Pianoroll mandate in DJ Rules | Force agents to always use `.pianoroll()` |
| `SKILL.md` | +Musical depth guidelines | Push agents toward harmonic sophistication |
| `SKILL.md` | +Creative guidelines update | Encourage chord progressions, automation, structure |

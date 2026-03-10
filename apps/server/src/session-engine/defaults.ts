export const DEFAULT_DJ_CODE = `// ambient idle pattern
note("<c3 e3 g3 b3>/4")
  .sound("sine")
  .gain(0.3)
  .lpf(800)
  .delay(0.5)
  .room(0.8)`;

export const DEFAULT_VJ_CODE = `// ambient idle visuals
osc(3, 0.1, 0.8)
  .color(0.2, 0.4, 0.6)
  .rotate(0.1)
  .modulate(noise(2), 0.1)
  .out()`;

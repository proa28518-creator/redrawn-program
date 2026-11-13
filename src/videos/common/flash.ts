// Single flash source (item 8): every video's hook flash comes from here — one decay,
// one hard cap, one defined exit. The story's FLASH_AT is the only frame source;
// the component never defines its own.
export const FLASH_LEN = 4;
export const FLASH_CAP = 0.85;
export const flashAt = (f: number, flashAtFrame: number): number => {
  if (flashAtFrame < 0) return 0;
  if (f < flashAtFrame || f >= flashAtFrame + FLASH_LEN) return 0;
  return Math.min(FLASH_CAP, [1, 0.75, 0.45, 0.2][f - flashAtFrame]);
};

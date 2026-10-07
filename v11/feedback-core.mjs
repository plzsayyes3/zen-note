const IGNORED_KEYS = new Set([
  'Shift','Control','Alt','Meta','CapsLock','Tab','Escape',
  'ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End',
  'PageUp','PageDown','Insert','F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12'
]);

export function isTypingKey(event) {
  if (!event || event.ctrlKey || event.metaKey || event.altKey) return false;
  if (IGNORED_KEYS.has(event.key)) return false;
  return event.key === 'Process' || event.key === 'Backspace' || event.key === 'Delete' || event.key === 'Enter' || event.key?.length === 1;
}

export function flowLevel(combo, lastKeyAt, now = Date.now()) {
  if (!combo || !lastKeyAt) return 0;
  const age = Math.max(0, now - lastKeyAt);
  const comboStrength = Math.min(1, combo / 30);
  if (age <= 2500) return comboStrength;
  if (age >= 8000) return 0;
  return Math.max(0, comboStrength * (1 - ((age - 2500) / 5500)));
}

export function activeTypingMsAfterKey(previousKeyAt, now, activeTypingMs, gapLimitMs = 2500) {
  if (!previousKeyAt) return activeTypingMs;
  const gap = Math.max(0, now - previousKeyAt);
  return gap <= gapLimitMs ? activeTypingMs + gap : activeTypingMs;
}

export function starsPerKey(activeTypingMs) {
  if (activeTypingMs < 180000) return 1;
  const acceleratedMinute = Math.floor((activeTypingMs - 180000) / 60000);
  return Math.min(64, 2 ** (acceleratedMinute + 1));
}

export function starFillLevel(starCount, maxStars) {
  if (!maxStars) return 0;
  const progress = Math.max(0, Math.min(1, starCount / maxStars));
  return Math.min(1, progress ** 1.58);
}

export function mix(a, b, t) {
  return a + (b - a) * t;
}

export function frameColorAt(progress) {
  const p = Math.max(0, Math.min(1, progress));
  const stops = [
    [0.00, [22, 52, 95]],
    [0.10, [27, 59, 130]],
    [0.22, [63, 140, 235]],
    [0.36, [107, 90, 226]],
    [0.50, [91, 210, 182]],
    [0.62, [230, 198, 92]],
    [0.74, [243, 142, 84]],
    [0.84, [230, 87, 95]],
    [0.93, [241, 145, 210]],
    [1.00, [248, 250, 255]]
  ];
  for (let i = 1; i < stops.length; i++) {
    if (p <= stops[i][0]) {
      const [p0, c0] = stops[i - 1];
      const [p1, c1] = stops[i];
      const t = (p - p0) / (p1 - p0 || 1);
      return c0.map((v, idx) => Math.round(mix(v, c1[idx], t)));
    }
  }
  return stops.at(-1)[1];
}

export function frameOpacityAt(progress) {
  const p = Math.max(0, Math.min(1, progress));
  return 0.30 + p * 0.38;
}

export function sentenceCompleted(insertedText) {
  return /[。？！\n]/u.test(String(insertedText || ''));
}

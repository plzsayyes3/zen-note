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
  const decay = 1 - ((age - 2500) / 5500);
  return Math.max(0, comboStrength * decay);
}

export function sentenceCompleted(insertedText) {
  return /[。？！\n]/u.test(String(insertedText || ''));
}

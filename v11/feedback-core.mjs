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

function paint(level) {
  if (typeof document === 'undefined') return;
  const edge = document.querySelector('.edge');
  const bubble = document.querySelector('.bubble-layer');
  const sunset = document.querySelector('.sunset-layer');
  const stars = document.querySelector('.star-layer');
  const galaxy = document.querySelector('.galaxy-layer');
  if (edge) edge.style.opacity = String(.04 + level * .78);
  if (bubble) {
    bubble.style.opacity = String(.04 + level * .72);
    bubble.style.transform = `scale(${1.02 + level * .07})`;
  }
  if (sunset) sunset.style.opacity = String(Math.max(0, level - .42) * 1.55);
  if (stars) stars.style.opacity = String(.06 + level * .74);
  if (galaxy) galaxy.style.opacity = String(Math.max(0, level - .28) * 1.25);
}

export function flowLevel(combo, lastKeyAt, now = Date.now()) {
  if (!combo || !lastKeyAt) { paint(0); return 0; }
  const age = Math.max(0, now - lastKeyAt);
  const comboStrength = Math.min(1, combo / 30);
  let level;
  if (age <= 2500) level = comboStrength;
  else if (age >= 8000) level = 0;
  else level = Math.max(0, comboStrength * (1 - ((age - 2500) / 5500)));
  paint(level);
  return level;
}

export function sentenceCompleted(insertedText) {
  return /[。？！\n]/u.test(String(insertedText || ''));
}

// Rolling digits: characters that changed roll in, up when the number rose and down when it fell. Screen readers read one plain value.
const value = s => parseFloat(s.replace(/[^\d.-]/g, ''));

export function roll(el, text) {
  const prev = el.dataset.v ?? el.textContent.trim();
  if (prev === text) return;
  el.classList.add('roll');
  el.toggleAttribute('data-down', value(text) < value(prev));
  const old = [...prev].reverse();
  const cells = [...text].reverse().map((ch, i) => {
    const cell = document.createElement('span');
    cell.className = 'roll-c';
    cell.setAttribute('aria-hidden', 'true');
    const now = document.createElement('span');
    now.textContent = ch;
    if (old[i] !== ch) {
      now.className = 'roll-new';
      if (old[i]) { const gone = document.createElement('span'); gone.className = 'roll-old'; gone.textContent = old[i]; cell.append(gone); }
    }
    cell.append(now);
    return cell;
  }).reverse();
  const sr = document.createElement('span');
  sr.className = 'sr';
  sr.textContent = text;
  el.replaceChildren(...cells, sr);
  el.dataset.v = text;
}

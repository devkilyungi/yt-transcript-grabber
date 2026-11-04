// The kit's icon sprite: every icon on the page is a <use> of one of these. Drawn by CSS (house.css `svg.icon`), so they follow the theme.
export function Sprite() {
  return (
    <svg className="sprite" aria-hidden="true">
      <symbol id="i-check" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" pathLength="1"/></symbol>
      <symbol id="i-x" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" pathLength="1"/></symbol>
      <symbol id="i-warn" viewBox="0 0 24 24"><path d="M12 3.5l9.5 16.5h-19z M12 10v4.5 M12 17.6v.1"/></symbol>
      <symbol id="i-info" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v5.5 M12 7.6v.1"/></symbol>
      <symbol id="i-chev" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></symbol>
      <symbol id="i-copy" viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></symbol>
      <symbol id="i-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></symbol>
      <symbol id="i-moon" viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></symbol>
      <symbol id="i-replay" viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.6 M4 4v4.6h4.6"/></symbol>
      <symbol id="i-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></symbol>
      <symbol id="i-trash" viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></symbol>
      <symbol id="i-up" viewBox="0 0 24 24"><path d="M12 19V5M6 11l6-6 6 6"/></symbol>
      <symbol id="i-down" viewBox="0 0 24 24"><path d="M12 5v14M6 13l6 6 6-6"/></symbol>
      <symbol id="i-inbox" viewBox="0 0 24 24"><path d="M3 13l3-8h12l3 8v6H3z M3 13h5l1.5 2.5h5L16 13h5"/></symbol>
      <symbol id="i-shield" viewBox="0 0 24 24"><path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z M8.5 12l2.5 2.5 4.5-5"/></symbol>
      <symbol id="i-eye-off" viewBox="0 0 24 24"><path d="M3 3l18 18 M10.6 5.1A9.8 9.8 0 0 1 12 5c6 0 9.5 7 9.5 7a17 17 0 0 1-2.7 3.6 M6.6 6.6A16.5 16.5 0 0 0 2.5 12S6 19 12 19a9.4 9.4 0 0 0 5.4-1.6 M9.9 9.9a3 3 0 0 0 4.2 4.2"/></symbol>
      <symbol id="i-pause" viewBox="0 0 24 24"><path d="M9 5v14M15 5v14"/></symbol>
      <symbol id="i-refresh" viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.4-5.7L20 8.6 M20 4v4.6h-4.6"/></symbol>
      <symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.4-4.4"/></symbol>
      <symbol id="i-play" viewBox="0 0 24 24"><path d="M8 5.5v13l10.5-6.5z"/></symbol>
      <symbol id="i-pen" viewBox="0 0 24 24"><path d="M4 20h7 M14.5 4.5l5 5L10 19H5v-5z"/></symbol>
      <symbol id="i-note" viewBox="0 0 24 24"><path d="M5 4h14v11l-5 5H5z M14 20v-5h5 M8.5 9h7 M8.5 12.5h4"/></symbol>
    </svg>
  );
}

export const Icon = ({ name }: { name: string }) => <svg className="icon" aria-hidden="true"><use href={`#i-${name}`} /></svg>;

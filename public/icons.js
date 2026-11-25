const icons = {
  logo: '<path d="M3 5.5 12 2l9 3.5v13L12 22l-9-3.5z"/><path d="m3 5.5 9 3.7 9-3.7M12 9.2V22M7.5 3.8l9 3.6"/>',
  home: '<rect x="3" y="3" width="7" height="7" rx="1.3"/><rect x="14" y="3" width="7" height="7" rx="1.3"/><rect x="3" y="14" width="7" height="7" rx="1.3"/><rect x="14" y="14" width="7" height="7" rx="1.3"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18m-13 5h3m3 0h2"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  spark: '<path d="M9 3c.9 4.7 2.3 6.1 7 7-4.7.9-6.1 2.3-7 7-.9-4.7-2.3-6.1-7-7 4.7-.9 6.1-2.3 7-7Zm9 9c.5 2.9 1.1 3.5 4 4-2.9.5-3.5 1.1-4 4-.5-2.9-1.1-3.5-4-4 2.9-.5 3.5-1.1 4-4ZM18 3v4m-2-2h4"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  left: '<path d="m15 18-6-6 6-6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  complete: '<circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/>',
  book: '<path d="M12 7a7 7 0 0 0-5-2H3v13h4a7 7 0 0 1 5 2 7 7 0 0 1 5-2h4V5h-4a7 7 0 0 0-5 2Zm0 0v13"/>',
  note: '<path d="M13 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-9l-7-7Z"/><path d="M13 3v7h7M8 13h8m-8 4h5"/>',
  upload: '<path d="M12 15V3M7 8l5-5 5 5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/>',
  chart: '<path d="M3 3v18h18M8 16v-4m5 4V7m5 9v-7"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/>',
  edit: '<path d="m15 5 4 4M5 15 16 4a2.8 2.8 0 0 1 4 4L9 19l-5 1z"/>',
  github: '<path d="M8 21c-4 1.2-4-2.2-6-2.5m12 4v-3.1a2.7 2.7 0 0 0-.75-2.1c2.5-.28 5.15-1.23 5.15-5.55a4.3 4.3 0 0 0-1.15-2.95c.12-.28.5-1.39-.11-2.9 0 0-.93-.3-3.05 1.13a10.7 10.7 0 0 0-5.55 0C6.42 5.59 5.48 5.9 5.48 5.9c-.61 1.51-.23 2.62-.11 2.9a4.25 4.25 0 0 0-1.15 2.95c0 4.3 2.63 5.27 5.13 5.55a2.67 2.67 0 0 0-.75 2.1v3.1" transform="translate(1 -2)"/>',
  drive: '<path d="m8 3 8 0 7 12-4 7H5l-4-7zM8 3l7 12m1-12L9 15m-8 0h22M9 15l-4 7m10-7 4 7"/>',
  key: '<circle cx="8.5" cy="8.5" r="5.5"/><path d="m12.5 12.5 8 8m-4.5-4.5 2.5-2.5m0 5 2.5-2.5"/>',
  terminal: '<rect x="2.5" y="4" width="19" height="16" rx="3"/><path d="m6 9 3 3-3 3m6 0h5"/>',
  link: '<path d="M10 13a4 4 0 0 0 6 .5l4-4a4 4 0 0 0-5.65-5.65l-2.3 2.3m2 4.85a4 4 0 0 0-6-.5l-4 4a4 4 0 0 0 5.65 5.65l2.3-2.3"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3m3 0-1 14H7L6 7m4 4v6m4-6v6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/>',
  bulb: '<path d="M9 19h6m-5 3h4M8 15a6 6 0 1 1 8 0c-.6.55-1 1-1 2H9c0-1-.4-1.45-1-2Z"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>'
};

export function icon(name, size = 20) {
  return `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${icons[name] ?? ''}</svg>`;
}

import type { CardLine } from '../visuals/title-card.js';

const HEAD = '#ffd38a';
const BODY = '#fff3dd';

/** The end credits of the Rooftop Party (rolled by FilmSystem). Keep in step with CREDITS.md. */
export const END_CREDITS: readonly CardLine[] = [
  { text: 'Dreamlive', size: 92, style: 'italic bold', color: HEAD },
  { text: "Bigfoot's Rooftop Party", size: 44, style: 'italic', color: BODY, gap: 6 },
  { text: 'Starring', size: 34, style: 'italic', color: HEAD, gap: 90 },
  { text: 'Bigfoot', size: 44, color: BODY, gap: 10 },
  { text: 'his cousin Yeti, on the decks', size: 36, color: BODY },
  { text: 'and you', size: 40, style: 'italic', color: BODY },
  { text: 'Music', size: 34, style: 'italic', color: HEAD, gap: 80 },
  { text: '"Discode" by Neil Fernandes', size: 34, color: BODY, gap: 10 },
  { text: '"Afrobeat" by Alex Morgan', size: 34, color: BODY },
  { text: '"Let\'s Bounce" by 1000 Handz', size: 34, color: BODY },
  { text: '"Bloom" by Purrple Cat', size: 34, color: BODY },
  { text: 'CC BY 4.0, via Free Music Archive', size: 26, style: 'italic', color: BODY },
  { text: 'Built with', size: 34, style: 'italic', color: HEAD, gap: 80 },
  { text: 'Immersive Web SDK  ·  three.js  ·  WebXR', size: 32, color: BODY, gap: 10 },
  { text: 'Made by', size: 34, style: 'italic', color: HEAD, gap: 80 },
  { text: 'William Nnamani', size: 40, color: BODY, gap: 10 },
  { text: 'Thank you for dreaming with us.', size: 40, style: 'italic', color: HEAD, gap: 110 },
];

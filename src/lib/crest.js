// The crest is the club logo, cut into its three panels so it can be taken
// apart and rebuilt in animations. Positions are percentages of the full
// crest box (from the original artwork). `apart` is where each panel sits
// when the crest is "exploded", in % of the panel's own size.

const base = import.meta.env.BASE_URL;

export const CREST_URL = `${base}logo/logo.png`;
export const CREST_ASPECT = 0.829; // width / height

export const PIECES = [
  {
    id: 'red',
    src: `${base}logo/piece-red.png`,
    box: { left: -0.897, top: -0.743, width: 49.327, height: 49.442 },
    color: '#e83643',
    apart: { x: -48, y: -36, r: -14 },
  },
  {
    id: 'blue',
    src: `${base}logo/piece-blue.png`,
    box: { left: 51.57, top: -0.743, width: 48.879, height: 49.442 },
    color: '#124093',
    apart: { x: 48, y: -42, r: 12 },
  },
  {
    id: 'green',
    src: `${base}logo/piece-green.png`,
    box: { left: -0.897, top: 50.558, width: 101.345, height: 49.814 },
    color: '#76b729',
    apart: { x: 0, y: 52, r: 7 },
  },
];

export function pieceStyle(piece, index = 0) {
  const { box, apart } = piece;
  return {
    left: `${box.left}%`,
    top: `${box.top}%`,
    width: `${box.width}%`,
    height: `${box.height}%`,
    '--ax': `${apart.x}%`,
    '--ay': `${apart.y}%`,
    '--ar': `${apart.r}deg`,
    '--i': index,
  };
}

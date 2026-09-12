import type { Clearing } from './clearing';
/** Mask the growth/light only; artwork is a separate untouched layer. */
export function ClearingMask({ id, clearings }: { id: string; clearings: Clearing[] }) {
  return <defs><mask id={id} maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="1000"
    style={{ maskType: 'luminance' }}>
    <rect width="1000" height="1000" fill="white" />
    {clearings.map(e => <ellipse key={e.id} data-clearing={e.id} cx={e.x} cy={e.y} rx={e.rx} ry={e.ry} fill="black" />)}
  </mask></defs>;
}

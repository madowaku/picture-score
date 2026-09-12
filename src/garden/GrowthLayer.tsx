import { memo } from "react";
import type { GardenState, MusicalRole } from "./gardenState";
import { growthStage } from "./growth";
import type { GrowthState } from "./growth";

function seed(id: string) {
  let n = 2166136261;
  for (const c of id) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
  return (n >>> 0) / 4294967296;
}
function Marks({ role, stage, variation }: { role: MusicalRole; stage: number; variation: number }) {
  const count = stage === 1 ? 2 : stage === 2 ? 5 : 8;
  return <>{Array.from({ length: count }, (_, i) => {
    const angle = (i / 8 * 360 + variation * 80), length = 28 + (i % 3) * 9;
    if (role === "melody") return <path key={i} transform={`rotate(${angle})`}
      d={`M0 15 Q-9 ${length} 0 ${length + 18} Q12 ${length + 4} 4 ${length} Q-3 ${length + 6} 0 ${length + 18}`} />;
    if (role === "harmony") return <ellipse key={i} transform={`rotate(${angle})`} cx="0" cy={20 + i % 3 * 4} rx="13" ry="20" />;
    if (role === "drone") return <path key={i} transform={`rotate(${angle})`}
      d={`M-12 20 Q-36 ${length} -15 ${length + 26} Q2 ${length + 10} 12 ${length + 18}`} />;
    if (role === "rhythm") return <circle key={i} transform={`rotate(${angle})`} cx={i % 2 ? 8 : -8} cy={25 + i % 3 * 11} r={2 + i % 2} />;
    return <path key={i} transform={`rotate(${angle}) translate(0 ${30 + i % 3 * 12})`}
      d="M0 -5 Q1 -1 5 0 Q1 1 0 5 Q-1 1 -5 0 Q-1 -1 0 -5Z" />;
  })}</>;
}
/** One quiet, noninteractive SVG, deterministic across reloads and viewport changes. */
export const GrowthLayer = memo(function GrowthLayer({ garden, growth, moments }: {
  garden: GardenState; growth: GrowthState; moments: Set<string>;
}) {
  const paths = Object.entries(growth.relations).filter(([, r]) => growthStage(r.sharedBeats, true) > 0)
    .sort((a, b) => b[1].sharedBeats - a[1].sharedBeats || a[0].localeCompare(b[0])).slice(0, 24);
  return <svg className="growth-layer" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true" data-testid="growth-layer">
    {paths.map(([key, relation]) => {
      const a = garden.objects.find((o) => o.id === relation.a)?.world, b = garden.objects.find((o) => o.id === relation.b)?.world;
      if (!a || !b) return null;
      const stage = growthStage(relation.sharedBeats, true);
      const x = (a.x + b.x) * 500, y = (a.y + b.y) * 500 + (seed(key) - .5) * 100;
      return <g key={key} data-growth-pair={key} data-shared-beats={relation.sharedBeats.toFixed(3)}
        className={moments.has(key) ? "growth-moment" : ""} style={{ opacity: .2 + stage * .12 }}>
        <path className="growth-path" d={`M${a.x * 1000} ${a.y * 1000} Q${x} ${y} ${b.x * 1000} ${b.y * 1000}`} />
        {stage === 3 && <><ellipse cx={x} cy={y} rx="5" ry="3" /><circle cx={x - 8} cy={y + 4} r="2" /></>}
      </g>;
    })}
    {garden.objects.map((object) => {
      const beats = growth.objects[object.id] ?? 0, stage = growthStage(beats);
      if (!stage) return null;
      return <g key={object.id} transform={`translate(${object.world.x * 1000} ${object.world.y * 1000})`}
        data-growth-object={object.id} data-audible-beats={beats.toFixed(3)} data-growth-stage={stage} data-growth-role={object.musicalRole}>
        <g className={`growth-habitat growth-${object.musicalRole} ${moments.has(object.id) ? "growth-moment" : ""}`}>
          <Marks role={object.musicalRole} stage={stage} variation={seed(object.id)} />
        </g>
      </g>;
    })}
  </svg>;
});

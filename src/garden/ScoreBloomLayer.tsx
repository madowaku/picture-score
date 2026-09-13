import { memo, useId, useMemo } from "react";
import type { CSSProperties } from "react";
import type { PaletteDefinition } from "../palettes";
import type { WorldEntity, WorldSnapshot } from "../world/runtime";
import type { Clearing, GardenLayout } from "./clearing";
import { ClearingMask } from "./ClearingMask";
import { resolvePalettePlacements } from "./scoreBloomPlacement";
import "./scoreBloom.css";

type MotionStyle = CSSProperties & {
  "--score-bloom-amplitude"?: string;
  "--score-bloom-amplitude-negative"?: string;
  "--score-bloom-duration"?: string;
  "--score-bloom-pulse-scale"?: string;
};

const motionStyle = (entity: WorldEntity): MotionStyle => {
  const amplitude = Math.max(0, entity.motion.amplitude) * 8;
  const reaction = Math.max(0, entity.reaction.amount);
  return {
    "--score-bloom-amplitude": `${amplitude}px`,
    "--score-bloom-amplitude-negative": `${-amplitude}px`,
    "--score-bloom-duration": `${entity.motion.speed > 0 ? Math.max(0.8, 2.4 / entity.motion.speed) : 8}s`,
    "--score-bloom-pulse-scale": `${1 + reaction * 0.04}`,
  };
};

const assetAnchor = (entity: WorldEntity, palette: PaletteDefinition) =>
  palette.roles[entity.role].assets.find(asset => asset.id === entity.assetId)?.anchor ?? { x: 0.5, y: 0.5 };

export interface ScoreBloomLayerProps {
  snapshot: WorldSnapshot;
  palette: PaletteDefinition;
  clearings: readonly Clearing[];
  layout: GardenLayout;
  debugEntityId?: string;
}

/**
 * Noninteractive semantic pigment. Placement is deterministic and source artwork
 * remains protected by the same ClearingMask principle as legacy Growth.
 */
export const ScoreBloomLayer = memo(function ScoreBloomLayer({
  snapshot,
  palette,
  clearings,
  layout,
  debugEntityId,
}: ScoreBloomLayerProps) {
  const mask = useId();
  const placements = useMemo(
    () => resolvePalettePlacements(snapshot.entities, palette, clearings, layout),
    [snapshot.entities, palette, clearings, layout],
  );

  return <svg
    className="score-bloom-layer"
    viewBox="0 0 1000 1000"
    preserveAspectRatio="none"
    aria-hidden="true"
    data-testid="score-bloom-layer"
    data-score-bloom-palette={snapshot.paletteId}
    data-score-bloom-entities={placements.size}
    data-score-bloom-energy={snapshot.environment.energy.toFixed(3)}
    data-score-bloom-brightness={snapshot.environment.brightness.toFixed(3)}
  >
    <ClearingMask id={mask} clearings={[...clearings]} />
    <g mask={`url(#${mask})`}>
      {snapshot.entities.map(entity => {
        const placement = placements.get(entity.id);
        if (!placement) return null;
        const anchor = assetAnchor(entity, palette);
        const opacity = Math.min(0.94, 0.48 + entity.intensity * 0.42);
        const selected = debugEntityId === entity.id;
        return <g
          key={entity.id}
          transform={`translate(${placement.x} ${placement.y}) rotate(${entity.rotation})`}
          data-score-bloom-entity={entity.id}
          data-score-bloom-role={entity.role}
          data-score-bloom-motion={entity.motion.idleMotion}
          data-score-bloom-birth={entity.motion.birthMotion}
          data-score-bloom-reaction-revision={entity.reaction.revision}
          data-score-bloom-world-event={entity.origin.worldEventId}
          data-score-bloom-source-event={entity.origin.musicalEventId}
          data-score-bloom-asset={entity.assetId}
          data-score-bloom-debug={selected ? "selected" : undefined}
        >
          <g className={`score-bloom-birth score-bloom-birth-${entity.motion.birthMotion}`}>
            <g
              className={`score-bloom-idle score-bloom-idle-${entity.motion.idleMotion}`}
              style={motionStyle(entity)}
            >
              <image
                href={entity.assetSrc}
                x={-anchor.x * placement.width}
                y={-anchor.y * placement.height}
                width={placement.width}
                height={placement.height}
                preserveAspectRatio="xMidYMid meet"
                opacity={opacity}
              />
            </g>
          </g>
          {selected ? <circle
            className="score-bloom-debug-ring"
            cx={(0.5 - anchor.x) * placement.width}
            cy={(0.5 - anchor.y) * placement.height}
            r={Math.max(placement.width, placement.height) * 0.62}
          /> : null}
        </g>;
      })}
    </g>
  </svg>;
});

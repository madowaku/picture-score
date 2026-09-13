import type { MusicalEvent } from "../music/ir";
import type { EntityOrigin, WorldEntity, WorldSnapshot } from "../world/runtime";

const short = (value: string): string => value.length > 42 ? `${value.slice(0, 39)}…` : value;

export function ScoreBloomDebugInspector({
  snapshot,
  selectedEntityId,
  onSelectEntity,
  inspect,
  musicalEvents,
  paused,
  phraseDuration,
  onTogglePause,
  onSeek,
  onRestart,
}: {
  snapshot: WorldSnapshot;
  selectedEntityId: string | null;
  onSelectEntity: (entityId: string | null) => void;
  inspect: (entityId: string) => EntityOrigin | undefined;
  musicalEvents: readonly MusicalEvent[];
  paused: boolean;
  phraseDuration: number;
  onTogglePause: () => void;
  onSeek: (time: number) => void;
  onRestart: () => void;
}) {
  const selected = snapshot.entities.find(entity => entity.id === selectedEntityId) ?? snapshot.entities[0];
  const origin = selected ? inspect(selected.id) ?? selected.origin : undefined;
  const musicalEvent = origin
    ? musicalEvents.find(event => event.id === origin.musicalEventId)
    : undefined;
  const phase = phraseDuration > 0 ? Math.min(phraseDuration, snapshot.time % phraseDuration) : 0;

  return <aside className="score-bloom-debug" data-testid="score-bloom-debug" onPointerDown={event => event.stopPropagation()}>
    <header><strong>SCORE BLOOM IR</strong><span>{snapshot.time.toFixed(2)}s · {snapshot.cursor} events · {snapshot.entities.length} entities</span></header>
    <div className="score-bloom-debug-transport">
      <button type="button" onClick={onTogglePause}>{paused ? "Resume" : "Pause"}</button>
      <button type="button" onClick={onRestart}>Restart</button>
      <label>Seek <input aria-label="SCORE BLOOM seek" type="range" min={0} max={Math.max(.01, phraseDuration)} step={.05}
        value={phase} onChange={event => onSeek(Number(event.target.value))} /></label>
      <output>{phase.toFixed(2)} / {phraseDuration.toFixed(2)}s</output>
    </div>
    <label className="score-bloom-debug-picker">Entity
      <select value={selected?.id ?? ""} onChange={event => onSelectEntity(event.target.value || null)}>
        {!snapshot.entities.length && <option value="">none</option>}
        {snapshot.entities.map(entity => <option key={entity.id} value={entity.id}>{entity.role} · {short(entity.id)}</option>)}
      </select>
    </label>
    {selected && origin ? <div className="score-bloom-debug-trace">
      <TraceRow label="MusicalEvent" value={origin.musicalEventId}
        detail={musicalEvent ? `${musicalEvent.type} @ ${musicalEvent.time.toFixed(2)}s` : undefined} />
      <TraceRow label="WorldEvent" value={origin.worldEventId} />
      <TraceRow label="PaletteCue" value={origin.paletteCueId} />
      <TraceRow label="Entity" value={selected.id} detail={`${selected.role} · ${selected.assetId}`} />
    </div> : <p className="score-bloom-debug-empty">No rendered entity yet.</p>}
  </aside>;
}

function TraceRow({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <div className="score-bloom-debug-row"><span>{label}</span><code title={value}>{short(value)}</code>{detail && <small>{detail}</small>}</div>;
}

export function selectedDebugEntity(
  entities: readonly WorldEntity[],
  selectedEntityId: string | null,
): WorldEntity | undefined {
  return entities.find(entity => entity.id === selectedEntityId) ?? entities[0];
}

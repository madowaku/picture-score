import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { ScoreBloomLayer } from "../garden/ScoreBloomLayer";
import type { Clearing, GardenLayout } from "../garden/clearing";
import { clearingPalette, prismProofPalette } from "../palettes";
import type { PaletteDefinition, PaletteRole } from "../palettes";
import { coreMeaningFixtures } from "../qa/coreMeaningFixtures";
import { ScoreBloomSession } from "../world/runtime";
import type { WorldSnapshot } from "../world/runtime";
import {
  creatorPaletteRepository,
  CreatorPaletteStorageError,
  materializeCreatorPalette,
  type CreatorPaletteAssetBlobs,
  type CreatorPaletteSummary,
} from "./persistence";
import {
  compileCreatorPalette,
  createEmptyCreatorPaletteDraft,
  CREATOR_PALETTE_ROLES,
  creatorMotionPresets,
  creatorPlacementPresets,
  type CreatorAssetDraft,
  type CreatorAssetFormat,
  type CreatorMotionPresetId,
  type CreatorPaletteDraft,
  type CreatorPlacementPresetId,
} from "./palette";
import "./creatorPaletteLab.css";

const ROLE_LABELS: Record<PaletteRole, string> = {
  melody: "Melody",
  harmony: "Harmony",
  rhythm: "Rhythm",
  ornament: "Ornament",
  resonance: "Resonance",
};

const ROLE_HINTS: Record<PaletteRole, string> = {
  melody: "the line we follow",
  harmony: "changes in color and chord",
  rhythm: "beat and pulse",
  ornament: "small bright details",
  resonance: "tails, air and lingering sound",
};

const PLACEMENT_LABELS: Record<CreatorPlacementPresetId, string> = {
  ground: "Ground",
  low: "Low",
  middle: "Middle",
  upper: "Upper",
  sky: "Sky",
  free: "Free",
};

const MOTION_LABELS: Record<CreatorMotionPresetId, string> = {
  still: "Still",
  "gentle-sway": "Gentle sway",
  float: "Float",
  pulse: "Pulse",
  twinkle: "Twinkle",
};

const clearings: Clearing[] = [
  { id: "creator-lab-source", x: 500, y: 510, rx: 150, ry: 132 },
];

const initialLayout: GardenLayout = {
  width: 520,
  height: 420,
  artworkWidth: 120,
  artworkHeight: 96,
};

const createCreatorDraftId = (): string => {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid ? `local-${uuid}` : `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
};

const extensionFormat = (fileName: string): CreatorAssetFormat | null => {
  const value = fileName.trim().toLowerCase();
  if (value.endsWith(".png")) return "png";
  if (value.endsWith(".webp")) return "webp";
  if (value.endsWith(".svg")) return "svg";
  return null;
};

const decodeImageDimensions = (src: string): Promise<{ width: number; height: number }> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error("Could not decode image"));
    image.src = src;
  });

const sampleAsset = (role: PaletteRole, byteSize: number): CreatorAssetDraft => {
  const source = prismProofPalette.roles[role].assets[0];
  return {
    role,
    fileName: source.src.split("/").at(-1) ?? `${role}.svg`,
    mimeType: "image/svg+xml",
    format: "svg",
    byteSize,
    objectUrl: source.src,
    anchor: source.anchor ? { ...source.anchor } : { x: 0.5, y: 0.5 },
    baseScale: source.baseScale ?? 1,
  };
};

const storageMessage = (error: unknown): string => {
  if (error instanceof CreatorPaletteStorageError) return error.message;
  return error instanceof Error && error.message ? error.message : "Creator Palette storage failed";
};

function LabStage({
  palette,
  snapshot,
}: {
  palette: PaletteDefinition | null;
  snapshot: WorldSnapshot | null;
}) {
  const stageRef = useRef<HTMLElement | null>(null);
  const [layout, setLayout] = useState(initialLayout);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const publish = () => {
      const rect = stage.getBoundingClientRect();
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);
      setLayout(previous =>
        Math.abs(previous.width - width) < 0.5 && Math.abs(previous.height - height) < 0.5
          ? previous
          : { ...previous, width, height },
      );
    };
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  return <section ref={stageRef} className="creator-lab-stage" data-creator-lab-stage>
    {palette && snapshot ? (
      <ScoreBloomLayer
        snapshot={snapshot}
        palette={palette}
        clearings={clearings}
        layout={layout}
      />
    ) : <div className="creator-lab-empty-stage">Add five images to hear your world.</div>}
    <svg className="creator-lab-source" viewBox="0 0 1000 1000" aria-hidden="true">
      <g
        transform="translate(500 510)"
        fill="none"
        stroke="currentColor"
        strokeWidth="13"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M -84 28 C -42 -72, 25 -92, 82 -24 C 50 -8, 22 15, 6 66" />
        <path d="M -68 48 C -24 16, 22 12, 70 42" opacity="0.68" />
        <circle cx="-18" cy="-18" r="5" fill="currentColor" stroke="none" />
      </g>
    </svg>
  </section>;
}

export function CreatorPaletteLab() {
  const repository = useMemo(() => creatorPaletteRepository(), []);
  const [draft, setDraft] = useState<CreatorPaletteDraft>(() =>
    createEmptyCreatorPaletteDraft(createCreatorDraftId(), "My Palette"),
  );
  const [fixtureIndex, setFixtureIndex] = useState(2);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [previewMode, setPreviewMode] = useState<"clearing" | "creator">("creator");
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [importErrors, setImportErrors] = useState<Partial<Record<PaletteRole, string>>>({});
  const ownedUrls = useRef(new Map<PaletteRole, string>());
  const assetBlobs = useRef<CreatorPaletteAssetBlobs>({});
  const [lastValidPalette, setLastValidPalette] = useState<PaletteDefinition | null>(null);
  const [savedPalettes, setSavedPalettes] = useState<CreatorPaletteSummary[]>([]);
  const [selectedSavedId, setSelectedSavedId] = useState("");
  const [storageBusy, setStorageBusy] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [storageStatus, setStorageStatus] = useState("");
  const fixture = coreMeaningFixtures[fixtureIndex];
  const compiled = useMemo(() => compileCreatorPalette(draft), [draft]);

  const refreshSaved = useCallback(async (preferredId?: string) => {
    try {
      const next = await repository.list();
      setSavedPalettes(next);
      setStorageError("");
      setSelectedSavedId(previous => {
        const target = preferredId ?? previous;
        return target && next.some(item => item.id === target) ? target : (next[0]?.id ?? "");
      });
      return next;
    } catch (error) {
      setSavedPalettes([]);
      setSelectedSavedId("");
      setStorageError(storageMessage(error));
      return [];
    }
  }, [repository]);

  useEffect(() => { void refreshSaved(); }, [refreshSaved]);

  useEffect(() => {
    if (compiled.ok) setLastValidPalette(compiled.palette);
  }, [compiled]);

  useEffect(() => () => {
    for (const url of ownedUrls.current.values()) URL.revokeObjectURL(url);
    ownedUrls.current.clear();
  }, []);

  const previewPalette = previewMode === "clearing" ? clearingPalette : lastValidPalette;
  const session = useMemo(() => previewPalette ? new ScoreBloomSession({
    trackId: `creator-lab:${fixture.id}`,
    seed: `creator-lab:${fixture.id}`,
    timeline: structuredClone(fixture.timeline),
    palette: previewPalette,
    reducedMotion,
  }) : null, [fixture, previewPalette, reducedMotion]);
  const [snapshot, setSnapshot] = useState<WorldSnapshot | null>(null);

  useEffect(() => {
    setPlaying(false);
    if (!session) {
      setSnapshot(null);
      return;
    }
    const target = Math.min(time, fixture.timeline.duration);
    session.seek(target);
    setSnapshot(session.snapshot());
  }, [session, fixture.timeline.duration]);

  useEffect(() => {
    if (!playing || !session) return;
    const startedAt = performance.now();
    const startTime = session.time;
    let frame = 0;
    let lastPublished = startTime - 1;

    const tick = (now: number) => {
      const nextTime = Math.min(
        fixture.timeline.duration,
        startTime + (now - startedAt) / 1000,
      );
      session.advanceTo(nextTime);
      if (nextTime - lastPublished >= 1 / 12 || nextTime >= fixture.timeline.duration) {
        setTime(nextTime);
        setSnapshot(session.snapshot());
        lastPublished = nextTime;
      }
      if (nextTime >= fixture.timeline.duration) {
        setPlaying(false);
        return;
      }
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [fixture.timeline.duration, playing, session]);

  const updateRole = (
    role: PaletteRole,
    patch: Partial<CreatorPaletteDraft["roles"][PaletteRole]>,
  ) => setDraft(previous => ({
    ...previous,
    roles: {
      ...previous.roles,
      [role]: { ...previous.roles[role], ...patch },
    },
  }));

  const releaseOwnedUrl = (role: PaletteRole) => {
    const current = ownedUrls.current.get(role);
    if (current) URL.revokeObjectURL(current);
    ownedUrls.current.delete(role);
  };

  const releaseAllOwnedUrls = () => {
    for (const role of CREATOR_PALETTE_ROLES) releaseOwnedUrl(role);
  };

  const importFile = async (role: PaletteRole, file: File | undefined) => {
    if (!file) return;
    const format = extensionFormat(file.name);
    if (!format) {
      setImportErrors(previous => ({ ...previous, [role]: "SVG, PNG, or WebP only" }));
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    try {
      const dimensions = await decodeImageDimensions(objectUrl);
      releaseOwnedUrl(role);
      ownedUrls.current.set(role, objectUrl);
      assetBlobs.current[role] = file;
      updateRole(role, {
        asset: {
          role,
          fileName: file.name,
          mimeType: file.type,
          format,
          byteSize: file.size,
          objectUrl,
          width: dimensions.width,
          height: dimensions.height,
          anchor: { x: 0.5, y: 0.8 },
          baseScale: 1,
        },
      });
      setImportErrors(previous => ({ ...previous, [role]: undefined }));
      setStorageStatus("");
    } catch {
      URL.revokeObjectURL(objectUrl);
      setImportErrors(previous => ({ ...previous, [role]: "Could not read this image" }));
    }
  };

  const removeAsset = (role: PaletteRole) => {
    releaseOwnedUrl(role);
    delete assetBlobs.current[role];
    updateRole(role, { asset: null });
    setImportErrors(previous => ({ ...previous, [role]: undefined }));
    setStorageStatus("");
  };

  const useSamples = async () => {
    setStorageBusy(true);
    setStorageError("");
    try {
      releaseAllOwnedUrls();
      const entries = await Promise.all(CREATOR_PALETTE_ROLES.map(async role => {
        const source = prismProofPalette.roles[role].assets[0];
        const response = await fetch(source.src);
        if (!response.ok) throw new Error(`Could not load sample ${role}`);
        const blob = await response.blob();
        return [role, blob] as const;
      }));
      assetBlobs.current = Object.fromEntries(entries) as Record<PaletteRole, Blob>;
      setDraft(previous => ({
        ...previous,
        name: previous.name.trim() || "My Palette",
        roles: Object.fromEntries(entries.map(([role, blob]) => [
          role,
          { ...previous.roles[role], asset: sampleAsset(role, blob.size) },
        ])) as CreatorPaletteDraft["roles"],
      }));
      setImportErrors({});
      setPreviewMode("creator");
      setStorageStatus("Sample materials loaded. You can save this palette locally.");
    } catch (error) {
      assetBlobs.current = {};
      setStorageError(storageMessage(error));
    } finally {
      setStorageBusy(false);
    }
  };

  const clearAll = () => {
    releaseAllOwnedUrls();
    assetBlobs.current = {};
    setDraft(createEmptyCreatorPaletteDraft(createCreatorDraftId(), "My Palette"));
    setSelectedSavedId("");
    setLastValidPalette(null);
    setImportErrors({});
    setPlaying(false);
    setTime(0);
    setStorageError("");
    setStorageStatus("");
  };

  const loadSaved = async (id: string) => {
    if (!id) return;
    setStorageBusy(true);
    setStorageError("");
    try {
      const document = await repository.load(id);
      if (!document) throw new CreatorPaletteStorageError("not-found", "That Creator Palette is no longer saved");
      const materialized = materializeCreatorPalette(document);
      releaseAllOwnedUrls();
      for (const role of CREATOR_PALETTE_ROLES) ownedUrls.current.set(role, materialized.objectUrls[role]);
      assetBlobs.current = { ...materialized.blobs };
      setDraft(materialized.draft);
      setSelectedSavedId(id);
      setPreviewMode("creator");
      setPlaying(false);
      setTime(0);
      setImportErrors({});
      setStorageStatus(`Loaded “${materialized.draft.name}”.`);
    } catch (error) {
      setStorageError(storageMessage(error));
    } finally {
      setStorageBusy(false);
    }
  };

  const saveCurrent = async () => {
    if (!compiled.ok) return;
    setStorageBusy(true);
    setStorageError("");
    try {
      const summary = await repository.save(draft, assetBlobs.current);
      await refreshSaved(summary.id);
      setSelectedSavedId(summary.id);
      setStorageStatus(`Saved “${summary.name}” on this device.`);
    } catch (error) {
      setStorageError(storageMessage(error));
    } finally {
      setStorageBusy(false);
    }
  };

  const renameSaved = async () => {
    if (!selectedSavedId || selectedSavedId !== draft.id) return;
    setStorageBusy(true);
    setStorageError("");
    try {
      const summary = await repository.rename(selectedSavedId, draft.name);
      await refreshSaved(summary.id);
      setStorageStatus(`Renamed to “${summary.name}”.`);
    } catch (error) {
      setStorageError(storageMessage(error));
    } finally {
      setStorageBusy(false);
    }
  };

  const duplicateSaved = async () => {
    if (!selectedSavedId) return;
    setStorageBusy(true);
    setStorageError("");
    try {
      const source = savedPalettes.find(item => item.id === selectedSavedId);
      const newId = createCreatorDraftId();
      const summary = await repository.duplicate(
        selectedSavedId,
        newId,
        `${source?.name ?? "My Palette"} copy`,
      );
      await refreshSaved(summary.id);
      await loadSaved(summary.id);
      setStorageStatus(`Duplicated as “${summary.name}”.`);
    } catch (error) {
      setStorageError(storageMessage(error));
      setStorageBusy(false);
    }
  };

  const deleteSaved = async () => {
    if (!selectedSavedId) return;
    const deletingId = selectedSavedId;
    setStorageBusy(true);
    setStorageError("");
    try {
      await repository.delete(deletingId);
      const next = await refreshSaved();
      if (draft.id === deletingId) {
        releaseAllOwnedUrls();
        assetBlobs.current = {};
        setDraft(createEmptyCreatorPaletteDraft(createCreatorDraftId(), "My Palette"));
        setLastValidPalette(null);
        setTime(0);
      }
      setStorageStatus("Deleted from this device.");
      setSelectedSavedId(next[0]?.id ?? "");
    } catch (error) {
      setStorageError(storageMessage(error));
    } finally {
      setStorageBusy(false);
    }
  };

  const seekTo = (next: number) => {
    setPlaying(false);
    const target = Math.max(0, Math.min(fixture.timeline.duration, next));
    setTime(target);
    if (!session) return;
    session.seek(target);
    setSnapshot(session.snapshot());
  };

  const changeFixture = (index: number) => {
    setPlaying(false);
    setTime(0);
    setFixtureIndex(index);
  };

  const togglePlay = () => {
    if (!session) return;
    if (playing) {
      setPlaying(false);
      return;
    }
    if (time >= fixture.timeline.duration) seekTo(0);
    setPlaying(true);
  };

  const validationErrors = compiled.ok ? [] : compiled.errors;
  const selectedSaved = savedPalettes.find(item => item.id === selectedSavedId);

  return <main
    className="creator-lab"
    data-creator-lab-valid={compiled.ok ? "true" : "false"}
    data-creator-lab-preview={previewPalette?.id ?? "empty"}
    data-creator-lab-fixture={fixture.id}
    data-creator-current-id={draft.id}
    data-creator-saved-count={savedPalettes.length}
  >
    <header className="creator-lab-header">
      <div>
        <p>PICTURE SCORE • CREATOR PALETTE LAB</p>
        <h1>Give music your own materials.</h1>
        <span>Five images. Five musical roles. No rigging.</span>
      </div>
      <label className="creator-lab-reduced">
        <input
          type="checkbox"
          checked={reducedMotion}
          onChange={event => setReducedMotion(event.currentTarget.checked)}
          aria-label="Creator Lab reduced motion"
        />
        Reduced motion
      </label>
    </header>

    <section className="creator-lab-preview" aria-label="Live preview">
      <div className="creator-lab-preview-bar">
        <div className="creator-lab-mode" role="group" aria-label="Preview palette">
          <button
            type="button"
            className={previewMode === "clearing" ? "is-active" : ""}
            onClick={() => setPreviewMode("clearing")}
          >Clearing</button>
          <button
            type="button"
            className={previewMode === "creator" ? "is-active" : ""}
            onClick={() => setPreviewMode("creator")}
            disabled={!lastValidPalette}
          >My Palette</button>
        </div>
        <strong>{previewPalette?.displayName ?? "Waiting for five images"}</strong>
      </div>
      <LabStage palette={previewPalette} snapshot={snapshot} />
      <nav className="creator-lab-fixtures" aria-label="Preview fixtures">
        {coreMeaningFixtures.map((item, index) => <button
          key={item.id}
          type="button"
          data-creator-fixture-id={item.id}
          className={index === fixtureIndex ? "is-active" : ""}
          onClick={() => changeFixture(index)}
        >{item.blindLabel}</button>)}
      </nav>
      <div className="creator-lab-transport">
        <button type="button" onClick={togglePlay} disabled={!session}>
          {playing ? "Pause" : time >= fixture.timeline.duration ? "Replay" : "Play"}
        </button>
        <button type="button" onClick={() => seekTo(0)} disabled={!session}>Restart</button>
        <input
          type="range"
          min="0"
          max={fixture.timeline.duration}
          step="0.05"
          value={time}
          onChange={(event: ChangeEvent<HTMLInputElement>) => seekTo(Number(event.currentTarget.value))}
          aria-label="Creator Lab preview time"
          disabled={!session}
        />
        <output>{time.toFixed(1)} / {fixture.timeline.duration.toFixed(1)}s</output>
      </div>
    </section>

    <section className="creator-lab-editor" aria-label="Palette materials">
      <div className="creator-lab-library" aria-label="Saved Creator Palettes">
        <label>
          Saved palettes
          <select
            aria-label="Saved Creator Palettes"
            value={selectedSavedId}
            onChange={event => setSelectedSavedId(event.currentTarget.value)}
            disabled={storageBusy || !savedPalettes.length}
          >
            {!savedPalettes.length && <option value="">None saved yet</option>}
            {savedPalettes.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <div className="creator-lab-library-actions">
          <button type="button" onClick={() => void loadSaved(selectedSavedId)} disabled={storageBusy || !selectedSavedId}>Open</button>
          <button type="button" onClick={clearAll} disabled={storageBusy}>New</button>
          <button type="button" onClick={() => void saveCurrent()} disabled={storageBusy || !compiled.ok}>Save</button>
          <button type="button" onClick={() => void renameSaved()} disabled={storageBusy || !selectedSavedId || selectedSavedId !== draft.id}>Rename</button>
          <button type="button" onClick={() => void duplicateSaved()} disabled={storageBusy || !selectedSavedId}>Duplicate</button>
          <button type="button" onClick={() => void deleteSaved()} disabled={storageBusy || !selectedSavedId}>Delete</button>
        </div>
        <span className="creator-lab-library-note">
          {selectedSaved ? `${Math.ceil(selectedSaved.totalBytes / 1024)} KB on this device` : "12 palettes / 40 MB library limit"}
        </span>
      </div>

      {(storageError || storageStatus) && <div
        className={storageError ? "creator-lab-storage-message is-error" : "creator-lab-storage-message"}
        role="status"
      >{storageError || storageStatus}</div>}

      <div className="creator-lab-name-row">
        <label>
          Palette name
          <input
            value={draft.name}
            onChange={event => setDraft(previous => ({ ...previous, name: event.currentTarget.value }))}
            maxLength={60}
          />
        </label>
        <label>
          Artist <small>optional</small>
          <input
            value={draft.authorName}
            onChange={event => setDraft(previous => ({ ...previous, authorName: event.currentTarget.value }))}
            maxLength={60}
          />
        </label>
        <div className="creator-lab-actions">
          <button type="button" onClick={() => { void useSamples(); }} disabled={storageBusy}>Use sample assets</button>
          <button type="button" onClick={clearAll} disabled={storageBusy}>Clear</button>
        </div>
      </div>

      <div className="creator-lab-role-list">
        {CREATOR_PALETTE_ROLES.map(role => {
          const roleDraft = draft.roles[role];
          const roleErrors = validationErrors.filter(item => item.role === role);
          const importError = importErrors[role];
          return <article className="creator-lab-role-card" key={role} data-creator-role={role}>
            <header>
              <div>
                <strong>{ROLE_LABELS[role]}</strong>
                <small>{ROLE_HINTS[role]}</small>
              </div>
              {roleDraft.asset && <button type="button" onClick={() => removeAsset(role)}>Remove</button>}
            </header>

            <label className="creator-lab-file">
              <span>{roleDraft.asset ? roleDraft.asset.fileName : "Add image"}</span>
              <input
                type="file"
                accept=".png,.webp,.svg,image/png,image/webp,image/svg+xml"
                onChange={event => void importFile(role, event.currentTarget.files?.[0])}
                aria-label={`Add image for ${ROLE_LABELS[role]}`}
              />
            </label>

            <div className="creator-lab-presets">
              <label>
                Place
                <select
                  value={roleDraft.placementPreset}
                  onChange={event => updateRole(role, {
                    placementPreset: event.currentTarget.value as CreatorPlacementPresetId,
                  })}
                >
                  {Object.keys(creatorPlacementPresets).map(id => <option key={id} value={id}>
                    {PLACEMENT_LABELS[id as CreatorPlacementPresetId]}
                  </option>)}
                </select>
              </label>
              <label>
                Move
                <select
                  value={roleDraft.motionPreset}
                  onChange={event => updateRole(role, {
                    motionPreset: event.currentTarget.value as CreatorMotionPresetId,
                  })}
                >
                  {Object.keys(creatorMotionPresets).map(id => <option key={id} value={id}>
                    {MOTION_LABELS[id as CreatorMotionPresetId]}
                  </option>)}
                </select>
              </label>
            </div>

            {(importError || roleErrors.length > 0) && <div className="creator-lab-errors" role="status">
              {importError && <span>{importError}</span>}
              {roleErrors.map(item => <span key={item.code}>{item.message}</span>)}
            </div>}
          </article>;
        })}
      </div>

      <footer className={compiled.ok ? "creator-lab-status is-ready" : "creator-lab-status"}>
        {compiled.ok
          ? "Ready. This draft is an ordinary PaletteDefinition v1."
          : `${validationErrors.length} thing${validationErrors.length === 1 ? "" : "s"} to finish before preview.`}
      </footer>
    </section>
  </main>;
}
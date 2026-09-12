import { describe, expect, it, vi, afterEach } from 'vitest';
import type { Stroke } from '../music/types';
import { createMusic, createVisualNotes } from '../music/score';
import { exampleStrokes } from '../music/examples';
import { emptyProject } from '../music/project';
import { emptyGarden, makeObject, parseGarden } from '../garden/gardenState';
import { buildEnsemblePlan } from '../garden/ensemble';
import { mixGarden } from '../garden/gardenMixer';
import { midiFile } from '../music/export';
import { drawRelations } from './drawRelations';
import { applyDrawWonder } from './drawMusic';
import { gardenRelations, StableGardenRelations } from './gardenRelations';
import { applyGardenWonder, spatialSlot } from './gardenMusic';
import { loadWonderMemory, rememberWonder } from './wonderMemory';
import { nextWonderHint } from './wonderHints';
const stroke = (id: string, coords: number[][]): Stroke => ({ id, points: coords.map(([x, y], time) => ({x,y,time,pressure:.5})) });
const circle = (id = 'circle', radius = 100, angle = Math.PI * 2) => stroke(id, Array.from({length:81}, (_,i) => [300 + radius * Math.cos(i / 80 * angle), 210 + radius * Math.sin(i / 80 * angle)]));
const music = (strokes: Stroke[]) => createMusic(createVisualNotes(strokes,.5),104,false,.5);
const has = (strokes: Stroke[], rule: string) => drawRelations(strokes).some(e => e.rule === rule);
const line = (id: string) => stroke(id, [[150,260],[280,210],[380,150],[520,170]]);
function garden(coords: number[][]) {
  return { ...emptyGarden(), listener: {x:.5,y:.5}, objects: coords.map(([x,y],i) => makeObject({...emptyProject(),strokes:[line('s'+i)]},{x,y},'o'+i)) };
}
afterEach(() => vi.unstubAllGlobals());
describe('drawing laws', () => {
  it('closes circles, hearts and joined edges, but rejects tiny and almost-closed loops', () => {
    expect(has([circle()], 'closed-loop')).toBe(true);
    expect(has(exampleStrokes('heart'), 'closed-loop')).toBe(true);
    expect(has([circle('tiny',4)], 'closed-loop')).toBe(false);
    expect(has([circle('open',100,Math.PI*1.8)], 'closed-loop')).toBe(false);
    expect(has([stroke('a',[[200,100],[400,100]]),stroke('b',[[400,100],[400,300]]),stroke('c',[[400,300],[200,300],[200,100]])], 'closed-loop')).toBe(true);
  });
  it('repeats the local contour exactly once and leaves every source IR untouched', () => {
    const strokes=[circle()], base=music(strokes), before=JSON.stringify({strokes,base});
    const effect=drawRelations(strokes).filter(e=>e.rule==='closed-loop');
    const performed=applyDrawWonder(base,effect);
    expect(performed.playNotes.length).toBeGreaterThan(base.playNotes.length);
    const end=Math.max(...base.playNotes.map(n=>n.beat+n.duration)), start=base.playNotes[0].beat;
    expect(performed.playNotes.every(n=>n.beat>=start && n.beat+n.duration<=end+1e-8)).toBe(true);
    expect(JSON.stringify({strokes,base})).toBe(before);
    expect(applyDrawWonder(base,effect)).toEqual(performed);
    expect([...midiFile(performed).slice(0,4)]).toEqual([77,84,104,100]);
  });
  it('thickens true retraces, rejects partial overlaps and nearby parallel contours, and caps five passes', () => {
    const a=line('a'), b={...line('b'),points:[...line('b').points].reverse()};
    expect(drawRelations([a,b]).find(e=>e.rule==='retrace-thicken')?.stage).toBe(1);
    expect(has([a,stroke('partial',[[150,260],[280,210]])],'retrace-thicken')).toBe(false);
    expect(has([a,{...line('parallel'),points:a.points.map(p=>({...p,y:p.y+18}))}],'retrace-thicken')).toBe(false);
    const repeated=Array.from({length:5},(_,i)=>line('pass'+i));
    expect(drawRelations(repeated).find(e=>e.rule==='retrace-thicken')?.stage).toBe(2);
    const base=music(repeated), output=applyDrawWonder(base,drawRelations(repeated));
    expect(output.playNotes.length).toBeLessThanOrEqual(base.playNotes.length*3);
    expect(Math.max(...output.playNotes.map(n=>n.velocity))).toBeLessThanOrEqual(.7);
    expect(output.playNotes.every(n=>n.duration>0 && n.beat+n.duration<=16)).toBe(true);
  });
  it('never recursively repeats merged source IDs when a closed shape is retraced', () => {
    const strokes=Array.from({length:5},(_,i)=>circle('c'+i));
    const base=music(strokes), effects=drawRelations(strokes).filter(e=>e.rule==='closed-loop');
    expect(applyDrawWonder(base,effects).playNotes.length).toBeLessThanOrEqual(base.playNotes.length*2);
  });
  it('bounds scribble sparks, clusters adjacent intersections and ignores near misses and endpoint joins', () => {
    const x=[stroke('a',[[100,80],[850,340]]),stroke('b',[[100,340],[850,80]])];
    expect(drawRelations(x).filter(e=>e.rule==='crossing-spark')).toHaveLength(1);
    expect(has([x[0],stroke('miss',[[100,360],[850,390]])],'crossing-spark')).toBe(false);
    expect(has([stroke('a',[[100,100],[300,200]]),stroke('b',[[300,200],[500,100]])],'crossing-spark')).toBe(false);
    const scribble=Array.from({length:24},(_,i)=>stroke('z'+i,[[50+i*30,40],[950-i*23,380]]));
    const effects=drawRelations(scribble).filter(e=>e.rule==='crossing-spark');
    expect(effects.length).toBeLessThanOrEqual(8);
    for(let bar=0;bar<4;bar++) expect(effects.filter(e=>Math.floor(e.position.x/250)===bar).length).toBeLessThanOrEqual(2);
  });
  it('recognizes an approximate heart and mirrored contours, without naming an image', () => {
    expect(has(exampleStrokes('heart'),'mirror-answer')).toBe(true);
    const a=stroke('a',[[300,80],[200,130],[240,270],[300,320]]);
    const b=stroke('b',a.points.map(p=>[600-p.x,p.y+3]));
    expect(has([a,b],'mirror-answer')).toBe(true);
    expect(has([line('asymmetric')],'mirror-answer')).toBe(false);
    expect(drawRelations([a,b])).toEqual(drawRelations(structuredClone([a,b])));
    const base=music([a,b]), result=applyDrawWonder(base,drawRelations([a,b]).filter(e=>e.rule==='mirror-answer'));
    expect(result.playNotes.some(n=>!base.playNotes.some(b=>b.id===n.id && b.pitch===n.pitch && b.duration===n.duration))).toBe(true);
  });
});
describe('spatial laws', () => {
  it.each([[[.25,.45],[.45,.45],[.65,.45]],[[.2,.45],[.4,.45],[.6,.45],[.8,.45]],[[.5,.2],[.5,.4],[.5,.6]]].map(coords => ({ coords })))('sequences a lineup and includes the third melody in the audible mix', ({ coords }) => {
    const state=garden(coords), mix=mixGarden(state), effects=gardenRelations(state,mix);
    expect(effects[0]?.rule).toBe('garden-lineup-cascade');
    expect(effects[0]?.objectIds.length).toBe(coords.length);
    expect([...mix.values()].every(n=>n>.015)).toBe(true);
    expect([...mix.values()].reduce((a,b)=>a+b,0)).toBeLessThanOrEqual(.751);
    const base=buildEnsemblePlan(state,mix,0), plan=applyGardenWonder(base,state,effects,0);
    const onsets=effects[0].objectIds.map(id=>Math.min(...plan.objectPlans.get(id)!.notes.map(n=>n.beat)));
    expect(onsets).toEqual([...onsets].sort((a,b)=>a-b));
    expect(applyGardenWonder(base,state,effects,12)).toBe(base);
    expect(parseGarden(JSON.parse(JSON.stringify(state)))).toEqual(state);
  });
  it('rotates three triangle voices, rejecting skinny, tiny, inaudible and collinear arrangements', () => {
    const state=garden([[.35,.35],[.65,.35],[.5,.61]]), effects=gardenRelations(state,mixGarden(state));
    expect(effects[0]?.rule).toBe('garden-triad-round');
    const e=effects[0], id=e.objectIds[0];
    expect([0,1,2].map(p=>spatialSlot(e,id,p)).sort()).toEqual([0,1,2]);
    for (const coords of [[[.4,.4],[.42,.4],[.41,.42]],[[.3,.4],[.7,.4],[.5,.42]],[[.3,.4],[.5,.4],[.7,.4]]]) {
      const s=garden(coords); expect(gardenRelations(s,mixGarden(s)).some(e=>e.rule==='garden-triad-round')).toBe(false);
    }
    expect(gardenRelations(state,new Map([['o0',.3],['o1',.3]]))).toEqual([]);
  });
  it('fades near the alignment boundary and waits for stable entry and exit', () => {
    const state=garden([[.3,.4],[.5,.43],[.7,.4]]), effects=gardenRelations(state,mixGarden(state));
    expect(effects[0].strength).toBeGreaterThan(0);
    expect(effects[0].strength).toBeLessThan(1);
    const stable=new StableGardenRelations();
    expect(stable.update(effects,0)).toEqual([]);
    expect(stable.update(effects,219)).toEqual([]);
    expect(stable.update(effects,220)).toEqual(effects);
    expect(stable.update([],300)).toEqual(effects);
    expect(stable.update([],521)).toEqual([]);
  });
});
describe('quiet memory and hints', () => {
  it('validates storage and survives unavailable storage', () => {
    vi.stubGlobal('localStorage',{getItem:()=>'{broken',setItem:()=>{throw Error();}});
    expect(loadWonderMemory()).toEqual({version:1,triggered:{}});
    expect(()=>rememberWonder(['closed-loop'])).not.toThrow();
    vi.stubGlobal('localStorage',{getItem:()=>JSON.stringify({version:1,triggered:{'closed-loop':12,unknown:2,'mirror-answer':'no'}})});
    expect(loadWonderMemory().triggered).toEqual({'closed-loop':12});
  });
  it('suggests untried experiments without repeating the last prompt', () => {
    const memory={version:1 as const,triggered:{'closed-loop':12},lastHint:'retrace-thicken' as const};
    expect(nextWonderHint('draw',memory,[])).toBe('crossing-spark');
    expect(nextWonderHint('garden',memory,[])).toBe('garden-lineup-cascade');
  });
});

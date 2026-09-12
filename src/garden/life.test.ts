import { afterEach, describe, expect, it, vi } from 'vitest';
import { GardenLifeBridge, LIFE_LIMITS, roleMotion } from './life';
import type { GardenLifeEvent } from './life';
import { LifePresentation } from './lifePresentation';
import { independentNotes } from './ensemble';
import { emptyProject } from '../music/project';
import { exampleStrokes } from '../music/examples';
import { makeObject } from './gardenState';
const event = (at=1, objectId='a', extra: Partial<GardenLifeEvent>={}): GardenLifeEvent =>
  ({objectId,at,beat:at*2,type:'note',role:'melody',duration:.2,pitch:60,...extra});
function observe() {
  const bridge=new GardenLifeBridge(), heard:(GardenLifeEvent|null)[]=[];
  bridge.onEvent=e=>heard.push(e);
  return {bridge,heard};
}
afterEach(()=>vi.useRealTimers());
describe('life clock observation',()=>{
  it('waits for actual onset, preserves order, and does not catch up stale attacks',()=>{
    const {bridge,heard}=observe();
    bridge.enqueue(event(1.2,'b'));bridge.enqueue(event(1,'a'));bridge.enqueue(event(.5,'old'));
    bridge.flush(.9,()=>true);expect(heard).toHaveLength(0);
    bridge.flush(1.01,()=>true);expect(heard.map(e=>e?.objectId)).toEqual(['a']);
    bridge.flush(1.22,()=>true);expect(heard.map(e=>e?.objectId)).toEqual(['a','b']);
  });
  it('coalesces a chord and simultaneous free/ensemble notes, retaining spark and formation cues',()=>{
    const {bridge,heard}=observe();
    bridge.enqueue(event(1,'a',{source:{strokeId:'line',point:{x:20,y:40}}}));
    bridge.enqueue(event(1,'a',{pitch:64,type:'sustain-start',duration:1.5,layer:'ensemble',formation:'garden-triad-round'}));
    bridge.enqueue(event(1,'a',{pitch:72,source:{strokeId:'line',point:{x:20,y:40},spark:{x:200,y:100}}}));
    bridge.flush(1.01,()=>true);
    expect(heard).toHaveLength(1);
    expect(heard[0]).toMatchObject({type:'sustain-start',duration:1.5,formation:'garden-triad-round',source:{spark:{x:200,y:100}}});
    bridge.flush(2.5,()=>true);expect(heard.at(-1)?.type).toBe('sustain-end');
  });
  it('filters inaudible branches before coalescing and isolates source positions',()=>{
    const {bridge,heard}=observe(), source={strokeId:'s',point:{x:1,y:2}};
    bridge.enqueue(event(1,'muted'));
    bridge.enqueue(event(1,'a',{source,layer:'free'}));
    bridge.enqueue(event(1,'a',{formation:'garden-lineup-cascade',layer:'ensemble'}));
    bridge.flush(1, e=>e.objectId!=='muted' && e.layer!=='ensemble');
    expect(heard).toHaveLength(1);expect(heard[0]?.formation).toBeUndefined();
    heard[0]!.source!.point.x=999;expect(source.point.x).toBe(1);
  });
  it('keeps visual rates bounded in a 12-work dense garden',()=>{
    const {bridge,heard}=observe();
    for(let tick=0;tick<100;tick++) {
      for(let i=0;i<12;i++)bridge.enqueue(event(tick/100,'o'+i));
      bridge.flush(tick/100,()=>true);
    }
    expect(heard.length).toBeLessThanOrEqual(LIFE_LIMITS.globalPerSecond);
    for(let i=0;i<12;i++)expect(heard.filter(e=>e?.objectId==='o'+i).length).toBeLessThanOrEqual(8);
  });
  it('does not let an old sustain end interrupt a newer held note',()=>{
    const {bridge,heard}=observe();
    bridge.enqueue(event(1,'a',{type:'sustain-start',duration:1}));
    bridge.flush(1,()=>true);
    bridge.enqueue(event(1.5,'a',{type:'sustain-start',duration:2}));
    bridge.flush(1.5,()=>true);bridge.flush(2,()=>true);
    expect(heard).toHaveLength(2);
    bridge.flush(3.5,()=>true);expect(heard.at(-1)?.type).toBe('sustain-end');
  });
  it('clears removed objects, queued work and timers on STOP, with a bounded queue',()=>{
    vi.useFakeTimers();
    const {bridge,heard}=observe();bridge.start(()=>1,()=>true);
    for(let i=0;i<1000;i++)bridge.enqueue(event(2,'o'+i));
    expect(bridge.pendingCount).toBe(LIFE_LIMITS.queue);
    bridge.remove('o0');expect(bridge.pendingCount).toBe(LIFE_LIMITS.queue-1);
    bridge.clear();expect(bridge.pendingCount).toBe(0);expect(vi.getTimerCount()).toBe(0);
    const count=heard.length;vi.advanceTimersByTime(10000);expect(heard).toHaveLength(count);expect(heard.at(-1)).toBeNull();
  });
  it('isolates failing visual subscribers from the clock and other subscribers',()=>{
    const bridge=new GardenLifeBridge();bridge.onEvent=()=>{throw Error('visual');};
    bridge.enqueue(event());expect(()=>bridge.flush(1,()=>true)).not.toThrow();
    const presentation=new LifePresentation(), other=vi.fn();
    presentation.register('a',()=>{throw Error('visual');});presentation.observe(other);
    presentation.dispatch(event());expect(other).toHaveBeenCalledOnce();
  });
});
it('provides five distinguishable, bounded role responses',()=>{
  const roles=['melody','harmony','drone','rhythm','decoration'] as const;
  const motions=roles.map(r=>roleMotion(r,2,1));
  expect(new Set(motions.map(m=>m.frames.join()))).toHaveProperty('size',5);
  expect(motions[0].frames.join()).toContain('-6px');
  expect(motions[1].frames.join()).toContain('1.07');
  expect(motions[2].duration).toBe(2000);
  expect(motions[3].duration).toBeLessThan(350);
});
it('attaches WONDER source cues only to derived arrangements without changing saved IR',()=>{
  const heart=makeObject({...emptyProject(),strokes:exampleStrokes('heart')},{x:.5,y:.5},'heart');
  const before=JSON.stringify(heart), notes=independentNotes(heart);
  expect(notes.some(n=>n.life?.loop)).toBe(true);
  expect(notes.some(n=>n.life?.mirror==='answer')).toBe(true);
  expect(notes.every(n=>n.life?.strokeId)).toBe(true);
  expect(JSON.stringify(heart)).toBe(before);
  const stroke=(id:string,points:number[][])=>({id,points:points.map(([x,y],time)=>({x,y,time,pressure:.5}))});
  const cross=makeObject({...emptyProject(),strokes:[stroke('a',[[100,80],[850,340]]),stroke('b',[[100,340],[850,80]])]},{x:.5,y:.5});
  expect(independentNotes(cross).some(n=>n.life?.spark)).toBe(true);
});

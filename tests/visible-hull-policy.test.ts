import {expect,it} from "vitest";
import {VisibleHullTracker} from "./visible-hull-policy";
import {chooseTouchTarget,delayedTouchClearance} from "./touch-policy";
it("reacts to a visible descending hull even when there are no hostile bullets",()=>{
 const tracker=new VisibleHullTracker();
 tracker.observe(0,[{id:1,x:180,y:415,behavior:"hookWing"}]);
 const hazards=tracker.observe(.06,[{id:1,x:180,y:430,behavior:"hookWing"}]);
 const s={player:{x:180,y:540},hostileProjectiles:hazards};
 const target=chooseTouchTarget(s,180,.2);
 expect(target).not.toBe(180);
 expect(delayedTouchClearance(s,target,180,.2)).toBeGreaterThan(25);
 expect(hazards[1].vy).toBeCloseTo(250);
});
it("observes supplied positions without mutating them or treating ground scenery as airborne collision",()=>{
 const tracker=new VisibleHullTracker();
 const input=[{id:1,x:100,y:200,behavior:"cross"},{id:2,x:50,y:200,behavior:"groundBattery"},{id:3,x:180,y:200,behavior:"groundDepot"}];
 const before=JSON.stringify(input);
 expect(tracker.observe(.9,[{id:9,x:-30,y:112},{id:10,x:180,y:700}])).toEqual([]);
 expect(tracker.retainedHulls).toBe(0);
 tracker.observe(1,input);
 const values=tracker.observe(1.1,[{...input[0],x:124,y:200},input[1],input[2]]);
 expect(values).toHaveLength(3); expect(values[1].vx).toBeCloseTo(240);
 expect(JSON.stringify(input)).toBe(before);expect(tracker.retainedHulls).toBe(1);
});
it("retains velocity through duplicate snapshots but drops expired IDs with bounded memory",()=>{
 const tracker=new VisibleHullTracker();tracker.observe(1,[{id:1,x:180,y:300}]);
 const a=tracker.observe(1.1,[{id:1,x:180,y:325}]);
 expect(tracker.observe(1.1,[{id:1,x:180,y:325}])).toEqual(a);
 for(let i=0;i<1000;i++){tracker.observe(2+i,[{id:i+2,x:180,y:300}]);expect(tracker.retainedHulls).toBe(1);}
 tracker.observe(1003,[]);expect(tracker.retainedHulls).toBe(0);
});

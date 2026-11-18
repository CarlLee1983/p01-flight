import { describe, it, expect } from "vitest";
import { keyboardEdge } from "../src/game/keyboard-event";
describe("keyboard action event identity", () => {
  it("does not replay earlier presses when Phaser revisits a pending queue", () => {
    const calls: object[] = [];
    const dispatch = keyboardEdge<{repeat:boolean}>(event => calls.push(event));
    const first = {repeat:false}, second = {repeat:false}, third = {repeat:false};
    for (const queue of [[first], [first], [first,second], [first,second], [first,second,third]])
      queue.forEach(dispatch);
    expect(calls).toEqual([first,second,third]);
  });
  it("ignores operating system repeat without suppressing a distinct fast press", () => {
    let count = 0;
    const dispatch = keyboardEdge(() => count++);
    dispatch({repeat:false}); dispatch({repeat:true}); dispatch({repeat:true}); dispatch({repeat:false});
    expect(count).toBe(2);
  });
});

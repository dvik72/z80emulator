//////////////////////////////////////////////////////////////////////////////
//
// This program is free software; you can redistribute it and / or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation; either version 2 of the License, or
// (at your option) any later version.
// 
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program; if not, write to the Free Software
// Foundation, Inc., 675 Mass Ave, Cambridge, MA 02139, USA.
//
//////////////////////////////////////////////////////////////////////////////

import { Z80, TIMER_RANGE } from '../z80/z80';
import { Board } from './board';

// Use the factory method on TimeoutManager to create the timer.
// Subsequent calls to set timeouts or stop timers should be done
// from this class.
export class Timer {
  setTimeout(timeout: number) {
    this.timeout = timeout & TIMER_RANGE;
    this.setTimeoutCb(this, false);
  }

  getTimeout(): number {
    return this.timeout;
  }

  addTimeout(timeToAdd: number) {
    this.timeout = this.timeout + timeToAdd & TIMER_RANGE;
    this.setTimeoutCb(this, false);
  }

  isRunning(): boolean {
    return this.next != this.prev;
  }

  stop(): void {
    this.unlink();
  }

  // The following methods and attributes are not indended
  // to be used outside this file :/
  constructor(
    public name: string,
    public setTimeoutCb: (timer: Timer, forceSchedule: boolean) => void,
    public expiredCb?: () => void
  ) {
    this.next = this;
    this.prev = this;
    this.expiredCb = expiredCb;
  }
  
  unlink(): void {
    this.prev.next = this.next;
    this.next.prev = this.prev;
    this.next = this;
    this.prev = this;
  }
  
  public getState(): any {
    const state: any = {};

    state.timeout = this.timeout;
    state.running = this.isRunning();

    return state;
  }

  public setState(state: any): void {
    this.unlink();

    this.timeout = state.timeout;
    if (state.running) {
      this.setTimeoutCb(this, true);

    }
  }

  timeout = 0;
  next: Timer;
  prev: Timer;
}

export let CHROME_BUG_WORKAROUND = 0;

export class Counter {
  constructor(
    name: string,
    private board: Board,
    private frequency: number
  ) {
    this.timer = this.board.getTimeoutManager().createTimer(name, this.onTimer.bind(this));
    this.timer.setTimeout(this.board.getSystemTime() + this.board.getSystemFrequency());
}

  public reset() {
    this.refTime = this.board.getSystemTime();
    this.refFrag = 0;
    this.oldTime = 0;
    this.time = 0;
  }

  private onTimer(): void {
    this.get();
    this.timer.setTimeout(this.timer.getTimeout() + 1000);
  }

  public get() {
    CHROME_BUG_WORKAROUND = this.refTime;
    const elapsed = this.frequency * this.board.getTimeSince(this.refTime) + this.refFrag;
    this.refTime = this.board.getSystemTime();
    this.refFrag = elapsed % this.board.getSystemFrequency();
    this.time += elapsed / this.board.getSystemFrequency() | 0;

    return this.time;
  }

  public elapsed() {
    const time = this.get();
    const elapsed = time - this.oldTime;
    this.oldTime = time;
    return elapsed;
  }

  public getState(): any {
    const state: any = {};

    state.refTime = this.refTime;
    state.refFrag = this.refFrag;
    state.time = this.time;
    state.oldTime = this.oldTime;

    state.timer = this.timer.getState();

    return state;
  }

  public setState(state: any): void {
    this.refTime = state.refTime;
    this.refFrag = state.refFrag;
    this.time = state.time;
    this.oldTime = state.oldTime;

    this.timer.setState(state.timer);
  }
  
  private refTime = 0;
  private refFrag = 0;
  private time = 0;
  private oldTime = 0;

  private timer: Timer;
}

export class TimeoutManager {
  constructor(
  ) {
    this.setTimeout = this.setTimeout.bind(this);
    this.timeout = this.timeout.bind(this);
    this.timerHead = this.createTimer('Head');
  }

  public initialize(z80: Z80) {
    this.timeAnchor = z80.getSystemTime();
    this.z80 = z80;
  }

  public createTimer(name: string, expiredCb?: () => void): Timer {
    return new Timer(name, this.setTimeout, expiredCb)
  }

  public timeout(): void {
    if (!this.z80) {
      return;
    }

    const currentTime = this.z80.getSystemTime();
    while (true) {
      let curr = this.timerHead.next;
      if ((curr.timeout - this.timeAnchor & TIMER_RANGE) > (currentTime - this.timeAnchor & TIMER_RANGE)) {
        break;
      }
      if (curr == this.timerHead) {
        break;
      }

      curr.unlink();

      if (curr.expiredCb) {
        curr.expiredCb();
      }
    }

    this.timeAnchor = currentTime;
    this.z80.setTimeoutAt(this.timerHead.next.timeout);
  }

  private setTimeout(timer: Timer, forceSchedule: boolean): void {
    if (!this.z80) {
      return;
    }

    timer.unlink();

    if (!forceSchedule) {
      // Dont schedule timer if it already expired.
      if ((timer.timeout - this.z80.getSystemTime() & TIMER_RANGE) > TIMER_RANGE / 2) {
        return;
      }
    }

    let curr = this.timerHead.next;
    while ((timer.timeout - this.timeAnchor & TIMER_RANGE) > (curr.timeout - this.timeAnchor & TIMER_RANGE)) {
      if (curr == this.timerHead) {
        break;
      }
      curr = curr.next;
    }

    timer.next = curr;
    timer.prev = curr.prev;
    curr.prev.next = timer;
    curr.prev = timer;

    this.z80.setTimeoutAt(this.timerHead.next.timeout);
  }

  public getState(): any {
    let state: any = {}

    state.timeAnchor = this.timeAnchor;

    return state;
  }

  public setState(state: any): void {
    this.timeAnchor = state.timeAnchor;
  }

  private z80?: Z80;
  private timerHead: Timer;
  private timeAnchor = 0;
}

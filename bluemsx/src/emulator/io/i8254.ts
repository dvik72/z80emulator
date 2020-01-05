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

import { Counter, Timer } from '../core/timeoutmanager';
import { Board } from '../core/board';
import { SaveState } from '../util/savestate';

enum Phase { NONE, LOW, HI };

class InternalCounter {
  constructor(
    private board: Board,
    private frequency: number,
    private out?: (state: number) => void
  ) {
    this.timer = this.board.getTimeoutManager().createTimer(name, this.onTimer.bind(this));
    this.counter = new Counter('I8254 Counter', this.board, this.frequency);
    this.reset();
  }

  public reset() {
    this.readPhase = Phase.LOW;
    this.writePhase = Phase.LOW;
    this.outputLatched = false;
    this.statusLatched = false;
    this.controlWord = 0x30;

    this.counter.reset();
  }

  public getFrequency(): number {
    return this.frequency;
  }

  public write(value: number): void {
    this.sync();

    switch ((this.controlWord & 0x30) >> 4) {
      case 0:
        return;
      case 1:
        this.countRegister = (this.countRegister & 0xff00) | value;
        break;
      case 2:
        this.countRegister = (this.countRegister & 0x00ff) | (value << 8);
        break;
      case 3:
        if (this.writePhase == Phase.LOW) {
          this.countRegister = (this.countRegister & 0xff00) | value;
          this.writePhase = Phase.HI;
          if (this.mode == 0) {
            this.outPhase = 0;
          }
          return;
        }
        else {
          this.countRegister = (this.countRegister & 0x00ff) | (value << 8);
          this.writePhase = Phase.LOW;
        }
        break;
    }

    if (this.mode != 1 && this.mode != 5) {
      this.load();
    }
  }

  public read(): number {
    this.sync();

    if (!this.outputLatched) {
      this.outputLatch = this.countingElement;
    }

    if (this.statusLatched) {
      this.statusLatched = false;
      return this.statusLatch;
    }

    // Modify output latch if mode = 3.
    let outputLatch = this.outputLatch;
    if (this.mode == 3) {
      if (outputLatch > this.countRegister / 2) {
        outputLatch = outputLatch - this.countRegister / 2;
      }
      outputLatch *= 2;
    }

    switch ((this.controlWord & 0x30) >> 4) {
      case 0:
        return 0xff;

      case 1:
        this.outputLatched = false;
        return outputLatch & 0xff;
      case 2:
        this.outputLatched = false;
        return outputLatch >> 8;
      case 3:
        if (this.readPhase == Phase.LOW) {
          this.readPhase = Phase.HI;
          return outputLatch & 0xff;
        }
        this.outputLatched = false;
        this.readPhase = Phase.LOW;
        return outputLatch >> 8;
    }

    return 0xff;
  }

  public load(): void {
    this.countingElement = this.countRegister;

    this.outPhase = 1;

    switch (this.mode) {
      case 0:
      case 1:
        this.endOutPhase1 = 0;
        break;
      case 2:
        this.endOutPhase1 = 2;
        this.endOutPhase2 = 1;
        break;
      case 3:
        this.endOutPhase1 = 1 + (this.countRegister + 1) / 2;
        this.endOutPhase2 = 1;
        break;
      case 4:
      case 5:
        this.endOutPhase1 = 1;
        this.endOutPhase2 = 0;
        break;
    }

    // Force exit from timer loop
    this.insideTimerLoop = 0;

    this.setTimeout();
  }

  private onTimer(time: number): void {
    this.sync();
  }

  private sync(): void {
    // If sync is called recursively, return
    if (this.insideTimerLoop) {
      return;
    }

    let elapsedTime = this.counter.elapsed();
    const mode = this.mode;

    // If timer is disabled, return 
    if (mode != 1 && mode != 5 && !this.gate) {
      return;
    }

    this.insideTimerLoop = 1;

    while (this.insideTimerLoop) {
      if (this.outPhase == 0) {
        this.countingElement -= elapsedTime;
        break;
      }

      if (this.outPhase == 1) {
        if (elapsedTime < this.countingElement - this.endOutPhase1) {
          this.countingElement -= elapsedTime;
          this.setTimeout();
          break;
        }

        if (mode == 0 || mode == 1) {
          this.outPhase = 0;
          this.countingElement -= elapsedTime;
          this.setOutput(1);
          break;
        }

        elapsedTime -= this.countingElement - this.endOutPhase1;
        this.countingElement = this.endOutPhase1;
        this.outPhase = 2;
        this.setOutput(10);
        continue;
      }

      if (this.outPhase == 2) {
        if (elapsedTime < this.countingElement - this.endOutPhase2) {
          this.countingElement -= elapsedTime;
          this.setTimeout();
          break;
        }

        if (mode == 4 || mode == 5) {
          this.outPhase = 0;
          this.countingElement -= elapsedTime;
          this.setOutput(1);
          break;
        }

        elapsedTime -= this.countingElement - this.endOutPhase2;
        this.countingElement = this.endOutPhase2;
        this.outPhase = 1;
        this.setOutput(1);
        this.countingElement = this.countRegister;
        if (mode == 3) {
          this.endOutPhase1 = (this.countRegister + 1) / 2;
        }
        continue;
      }
    }

    this.insideTimerLoop = 0;
  }

  private setTimeout(): void {
    let nextTimeout = 0;
    const mode = this.mode;

    // If counter is disabled, just return
    if (mode != 1 && mode != 5 && !this.gate) {
      return;
    }

    if (this.outPhase == 1) {
      nextTimeout = this.countingElement - this.endOutPhase1;
    }
    else if (this.outPhase == 2) {
      nextTimeout = this.countingElement - this.endOutPhase2;
    }

    if (nextTimeout != 0) {
      const time = this.board.getSystemTime() +
        this.board.getSystemFrequency() * nextTimeout / this.frequency | 0;
      this.timer.setTimeout(time);
    }
  }

  public setOutput(state: number): void {
    if (state != this.outputState) {
      this.out && this.out(state);
    }
    this.outputState = state;
  }

  public setControl(value: number) {
    this.sync();

    this.controlWord = value;

    if ((value & 0x30) == 0x00) {
      this.latchOutput();
    }
    else {
      this.writePhase = Phase.LOW;
      this.mode = (value & (value & 0x04 ? 0x06 : 0x0e)) >> 1;
      this.setOutput(this.mode == 0 ? 0 : 1);
    }
  }

  public setGate(state: boolean) {
    this.sync();

    if (this.gate == state) {
      return;
    }

    this.gate = state;

    if (this.mode & 0x02) {
      if (state) {
        this.load();
      }
      else {
        this.setOutput(1);
      }
    }
    else if (this.mode & 0x01) {
      if (state) {
        this.load();
      }
      if (this.mode == 1) {
        this.setOutput(0);
      }
    }

    if ((this.mode & 1) == 0 && this.gate) {
      this.insideTimerLoop = 0;
      this.setTimeout();
    }
  }

  public latchStatus() {
    this.sync();

    this.statusLatch = this.controlWord | (this.outputState ? 0x80 : 0);
    this.statusLatched = true;
  }

  public latchOutput() {
    this.sync();

    this.readPhase = Phase.LOW;
    this.outputLatch = this.countingElement;
    this.outputLatched = true;
  }

  public getState(): any {
    let state: any = {};

    state.countingElement = this.countingElement;
    state.outputLatch = this.outputLatch;
    state.countRegister = this.countRegister;
    state.controlWord = this.controlWord;
    state.statusLatch = this.statusLatch;

    state.outputLatched = this.outputLatched;
    state.statusLatched = this.statusLatched;
    state.readPhase = this.readPhase;
    state.writePhase = this.writePhase;
    state.mode = this.mode;
    state.gate = this.gate;

    state.counterLatched = this.counterLatched;

    state.outputState = this.outputState;

    state.outPhase = this.outPhase;
    state.endOutPhase1 = this.endOutPhase1;
    state.endOutPhase2 = this.endOutPhase2;

    state.insideTimerLoop = this.insideTimerLoop;

    state.counter = this.counter.getState();
    state.timer = this.timer.getState();

    return state;
  }

  public setState(state: any): void {
    this.countingElement = state.countingElement;
    this.outputLatch = state.outputLatch;
    this.countRegister = state.countRegister;
    this.controlWord = state.controlWord;
    this.statusLatch = state.statusLatch;

    this.outputLatched = state.outputLatched;
    this.statusLatched = state.statusLatched;
    this.readPhase = state.readPhase;
    this.writePhase = state.writePhase;
    this.mode = state.mode;
    this.gate = state.gate;

    this.counterLatched = state.counterLatched;

    this.outputState = state.outputState;

    this.outPhase = state.outPhase;
    this.endOutPhase1 = state.endOutPhase1;
    this.endOutPhase2 = state.endOutPhase2;

    this.insideTimerLoop = state.insideTimerLoop;

    this.counter.setState(state.counter);
    this.timer.setState(state.timer);
  }

  private countingElement = 0;
  private outputLatch = 0;
  private countRegister = 0;
  private controlWord = 0;
  private statusLatch = 0;

  private outputLatched = false;
  private statusLatched = false;
  private readPhase = Phase.NONE;
  private writePhase = Phase.NONE;
  private mode = 0;
  private gate = false;

  private counterLatched = 0;

  private outputState = 0;

  private outPhase = 0;
  private endOutPhase1 = 0;
  private endOutPhase2 = 0;

  private insideTimerLoop = 0;

  private counter: Counter;
  private timer: Timer;
}

export enum I8254Counter { COUNTER_1 = 0, COUNTER_2 = 1, COUNTER_3 = 2 };

export class I8254 {
  constructor(
    board: Board,
    frequency: number,
    out1?: (state: number) => void,
    out2?: (state: number) => void,
    out3?: (state: number) => void
  ) {
    this.counters[I8254Counter.COUNTER_1] = new InternalCounter(board, frequency, out1);
    this.counters[I8254Counter.COUNTER_2] = new InternalCounter(board, frequency, out2);
    this.counters[I8254Counter.COUNTER_3] = new InternalCounter(board, frequency, out3);
  }

  public reset(): void {
    for (const counter of this.counters) {
      counter.reset();
    }
  }

  public read(port: number): number {
    switch (port & 3) {
      case 0:
      case 1:
      case 2:
        return this.counters[port & 3].read();
      default:
        return 0xff;
    }
  }

  public write(port: number, value: number): void {
    switch (port & 3) {
      case 0:
      case 1:
      case 2:
        this.counters[port & 3].write(value);
        break;
      case 3:
        let counter = value >> 6;
        if (counter < 3) {
          this.counters[counter].setControl(value & 0x3f);
        } else {
          if (value & 0x02) {
            if (~value & 0x10) this.counters[0].latchOutput();
            if (~value & 0x20) this.counters[0].latchStatus();
          }
          if (value & 0x04) {
            if (~value & 0x10) this.counters[1].latchOutput();
            if (~value & 0x20) this.counters[1].latchStatus();
          }
          if (value & 0x08) {
            if (~value & 0x10) this.counters[2].latchOutput();
            if (~value & 0x20) this.counters[3].latchStatus();
          }
        }
        break;
    }
  }

  public getFrequency(counter: I8254Counter): number {
    return this.counters[counter].getFrequency() || 0;
  }

  public setGate(counter: I8254Counter, state: boolean): void {
    this.counters[counter].setGate(state);
  }
  public getState(): any {
    let state: any = {};

    state.counters = []
    for (let i = 0; i < this.counters.length; i++) {
      state.counters[i] = this.counters[i].getState();
    }

    return state;
  }

  public setState(state: any): void {
    for (let i = 0; i < this.counters.length; i++) {
      this.counters[i].setState(state.counters[i]);
    }
  }

  private counters = new Array<InternalCounter>(3);
}
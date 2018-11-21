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
import { AudioManager } from './audiomanager';
import { IoManager, Port } from './iomanager';
import { SlotManager } from './slotmanager';
import { TimeoutManager } from './timeoutmanager';

export enum InterruptVector {
  VDP_IE0 = 0x0001,
  VDP_IE1 = 0x0002,
  RS232 = 0x0004,
  YMF262 = 0x0008,
  Y8950 = 0x0010,
  MSX_AUDIO = 0x0020,
  MIDI_TMR = 0x0040,
  MIDI_RXRDY = 0x0080,
  NET = 0x0100,
  VM2151 = 0x0200,
  SFG05 = 0x0400,
};


// This class emulates a generic board with a Z80 processor with modular
// interfaces to plug in IO devices and memory devices. The class also provides
// a timeout service for emulated devices to register callbacks at some given
// time (in the emulated time space).
export class Board {
  constructor(cpuFlags: number, enableSubslots: boolean) {
    this.ioManager = new IoManager(enableSubslots);
    this.slotManager = new SlotManager();
    this.timeoutManager = new TimeoutManager();
    this.audioManager = new AudioManager(this);

    this.z80 = new Z80(cpuFlags, this.slotManager.read, this.slotManager.write, this.ioManager.read, this.ioManager.write, this.timeoutManager.timeout);
    this.timeoutManager.initialize(this.z80);
  }

  public getIoManager(): IoManager {
    return this.ioManager;
  }

  public getSlotManager(): SlotManager {
    return this.slotManager;
  }

  public getZ80(): Z80 {
    return this.z80;
  }

  public getTimeoutManager(): TimeoutManager {
    return this.timeoutManager;
  }

  public getSystemTime(): number {
    return this.z80.getSystemTime();
  }

  public getSystemFrequency(): number {
    return this.z80.getSystemFrequency();
  }

  public getTimeSince(time: number): number {
    return this.z80.getSystemTime() - time & TIMER_RANGE;
  }

  public reset(): void {
    this.interruptMask = 0;
    this.z80.reset();
  }

  public setInt(vector: InterruptVector): void {
    this.interruptMask |= vector;
    this.z80.setInt();
  }

  public clearInt(vector: InterruptVector): void {
    this.interruptMask &= ~vector;
    if (!this.interruptMask) {
      this.z80.clearInt();
    }
  }

  public getAudioManager(): AudioManager {
    return this.audioManager;
  }

  public syncAudio(): void {
    this.audioManager.sync();
  }

  public run(cpuCycles?: number): void {
    this.z80.execute(cpuCycles);
  }

  private ioManager: IoManager;
  private slotManager: SlotManager;
  private timeoutManager: TimeoutManager;
  private audioManager: AudioManager;
  private z80: Z80;
  private interruptMask = 0;
}

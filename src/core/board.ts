﻿//////////////////////////////////////////////////////////////////////////////
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
import { LedManager } from './ledmanager';
import { IoManager, Port } from './iomanager';
import { SlotManager } from './slotmanager';
import { TimeoutManager } from './timeoutmanager';
import { WebAudio } from '../audio/webaudio';
import { RamManager } from './rammanager';
import { DramManager } from './drammanager';

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

const CLOCK_FREQ = 3579545;


// This class emulates a generic board with a Z80 processor with modular
// interfaces to plug in IO devices and memory devices. The class also provides
// a timeout service for emulated devices to register callbacks at some given
// time (in the emulated time space).
export class Board {
  constructor(
    webAudio: WebAudio,
    private ledManager: LedManager,
    cpuFlags: number,
    enableSubslots: boolean,
    enableRamManager: boolean = false,
    enableDramManager: boolean = false
  ) {
    this.ioManager = new IoManager(enableSubslots);
    this.slotManager = new SlotManager();
    this.timeoutManager = new TimeoutManager();
    if (enableRamManager) {
      this.ramManager = new RamManager(this.ioManager);
    }
    if (enableDramManager) {
      this.dramManager = new DramManager();
    }

    this.z80 = new Z80(cpuFlags, this.slotManager.read, this.slotManager.write, this.ioManager.read, this.ioManager.write, this.timeoutManager.timeout);
    this.timeoutManager.initialize(this.z80);

    this.audioManager = new AudioManager(webAudio, this);

    this.ledManager.setAll(false);
  }

  public getIoManager(): IoManager {
    return this.ioManager;
  }

  public getSlotManager(): SlotManager {
    return this.slotManager;
  }

  public getRamManager(): RamManager | undefined {
    return this.ramManager;
  }

  public getDramManager(): DramManager | undefined {
    return this.dramManager;
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

  public getTimeDelta(startTime: number, endTime: number): number {
    return endTime - startTime & TIMER_RANGE;
  }

  public getTimeSince(time: number): number {
    return this.z80.getSystemTime() - time & TIMER_RANGE;
  }

  public reset(): void {
    this.interruptMask = 0;
    this.z80.reset();
  }

  public getInt(vector: InterruptVector): boolean {
    return (this.interruptMask & vector) != 0;
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

  public getLedManager(): LedManager {
    return this.ledManager;
  }

  public setZ80Freq15(enable15: boolean) {
    this.z80.setFrequency(enable15 ? CLOCK_FREQ * 1.5 | 0 : CLOCK_FREQ);
  }

  public getFromSwitch(): boolean {
    // TODO: Control this switch from Emulator UI
    return false;
  }

  public getRamPage(page: number): Uint8Array | undefined {
    if (!this.mainRam || page >= this.mainRam.length) {
      return undefined;
    }
    if (page < 0) {
      page += this.mainRam.length;
    }
    return this.mainRam[page];
  }

  public setMainRam(ramPages: Array<Uint8Array>): void {
    this.mainRam = ramPages;
  }

  public run(cpuCycles?: number): void {
    this.z80.execute(cpuCycles);
  }

  public dumpAsm(count: number): void {
    this.z80.dumpAsm(count);
  }

  public getState(): any {
    let state: any = {};

    state.interruptMask = this.interruptMask;

    state.z80 = this.z80.getState();
    state.slotManager = this.slotManager.getState();
    state.timeoutManager = this.timeoutManager.getState();
    if (this.ramManager) {
      state.ramManager = this.ramManager.getState();
    }
    state.audioManager = this.audioManager.getState();

    return state;
  }

  public setState(state: any): void {
    this.interruptMask = state.interruptMask;

    this.z80.setState(state.z80);
    this.slotManager.setState(state.slotManager);
    this.timeoutManager.setState(state.timeoutManager);
    if (this.ramManager) {
      this.ramManager.setState(state.ramManager);
    }
    this.audioManager.setState(state.audioManager);
  }
  
  public mapRamSlots(): void {
    this.slotManager.mapRamSlots();
  }
  
  private ioManager: IoManager;
  private slotManager: SlotManager;
  private timeoutManager: TimeoutManager;
  private ramManager?: RamManager;
  private dramManager?: DramManager;
  private audioManager: AudioManager;
  private z80: Z80;
  private interruptMask = 0;
  private mainRam?: Array<Uint8Array>;
}

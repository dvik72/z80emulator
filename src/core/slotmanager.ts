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

import { SaveState } from './savestate';

const EMPTY_RAM = new Uint8Array(0x4000);

export class Slot {
  constructor(
    public description: string,
    public readCb?: (a: number) => number,
    public writeCb?: (a: number, v: number) => void,
    public ejectCb?: () => void) {
    this.readCb = readCb;
    this.writeCb = writeCb;
    this.ejectCb = ejectCb;
  }

  map(readEnable: boolean, writeEnable: boolean, pageData?: Uint8Array) {
    this.pageData = pageData ? pageData : EMPTY_RAM;
    this.writeEnable = writeEnable;
    this.readEnable = readEnable;
  }

  unmap(): void {
    this.pageData = EMPTY_RAM;
    this.writeEnable = false;
    this.readEnable = false;
  }

  public pageData = EMPTY_RAM;
  public writeEnable = false;
  public readEnable = false;
  public fullAddress = false;
}

class RamSlot {
  slot = 0;
  sslot = 0;
  slotInfo = new Slot('Undefined');
}

class SlotState {
  constructor(
    public subslotted: boolean,
    public state: number,
    public substate: number,
    public sslReg: number
  ) {
  }


  public getState(): any {
    let state: any = {};

    state.subslotted = this.subslotted;
    state.state = this.state;
    state.substate = this.substate;
    state.sslReg = this.sslReg;

    return state;
  }

  public setState(state: any): void {
    this.subslotted = state.subslotted;
    this.state = state.state;
    this.substate = state.substate;
    this.sslReg = state.sslReg;
  }
}

export class SlotManager {
  constructor() {
    this.read = this.read.bind(this);
    this.write = this.write.bind(this);
    this.reset();
  }

  private reset(): void {
    for (let i = 0; i < 4; i++) this.pslot[i] = new SlotState(false, 0, 0, 0);

    for (let i = 0; i < 4; i++) {
      this.slotTable[i] = new Array<Slot[]>(4);
      for (let j = 0; j < 4; j++) {
        this.slotTable[i][j] = new Array<Slot>(8);
        for (let k = 0; k < 8; k++) {
          this.slotTable[i][j][k] = new Slot('Unmapped');
        }
      }
    }

    for (let i = 0; i < 8; i++) {
      this.ramslot[i] = new RamSlot();
      this.ramslot[i].slotInfo = this.slotTable[0][0][i];
    }
  }

  public registerSlot(slot: number, sslot: number, page: number, slotInfo: Slot) {
    this.slotTable[slot][sslot][page] = slotInfo;

    // Update ram mapping if slot is currently mapped to main memory.
    for (let ramslot of this.ramslot) {
      if (ramslot.slot == slot && ramslot.sslot == sslot) {
        this.mapRamPage(slot, sslot, page);
      }
    }
  }

  public remove(slot: number, sslot: number): void {
    for (let page = 0; page < 8; page++) {
      let slotInfo = this.slotTable[slot][sslot][page];
      if (slotInfo.ejectCb) {
        slotInfo.ejectCb();
      }
    }
  }

  public registerWrite0Callback(writeCb: (a: number, v: number) => void): void {
    this.write0Cb = writeCb;
  }

  public unregisterWrite0Callback(): void {
    this.write0Cb = undefined;
  }

  public read(address: number): number {
    if (address == 0xffff) {
      const sslReg = this.pslot[3].state;
      if (this.pslot[sslReg].subslotted) {
        return ~this.pslot[sslReg].sslReg & 0xff;
      }
    }

    if (this.ramslot[address >> 13].slotInfo.readEnable) {
      const slotInfo = this.ramslot[address >> 13].slotInfo;
      return slotInfo.pageData[address & 0x1fff];
    }

    const psl = this.pslot[address >> 14].state;
    const ssl = this.pslot[psl].subslotted ? this.pslot[address >> 14].substate : 0;

    const slotInfo = this.slotTable[psl][ssl][address >> 13];

    if (slotInfo.readCb) {
      const mask = slotInfo.fullAddress ? 0xffff : 0x1fff;
      return slotInfo.readCb(address & mask);
    }

    return 0xff;
  }

  public write(address: number, value: number): void {
    if (address == 0xffff) {
      const pslReg = this.pslot[3].state;

      if (this.pslot[pslReg].subslotted) {
        this.pslot[pslReg].sslReg = value;

        for (let page = 0; page < 4; page++) {
          if (this.pslot[page].state == pslReg) {
            this.pslot[page].substate = value & 3;
            this.mapRamPage(pslReg, value & 3, 2 * page);
            this.mapRamPage(pslReg, value & 3, 2 * page + 1);
          }
          value >>= 2;
        }

        return;
      }
    }

    if (address == 0) {
      if (this.write0Cb) {
        this.write0Cb(address, value);
        return;
      }
    }

    if (this.ramslot[address >> 13].slotInfo.writeEnable) {
      this.ramslot[address >> 13].slotInfo.pageData[address & 0x1FFF] = value;
      return;
    }

    const psl = this.pslot[address >> 14].state;
    const ssl = this.pslot[psl].subslotted ? this.pslot[address >> 14].substate : 0;

    let slotInfo = this.slotTable[psl][ssl][address >> 13];

    if (slotInfo.writeCb) {
      const mask = slotInfo.fullAddress ? 0xffff : 0x1fff;
      slotInfo.writeCb(address & mask, value);
    }
  }

  public mapRamPage(slot: number, sslot: number, page: number): void {
    this.ramslot[page].slot = slot;
    this.ramslot[page].sslot = sslot;
    this.ramslot[page].slotInfo = this.slotTable[slot][sslot][page];
  }

  public setRamSlot(slot: number, psl: number): void {
    this.pslot[slot].state = psl;
    this.pslot[slot].substate = (this.pslot[psl].sslReg >> (slot * 2)) & 3;

    const ssl = this.pslot[psl].subslotted ? this.pslot[slot].substate : 0;

    this.mapRamPage(psl, ssl, 2 * slot);
    this.mapRamPage(psl, ssl, 2 * slot + 1);
  }

  public getRamSlot(page: number): number {
    for (let i = 0; i < 4; i++) {
      if (this.pslot[i].state == page) {
        return i;
      }
    }
    return 0;
  }

  public setSubslotted(slot: number, subslotted: boolean): void {
    this.pslot[slot].subslotted = subslotted;
  }

  public mapRamSlots(): void {
    for (let page = 0; page < 4; page++) {
      const psl = this.pslot[page].state;
      const ssl = this.pslot[psl].subslotted ? this.pslot[page].substate : 0;

      this.mapRamPage(psl, ssl, 2 * page);
      this.mapRamPage(psl, ssl, 2 * page + 1);
    }
  }

  public getState(): any {
    let state: any = {};

    state.pslot = [];
    for (let i = 0; i < this.pslot.length; i++) {
      state.pslot[i] = this.pslot[i].getState();
    }

   return state;
  }

  public setState(state: any): void {
    for (let i = 0; i < this.pslot.length; i++) {
      this.pslot[i].setState(state.pslot[i]);
    }
  }

  private pslot: SlotState[] = new Array<SlotState>(4);
  private ramslot: RamSlot[] = new Array<RamSlot>(8);
  private slotTable: Slot[][][] = new Array<Slot[][]>(4);

  private write0Cb?: (a: number, v: number) => void = undefined;
}

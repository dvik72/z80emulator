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

// Minimal functional emulation of MSX. 
// The emulation is not complete, but it includes enough features
// to run dos programs and cartridges up to 64kB.

import { Z80, CPU_VDP_IO_DELAY } from '../z80/z80';
import { msxDosRom } from './msxDosRom';


class Vdp {
  constructor() {
    for (let i = 0; i < 8; i++) {
      this.regs[i] = 0;
    }
  }

  status: number = 0;
  latch: number = 0;
  address: number = 0;
  data: number = 0;
  regs: number[] = new Array<number>(8);
  key: number = 0;
}

class Ppi {
  constructor() {
    for (let i = 0; i < 4; i++) {
      this.regs[i] = 0;
    }
  }

  regs: number[] = new Array<number>(4);
}

const keyMatrix = [ 
  0xffff, 0xffff, 0xffff, 0xffff, 0xffff, 0xffff, 0xffff, 0xffff, 0xff75, 0xffff, 0xff77, 0xffff, 0xffff, 0xff77, 0xffff, 0xffff,
  0xffff, 0xffff, 0xffff, 0xffff, 0xffff, 0xffff, 0xffff, 0xffff, 0xffff, 0xffff, 0xffff, 0xffff, 0xff85, 0xff86, 0xff84, 0xff87,

  0xff80, 0x6001, 0x6020, 0x6003, 0x6004, 0x6005, 0x6007, 0xff20, 0x6011, 0x6000, 0x6010, 0x6013, 0xff22, 0xff12, 0xff23, 0xff24,
  0xff00, 0xff01, 0xff02, 0xff03, 0xff04, 0xff05, 0xff06, 0xff07, 0xff10, 0xff11, 0x6017, 0xff17, 0x6022, 0xff13, 0x6023, 0x6024,

  0x6002, 0x6026, 0x6027, 0x6030, 0x6031, 0x6032, 0x6033, 0x6034, 0x6035, 0x6036, 0x6037, 0x6040, 0x6041, 0x6042, 0x6043, 0x6044,
  0x6045, 0x6046, 0x6047, 0x6050, 0x6051, 0x6052, 0x6053, 0x6054, 0x6055, 0x6056, 0x6057, 0xff16, 0xff14, 0xff21, 0x6006, 0x6012,

  0xff72, 0xff26, 0xff27, 0xff30, 0xff31, 0xff32, 0xff33, 0xff34, 0xff35, 0xff36, 0xff37, 0xff40, 0xff41, 0xff42, 0xff43, 0xff44,
  0xff45, 0xff46, 0xff47, 0xff50, 0xff51, 0xff52, 0xff53, 0xff54, 0xff55, 0xff56, 0xff57, 0x6016, 0x6014, 0x6021, 0x6072, 0xff75,

  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
];

export class NanoMsx {
  constructor() {
    // Inithialize the memory map.
    for (let i = 0; i < 4; i++) {
      this.memory[i] = new Array<number[]>(4);
    }

    this.readMemory = this.readMemory.bind(this);
    this.writeMemory = this.writeMemory.bind(this);
    this.readIoPort = this.readIoPort.bind(this);
    this.writeIoPort = this.writeIoPort.bind(this);
    this.timeout = this.timeout.bind(this);

    const cpuFlagsMsx1 = CPU_VDP_IO_DELAY;
    this.z80 = new Z80(cpuFlagsMsx1, this.readMemory, this.writeMemory, this.readIoPort, this.writeIoPort, this.timeout);
  }

  run(): void {
    this.initMemory();
    this.mapSystemRom(msxDosRom);

    this.z80Timeout = this.z80Frequency / 50 | 0;
    this.emuTime = this.gettime();
    this.syncTime = this.emuTime + 20000;
    this.z80.setTimeoutAt(this.z80Timeout);

    this.z80.reset();
    this.z80.execute();
  }

  private vdp: Vdp = new Vdp();
  private ppi: Ppi = new Ppi();

  private memory: number[][][] = new Array<number[][]>(4);
  private slot: number[] = new Array<number>(4);
  private mappedMemory: number[][] = new Array<number[]>(4);
  private ram: number[][] = new Array<number[]>(4);
  private vram: number[] = new Array<number>(0x4000);
  private empty: number[] = new Array<number>(0x4000);

  private z80Timeout = 0;
  private z80Frequency = 3579545;
  private frameCounter = 0;
  private syncTime = 0;
  private emuTime = 0;
  private keyPressed = 0xffff;
  private verbose = 0;
  private normalSpeed = 0;
  private vramDirtyFlag = 1;

  private z80: Z80;

  private screenBuffer: string = '';

  private readIoPort(port: number): number {
    switch (port & 0xff) {
      case 0xa8:
        return this.ppi.regs[3] & 0x10 ? 0xff : this.ppi.regs[0];
      case 0xa9:
        if (this.ppi.regs[3] & 0x02) {
          const row = (this.ppi.regs[3] & 0x01 ? 0x00 : this.ppi.regs[2]) & 0x0f;
          let val = 0;
          if (((this.keyPressed >> 4) & 0x0f) == row) val |= 1 << ((this.keyPressed >> 0) & 0x0f);
          if (((this.keyPressed >> 12) & 0x0f) == row) val |= 1 << ((this.keyPressed >> 8) & 0x0f);
          return ~val;
        }
        return this.ppi.regs[1];
      case 0xaa:
        return ((this.ppi.regs[3] & 0x01 ? 0xff : this.ppi.regs[2]) & 0x0f) |
          ((this.ppi.regs[3] & 0x08 ? 0xff : this.ppi.regs[2]) & 0xf0);
      case 0xab:
        return this.ppi.regs[3];
      case 0x98:
        {
          const value = this.vdp.data;
          this.vdp.data = this.vram[this.vdp.address++ & 0x3fff];
          this.vdp.key = 0;
          return value;
        }
      case 0x99:
        {
          const status = this.vdp.status;
          this.vdp.status &= 0x1f;
          this.z80.clearInt();
          return status;
        }
    }
    return 0xff;
  }

  private writeIoPort(port: number, value: number): void {
    switch (port & 0xff) {
      case 0xa8:
        this.ppi.regs[0] = value;
        this.updadeSlots();
        break;
      case 0xa9:
      case 0xaa:
        this.ppi.regs[port & 0x03] = value;
        break;
      case 0xab:
        if (value & 0x80) {
          this.ppi.regs[3] = value;
          this.updadeSlots();
        }
        else {
          const mask = 1 << ((value >> 1) & 0x07);
          if (value & 1) {
            this.ppi.regs[2] |= mask;
          }
          else {
            this.ppi.regs[2] &= ~mask;
          }
        }
        break;
      case 0x98:
        this.vramDirtyFlag = 1;
        this.vram[this.vdp.address++ & 0x3fff] = value;
        this.vdp.key = 0;
        this.vdp.data = value;
        break;
      case 0x99:
        if (this.vdp.key) {
          this.vdp.key = 0;
          this.vdp.address = (value << 8 | this.vdp.latch) & 0xffff;
          if ((value & 0xc0) == 0x80) {
            this.vdp.regs[value & 0x07] = this.vdp.latch;
            this.vramDirtyFlag = 1;
          }
          if ((value & 0xc0) == 0x00) {
            this.readIoPort(0x98);
          }
        }
        else {
          this.vdp.key = 1;
          this.vdp.latch = value;
        }
        break;
    }
  }

  private readMemory(address: number): number {
    return this.mappedMemory[address >> 14][address & 0x3fff];
  }

  private writeMemory(address: number, value: number): void {
    const page = address >> 14;
    if (this.slot[page] == 3) {
      this.mappedMemory[page][address & 0x3fff] = value;
    }
  }

  private updadeSlots(): void {
    let slotMask = (this.ppi.regs[3] & 0x10) ? 0 : this.ppi.regs[0];
    for (let i = 0; i < 4; i++) {
      this.mappedMemory[i] = this.memory[(slotMask & 3)][i];
      slotMask >>= 2;
      this.slot[i] = (this.ppi.regs[0] >> (i << 1)) & 3;
    }
  }

  private timeout(): void {
    this.vdp.status |= 0x80;
    if (this.vdp.regs[1] & 0x20) {
      this.z80.setInt();
    }

    this.keyPressed = keyMatrix[this.pollkbd()];

    if (this.vramDirtyFlag && (this.frameCounter & 3) == 0) {
      this.vramDirtyFlag = 0;
      this.renderScreen();
    }

    if (this.normalSpeed) {
      const diffTime = this.syncTime - this.gettime();
      if (diffTime > 0) {
        this.delay(diffTime / 1000);
      }
      this.syncTime += 20000;
    }

    if (++this.frameCounter == 50) {
      const diffTime = this.gettime() - this.emuTime;

      this.frameCounter = 0;

      if (!this.normalSpeed) {
        this.z80Frequency = this.z80Frequency * 1000000 / diffTime;
      }
      this.emuTime += diffTime;
    }

    this.z80Timeout += this.z80Frequency / 50 | 0;
    this.z80.setTimeoutAt(this.z80Timeout);
  }

  private initMemory(): void {
    // Initialize empty/unmapped rom block
    for (let i = 0; i < 0x4000; i++) {
      this.empty[i] = 0xff;
    }

    // Initialize RAM blocks
    for (let page = 0; page < 4; page++) {
      this.ram[page] = new Array<number>(0x4000);
      for (let i = 0; i < 0x4000; i++) {
        this.ram[page][i] = 0;
      }
    }

    for (let slot = 0; slot < 4; slot++) {
      for (let page = 0; page < 4; page++) {
        if (slot < 3) {
          this.memory[slot][page] = this.empty;
        } else {
          this.memory[slot][page] = this.ram[page];
        }
      }
    }

    for (let page = 0; page < 4; page++) {
      this.ram[page] = this.memory[0][page];
    }
  }

  private mapSystemRom(rom: number[]): void {
    this.memory[0][0] = rom;
  }

  private pollkbd(): number {
    return 0;
  }

  private gettime(): number {
    return new Date().getTime();
  }

  private delay(ms: number): void {
//    const wait = (ms) => new Promise(res => setTimeout(res, ms));
//    await wait(ms);
  }

  private renderScreen() {
    const width = (this.vdp.regs[1] & 0x10) ? 40 : 32;
    let offset = (this.vdp.regs[2] & 0x0f) << 10;
    let buf = '';

    for (let y = 0; y < 24; y++) {
      for (let x = 0; x < width; x++) {
        const val = this.vram[offset++ & 0x3fff];
        buf += val >= 32 && val < 126 ? String.fromCharCode(val) : val == 0xff ? '_' : ' ';
      }
      if (width == 32) {
        buf += '        ';
      }
      buf += '\n';
    }

    if (buf == this.screenBuffer) {
      this.screenBuffer = buf;
      document.body.innerHTML = this.screenBuffer;
    }
  }
}

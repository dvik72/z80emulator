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
import { SlotManager } from '../mappers/slotmanager';
import { MsxPpi } from '../io/msxppi';
import { MapperRomBasic } from '../mappers/rombasic';
import { MapperRamNormal } from '../mappers/ramnormal';
import { msxDosRom } from './msxDosRom';


class Vdp {
  status: number = 0;
  latch: number = 0;
  address: number = 0;
  data: number = 0;
  regs: number[] = [0x00, 0x10, 0xff, 0xff, 0xff, 0xff, 0x00, 0x00];
  key: number = 0;
}

export class NanoMsx {
  constructor() {
    this.slotManager = new SlotManager();

    this.mapMemorySlot = this.mapMemorySlot.bind(this);
    this.msxPpi = new MsxPpi(this.mapMemorySlot);

    const cpuFlagsMsx1 = CPU_VDP_IO_DELAY;
    this.readMemory = this.readMemory.bind(this);
    this.writeMemory = this.writeMemory.bind(this);
    this.readIoPort = this.readIoPort.bind(this);
    this.writeIoPort = this.writeIoPort.bind(this);
    this.timeout = this.timeout.bind(this);
    this.z80 = new Z80(cpuFlagsMsx1, this.readMemory, this.writeMemory, this.readIoPort, this.writeIoPort, this.timeout);
  }

  run(): void {
    // Initialize MSX 1 machine configuration
    this.msxRom = new MapperRomBasic(this.slotManager, 0, 0, 0, msxDosRom);
    this.ram = new MapperRamNormal(this.slotManager, 0, 3, 0, 0x10000);

    this.z80Timeout = this.z80Frequency / 50 | 0;
    this.emuTime = this.gettime();
    this.syncTime = this.emuTime + 20000;
    this.z80.setTimeoutAt(this.z80Timeout);

    this.msxPpi.reset();

    this.z80.reset();
    this.z80.execute();
  }

  private ram?: MapperRamNormal;
  private msxRom?: MapperRomBasic;

  private vdp: Vdp = new Vdp();

  private vram: number[] = new Array<number>(0x4000);

  private z80Timeout = 0;
  private z80Frequency = 3579545;
  private frameCounter = 0;
  private syncTime = 0;
  private emuTime = 0;
  private keyPressed = 0xffff;
  private verbose = 0;
  private normalSpeed = 0;
  private vramDirtyFlag = 1;

  private slotManager: SlotManager;
  private msxPpi: MsxPpi;
  private z80: Z80;

  private screenBuffer: string = '';

  private mapMemorySlot(slot: number, sslot: number): void {
    this.slotManager.setRamSlot(slot, sslot);
  }

  private readIoPort(port: number): number {
    switch (port & 0xff) {
      case 0xa8:
      case 0xa9:
      case 0xaa:
      case 0xab:
        return this.msxPpi.read(port & 3);
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
    console.log('Write Io:  ' + ('0000' + port.toString(16)).slice(-4) + ' : ' + ('00' + (value).toString(16)).slice(-2));

    switch (port & 0xff) {
      case 0xa8:
      case 0xa9:
      case 0xaa:
      case 0xab:
        this.msxPpi.write(port & 3, value);
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
            console.log('VDP REG ' + ('0000' + (value & 0x07).toString(16)).slice(-2) + ': ' + ('0000' + this.vdp.latch.toString(16)).slice(-2));
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
    return this.slotManager.read(address);
  }

  private writeMemory(address: number, value: number): void {
    return this.slotManager.write(address, value);
  }

  private timeout(): void {
    this.vdp.status |= 0x80;
    if (this.vdp.regs[1] & 0x20) {
      this.z80.setInt();
    }

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
//        this.z80Frequency = this.z80Frequency * 1000000 / diffTime;
      }
      this.emuTime += diffTime;
    }

    this.z80Timeout = this.z80Timeout + this.z80Frequency / 50 & 0xfffffff;
    this.z80.setTimeoutAt(this.z80Timeout);
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

    if (buf != this.screenBuffer) {
      this.screenBuffer = buf;
      document.body.innerHTML = this.screenBuffer;
    }
  }
}

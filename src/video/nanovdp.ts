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

import { Z80 } from '../z80/z80';
import { IoManager, Port } from '../core/iomanager';


// Minimal MSX1 VDP implementation, for testing mostly.
export class NanoVdp {
  constructor(
    private ioManager: IoManager,
    private z80: Z80) {
    this.read = this.read.bind(this);
    this.write = this.write.bind(this);

    this.ioManager.registerPort(0x98, new Port(this.read, this.write));
    this.ioManager.registerPort(0x99, new Port(this.read, this.write));
  }

  getStatus(): number { return this.status; }
  setStatusBit(value: number): void { this.status |= value; }
  getRegister(reg: number): number { return this.regs[reg]; }
  getVram(index: number): number { return this.vram[index & 0x3fff]; }
  isDirty(): boolean { return this.vramDirtyFlag; }
  clearDirty(): void { this.vramDirtyFlag = false; }

  private status: number = 0;
  private latch: number = 0;
  private address: number = 0;
  private data: number = 0;
  private regs: number[] = [0x00, 0x10, 0xff, 0xff, 0xff, 0xff, 0x00, 0x00];
  private key: number = 0;
  private vramDirtyFlag = false;
  private vram: number[] = new Array<number>(0x4000);

  private read(port: number): number {
    switch (port & 1) {
      case 0:
        {
          const value = this.data;
          this.data = this.vram[this.address++ & 0x3fff];
          this.key = 0;
          return value;
        }
      case 1:
        {
          const status = this.status;
          this.status &= 0x1f;
          this.z80.clearInt();
          return status;
        }
    }
    return 0xff;
  }

  private write(port: number, value: number): void {
    switch (port & 1) {
      case 0:
        this.vramDirtyFlag = true;
        this.vram[this.address++ & 0x3fff] = value;
        this.key = 0;
        this.data = value;
        break;
      case 1:
        if (this.key) {
          this.key = 0;
          this.address = (value << 8 | this.latch) & 0xffff;
          if ((value & 0xc0) == 0x80) {
            this.regs[value & 0x07] = this.latch;
            console.log('VDP REG ' + ('0000' + (value & 0x07).toString(16)).slice(-2) + ': ' + ('0000' + this.latch.toString(16)).slice(-2));
            this.vramDirtyFlag = true;
          }
          if ((value & 0xc0) == 0x00) {
            this.read(0);
          }
        }
        else {
          this.key = 1;
          this.latch = value;
        }
        break;
    }
  }
}

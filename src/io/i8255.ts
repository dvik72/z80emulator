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

import { SaveState } from '../core/savestate';

export class I8255 {
  constructor(
    private readA: () => number,
    private writeA: (v: number) => void,
    private readB: () => number,
    private writeB: (v: number) => void,
    private readCLo: () => number,
    private writeCLo: (v: number) => void,
    private readCHi: () => number,
    private writeCHi: (v: number) => void) {
    this.read = this.read.bind(this);
    this.write = this.write.bind(this);
  }

  reset(): void {
    this.regs[3] = 0x9b;
    this.write(0, 0);
    this.write(1, 0);
    this.write(2, 0);
  }

  read(port: number): number {
    port &= 0x03;

    switch (port) {
      case 0:
        switch (this.regs[3] & 0x60) {
          case 0x00: // MODE 0
            if (this.regs[3] & 0x10) {
              return this.readA() & 0xff;
            }
            return this.regs[0];

          case 0x20: // MODE 1
            return 0xff;

          default: // MODE 2
            return 0xff;
        }
        break;

      case 1:
        switch (this.regs[3] & 0x04) {
          case 0x00: // MODE 0
            if (this.regs[3] & 0x02) {
              return this.readB() & 0xff;
            }
            return this.regs[1];

          default: // MODE 1
            return 0xff;
        }
        break;

      case 2:
        let value = this.regs[2];

        if (this.regs[3] & 0x01) {
          value = (value & 0xf0) | (this.readCLo() & 0x0f);
        }
        if (this.regs[3] & 0x08) {
          value = (value & 0x0f) | ((this.readCHi() & 0x0f) << 4);
        }
        return value;

      case 3:
        return this.regs[3];
    }

    return 0xff;
  }

  write(port: number, value: number): void {
    port &= 0x03;
    value &= 0xff;

    switch (port) {
      case 0:
        switch (this.regs[3] & 0x60) {
          case 0x00: // MODE 0
            break;
          case 0x20: // MODE 1
            break;
          default: // MODE 2
            break;
        }

        this.regs[0] = value;

        if (!(this.regs[3] & 0x10)) {
          this.writeA(value);
        }
        return;

      case 1:
        switch (this.regs[3] & 0x04) {
          case 0x00: // MODE 0
            break;
          default: // MODE 1
            break;
        }

        this.regs[1] = value;

        if (!(this.regs[3] & 0x02)) {
          this.writeB(value);
        }
        return;

      case 2:
        this.regs[2] = value;

        if (!(this.regs[3] & 0x01)) {
          this.writeCLo(value & 0x0f);
        }
        if (!(this.regs[3] & 0x08)) {
          this.writeCHi(value >> 4);
        }
        return;

      case 3:
        if (value & 0x80) {
          this.regs[3] = value;
          this.write(0, this.regs[0]);
          this.write(1, this.regs[1]);
          this.write(2, this.regs[2]);
        }
        else {
          const mask = 1 << ((value >> 1) & 0x07);
          if (value & 0x01) {
            this.write(2, this.regs[2] | mask);
          }
          else {
            this.write(2, this.regs[2] & ~mask);
          }
        }
        return;
    }
  }

  public getState(): any {
    const state: any = {};

    state.regs = SaveState.getArrayState(this.regs);

    return state;
  }

  public setState(state: any): void {
    SaveState.setArrayState(this.regs, state.regs);
  }

  private regs = [0, 0, 0, 0];

}

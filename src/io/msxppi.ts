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

import { IoManager, Port } from '../core/iomanager';
import { SlotManager } from '../core/slotmanager';
import { I8255 } from './i8255';


export class MsxPpi {
  constructor(
    private ioManager: IoManager, 
    private slotManager: SlotManager) {
    this.readA = this.readA.bind(this);
    this.readB = this.readB.bind(this);
    this.readCLo = this.readCLo.bind(this);
    this.readCHi = this.readCHi.bind(this);
    this.writeA = this.writeA.bind(this);
    this.writeB = this.writeB.bind(this);
    this.writeCLo = this.writeCLo.bind(this);
    this.writeCHi = this.writeCHi.bind(this);

    this.i8255 = new I8255(this.readA, this.writeA, this.readB, this.writeB, this.readCLo, this.writeCLo, this.readCHi, this.writeCHi);
    this.ioManager.registerPort(0xa8, new Port(this.i8255.read, this.i8255.write));
    this.ioManager.registerPort(0xa9, new Port(this.i8255.read, this.i8255.write));
    this.ioManager.registerPort(0xaa, new Port(this.i8255.read, this.i8255.write));
    this.ioManager.registerPort(0xab, new Port(this.i8255.read, this.i8255.write));
  }

  private row = 0;
  private regA = 0;
  private regCHi = 0;
  private i8255: I8255;

  reset(): void {
    this.row = 0;
    this.regA = 0;
    this.regCHi = 0;

    this.i8255.reset();
  }

  private writeA(value: number) {
    if (value != this.regA) {
      this.regA = value;
      for (let i = 0; i < 4; i++) {
        this.slotManager.setRamSlot(i, value & 3);
        value >>= 2;
      }
    }
  }

  private writeB(value: number) { }

  private writeCLo(value: number) {
    this.row = value;
  }

  private writeCHi(value: number) {
    if (value != this.regCHi) {
      this.regCHi = value;
    }
  }

  private readA(): number {
    return 0xff;
  }

  private readB(): number {
    return 0xff;
  }

  private readCLo(): number {
    return 0xff;
  }

  private readCHi(): number {
    return 0xff;
  }
}

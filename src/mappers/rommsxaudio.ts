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

import { Mapper } from './mapper';
import { Board } from '../core/board';
import { Slot } from '../core/slotmanager';
import { Port } from '../core/iomanager';
import { Y8950 } from '../audio/y8950';
import { SaveState } from '../core/savestate';

export class MapperRomMsxAudio extends Mapper {
  static NAME = 'MSX Audio';

  constructor(board: Board, slot: number, sslot: number, private romData: Uint8Array) {
    super(MapperRomMsxAudio.NAME);

    if (this.romData.length > 0) {
      this.sizeMask = this.romData.length - 1;
      this.bankSelect = 0;

      for (let i = 0; i < this.ram.length; i++) {
        this.ram[i] = 0xff;
      }

      // FS-CA1 BIOS hack ret z -> nop
      this.romData[0x408e] = 0;

      for (let page = 0; page < 8; page++) {
        this.slotInfo[page] = new Slot(this.getName(), this.readCb.bind(this), this.writeCb.bind(this));
        this.slotInfo[page].fullAddress = true;
        this.slotInfo[page].map(false, false);
        board.getSlotManager().registerSlot(slot, sslot, page, this.slotInfo[page]);
      }
    }
    
    let ioBase = 0xc0; // Add 2 for second msxaudio if installed
    if (board.getIoManager().isPortRegistered(ioBase)) {
      ioBase = 0xc2;
    }

    this.y8950 = new Y8950(board);

    board.getIoManager().registerPort(ioBase + 0, new Port(this.readIo.bind(this), this.writeIo.bind(this)));
    board.getIoManager().registerPort(ioBase + 1, new Port(this.readIo.bind(this), this.writeIo.bind(this)));

    board.getIoManager().registerPort(0x00, new Port(undefined, this.writeMidiIo.bind(this)));
    board.getIoManager().registerPort(0x01, new Port(undefined, this.writeMidiIo.bind(this)));
    board.getIoManager().registerPort(0x04, new Port(this.readMidiIo.bind(this)));
    board.getIoManager().registerPort(0x05, new Port(this.readMidiIo.bind(this)));

    this.reset();
  }

  public reset() {
    this.y8950.reset();

//      philipsMidiReset(rm -> midi);

    // FS-CA1
    this.writeCb(0x7ffe, 0);
    this.writeCb(0x7fff, 0);
  }

  private readCb(address: number): number {

    if (this.bankSelect == 0 && (address & 0x3fff) >= 0x3000) {
      return this.ram[(address & 0x3fff) - 0x3000];
    }

    return this.romData![(0x8000 * this.bankSelect + (address & 0x7fff)) & this.sizeMask];
  }

  private writeCb(address: number, value: number): void {
    if (address == 0x7ffe) this.bankSelect = value & 3;

    address &= 0x3fff;
    if (this.bankSelect == 0 && address >= 0x3000) {
      this.ram[address - 0x3000] = value;
    }
  }

  private readIo(port: number): number {
    return this.y8950.read(port & 1);
  }

  private writeIo(port: number, value: number): void {
    this.y8950.write(port & 1, value);
  }

  private readMidiIo(port: number): number {
    return (~0x80) & 0xff;
  }

  private writeMidiIo(port: number, value: number): void {
  }

  public getState(): any {
    let state: any = {};

    return state;
  }

  public setState(state: any): void {
  }

  private slotInfo = new Array<Slot>(8);
  private bankSelect = 0;
  private ram = new Uint8Array(0x1000);
  private sizeMask = 0;
  private y8950: Y8950;
}
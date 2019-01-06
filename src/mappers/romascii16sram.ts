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

export class MapperRomAscii16sram extends Mapper {
  static NAME = 'ASCII-16 SRAM';

  constructor(board: Board, slot: number, sslot: number, romData: Uint8Array) {
    super(MapperRomAscii16sram.NAME);
    
    let size = 0x8000;
    while (size < romData.length) {
        size *= 2;
    }
    this.romMask = (size >> 14) - 1;

    this.pages = [];
    for (let romOffset = 0; romOffset < size;) {
      let pageData = new Uint8Array(0x2000);
      for (let i = 0; i < 0x2000; i++) {
        pageData[i] = romOffset < romData.length ? romData[romOffset] : 0xff;
        romOffset++;
      }
      this.pages.push(pageData);
    }

    // Initialize SRAM (should ideally store in a cookie or something...)
    for (let i = 0; i < this.sram.length; i++) {
      this.sram[i] = 0xff;
    }

    for (let page = 0; page < 4; page++) {
      this.slotInfo[page] = new Slot(this.getName(), undefined, 
        page == 1 ? this.writeCb.bind(this) : page >= 2 ? this.writeSramCb.bind(this) :undefined);
      this.slotInfo[page].map(true, false, this.pages[page & 1]);
      board.getSlotManager().registerSlot(slot, sslot, page + 2, this.slotInfo[page]);
    }
  }

  private writeCb(address: number, value: number): void {
    if (address >= 0x1800) {
      return;
    }

    let bank = (address >> 12) & 1;

    if (this.romMapper[bank] != value) {
      if (value & ~this.romMask) {
        this.slotInfo[2 * bank].map(true, false, this.sram);
        this.slotInfo[2 * bank + 1].map(true, false, this.sram);
        if (bank > 0) {
          this.sramEnabled = true;
        }
      }
      else {
        this.slotInfo[2 * bank].map(true, false, this.pages[2 * value]);
        this.slotInfo[2 * bank + 1].map(true, false, this.pages[2 * value + 1]);
        if (bank > 0) {
          this.sramEnabled = false;
        }
      }
      this.romMapper[bank] = value;
    }
  }

  private writeSramCb(address: number, value: number): void {
    if (this.sramEnabled) {
      for (address &= 0x7ff; address < 0x2000; address += 0x800) {
          this.sram[address] = value;
      }
    }
  }

  private romMask = 0;
  private pages: Array<Uint8Array>;
  private slotInfo = new Array<Slot>(4);
  private romMapper = [0, 0];
  private sram = new Uint8Array(0x2000);
  private sramEnabled = false;
}

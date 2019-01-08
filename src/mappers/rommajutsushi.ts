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
import { Dac } from '../audio/dac';
 
export class MapperRomMajutsushi extends Mapper {
  static NAME = 'Majutsushi';

  constructor(board: Board, slot: number, sslot: number, romData: Uint8Array) {
    super(MapperRomMajutsushi.NAME);

    let size = 0x8000;
    while (size < romData.length) {
      size *= 2;
    }
    this.romMask = (size >> 13) - 1;

    this.pages = [];
    for (let romOffset = 0; romOffset < size;) {
      let pageData = new Uint8Array(0x2000);
      for (let i = 0; i < 0x2000; i++) {
        pageData[i] = romOffset < romData.length ? romData[romOffset] : 0xff;
        romOffset++;
      }
      this.pages.push(pageData);
    }

    for (let page = 0; page < 4; page++) {
      this.slotInfo[page] = new Slot(this.getName(), undefined, this.writeCb.bind(this));
      this.slotInfo[page].fullAddress = true;
      this.slotInfo[page].map(true, false, this.pages[page]);
      board.getSlotManager().registerSlot(slot, sslot, page + 2, this.slotInfo[page]);
    }

    this.dac = new Dac(board, 8, false);
  }

  private writeCb(address: number, value: number): void {
    if (address >= 0x5000 && address < 0x6000) {
      this.dac.write(value);
    }
    if (address < 0x6000) {
      return;
    }

    const bank = (address - 0x4000) >> 13;
    value &= this.romMask;
    if (this.romMapper[bank] != value) {
      this.romMapper[bank] = value;
      this.slotInfo[bank].map(true, false, this.pages[value]);
    }
  }

  private romMask = 0;
  private pages: Array<Uint8Array>;
  private slotInfo = new Array<Slot>(4);
  private romMapper = [0, 1, 2, 3];
  private dac: Dac;
}

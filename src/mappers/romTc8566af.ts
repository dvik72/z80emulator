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
import { DiskManager } from '../disk/diskmanager';
import { Tc8566af } from '../disk/tc8566af';

export class MapperRomTc8566af extends Mapper {
  constructor(diskManager: DiskManager, board: Board, slot: number, sslot: number, romData: Uint8Array) {
    super('ROM TC8566AF');

    this.tc8566af = new Tc8566af(diskManager, board);
    
    this.pages = [];
    for (let romOffset = 0; romOffset < 0x4000;) {
      let pageData = new Array<number>(0x2000);
      for (let i = 0; i < 0x2000; i++) {
        pageData[i] = romOffset < romData.length ? romData[romOffset] : 0xff;
        romOffset++;
      }
      this.pages.push(pageData);
    }

    for (let page = 0; page < 4; page++) {
      this.slotInfo[page] = new Slot(this.getName(),
        page & 1 ? this.readCb.bind(this): undefined, page & 1 ? this.writeCb.bind(this) : undefined);
      this.slotInfo[page].map(page == 0, false, this.pages[page & 1]);
      board.getSlotManager().registerSlot(slot, sslot, page + 2, this.slotInfo[page]);
    }
  }

  private readCb(address: number): number {
    switch (address) {
      case 0x1ffa:
        return this.tc8566af.readRegister(4);
      case 0x1ffb:
        return this.tc8566af.readRegister(5);
      default:
        return this.pages[1][address];
    }
  }
  
  private writeCb(address: number, value: number): void {
    switch (address) {
      case 0x1ff8:
        this.tc8566af.writeRegister(2, value);
        break;
      case 0x1ff9:
        this.tc8566af.writeRegister(3, value);
        break;
      case 0x1ffa:
        this.tc8566af.writeRegister(4, value);
        break;
      case 0x1ffb:
        this.tc8566af.writeRegister(5, value);
        break;
    }
}

  private tc8566af: Tc8566af;
  private pages: Array<Array<number>>;
  private slotInfo = new Array<Slot>(4);
}

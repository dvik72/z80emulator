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
import { SaveState } from '../util/savestate';

export class MapperRomCrossBlaim extends Mapper {
  static NAME = 'Cross Blaim';

  constructor(board: Board, slot: number, sslot: number, romData: Uint8Array) {
    super(MapperRomCrossBlaim.NAME);

    this.pages = [];
    for (let romOffset = 0; romOffset < 0x10000;) {
      let pageData = new Uint8Array(0x2000);
      for (let i = 0; i < 0x2000; i++) {
        pageData[i] = romOffset < romData.length ? romData[romOffset] : 0xff;
        romOffset++;
      }
      this.pages.push(pageData);
    }

    for (let page = 0; page < 8; page++) {
      this.slotInfo[page] = new Slot(this.getName(), undefined, this.writeCb.bind(this));
      board.getSlotManager().registerSlot(slot, sslot, page, this.slotInfo[page]);
    }
    this.slotInfo[2].map(true, false, this.pages[0]);
    this.slotInfo[3].map(true, false, this.pages[1]);
  }

  private writeCb(address: number, value: number): void {
    value &= 3;

    if (this.romMapper != value) {
      this.romMapper = value;

      if (value & 2) {
        this.slotInfo[0].map(true, false);
        this.slotInfo[1].map(true, false);
        this.slotInfo[4].map(true, false, this.pages[value * 2]);
        this.slotInfo[5].map(true, false, this.pages[value * 2 + 1]);
        this.slotInfo[6].map(true, false);
        this.slotInfo[7].map(true, false);
      }
      else {
        this.slotInfo[0].map(true, false, this.pages[2]);
        this.slotInfo[1].map(true, false, this.pages[3]);
        this.slotInfo[4].map(true, false, this.pages[2]);
        this.slotInfo[5].map(true, false, this.pages[3]);
        this.slotInfo[6].map(true, false, this.pages[2]);
        this.slotInfo[7].map(true, false, this.pages[3]);
      }
    }
  }

  public getState(): any {
    let state: any = {};

    state.romMapper = this.romMapper;

    return state;
  }

  public setState(state: any): void {
    this.romMapper = -1;
    this.writeCb(0, state.romMapper);
  }

  private pages: Array<Uint8Array>;
  private slotInfo = new Array<Slot>(4);
  private romMapper = -1;
}

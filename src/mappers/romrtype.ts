﻿//////////////////////////////////////////////////////////////////////////////
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
import { SaveState } from '../core/savestate';

export class MapperRomRtype extends Mapper {
  static NAME = 'R-Type';

  constructor(board: Board, slot: number, sslot: number, romData: Uint8Array) {
    super(MapperRomRtype.NAME);
    
    this.pages = [];
    for (let romOffset = 0; romOffset < 0x60000;) {
      let pageData = new Uint8Array(0x2000);
      for (let i = 0; i < 0x2000; i++) {
        pageData[i] = romOffset < romData.length ? romData[romOffset] : 0xff;
        romOffset++;
      }
      this.pages.push(pageData);
    }

    for (let page = 0; page < 4; page++) {
      this.slotInfo[page] = new Slot(this.getName() + ' - ' + (page + 2), undefined, this.writeCb.bind(this));
      this.slotInfo[page].map(true, false, this.pages[[0x2e, 0x2f, 0, 1][page]]);
      board.getSlotManager().registerSlot(slot, sslot, page + 2, this.slotInfo[page]);
    }
  }

  private writeCb(address: number, value: number): void {
  	value &= (value & 0x10) ? 0x17 : 0x0f;

    if (this.romMapper != value) {
      this.romMapper = value;
      this.slotInfo[2].map(true, false, this.pages[2 * value]);
      this.slotInfo[3].map(true, false, this.pages[2 * value + 1]);
    }
  }

  public getState(): any {
    let state: any = {};

    state.romMapper = this.romMapper;

    return state;
  }

  public setState(state: any): void {
    this.romMapper = state.romMapper;

    for (let bank = 2; bank < 4; bank++) {
      const page = this.pages[2 * this.romMapper + (bank & 1)];
      this.slotInfo[bank].map(true, false, page);
    }
  }

  private pages: Array<Uint8Array>;
  private slotInfo = new Array<Slot>(4);
  private romMapper = 0;
}

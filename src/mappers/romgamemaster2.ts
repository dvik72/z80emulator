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
import { SaveState } from '../core/savestate';

export class MapperRomGameMaster2 extends Mapper {
  static NAME = 'Game Master 2';

  constructor(board: Board, slot: number, sslot: number, romData: Uint8Array) {
    super(MapperRomGameMaster2.NAME);

    this.pages = [];
    for (let romOffset = 0; romOffset < 0x20000;) {
      let pageData = new Uint8Array(0x2000);
      for (let i = 0; i < 0x2000; i++) {
        pageData[i] = romOffset < romData.length ? romData[romOffset] : 0xff;
        romOffset++;
      }
      this.pages.push(pageData);
    }

    // Initialize SRAM (should ideally store in a cookie or something...)
    for (let page = 0; page < this.sram.length; page++) {
      for (let i = 0; i < this.sram[page].length; i++) {
        this.sram[page][i] = 0xff;
      }
    }

    for (let page = 0; page < 4; page++) {
      this.slotInfo[page] = new Slot(this.getName(), undefined, 
        page > 0 ? this.writeCb.bind(this) : undefined);
      this.slotInfo[page].fullAddress = true;
      this.slotInfo[page].map(true, false, this.pages[0]);
      board.getSlotManager().registerSlot(slot, sslot, page + 2, this.slotInfo[page]);
    }
  }

  private writeCb(address: number, value: number): void {
    if (address >= 0xb000 && this.sramEnabled) {
      let offset = address & 0x0fff;
      this.sram[this.sramPage][offset] = value;
      this.sram[this.sramPage][offset + 0x1000] = value;
      return;
    }

    if (address & 0x1fff) {
      return;
    }

    if ((address >> 12) == 0x0a) {
			this.sramEnabled = (value & 0x10) != 0;
		}

    let bank = (address - 0x4000) >> 13;
    if (value & 0x10) {
      this.sramPage = (value >> 5) & 1;
      this.slotInfo[bank].map(true, false, this.sram[this.sramPage]);
    }
    else {
      value &= 0x0f;
      this.romMapper[bank] = value;
      this.slotInfo[bank].map(true, false, this.pages[value]);
    }
  }

  public getState(): any {
    let state: any = {};

    state.sramEnabled = this.sramEnabled;

    state.romMapper = SaveState.getArrayState(this.romMapper);
    state.sram = SaveState.getArrayOfArrayState(this.sram);

    return state;
  }

  public setState(state: any): void {
    this.sramEnabled = state.sramEnabled;

    SaveState.setArrayState(this.romMapper, state.romMapper);
    SaveState.setArrayOfArrayState(this.sram, state.sram);

    for (let bank = 0; bank < 4; bank++) {
      const value = this.romMapper[bank];
      const page = (value & 0x10) ? this.sram[(value >> 5) & 1] : this.pages[value & 0x0f];
      this.slotInfo[bank].map(true, false, page);
    }
  }

  private pages: Array<Uint8Array>;
  private slotInfo = new Array<Slot>(4);
  private romMapper = [0, 0, 0, 0];
  private sram = [new Uint8Array(0x2000), new Uint8Array(0x2000) ];
  private sramPage = 0;
  private sramEnabled = false;
}

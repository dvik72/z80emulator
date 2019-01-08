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

export enum Ascii8SramType{
  ASCII8,
  KOEI,
  WIZARDRY
};

export class MapperRomAscii8sram extends Mapper {
  static NAME = 'ASCII-8 SRAM';

  constructor(
    board: Board,
    slot: number,
    sslot: number,
    romData: Uint8Array,
    sramType: Ascii8SramType = Ascii8SramType.ASCII8
  ) {
    super(MapperRomAscii8sram.NAME);

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
      this.slotInfo[page] = new Slot(this.getName(), undefined, page == 1 ? this.writeCb.bind(this) : undefined);
      this.slotInfo[page].map(true, false, this.pages[0]);
      board.getSlotManager().registerSlot(slot, sslot, page + 2, this.slotInfo[page]);
    }

    this.sramEnableBit = sramType == Ascii8SramType.WIZARDRY ? 0x80 : size >> 13;

    const sramBanks = sramType == Ascii8SramType.KOEI ? 4 : 1;
    this.sram = new Array<Uint8Array>(sramBanks);
    for (let page = 0; page < sramBanks; page++) {
      let sram = new Uint8Array(0x2000);
      for (let i = 0; i < sram.length; i++) {
        sram[i] = 0xff;
      }
      this.sram[page] = sram;
    }
  }

  private writeCb(address: number, value: number): void {
    let bank = (address & 0x1800) >> 11;

    if (this.romMapper[bank] != value) {
      if (value & this.sramEnableBit) {
        this.slotInfo[bank].map(true, bank > 1, this.sram[value & (this.sram.length - 1)]);
      }
      else {
        this.slotInfo[bank].map(true, false, this.pages[value & this.romMask]);
      }
      this.romMapper[bank] = value;
    }
  }

  private romMask = 0;
  private pages: Array<Uint8Array>;
  private sram: Array<Uint8Array>;
  private sramEnableBit = 0;
  private slotInfo = new Array<Slot>(4);
  private romMapper = [0, 0, 0, 0];
}

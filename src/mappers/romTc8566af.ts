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

export enum Tc8566AfIo { MSX2, MSXTR };

export class MapperRomTc8566af extends Mapper {
  constructor(
    private type: Tc8566AfIo,
    private diskManager: DiskManager,
    board: Board, slot: number, sslot: number, romData: Uint8Array) {
    super('ROM TC8566AF');

    this.tc8566af = new Tc8566af(this.diskManager, board);

    const pageCount = (romData.length + 0x3fff) >> 14;
    this.pages = [];
    for (let romOffset = 0; romOffset < 0x4000 * pageCount;) {
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
    const offset = address >= 0x1ff0 ? 0 : 2 * this.mappedPage;
    switch (this.type) {
      case Tc8566AfIo.MSX2:
        switch (address) {
          case 0x1ffa:
            return this.tc8566af.readRegister(4);
          case 0x1ffb:
            return this.tc8566af.readRegister(5);
          default:
            return this.pages[offset + 1][address];
        }
        break;
      case Tc8566AfIo.MSXTR:
        switch (address) {
          case 0x1ff0:
            return this.mappedPage;
            break;
          case 0x1ff1:
            return 0x03 |
              (this.diskManager.getFloppyDisk(0).hasChanged() ? 0x00 : 0x10) |
              (this.diskManager.getFloppyDisk(1).hasChanged() ? 0x00 : 0x20);
            break;
          case 0x1ff4:
            return this.tc8566af.readRegister(4);
          case 0x1ff5:
            return this.tc8566af.readRegister(5);
          default:
            return this.pages[offset + 1][address];
        }
        break;
    }

    return 0xff;
  }
  
  private writeCb(address: number, value: number): void {
    switch (this.type) {
      case Tc8566AfIo.MSX2:
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
        break;
      case Tc8566AfIo.MSXTR:
        switch (address) {
          case 0x0000:
          case 0x1ff0:
          case 0x1ffe:
            this.mappedPage = value & ((this.pages.length >> 1) - 1);
            this.slotInfo[0].map(true, false, this.pages[2 * this.mappedPage]);
            break;
          case 0x1ff2:
            this.tc8566af.writeRegister(2, value);
            break;
          case 0x1ff3:
            this.tc8566af.writeRegister(3, value);
            break;
          case 0x1ff4:
            this.tc8566af.writeRegister(4, value);
            break;
          case 0x1ff5:
            this.tc8566af.writeRegister(5, value);
            break;
        }
        break;
    }
  }

  private tc8566af: Tc8566af;
  private pages: Array<Array<number>>;
  private slotInfo = new Array<Slot>(4);
  private mappedPage = 0;
}

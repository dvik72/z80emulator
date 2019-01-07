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
import { Scc, SccMode } from '../audio/scc';
import { Ay8910, Ay8910ConnectorType, PsgType } from '../audio/ay8910';
import { AmdFlash, AmdType } from '../memory/amdflash';

export class MapperRomMegaFlashRomScc extends Mapper {
  static NAME = 'MegaFlashRom SCC';

  constructor(
    private board: Board,
    slot: number,
    sslot: number,
    romData: Uint8Array,
    writeProtectMask: number,
    private flashSize: number,
    hasPsg: boolean)
  {
    super(MapperRomMegaFlashRomScc.NAME);

    this.scc = new Scc(board, SccMode.REAL);
    if (hasPsg) {
      this.ay8910 = new Ay8910(this.board, Ay8910ConnectorType.SCCPLUS, PsgType.AY8910);
    }

    this.amdFlash = new AmdFlash(AmdType.TYPE_2, flashSize, 0x10000, writeProtectMask, romData);

    this.romMask = (flashSize >> 13) - 1;

    for (let page = 0; page < 4; page++) {
      this.slotInfo[page] = new Slot(this.getName(), this.readCb.bind(this), this.writeCb.bind(this));
      this.slotInfo[page].fullAddress = true;
      board.getSlotManager().registerSlot(slot, sslot, page + 2, this.slotInfo[page]);
      this.mapPage(page, page);
    }
  }

  public reset(): void {
    this.amdFlash.reset();
    this.scc.reset();
    this.ay8910 && this.ay8910.reset();
  }

  private readCb(address: number): number {
    if (address >= 0x9800 && address < 0xa000 && this.sccEnable) {
      return this.scc.read(address & 0xff);
    }

    const bank = (address >> 13) - 2;
    
    return this.amdFlash.read((address & 0x1fff) + 0x2000 * this.flashPage[bank]);
  }

  private writeCb(address: number, value: number): void {
    if (address >= 0x9800 && address < 0xa000 && this.sccEnable) {
      this.scc.write(address & 0xff, value);
    }

    address -= 0x4000;

    const bank = address >> 13;
    
    this.amdFlash.write((address & 0x1fff) + 0x2000 * this.flashPage[bank], value);

    if ((address - 0x1000) & 0x1800) {
      return;
    }

    let change = false;
    if (bank == 2) {
      const newEnable = (value & 0x3F) == 0x3F;
      change = this.sccEnable != newEnable;
      this.sccEnable = newEnable;
    }

    value &= this.romMask;
    if (this.flashPage[bank] != value || change) {
      this.mapPage(bank, value);
    }
  }

  private mapPage(bank: number, page: number): void {
    this.flashPage[bank] = page;
    
    const bankData = this.amdFlash.getPage(page);
    const readEnable = (bank == 2 && this.sccEnable);

    this.slotInfo[bank].map(readEnable, false, bankData);
  }

  private amdFlash: AmdFlash;
  private scc: Scc;
  private ay8910?: Ay8910;
  private slotInfo = new Array<Slot>(4);
  private romMapper = [0, 0, 0, 0];
  private flashPage = [0, 0, 0, 0];
  private sccEnable = false;
  private romMask = 0;
}

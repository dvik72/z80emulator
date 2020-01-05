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
import { Port } from '../core/iomanager';

export class MapperKanji extends Mapper {
  static NAME = 'Kanji';

  constructor(board: Board, private romData: Uint8Array) {
    super(MapperKanji.NAME);

    board.getIoManager().registerPort(0xd8, new Port(this.read.bind(this), this.write.bind(this)));
    board.getIoManager().registerPort(0xd9, new Port(this.read.bind(this), this.write.bind(this)));
    board.getIoManager().registerPort(0xda, new Port(this.read.bind(this), this.write.bind(this)));
    board.getIoManager().registerPort(0xdb, new Port(this.read.bind(this), this.write.bind(this)));    
  }

  private read(port: number): number {
    const reg = (port >> 1) & 1;

    if (reg >= (this.romData.length >> 17)) {
      return 0xff;
    }

    const value = this.romData[this.address[reg]];

    this.address[reg] = (this.address[reg] & ~0x1f) | ((this.address[reg] + 1) & 0x1f);

    return value;
  }

  private write(port: number, value: number): void {
    switch (port & 0x03) {
      case 0:
        this.address[0] = (this.address[0] & 0x1f800) | ((value & 0x3f) << 5);
        break;
      case 1:
        this.address[0] = (this.address[0] & 0x007e0) | ((value & 0x3f) << 11);
        break;
      case 2:
        this.address[1] = (this.address[1] & 0x3f800) | ((value & 0x3f) << 5);
        break;
      case 3:
        this.address[1] = (this.address[1] & 0x207e0) | ((value & 0x3f) << 11);
        break;
    }
  }

  private address = [0, 0x20000];
}

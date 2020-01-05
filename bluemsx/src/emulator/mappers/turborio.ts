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
import { LedType } from '../core/ledmanager';
import { Port } from '../core/iomanager';

export class MapperTurboRIo extends Mapper {
  constructor(private board: Board) {
    super('Turbo-R IO');

    this.board.getIoManager().registerPort(0xa7, new Port(this.read.bind(this), this.write.bind(this)));
  }

  private read(port: number): number {
    // return switchGetPause() ? 1 : 0;
    return 0;
  }

  private write(port: number, value: number): void {
    this.board.getLedManager().getLed(LedType.PAUSE).set((value & 0x01) != 0);
    this.board.getLedManager().getLed(LedType.TURBOR).set((value & 0x80) != 0);
  }
}

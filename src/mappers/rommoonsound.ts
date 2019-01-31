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
import { Moonsound } from '../audio/moonsound';
import { SaveState } from '../core/savestate';

export class MapperRomMoonsound extends Mapper {
  constructor(
    board: Board,
    romData: Uint8Array,
    ramSize: number
  ) {
    super('Moonsound');

    this.moonsound = new Moonsound(board, romData, ramSize);

    this.read = this.read.bind(this);
    this.write = this.write.bind(this);

    board.getIoManager().registerPort(0x7e, new Port(this.read, this.write));
    board.getIoManager().registerPort(0x7f, new Port(this.read, this.write));
    board.getIoManager().registerPort(0xc4, new Port(this.read, this.write));
    board.getIoManager().registerPort(0xc5, new Port(this.read, this.write));
    board.getIoManager().registerPort(0xc6, new Port(this.read, this.write));
    board.getIoManager().registerPort(0xc7, new Port(this.read, this.write));

    this.reset();
  }

  public reset() {
    this.moonsound.reset();
  }

  private read(port: number): number {
    return this.moonsound.read(port);
  }

  private write(port: number, value: number): void {
    this.moonsound.write(port, value);
  }

  public getState(): any {
    let state: any = {};

    return state;
  }

  public setState(state: any): void {
  }

  private moonsound: Moonsound;
}

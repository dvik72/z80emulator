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

export class MapperF4Device extends Mapper {
  constructor(board: Board, private inverted: boolean = false) {
    super('F4 Device');

    board.getIoManager().registerPort(0xf4, new Port(this.read.bind(this), this.write.bind(this)));

    this.status = this.inverted ? 0xff : 0;
  }

  private read(port: number): number {
    return this.status;
  }
  
  private write(port: number, value: number): void {

    if (this.inverted) {
      this.status = value | 0x7f;
    }
    else {
      this.status = (this.status & 0x20) | (value & 0xa0);
    }
  }

  public getState(): any {
    let state: any = {};

    state.status = this.status;

    return state;
  }

  public setState(state: any): void {
    this.status = state.status;
  }

  private status = 0;
}
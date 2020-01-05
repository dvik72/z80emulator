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
import { Counter } from '../core/timeoutmanager';
import { Port } from '../core/iomanager';
import { SaveState } from '../util/savestate';

export class MapperTurboRTimer extends Mapper {
  constructor(private board: Board) {
    super('Turbo-R Timer');

    this.board.getIoManager().registerPort(0xe6, new Port(this.read.bind(this), this.write.bind(this)));
    this.board.getIoManager().registerPort(0xe7, new Port(this.read.bind(this), this.write.bind(this)));

    this.counter = new Counter('Turbo-R Timer Counter', this.board, 255682);

    this.reset();
  }

  public reset() {
    this.counter.reset();
  }

  private read(port: number): number {
    switch (port & 0x01) {
      case 0:
        return this.counter.get() & 0xff;
      case 1:
        return (this.counter.get() >> 8) & 0xff;
    }
    return 0xff;
  }

  private write(port: number, value: number): void {
    this.counter.reset();
  }

  public getState(): any {
    let state: any = {};

    state.counter = this.counter.getState();

    return state;
  }

  public setState(state: any): void {
    this.counter.setState(state.counter);
  }

  private counter: Counter;
}
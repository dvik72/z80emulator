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

import { Disk } from './disk';
import { SaveState } from '../core/savestate';


export class DiskManager {
  public constructor() {
    for (let i = 0; i < this.floppyDisks.length; i++) {
      this.floppyDisks[i] = new Disk();
    }
  }

  public reset(): void {
    for (let floppyDisk of this.floppyDisks) {
      floppyDisk.enable(false);
    }
  }

  public getFloppyDisk(index: number): Disk {
    return this.floppyDisks[index % this.floppyDisks.length] || this.unmappedFloppyDisk;
  }

  public insertFloppyImage(index: number, image: Uint8Array): void {
    if (index < this.floppyDisks.length) {
      this.floppyDisks[index].load(image);
    }
  }

  public ejectFloppyImage(index: number): void {
    this.floppyDisks[index].unload();
  }

  public getState(): any {
    let state: any = {};

    state.floppyDisks = [];
    for (let i = 0; i < this.floppyDisks.length; i++) {
      state.floppyDisks[i] = this.floppyDisks[i].getState();
    }

    return state;
  }

  public setState(state: any): void {
    for (let i = 0; i < this.floppyDisks.length; i++) {
      this.floppyDisks[i].setState(state.floppyDisks[i]);
    }
  }

  private floppyDisks = new Array<Disk>(4);
  private unmappedFloppyDisk = new Disk();
}
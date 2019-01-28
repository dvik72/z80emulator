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

export class SaveState {
  public constructor() { }

  public getState(): any {
    return '';
  }

  public setState(state: any): void {
  }

  protected getArrayState(array: Uint8Array | Uint16Array): any {
    let state = [];

    for (let i = 0; i < array.length; i++) {
      state[i] = array[i];
    }

    return state;
  }

  protected setArrayState(array: Uint8Array | Uint16Array, state: any): void {
    for (let i = 0; i < array.length; i++) {
      array[i] = state[i];
    }
  }
}

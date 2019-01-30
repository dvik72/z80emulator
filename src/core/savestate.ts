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
    let state: any = {};

    return state;
  }

  public setState(state: any): void {
  }
 
  public static getArrayState(array: Uint8Array | Uint16Array | Array<number> | Array<boolean>): any {
    let state = [];

    for (let i = 0; i < array.length; i++) {
      state[i] = array[i];
    }

    return state;
  }

  public static setArrayState(array: Uint8Array | Uint16Array | Array<number> | Array<boolean>, state: any): void {
    for (let i = 0; i < array.length; i++) {
      array[i] = state[i];
    }
  }

  public static getArrayOfArrayState(array: Array<Uint8Array | Uint16Array | Array<number>>): any {
    let state = [];

    for (let i = 0; i < array.length; i++) {
      state[i] = SaveState.getArrayState(array[i]);
    }

    return state;
  }

  public static setArrayOfArrayState(array: Array<Uint8Array | Uint16Array | Array<number>>, state: any): void {
    for (let i = 0; i < array.length; i++) {
      SaveState.setArrayState(array[i], state[i])
    }
  }
}

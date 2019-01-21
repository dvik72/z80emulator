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

export enum LedType {
  CAPS_LOCK = 0,
  KANA = 1,
  TURBOR = 2,
  PAUSE = 3,
  RENSHA = 4,
  FDD1 = 5,
  FDD2 = 6,
  HDD = 7,
  CAS = 8
};

export class Led {
  constructor(private id: number) { }

  public set(enable: boolean): void {
    this.changed = this.changed || this.enabled !== enable;
    this.enabled = enable;
  }

  public get(): boolean {
    return this.enabled;
  }

  public hasChanged(): boolean {
    const changed = this.changed;
    this.changed = false;
    return changed;
  }

  private enabled = false;
  private changed = true;
}

export class LedManager {
  constructor() {
    for (let i = 0; i < 32; i++) {
      this.leds[i] = new Led(i);
    }
  }

  public getLed(led: LedType): Led {
    return this.leds[led];
  }

  public setAll(enable: boolean): void {
    for (let i = 0; i < 32; i++) {
      this.leds[i].set(enable);
    }
  }

  private leds = new Array<Led>(32);
}

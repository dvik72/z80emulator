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

const PREFS_VERSION = 1;
const COMPATIBLE_VERSIONS = [1];

class Prefs {
  constructor() { }

  public version = PREFS_VERSION;
  public machineName = '';
}

export class UserPrefs {
  constructor() {
  }

  public get(): Prefs {
    return this.prefs;
  }

  public load(): void {
    try {
      let json = JSON.parse(localStorage.bluemsxprefs || "{}");

      let version = json.version;
      if (COMPATIBLE_VERSIONS.indexOf(version) >= 0) {
        this.prefs = JSON.parse(localStorage.bluemsxprefs || "{}") as Prefs;
      }
    }
    catch (e) {
      this.prefs = new Prefs();
    }
  }

  public save() {
    try {
      localStorage.bluemsxprefs = JSON.stringify(this.prefs);
    } catch (e) { }
  }

  private prefs = new Prefs();
}

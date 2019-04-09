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

export class UrlParam {
  public constructor(public readonly key: string, public readonly value: string | null = null) { }
}

export class UrlParser {
  public static decodeUrlParams(): Array<UrlParam> {
    const search = window.location.search;
    const hashes = search.slice(search.indexOf("?") + 1).split("&");
    let params = [];

    for (const hash of hashes) {
      const split = hash.indexOf("=");
      if (split < 0) {
        params.push(new UrlParam(hash));
      } else {
        const key = hash.slice(0, split);
        const val = hash.slice(split + 1);
        params.push(new UrlParam(key, val));
      }
    }

    return params;
  }

  public static toDebugString(): string {
    const urlParams = this.decodeUrlParams();
    let s = '[\n';
    for (const param of urlParams) {
      s += '  ' + param.key;
      if (param.value) {
        s += ': ' + param.value;
      }
      s += '\n';
    }
    s += ']';

    return s;
  }
}

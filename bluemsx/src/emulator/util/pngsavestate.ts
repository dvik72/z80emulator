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

import { BSON } from './bson';
import * as JSZip from './jszip';


const CRC32_TABLE = new Uint8Array(256);

for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    if (c & 1) {
      c = -306674912 ^ ((c >> 1) & 0x7fffffff);
    } else {
      c = (c >> 1) & 0x7fffffff;
    }
  }
  CRC32_TABLE[i] = c;
}

export class PngSaveState {

  public static encode(
    state: any,
    frameBuffer: Uint16Array,
    frameBufferWidth: number,
    frameBufferHeight: number): Uint8Array {

    let buffer = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

    const width = 34 * 2;
    const height = 26 * 2;

    const ratioW = frameBufferWidth / width | 0;
    const ratioH = frameBufferHeight / height | 0;

    const imageData = new Uint8Array(3 * (width + 1) * height);
    let idx = 0;
    for (let h = 0; h < height; h++) {
      imageData[idx++] = 0;
      for (let w = 0; w < width; w++) {
        let r = 0;
        let g = 0;
        let b = 0;
        let cnt = 0;

        for (let j = 0; j < ratioH; j++) {
          for (let i = 0; i < ratioW; i++) {
            const color = frameBuffer[frameBufferWidth * (j + h * ratioH) + i + w * ratioW];
            r += color >> 10 & 0x1f;
            g += color >> 5 & 0x1f;
            b += color & 0x1f;
            cnt++;
          }
        }

        imageData[idx++] = (r / cnt) * 255 / 31 | 0;
        imageData[idx++] = (g / cnt) * 255 / 31 | 0;
        imageData[idx++] = (b / cnt) * 255 / 31 | 0;
      }
    }

    buffer = PngSaveState.addChunk(buffer, 'IHDR', PngSaveState.pngHdr(width, height));
    buffer = PngSaveState.addChunk(buffer, 'IDAT', PngSaveState.deflate(imageData));
    buffer = PngSaveState.addChunk(buffer, 'bmSX', PngSaveState.fromState(state));
    buffer = PngSaveState.addChunk(buffer, 'IEND');

    return buffer;
  }

  public static decode(buf: Uint8Array): any | null {
    for (let i = 0; i < buf.length; i++) {
      if (buf[i] == 0x62 && buf[i + 1] == 0x6d && buf[i + 2] == 0x53 && buf[i + 3] == 0x58) {
        const length = buf[i -4] << 24 | buf[i -3] << 16 | buf[i - 2] << 8 | buf[i - 1];
        if (i + length < buf.length) {
          return PngSaveState.toState(buf.slice(i + 4, i + 4 + length));
        }
      }
    }
    return null;
  }

  private static addChunk(buffer: Uint8Array, type: string, data?: Uint8Array): Uint8Array {
    let dataLength = data ? data.length : 0;
    let newBuffer = new Uint8Array(buffer.length + dataLength + 12);
    newBuffer.set(buffer, 0);
    newBuffer.set(PngSaveState.byte4(dataLength), buffer.length + 0);
    newBuffer.set(PngSaveState.string4(type), buffer.length + 4);
    if (data) {
      newBuffer.set(data, buffer.length + 8);
      newBuffer.set(PngSaveState.byte4(PngSaveState.crc32(data)), buffer.length + data.length + 8);
    }

    return newBuffer;
  }

  private static pngHdr(width: number, height: number) {
    const hdr = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 8, 2, 0, 0, 0]);
    hdr.set(PngSaveState.byte4(width), 0);
    hdr.set(PngSaveState.byte4(height), 4);
    return hdr;
  }

  private static byte4(value: number): Uint8Array {
    return new Uint8Array([(value >> 24) & 0xff, (value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff]);
  }

  private static deflate(data: Uint8Array): Uint8Array {
    // TODO: Works for small pngs (< 64kB)
    const dataSize = 11 + data.length;

    const buffer = new Uint8Array(dataSize);

    let header = ((8 + (7 << 4)) << 8) | (3 << 6);
    header += 31 - (header % 31);

    buffer[0] = header >> 8 & 0xff;
    buffer[1] = header & 0xff;
    buffer[2] = 1;
    buffer[3] = data.length & 0xff;
    buffer[4] = data.length >> 8 & 0xff;
    buffer[5] = ~data.length & 0xff;
    buffer[6] = ~data.length >> 8 & 0xff;
    buffer.set(data, 7);

    const BASE = 65521;
    const NMAX = 5552;
    let s1 = 1;
    let s2 = 0;
    let n = NMAX;

    for (let i = 0; i < data.length; i++) {
      s1 += data[i];
      s2 += s1;
      if ((n -= 1) == 0) {
        s1 %= BASE;
        s2 %= BASE;
        n = NMAX;
      }
    }
    s1 %= BASE;
    s2 %= BASE;

    buffer[7 + data.length] = s2 >> 8 & 0xff;
    buffer[8 + data.length] = s2 & 0xff;
    buffer[9 + data.length] = s1 >> 8 & 0xff;
    buffer[10 + data.length] = s1 & 0xff;

    return buffer;
  }

  private static string4(value: string): Uint8Array {
    return new Uint8Array([
      value.charCodeAt(0),
      value.charCodeAt(1),
      value.charCodeAt(2),
      value.charCodeAt(3)
    ]);
  }

  private static crc32(buffer: Uint8Array): number {
    let crc = -1;
    for (let i = 0; i < buffer.length; i++) {
      crc = CRC32_TABLE[(crc ^ buffer[i]) & 0xff] ^ ((crc >> 8) & 0x00ffffff);
    }
    return crc;
  }

  private static fromState(state: any): Uint8Array {
    const serializedState = BSON.serialize(state);
    return (JSZip as any).compressions.DEFLATE.compress(serializedState);
  }

  private static toState(array: Uint8Array): any {
    const decompressedArray = (JSZip as any).compressions.DEFLATE.uncompress(array);
    return BSON.deserialize(decompressedArray);
  }
}

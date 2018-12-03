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

import { MediaInfo } from '../util/mediainfo';

export abstract class Machine {

  public constructor(
    private name: string) {
  }

  public getName(): string {
    return this.name;
  }

  public abstract init(): void;

  public abstract reset(): void;

  public abstract runStep(milliseconds: number): void;

  public abstract getFrameBuffer(): Uint16Array | null;

  public abstract getFrameBufferWidth(): number;

  public abstract getFrameBufferHeight(): number;

  public abstract keyDown(keyCode: string): void;

  public abstract keyUp(keyCode: string): void;

  public abstract insertRomMedia(mediaInfo: MediaInfo, cartridgeSlot?: number): void;
}
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

import { AudioDevice } from '../core/audiomanager';
import { Board } from '../core/board';
import { Port } from '../core/iomanager';

class DacChannel {
  public write(volume?: number): void {
    if (volume != undefined) {
      this.volume = (this.volume * this.count + volume) / ++this.count;
    }
  }

  public sync(buffer: Float32Array, count: number): void {
    for (let i = 0; i < count; i++) {
      buffer[i] = this.volume;
    }
  }

  private volume = 0;
  private count = 0;
}

export class Dac extends AudioDevice {
  constructor(
    private board: Board,
    dacBits: number,
    stereo: boolean
  ) {
    super('DAC', stereo);

    this.range = 1 << (dacBits + 1);
    this.sync = this.sync.bind(this);

    this.board.getAudioManager().registerAudioDevice(this);
  }
  
  public write(leftVolume?: number, rightVolume?: number): void {
    this.board.syncAudio();
    leftVolume != undefined && this.leftChannel.write(leftVolume / this.range);
    rightVolume != undefined && this.rightChannel.write(rightVolume / this.range);
  }

  public sync(count: number): void {
    if (this.isStereo()) {
      this.leftChannel.sync(this.getAudioBufferLeft(), count);
      this.rightChannel.sync(this.getAudioBufferRight(), count);
    }
    else {
      this.leftChannel.sync(this.getAudioBufferMono(), count);
    }
  }

  private leftChannel = new DacChannel();
  private rightChannel = new DacChannel();
  private range = 0;
}

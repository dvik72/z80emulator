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
import { SaveState } from '../util/savestate';

class DacChannel {
  public write(volume?: number): void {
    if (volume != undefined) {
      this.volume = volume;
      this.fracVolume = (this.fracVolume * this.count + volume) / ++this.count;
    }
  }

  public sync(buffer: Float32Array, count: number): void {
    if (count > 0) {
      buffer[0] = this.fracVolume;
      this.count = 0;
    }
    for (let i = 1; i < count; i++) {
      buffer[i] = this.volume;
    }
  }

  public getState(): any {
    let state: any = {};

    state.fracVolume = this.fracVolume;
    state.volume = this.volume;
    state.count = this.count;

    return state;
  }

  public setState(state: any): void {
    this.fracVolume = state.fracVolume;
    this.volume = state.volume;
    this.count = state.count;
  }

  private fracVolume = 0;
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

    this.range = 1 << dacBits;
    this.sync = this.sync.bind(this);

    this.board.getAudioManager().registerAudioDevice(this);
  }
  
  public write(leftVolume?: number, rightVolume?: number): void {
    this.board.syncAudio();
    leftVolume != undefined && this.leftChannel.write(leftVolume / this.range * 0.9);
    rightVolume != undefined && this.rightChannel.write(rightVolume / this.range * 0.9);
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

  public getState(): any {
    let state: any = {};

    state.leftChannel = this.leftChannel.getState();
    state.rightChannel = this.rightChannel.getState();

    return state;
  }

  public setState(state: any): void {
    this.leftChannel.setState(state.leftChannel);
    this.rightChannel.setState(state.rightChannel);
  }

  private leftChannel = new DacChannel();
  private rightChannel = new DacChannel();
  private range = 0;
}

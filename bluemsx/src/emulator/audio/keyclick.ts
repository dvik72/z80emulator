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
import { SaveState } from '../util/savestate';

export class KeyClick extends AudioDevice {
  constructor(
    private board: Board
  ) {
    super('Keyclick', false);

    this.sync = this.sync.bind(this);

    this.board.getAudioManager().registerAudioDevice(this);
  }

  public click(on: boolean): void {
    this.board.syncAudio();
    this.count++;
    this.sampleVolumeSum += on ? 1 : 0;
  }

  public sync(count: number): void {
    const audioBuffer = this.getAudioBufferMono();

    if (this.count) {
      this.sampleVolume = this.sampleVolumeSum / this.count;
      this.count = 0;
      this.sampleVolumeSum = 0;
    }
    
    for (let index = 0; index < count; index++) {
      audioBuffer[index++] = this.sampleVolume;
    }
  }

  public getState(): any {
    let state: any = {};

    state.sampleVolume = this.sampleVolume;
    state.sampleVolumeSum = this.sampleVolumeSum;
    state.count = this.count;

    return state;
  }

  public setState(state: any): void {
    this.sampleVolume = state.sampleVolume;
    this.sampleVolumeSum = state.sampleVolumeSum;
    this.count = state.count;
  }

  private sampleVolume = 0;
  private sampleVolumeSum = 0;
  private count = 0;

}

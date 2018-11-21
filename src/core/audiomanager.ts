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

import { Board } from './board';

export const SAMPLE_RATE = 44100;
export const MAX_AUDIO_BUFFER_SIZE = 10000 * 2;

export abstract class AudioDevice {
  public constructor(
    private name: string,
    private stereo: boolean) {
  }

  public getName(): string {
    return name;
  }

  public isStereo(): boolean {
    return this.stereo;
  }

  public getVolumeLeft(): number {
    return 100;
  }

  public getVolumeRight(): number {
    return 100;
  }

  public abstract sync(count: number): Array<number>;
}

export class AudioManager {
  public constructor(
    private board: Board)
  {
    this.audioDevices = [];
  }

  public setEnable(enable: boolean): void {
    this.enable = enable;
  }

  public registerAudioDevice(audioDevice: AudioDevice): void {
    this.audioDevices.push(audioDevice);
  }

  public sync(): void {
    const elapsed = SAMPLE_RATE * this.board.getTimeSince(this.timeRef) + this.timeFrag;
    this.timeRef = this.board.getSystemTime();
    this.timeFrag = elapsed % this.board.getSystemFrequency();
    let count = elapsed / this.board.getSystemFrequency() | 0;
    
    if (!this.enable) {
      while (count--) {
       this.buffer[this.index++] = 0;
        this.buffer[this.index++] = 0;

        if (this.index == this.fragmentSize) {
          this.index = 0;
        }
      }
      return;
    }

    let chBuff: Array<Array<number>> = [];
    for (let i = 0; i < this.audioDevices.length; i++) {
      chBuff[i] = this.audioDevices[i].sync(count);
    }
    for (let idx = 0; idx < count; idx++) {
      let left = 0;
      let right = 0;

      for (let i = 0; i < chBuff.length; i++) {
        let chanLeft = 0;
        let chanRight = 0;
        const audioDevice = this.audioDevices[i];

        if (audioDevice.isStereo()) {
          chanLeft = audioDevice.getVolumeLeft() * chBuff[i][2 * idx];
          chanRight = audioDevice.getVolumeRight() * chBuff[i][2* idx + 1];
        }
        else {
          chanLeft = chanRight = audioDevice.getVolumeLeft() * chBuff[i][idx];
        }

        left += chanLeft;
        right += chanRight;
      }

      left = left / 4096 | 0;
      right = right / 4096 | 0;
      
      if (left > 32767) { left = 32767; }
      if (left < -32767) { left = -32767; }
      if (right > 32767) { right = 32767; }
      if (right < -32767) { right = -32767; }

      this.buffer[this.index++] = left;
      this.buffer[this.index++] = right;

      if (this.index == this.fragmentSize) {
        this.index = 0;
      }
    }
  }

  private audioDevices: AudioDevice[];
  private timeRef = 0;
  private timeFrag = 0;
  private index = 0;
  private fragmentSize = 512;
  private enable = true;

  private buffer = new Array<number>(MAX_AUDIO_BUFFER_SIZE);
};

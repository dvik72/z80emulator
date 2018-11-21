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

export abstract class AudioDevice {
  public constructor(
    private name: string) {
  }

  public getName(): string {
    return name;
  }

  public abstract sync(count: number): Array<number>;
}

export class AudioManager {
  public constructor(
    private board: Board)
  {
    this.audioDevices = [];
  }

  public registerAudioDevice(audioDevice: AudioDevice): void {
    this.audioDevices.push(audioDevice);
  }

  public sync(): void {
    const elapsed = SAMPLE_RATE * this.board.getTimeSince(this.timeRef) + this.timeFrag;
    this.timeRef = this.board.getSystemTime();
    this.timeFrag = elapsed % this.board.getSystemFrequency();
    let count = elapsed / this.board.getSystemFrequency() | 0;
  }

  private audioDevices: AudioDevice[];
  private timeRef = 0;
  private timeFrag = 0
};

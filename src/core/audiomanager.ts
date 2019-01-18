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
import { Timer } from './timeoutmanager';
import { WebAudio } from '../audio/webaudio';

const MAX_AUDIO_BUFFER_SIZE = 10000;

export abstract class AudioDevice {
  public constructor(
    private name: string,
    private stereo: boolean) {
  }

  public getName(): string {
    return this.name;
  }

  public isStereo(): boolean {
    return this.stereo;
  }

  public getVolumeLeft(): number {
    return 1.0;
  }

  public getVolumeRight(): number {
    return 1.0;
  }

  public getAudioBufferMono() {
    return this.audioBufferLeft;
  }

  public getAudioBufferLeft() {
    return this.audioBufferLeft;
  }

  public getAudioBufferRight() {
    return this.stereo ? this.audioBufferRight : this.audioBufferLeft;
  }

  public setSampleRate(sampleRate: number) {
    this.sampleRate = sampleRate;
  }

  public abstract sync(count: number): void;

  protected audioBufferLeft = new Float32Array(MAX_AUDIO_BUFFER_SIZE);
  protected audioBufferRight = new Float32Array(MAX_AUDIO_BUFFER_SIZE);
  protected sampleRate = 1;
}

export class AudioManager {
  public constructor(
    private webAudio: WebAudio,
    private board: Board)
  {
    this.sampleRate = this.webAudio.getSampleRate();
    this.audioDevices = [];

    this.onSync = this.onSync.bind(this);
    this.syncTimer = board.getTimeoutManager().createTimer('Audio Sync', this.onSync);
    this.syncPeriod = this.board.getSystemFrequency() / 1000 | 0;
    this.onSync();
    return;
  }

  public setEnable(enable: boolean): void {
    this.enable = enable;
  }

  public getSampleRate(): number {
    return this.sampleRate;
  }

  public registerAudioDevice(audioDevice: AudioDevice): void {
    audioDevice.setSampleRate(this.getSampleRate());
    this.audioDevices.push(audioDevice);
  }

  private onSync(): void {
    this.sync();
    this.syncTimer.setTimeout(this.board.getSystemTime() + this.syncPeriod);
  }
  
  public sync(): void {
    const elapsed = this.sampleRate * this.board.getTimeSince(this.timeRef) + this.timeFrag;
    this.timeRef = this.board.getSystemTime();
    this.timeFrag = elapsed % this.board.getSystemFrequency();
    let count = elapsed / this.board.getSystemFrequency() | 0;

    if (!this.enable) {
      while (count--) {
        this.webAudio.addSample(0, 0);
      }
      return;
    }

    for (let i = 0; i < this.audioDevices.length; i++) {
      this.audioDevices[i].sync(count);
    }
    for (let idx = 0; idx < count; idx++) {
      let left = 0;
      let right = 0;

      for (let i = 0; i < this.audioDevices.length; i++) {
        const audioDevice = this.audioDevices[i];
        const audioBufferLeft = audioDevice.getAudioBufferLeft();
        const audioBufferRight = audioDevice.getAudioBufferRight();

        left += audioDevice.getVolumeLeft() * audioBufferLeft[idx];
        right += audioDevice.getVolumeRight() * audioBufferRight[idx];
      }

      // Perform DC offset filtering
      this.volumeLeft *= 0.9985;
      this.volumeLeft += left - this.oldVolumeLeft;
      this.oldVolumeLeft = left;
      this.volumeRight *= 0.9985;
      this.volumeRight += right - this.oldVolumeRight;
      this.oldVolumeRight = right;
      
      // Perform simple 1 pole low pass IIR filtering
      this.outVolumeLeft += 2 * (this.volumeLeft - this.outVolumeLeft) / 3;
      this.outVolumeRight += 2 * (this.volumeRight - this.outVolumeRight) / 3;

      // Clip volumes if needed
      const logClip = true;
      if (this.outVolumeLeft >= 1) { logClip && console.log('clip: ' + this.outVolumeLeft); this.outVolumeLeft = 0.99999; }
      if (this.outVolumeLeft <= -1) { logClip && console.log('clip: ' + this.outVolumeLeft); this.outVolumeLeft = -0.99999; }
      if (this.outVolumeRight >= 1) { logClip && console.log('clip: ' + this.outVolumeRight); this.outVolumeRight = 0.99999; }
      if (this.outVolumeRight <= -1) { logClip && console.log('clip: ' + this.outVolumeRight); this.outVolumeRight = -0.99999; }

      this.webAudio.addSample(this.outVolumeLeft, this.outVolumeRight);
    }
  }

  private volumeLeft = 0;
  private oldVolumeLeft = 0;
  private outVolumeLeft = 0;
  private volumeRight = 0;
  private oldVolumeRight = 0;
  private outVolumeRight = 0;

  private audioDevices: AudioDevice[];
  private timeRef = 0;
  private timeFrag = 0;
  private enable = true;
  
  private sampleRate: number;

  private syncTimer: Timer;
  private syncPeriod = 0;
};

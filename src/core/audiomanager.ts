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
    return 1.0;
  }

  public getVolumeRight(): number {
    return 1.0;
  }

  public abstract sync(sampleRate: number, count: number): Array<number>;
}

export class AudioManager {
  public constructor(
    private board: Board)
  {
    this.audioDevices = [];

    this.onSync = this.onSync.bind(this);
    this.syncTimer = board.getTimeoutManager().createTimer('Audio Sync', this.onSync);
    this.syncPeriod = this.board.getSystemFrequency() / 50 | 0;
    this.onSync();

    this.playingBuffer = undefined;
    this.audioContext = new AudioContext();
    this.sampleRate = this.audioContext.sampleRate;
    this.gainNode = this.audioContext.createGain();
    this.gainNode.connect(this.audioContext.destination);
    this.audioBuffer = this.audioContext.createBuffer(2, this.fragmentSize, this.sampleRate);
    this.audioDataLeft = this.audioBuffer.getChannelData(0);
    this.audioDataRight = this.audioBuffer.getChannelData(1);
    this.bufferSource = this.audioContext.createBufferSource();
    this.bufferSource.connect(this.gainNode);
  }

  public setEnable(enable: boolean): void {
    this.enable = enable;
  }

  public getSampleRate(): number {
    return this.sampleRate;
  }

  public registerAudioDevice(audioDevice: AudioDevice): void {
    this.audioDevices.push(audioDevice);
  }

  private onSync(): void {
    this.sync();
    this.syncTimer.setTimeout(this.board.getSystemTime() + this.syncPeriod);
  }

  private playFragment() {
    if (this.playingBuffer) {
      this.playingBuffer.stop();
    }

    this.bufferSource.buffer = this.audioBuffer;
    this.playingBuffer = this.bufferSource;
    this.playingBuffer.start(0);

    this.audioBuffer = this.audioContext.createBuffer(2, this.fragmentSize, this.sampleRate);
    this.audioDataLeft = this.audioBuffer.getChannelData(0);
    this.audioDataRight = this.audioBuffer.getChannelData(1);
    this.bufferSource = this.audioContext.createBufferSource();
    this.bufferSource.connect(this.gainNode);
  }

  public sync(): void {
    const elapsed = this.sampleRate * this.board.getTimeSince(this.timeRef) + this.timeFrag;
    this.timeRef = this.board.getSystemTime();
    this.timeFrag = elapsed % this.board.getSystemFrequency();
    let count = elapsed / this.board.getSystemFrequency() | 0;
    
    if (!this.enable) {
      while (count--) {
        this.audioDataLeft[this.index] = 0;
        this.audioDataRight[this.index++] = 0;

        if (this.index == this.fragmentSize) {
          this.index = 0;
          this.playFragment();
        }
      }
      return;
    }

    let chBuff: Array<Array<number>> = [];
    for (let i = 0; i < this.audioDevices.length; i++) {
      chBuff[i] = this.audioDevices[i].sync(this.sampleRate, count);
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
      
      if (left > 1) { left = 1; }
      if (left < -1) { left = -1; }
      if (right > 1) { right = 1; }
      if (right < -1) { right = -1; }
      
      this.audioDataLeft[this.index] = left;
      this.audioDataRight[this.index++] = right;

      if (this.index == this.fragmentSize) {
        this.index = 0;
        this.playFragment();
      }
    }
  }

  private audioDevices: AudioDevice[];
  private timeRef = 0;
  private timeFrag = 0;
  private index = 0;
  private enable = true;
  
  private audioContext: AudioContext;
  private gainNode: GainNode;
  private audioBuffer: AudioBuffer;
  private playingBuffer?: AudioBufferSourceNode;
  private bufferSource: AudioBufferSourceNode;
  private fragmentSize = 8192;
  private sampleRate = 44100;
  private audioDataLeft: Float32Array;
  private audioDataRight: Float32Array;

  private syncTimer: Timer;
  private syncPeriod = 0;
};

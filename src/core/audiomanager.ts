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

class SoundBuffer {
  private chunks: Array<AudioBufferSourceNode> = [];
  private isPlaying: boolean = false;
  private startTime: number = 0;
  private lastChunkOffset: number = 0;

  constructor(public ctx: AudioContext, public sampleRate: number, public bufferSize: number = 6) { }

  private createChunk(chunkLeft: Float32Array, chunkRight: Float32Array) {
    var audioBuffer = this.ctx.createBuffer(2, chunkLeft.length, this.sampleRate);
    audioBuffer.getChannelData(0).set(chunkLeft);
    audioBuffer.getChannelData(1).set(chunkRight);
    var source = this.ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.ctx.destination);
    source.onended = (e: Event) => {
      this.chunks.splice(this.chunks.indexOf(source), 1);
      if (this.chunks.length == 0) {
        this.isPlaying = false;
        this.startTime = 0;
        this.lastChunkOffset = 0;
      }
    };

    return source;
  }

  public addChunk(dataLeft: Float32Array, dataRight: Float32Array) {
    if (this.isPlaying && (this.chunks.length > this.bufferSize)) {
      return;
    } else if (this.isPlaying && (this.chunks.length <= this.bufferSize)) {
      let chunk = this.createChunk(dataLeft, dataRight);
      if (!chunk.buffer) {
        return;
      }
      chunk.start(this.startTime + this.lastChunkOffset);
      this.lastChunkOffset += chunk.buffer.duration;
      this.chunks.push(chunk);
    } else if ((this.chunks.length < (this.bufferSize / 2)) && !this.isPlaying) {
      let chunk = this.createChunk(dataLeft, dataRight);
      this.chunks.push(chunk);
    } else {
      this.isPlaying = true;
      let chunk = this.createChunk(dataLeft, dataRight);
      this.chunks.push(chunk);
      this.startTime = this.ctx.currentTime;
      this.lastChunkOffset = 0;
      for (let i = 0; i < this.chunks.length; i++) {
        let chunk = this.chunks[i];
        if (!chunk.buffer) {
          return;
        }
        chunk.start(this.startTime + this.lastChunkOffset);
        this.lastChunkOffset += chunk.buffer.duration;
      }
    }
  }
}

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
    private board: Board)
  {
    this.audioDevices = [];

    this.onSync = this.onSync.bind(this);
    this.syncTimer = board.getTimeoutManager().createTimer('Audio Sync', this.onSync);
    this.syncPeriod = this.board.getSystemFrequency() / 1000 | 0;
    this.onSync();

    this.audioContext = new AudioContext();
    this.sampleRate = this.audioContext.sampleRate;
    this.fragmentSize = this.sampleRate / 400 | 0;

    this.gainNode = this.audioContext.createGain();
    this.gainNode.connect(this.audioContext.destination);

    this.soundBuffer = new SoundBuffer(this.audioContext, this.sampleRate, 24);
    this.audioDataLeft = new Float32Array(this.fragmentSize);
    this.audioDataRight = new Float32Array(this.fragmentSize);
    return;
  }

  public setEnable(enable: boolean): void {
    this.enable = enable;
  }

  public getSampleRate(): number {
    return this.sampleRate;
  }

  public registerAudioDevice(audioDevice: AudioDevice): void {
    audioDevice.setSampleRate(this.sampleRate);
    this.audioDevices.push(audioDevice);
  }

  private onSync(): void {
    this.sync();
    this.syncTimer.setTimeout(this.board.getSystemTime() + this.syncPeriod);
  }

  private playFragment() {
    this.soundBuffer.addChunk(this.audioDataLeft, this.audioDataRight);
    this.audioDataLeft = new Float32Array(this.fragmentSize);
    this.audioDataRight = new Float32Array(this.fragmentSize);
    return;
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
      if (this.outVolumeLeft > 1) { console.log('clip: ' + this.outVolumeLeft); this.outVolumeLeft = 1; }
      if (this.outVolumeLeft < -1) { console.log('clip: ' + this.outVolumeLeft); this.outVolumeLeft = -1; }
      if (this.outVolumeRight > 1) { console.log('clip: ' + this.outVolumeRight); this.outVolumeRight = 1; }
      if (this.outVolumeRight < -1) { console.log('clip: ' + this.outVolumeRight); this.outVolumeRight = -1; }
      
      this.audioDataLeft[this.index] = this.outVolumeLeft;
      this.audioDataRight[this.index++] = this.outVolumeRight;

      if (this.index == this.fragmentSize) {
        this.index = 0;
        this.playFragment();
      }
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
  private index = 0;
  private enable = true;
  
  private audioContext: AudioContext;
  private gainNode: GainNode;
  private fragmentSize = 8192;
  private sampleRate = 44100;
  private audioDataLeft: Float32Array;
  private audioDataRight: Float32Array;

  private syncTimer: Timer;
  private syncPeriod = 0;

  private soundBuffer: SoundBuffer;
};

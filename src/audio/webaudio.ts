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

export class WebAudio {
  private ctx: AudioContext;
  private gainNode: GainNode;
  private chunks: Array<AudioBufferSourceNode> = [];
  private isPlaying: boolean = false;
  private nextStartTime: number = 0;
  private bufferSize = 6;
 
  private sampleRate: number;
  private fragmentSize: number;
  private index = 0;

  private audioDataLeft: Float32Array;
  private audioDataRight: Float32Array;

  constructor() {
    this.ctx = new AudioContext();
    this.sampleRate = this.ctx.sampleRate;
    this.fragmentSize = this.sampleRate / 100 | 0;

    this.gainNode = this.ctx.createGain();
    this.gainNode.connect(this.ctx.destination);

    this.audioDataLeft = new Float32Array(this.fragmentSize);
    this.audioDataRight = new Float32Array(this.fragmentSize);
  }

  public resume(): void {
    this.ctx.resume();
  }

  public reset(): void {
    this.index = 0;
  }

  public getSampleRate(): number {
    return this.sampleRate;
  }

  public addSample(left: number, right: number) {
    this.audioDataLeft[this.index] = left;
    this.audioDataRight[this.index++] = right;

    if (this.index == this.fragmentSize) {
      this.index = 0;

      this.addChunk(this.audioDataLeft, this.audioDataRight);
      this.audioDataLeft = new Float32Array(this.fragmentSize);
      this.audioDataRight = new Float32Array(this.fragmentSize);
    }
  }

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
      }
    };

    return source;
  }

  private draining = false;

  private fullCount = 0;

  private addChunk(dataLeft: Float32Array, dataRight: Float32Array) {
    if (this.isPlaying && this.draining) {
      this.draining = this.chunks.length > this.bufferSize / 4;
      return;
    }

    if (this.isPlaying && (this.chunks.length > this.bufferSize)) {
      console.log('WEBAUDIO: Buffer full (' + ++this.fullCount + ')');
      this.draining = true;
      return;
    }

    if (this.isPlaying && (this.chunks.length <= this.bufferSize)) {
      let chunk = this.createChunk(dataLeft, dataRight);
      if (!chunk.buffer) {
        console.log('WEBAUDIO: Failed to create chunk');
        return;
      }
      chunk.start(this.nextStartTime);
      this.nextStartTime += chunk.buffer.duration;
      this.chunks.push(chunk);
      return;
    }

    if ((this.chunks.length < (this.bufferSize / 2)) && !this.isPlaying) {
      let chunk = this.createChunk(dataLeft, dataRight);
      this.chunks.push(chunk);
      return;
    }

    this.isPlaying = true;
    let chunk = this.createChunk(dataLeft, dataRight);
    this.chunks.push(chunk);
    this.nextStartTime = this.ctx.currentTime;
    for (let i = 0; i < this.chunks.length; i++) {
      let chunk = this.chunks[i];
      if (!chunk.buffer) {
        return;
      }
      chunk.start(this.nextStartTime);
      this.nextStartTime += chunk.buffer.duration;
    }
  }
}

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

import { Board } from '../core/board';
import { AudioDevice } from '../core/audiomanager';
import { Ymf278 } from '../audio/ymf278';
import { Ymf262 } from '../audio/ymf262';

export class Moonsound extends AudioDevice {
  constructor(
    private board: Board,
    romData: Uint8Array,
    ramSize: number
  ) {
    super('Moonsound', true);

    this.board.getAudioManager().registerAudioDevice(this);

    this.ymf262 = new Ymf262(this.board);
    this.ymf278 = new Ymf278(this.board, ramSize, romData);

    this.ymf262.setSampleRate(this.sampleRate);
    this.ymf278.setSampleRate(this.sampleRate);
  }

  public reset() {
    this.ymf262.reset();
    this.ymf278.reset();
  }

  public read(ioPort: number): number {
    let result = 0xff;

    if (ioPort < 0xC0) {
      switch (ioPort & 0x01) {
        case 1: // read wave register
          this.board.syncAudio();
          result = this.ymf278.readReg(this.opl4latch);
          break;
      }
    } else {
      switch (ioPort & 0x03) {
        case 0: // read status
        case 2:
          this.board.syncAudio();
          result = this.ymf262.readStatus() | this.ymf278.readStatus();
          break;
        case 1:
        case 3: // read fm register
          this.board.syncAudio();
          result = this.ymf262.readReg(this.opl3latch);
          break;
      }
    }

    return result;
  }

  public write(ioPort: number, value: number) {
    if (ioPort < 0xC0) {
      switch (ioPort & 0x01) {
        case 0: // select register
          this.opl4latch = value;
          break;
        case 1:
          this.board.syncAudio();
          this.ymf278.writeReg(this.opl4latch, value);
          break;
      }
    } else {
      switch (ioPort & 0x03) {
        case 0:
          this.opl3latch = value;
          break;
        case 2: // select register bank 1
          this.opl3latch = value | 0x100;
          break;
        case 1:
        case 3: // write fm register
          this.board.syncAudio();
          this.ymf262.writeReg(this.opl3latch, value);
          break;
      }
    }
  }


  public sync(count: number): void {
    const audioBufferLeft = this.getAudioBufferLeft();
    const audioBufferRight = this.getAudioBufferRight();

    const ymf262Buffers = this.ymf262.sync(count);
    const ymf278Buffers = this.ymf278.sync(count);

    for (let i = 0; i < count; i++) {
      audioBufferLeft[i] = (ymf262Buffers[0][i] + ymf278Buffers[0][i]) / 180000;
      audioBufferRight[i] = (ymf262Buffers[1][i] + ymf278Buffers[1][i]) / 180000;
    }
  }

  private ymf278: Ymf278;
  private ymf262: Ymf262;
  private opl3latch = 0;
  private opl4latch = 0;
}
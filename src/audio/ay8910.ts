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
import { Port } from '../core/iomanager';

export enum Ay8910ConnectorType { MSX, SCCPLUS, SVI };
export enum PsgType { AY8910, YM2149, SN76489 };

const regMask = [
  0xff, 0x0f, 0xff, 0x0f, 0xff, 0x0f, 0x1f, 0x3f,
  0x1f, 0x1f, 0x1f, 0xff, 0xff, 0x0f, 0xff, 0xff
];

const BASE_PHASE_STEP = 0x28959bec;

const AUDIO_BUFFER_SIZE = 10000;

export class Ay8910 {
  constructor(
    private board: Board,
    connectorType: Ay8910ConnectorType,
    psgType: PsgType,
    private readCb?: (port: number) => number,
    private writeCb?: (port: number, value: number) => void
  ) {
    this.writeAddress = this.writeAddress.bind(this);
    this.writeData = this.writeData.bind(this);
    this.readData = this.readData.bind(this);

    let v = 0x26a9;
    for (let i = 15; i >= 0; i--) {
      this.voltTable[i] = v | 0;
      this.voltEnvTable[2 * i + 0] = v | 0;
      this.voltEnvTable[2 * i + 1] = v | 0;
      v *= 0.707945784384;
    }

    if (psgType == PsgType.YM2149) {
      let v = 0x26a9;
      for (let i = 31; i >= 0; i--) {
        this.voltEnvTable[i] = v | 0;
        v *= 0.84139514164529;
      }
    }

    for (let i = 0; i < 16; i++) {
      this.voltTable[i] -= this.voltTable[0];
    }
    for (let i = 0; i < 32; i++) {
      this.voltEnvTable[i] -= this.voltEnvTable[0];
    }

    switch (connectorType) {
      case Ay8910ConnectorType.MSX:
        this.board.getIoManager().registerPort(0xa0, new Port(undefined, this.writeAddress));
        this.board.getIoManager().registerPort(0xa1, new Port(undefined, this.writeData));
        this.board.getIoManager().registerPort(0xa2, new Port(this.readData, undefined));
        break;
      case Ay8910ConnectorType.SCCPLUS:
        this.board.getIoManager().registerPort(0x10, new Port(undefined, this.writeAddress));
        this.board.getIoManager().registerPort(0x11, new Port(undefined, this.writeData));
        this.board.getIoManager().registerPort(0x12, new Port(this.readData, undefined));
        break;
      case Ay8910ConnectorType.SVI:
        this.board.getIoManager().registerPort(0x88, new Port(undefined, this.writeAddress));
        this.board.getIoManager().registerPort(0x8c, new Port(undefined, this.writeData));
        this.board.getIoManager().registerPort(0x90, new Port(this.readData, undefined));
        break;
    }
  }

  public reset(): void {
    this.noiseRand = 1;
    this.noiseVolume = 1;

    for (let i = 0; i < 16; i++) {
      this.writeAddress(0, i);
      this.writeData(1, 0);
    }
  }

  private writeAddress(unusedAddress: number, value: number): void {
    this.address = value & 0x0f;
  }

  private writeData(unusedAddress: number, value: number): void {
    this.updateRegister(this.address, value);
  }

  private updateRegister(regIndex: number, value: number): void {
    value &= regMask[regIndex];
    this.regs[regIndex] = value;

    if (regIndex < 14) {
      this.board.syncAudio();
    }

    switch (regIndex) {
      case 0:
      case 1:
      case 2:
      case 3:
      case 4:
      case 5: {
        let period = this.regs[regIndex & 6] | ((this.regs[regIndex | 1]) << 8);
          this.toneStep[regIndex >> 1] = period > 0 ? BASE_PHASE_STEP / period : 1 << 31;
        }
        break;

      case 6: {
          let period = value ? value : 1;
          this.noiseStep = period > 0 ? BASE_PHASE_STEP / period : 1 << 31;
        }
        break;

      case 7:
        this.enable = value;
        break;

      case 8:
      case 9:
      case 10:
        this.ampVolume[regIndex - 8] = value;
        break;

      case 11:
      case 12: {
          let period = 16 * (this.regs[11] | (this.regs[12] << 8));
          this.envStep = BASE_PHASE_STEP / (period ? period : 8);
        }
        break;

      case 13:
        if (value < 4) value = 0x09;
        if (value < 8) value = 0x0f;
        this.envShape = value;
        this.envPhase = 0;
        break;
      case 14:
      case 15:
        if (this.writeCb) {
          const port = value & 1;
          this.writeCb(port, value);
        }
    }
  }

  private readData(unusedAddress: number): number {
    if (this.address >= 14) {
      const port = this.address & 1;
      if (this.readCb) {
        this.regs[this.address] = this.readCb(port);
      }
    }
    return this.regs[this.address];    
  }

  private regs = new Array<number>(16);
  private address = 0;

  private tonePhase = new Array<number>(3);
  private toneStep = new Array<number>(3);
  private noisePhase = 0;
  private noiseStep = 0;
  private noiseRand = 0;
  private  noiseVolume = 0;

  private envShape = 0;
  private envStep = 0;
  private envPhase = 0;

  private enable = 0;
  private ampVolume = new Array<number>(3);
  private ctrlVolume = new Array<number>(2);
  private oldSampleVolume = new Array<number>(2);
  private daVolume = new Array<number>(2);

  private voltTable = new Array<number>(16);
  private voltEnvTable = new Array<number>(32);

  private buffer = new Array<number>(2 * AUDIO_BUFFER_SIZE);
}
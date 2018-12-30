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

export enum Ay8910ConnectorType { MSX, SCCPLUS, SVI };
export enum PsgType { AY8910 = 'AY8910', YM2149 = 'YM2149', SN76489 = 'SN76489' };

const regMask = [
  0xff, 0x0f, 0xff, 0x0f, 0xff, 0x0f, 0x1f, 0x3f,
  0x1f, 0x1f, 0x1f, 0xff, 0xff, 0x0f, 0xff, 0xff
];

export class Ay8910 extends AudioDevice {
  constructor(
    private board: Board,
    connectorType: Ay8910ConnectorType,
    psgType: PsgType,
    private readCb?: (port: number) => number,
    private writeCb?: (port: number, value: number) => void
  ) {
    super(psgType.toString(), false);
    
    this.writeAddress = this.writeAddress.bind(this);
    this.writeData = this.writeData.bind(this);
    this.readData = this.readData.bind(this);
    this.sync = this.sync.bind(this);

    this.board.getAudioManager().registerAudioDevice(this);
    this.basePhaseStep = (1 << 28) * (3579545 / 32 / this.sampleRate) | 0;

    let v = 1;
    for (let i = 15; i >= 0; i--) {
      this.voltTable[i] = v;
      this.voltEnvTable[2 * i + 0] = v;
      this.voltEnvTable[2 * i + 1] = v;
      v *= 0.707945784384;
    }

    if (psgType == PsgType.YM2149) {
      let v = 1;
      for (let i = 31; i >= 0; i--) {
        this.voltEnvTable[i] = v;
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
        this.toneStep[regIndex >> 1] = period > 0 ? this.basePhaseStep / period : 1 << 31;
        }
        break;

      case 6: {
          let period = value ? value : 1;
        this.noiseStep = period > 0 ? this.basePhaseStep / period : 1 << 31;
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
        this.envStep = this.basePhaseStep / (period ? period : 8);
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

  public sync(count: number): void {
    const audioBuffer = this.getAudioBufferMono();
    
    for (let index = 0; index < count; index++) {
      let sampleVolume = [ 0, 0, 0 ];

      // Update noise generator
      this.noisePhase = this.noisePhase + this.noiseStep & 0xffffffff;
      while (this.noisePhase >> 28) {
        this.noisePhase  -= 0x10000000;
        this.noiseVolume ^= ((this.noiseRand + 1) >> 1) & 1;
        this.noiseRand = (this.noiseRand ^ (0x28000 * (this.noiseRand & 1))) >> 1;
      }

      // Update envelope phase
      this.envPhase += this.envStep;
      if ((this.envShape & 1) && (this.envPhase >> 28)) {
        this.envPhase = 0x10000000;
      }

      // Calculate envelope volume
      let envVolume = (this.envPhase >> 23) & 0x1f;
      if (((this.envPhase >> 27) & (this.envShape + 1) ^ (~this.envShape >> 1)) & 2) {
        envVolume ^= 0x1f;
      }

      // Calculate and add channel samples to buffer
      for (let channel = 0; channel < 3; channel++) {
        let enable = this.enable >> channel;
        let noiseEnable = ((enable >> 3) | this.noiseVolume) & 1;
        let phaseStep = (~enable & 1) * this.toneStep[channel];
        let tonePhase = this.tonePhase[channel];
        let tone = 0;
        let count = 16;

        // Perform 16x oversampling 
        while (count--) {
          // Update phase of tone
          tonePhase += phaseStep;

          // Calculate if tone is on or off
          tone += (enable | (tonePhase >> 31)) & noiseEnable;
        }

        // Store phase
        this.tonePhase[channel] = tonePhase;

        // Amplify sample using either envelope volume or channel volume
        if (this.ampVolume[channel] & 0x10) {
          sampleVolume[channel] += tone * this.voltEnvTable[envVolume] / 156;
        }
        else {
          sampleVolume[channel] += tone * this.voltTable[this.ampVolume[channel]] / 156;
        }
      }
      
      audioBuffer[index] = sampleVolume[0] + sampleVolume[1] + sampleVolume[2];
    }
  }

  private regs = new Uint8Array(16);
  private address = 0;

  private tonePhase = [0, 0, 0];
  private toneStep = [0, 0, 0];
  private noisePhase = 0;
  private noiseStep = 0;
  private noiseRand = 0;
  private  noiseVolume = 0;

  private envShape = 0;
  private envStep = 0;
  private envPhase = 0;

  private basePhaseStep = 0;

  private enable = 0;
  private ampVolume = [0, 0, 0];

  private voltTable = new Array<number>(16);
  private voltEnvTable = new Array<number>(32);
}
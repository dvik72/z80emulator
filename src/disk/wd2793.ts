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

import { DiskManager } from '../disk/diskmanager'
import { Disk, DiskError } from './disk';
import { Board } from '../core/board';
import { LedType } from '../core/ledmanager';
import { SaveState } from '../core/savestate';


const CMD_RESTORE = 0x00;
const CMD_SEEK = 0x01;
const CMD_STEP1 = 0x02;
const CMD_STEP2 = 0x03;
const CMD_STEP_IN1 = 0x04;
const CMD_STEP_IN2 = 0x05;
const CMD_STEP_OUT1 = 0x06;
const CMD_STEP_OUT2 = 0x07;
const CMD_READ_SECTOR = 0x08;
const CMD_READ_SECTORS = 0x09;
const CMD_WRITE_SECTOR = 0x0a;
const CMD_WRITE_SECTORS = 0x0b;
const CMD_READ_ADDRESS = 0x0c;
const CMD_FORCE_INTERRUPT = 0x0d;
const CMD_READ_TRACK = 0x0e;
const CMD_WRITE_TRACK = 0x0f;

// Type II commands status
const ST_BUSY = 0x01;
const ST_INDEX = 0x02;
const ST_DATA_REQUEST = 0x02;
const ST_TRACK00 = 0x04;
const ST_LOST_DATA = 0x04;
const ST_CRC_ERROR = 0x08;
const ST_SEEK_ERROR = 0x10;
const ST_RECORD_NOT_FOUND = 0x10;
const ST_HEAD_LOADED = 0x20;
const ST_RECORD_TYPE = 0x20;
const ST_WRITE_PROTECTED = 0x40;
const ST_NOT_READY = 0x80;

const FLAG_HLD = 0x08;
const FLAG_IMM = 0x08;
const FLAG_DDM = 0x10;

const TIME_PER_STEP = [200, 100, 66, 50];

export enum Wd2793Type {
  WD1772,
  WD1793,
  WD2793
};

export class Wd2793 {
  public constructor(
    private diskManager: DiskManager,
    private board: Board,
    private type: Wd2793Type
  ) {
    this.disk = this.diskManager.getFloppyDisk(this.diskNo = 0);

    this.reset();
  }

  public getSide(): number {
    return this.side;
  }

  public setSide(side: number): void {
    this.sync();

    if (this.type != Wd2793Type.WD1772) {
      this.side = side;
    }
  }

  public setDensity(density: number): void {
    this.density = density;
  }

  public getDrive(): number {
    return this.drive;
  }
 
  public setDrive(drive: number): void {
    this.sync();

    if (this.drive != -1) {
      this.tracks[this.drive] = this.track;
    }
    if (drive != -1) {
      this.track = this.tracks[drive];
    }
    this.disk = this.diskManager.getFloppyDisk(this.diskNo = drive);
  }

  public setMotor(motorOn: boolean) {
    switch (this.drive) {
      case 0:
        this.board.getLedManager().getLed(LedType.FDD1).set(motorOn);
        this.board.getLedManager().getLed(LedType.FDD2).set(false);
        break;
      case 1:
        this.board.getLedManager().getLed(LedType.FDD1).set(false);
        this.board.getLedManager().getLed(LedType.FDD2).set(motorOn);
        break;
      default:
        this.board.getLedManager().getLed(LedType.FDD1).set(false);
        this.board.getLedManager().getLed(LedType.FDD2).set(false);
        break;
    }
  }

  public hasChanged(drive: number): boolean {
    return this.disk.hasChanged();
  }

  public getDataRequest(): number {
    this.sync();

    if (((this.regCommand & 0xF0) == 0xF0) && ((this.regStatus & ST_BUSY) || this.dataReady)) {
      const pulses = this.board.getTimeSince(this.dataRequsetTime) / (this.board.getSystemFrequency() / 5 | 0) | 0;
      if (this.dataReady) {
        this.dataRequest = 1;
      }
      if (pulses > 0) {
        this.dataReady = 1;
      }
      if (pulses > 1) {
        this.dataAvailable = 0;
        this.sectorOffset  = 0;
        this.dataRequest   = 0;
        this.intRequest    = 1;
        this.regStatus    &= ~ST_BUSY;
      }
    }

    if ((this.regCommand & 0xe0) == 0x80 && (this.regStatus & ST_BUSY)) {
      const pulses = this.board.getTimeSince(this.dataRequsetTime) / (this.board.getSystemFrequency() / 25 | 0) | 0;
      if (this.dataReady) {
        this.dataRequest = 1;
      }
      if (pulses > 0) {
        this.dataReady = 1;
      }
    }

    return this.dataRequest;
  }

  public getIrq(): number {
    this.sync();

    return this.intRequest;
  }

  public setTrackReg(value: number): void {
    this.sync();

    this.regTrack = value;
  }

  public getTrackReg(): number {
    this.sync();

    return this.regTrack;
  }

  public setSectorReg(value: number): void {
    this.sync();

    this.regSector = value;
  }

  public getSectorReg(): number {
    this.sync();

    return this.regSector;
  }

  public getDataReg(): number {
    this.sync();

    if (((this.regCommand & 0xe0) == 0x80) && (this.regStatus & ST_BUSY)) {
      this.regData = this.sectorBuf[this.sectorOffset];
      this.sectorOffset++;
      if (this.dataAvailable) {
        this.dataAvailable--;
      }
      if (this.dataAvailable == 0) {
        if (!(this.regCommand & FLAG_DDM)) {
          this.regStatus &= ~(ST_BUSY | ST_DATA_REQUEST);
          this.dataRequest = 0;
          this.intRequest = 1;
        } else {
          this.regSector++;
          this.readSector();
        }
      }
    }

    return this.regData;
  }

  public setDataReg(value: number): void {
    this.sync();

    this.regData = value;
    if ((this.regCommand & 0xE0) == 0xA0) {
      this.sectorBuf[this.sectorOffset] = value;
      this.sectorOffset++;
      if (this.dataAvailable) {
        this.dataAvailable--;
      }
      if (this.dataAvailable == 0) {
        let diskError = DiskError.NO_DATA;
        if (this.drive >= 0) {
          this.dataRequsetTime = this.board.getSystemTime();
          diskError = this.drive < 0 ? DiskError.NO_DATA :
            this.disk.writeSector(this.sectorBuf, this.regSector, this.side, this.track);
        }
        this.sectorOffset = 0;
        this.dataAvailable = this.disk.getSectorSize(this.side, this.track, this.density);
        if (diskError != DiskError.OK || this.track != this.regTrack) {
          this.regStatus |= ST_RECORD_NOT_FOUND;
          this.intRequest = 1;
          this.regStatus &= ~ST_BUSY;
          return;
        }
        this.regStatus &= ~(ST_BUSY | ST_DATA_REQUEST);
        if (!(this.regCommand & FLAG_DDM)) {
          this.intRequest  = 1;
          this.dataRequest = 0;
        }
      }
    }
  }

  public getStatusReg(): number {
    this.sync();

    if (((this.regCommand & 0x80) == 0) || ((this.regCommand & 0xf0) == 0xd0)) {
      this.regStatus &= ~(ST_INDEX | ST_TRACK00 | ST_HEAD_LOADED | ST_WRITE_PROTECTED);
      if (this.disk.isEnabled()) {
        if (this.disk.isPresent()) {
          if (160 * this.board.getSystemTime() / this.board.getSystemFrequency() & 0x1e) {
            this.regStatus |= ST_INDEX;
          }
        }
        if (this.track == 0) {
          this.regStatus |=  ST_TRACK00;
        }
        if (this.headLoaded) {
          this.regStatus |=  ST_HEAD_LOADED;
        }
      }
      else {
        this.regStatus |= ST_WRITE_PROTECTED;
      }
    }
    else {
      if (this.getDataRequest()) {
        this.regStatus |=  ST_DATA_REQUEST;
      }
      else {
        this.regStatus &= ~ST_DATA_REQUEST;
      }
    }

    if (this.disk.isPresent()) {
      this.regStatus &= ~ST_NOT_READY;
    }
    else {
      this.regStatus |=  ST_NOT_READY;
    }

    this.intRequest = this.immediateInt;
  
    return this.regStatus;
  }

  public setCommandReg(value: number): void {
    this.sync();

    this.regCommand = value;
    this.intRequest = this.immediateInt;
    
    switch (this.regCommand >> 4) {
      case CMD_RESTORE:
      case CMD_SEEK:
      case CMD_STEP1:
      case CMD_STEP2:
      case CMD_STEP_IN1:
      case CMD_STEP_IN2:
      case CMD_STEP_OUT1:
      case CMD_STEP_OUT2:
        this.commandType1();
        break;

      case CMD_READ_SECTOR:
      case CMD_READ_SECTORS:
      case CMD_WRITE_SECTOR:
      case CMD_WRITE_SECTORS:
        this.commandType2();
        break;

      case CMD_READ_ADDRESS:
      case CMD_READ_TRACK:
      case CMD_WRITE_TRACK:
        this.commandType3();
        break;

      case CMD_FORCE_INTERRUPT:
        this.commandType4();
        break;
    }
  }

  public reset() {
    this.dataRequsetTime = 0;
    this.dataReady       = 0;
    this.curStep         = 0;
    this.step            = 0;
    this.stepTime        = 0;
    this.sectorOffset    = 0;
    this.dataAvailable   = 0;
    this.regStatus       = 0;
    this.regTrack        = 0;
    this.regData         = 0;
    this.stepDirection   = 1;
    this.regCommand      = 0x03;
    this.regSector       = 0x01;
    this.dataRequest     = 0;
    this.intRequest      = 0;
    this.immediateInt    = 0;
    this.headLoaded      = 0;
    this.drive           = 0;
    this.track       = 0;
    this.tracks   = [0, 0, 0, 0];
    this.side = 0;

    this.sectorBuf = new Uint8Array(512);
    for (let i in this.sectorBuf) {
      this.sectorBuf[i] = 0;  
    }

    this.board.getLedManager().getLed(LedType.FDD1).set(false);
    this.board.getLedManager().getLed(LedType.FDD2).set(false);
  }
  
  private readSector(): void {
    let diskError = DiskError.NO_DATA;
    if (this.drive >= 0) {
      const rv = this.disk.readSector(this.regSector, this.side, this.track);
      diskError = rv[0];
      this.sectorBuf = rv[1] || this.sectorBuf;
    }

    if (diskError == DiskError.NO_DATA || this.track != this.regTrack) {
      this.regStatus |= ST_RECORD_NOT_FOUND;
      this.intRequest = 1;
      this.regStatus &= ~ST_BUSY;
    }
    else {
      if (diskError == DiskError.CRC_ERROR) {
        this.regStatus |= ST_CRC_ERROR;
      }
      this.sectorOffset    = 0;
      this.dataRequest     = 0;
      this.dataReady       = 0;
      this.dataRequsetTime = this.board.getSystemTime();
      this.dataAvailable = this.sectorBuf.length;
    }
  }

  private sync(): void {
    if (this.step) {
      const steps = TIME_PER_STEP[this.regCommand & 3] * this.board.getTimeSince(this.stepTime) / this.board.getSystemFrequency() | 0;

      while (this.curStep < steps) {
        this.curStep++;
        if ((this.regCommand & 0x10) || ((this.regCommand & 0xe0) == 0x00)) {
          this.regTrack = this.regTrack + this.stepDirection & 0xff;
        }

        if (this.disk.isEnabled() &&
          ((this.stepDirection == -1 && this.track > 0) || this.stepDirection == 1)) {
          this.track = this.track + this.stepDirection & 0xff;
        }
        if (this.regCommand & 0xe0) {
          this.intRequest = 1;
          this.regStatus &= ~ST_BUSY;
          this.step       = 0;
          break;
        }
        if (this.stepDirection == -1 && this.disk.isEnabled() && this.track == 0) {
          this.regTrack   = 0;
          this.intRequest = 1;
          this.regStatus &= ~ST_BUSY;
          this.step       = 0;
          break;
        }

        if (this.regTrack == this.regData) {
          this.intRequest = 1;
          this.regStatus &= ~ST_BUSY;
          this.step       = 0;
          break;
        }
      }
    }
  }

  private commandType1(): void {
    this.regStatus  &= ~(ST_SEEK_ERROR | ST_CRC_ERROR);
    this.headLoaded  = this.regCommand & FLAG_HLD;
    this.regStatus  |= ST_BUSY;
    this.dataRequest = 0;

    switch (this.regCommand >> 4) {
      case CMD_RESTORE:
        this.regTrack = 0xff;
        this.regData  = 0x00;
        this.stepDirection = -1;
        break;

      case CMD_SEEK:
        if (this.regTrack == this.regData) {
          this.intRequest = 1;
          this.regStatus &= ~ST_BUSY;
          return;
        }
        this.stepDirection = this.regTrack > this.regData ? -1 : 1;
        break;

      case CMD_STEP1:
      case CMD_STEP2:
        break;

      case CMD_STEP_IN1:
      case CMD_STEP_IN2:
        this.stepDirection = 1;
        break;

      case CMD_STEP_OUT1:
      case CMD_STEP_OUT2:
        this.stepDirection = -1;
        break;
    }

    this.step     = 1;
    this.curStep  = 0;
    this.stepTime = this.board.getSystemTime();
  }

  private commandType2(): void {
    this.regStatus  &= ~(ST_LOST_DATA | ST_RECORD_NOT_FOUND | ST_RECORD_TYPE | ST_WRITE_PROTECTED);
    this.regStatus  |= ST_BUSY;
    this.headLoaded  = 1;
    this.dataRequest = 0;

    if (!this.disk.isPresent()) {
      this.intRequest  = 1;
      this.regStatus &= ~ST_BUSY;
      return;
    }

    switch (this.regCommand >> 4) {
      case CMD_READ_SECTOR:
      case CMD_READ_SECTORS:
        this.readSector();
        break;

      case CMD_WRITE_SECTOR:
      case CMD_WRITE_SECTORS:
        this.sectorOffset  = 0;
        this.dataRequest   = 1;
        this.dataAvailable = this.disk.getSectorSize(this.side, this.track, this.density);
        break;
    }
  }

  private commandType3(): void {
    this.regStatus  &= ~(ST_LOST_DATA | ST_RECORD_NOT_FOUND | ST_RECORD_TYPE);
    this.regStatus  |= ST_BUSY;
    this.headLoaded  = 1;
    this.dataRequest = 0;
    this.dataReady  = 0;

    if (!this.disk.isPresent()) {
      this.intRequest = 1;
      this.regStatus &= ~ST_BUSY;
      return;
    }

    switch (this.regCommand >> 4) {
      case CMD_READ_ADDRESS:
      case CMD_READ_TRACK:
        this.intRequest = 1;
        this.regStatus &= ~ST_BUSY;

      case CMD_WRITE_TRACK:
        this.dataRequest = 1;
        break;
    }
  }

  private commandType4(): void {
    const flags = this.regCommand & 0x0f;
    if (flags == 0x00) {
      this.immediateInt = 0;
    }
    if (flags & FLAG_IMM) {
      this.immediateInt = 1;
    }

    this.dataRequest = 0;
    this.regStatus  &= ~ST_BUSY;
  }
  
  public getState(): any {
    let state: any = {};

    state.regStatus = this.regStatus;
    state.regCommand = this.regCommand;
    state.regSector = this.regSector;
    state.regTrack = this.regTrack;
    state.regData = this.regData;
    state.immediateInt = this.immediateInt;
    state.intRequest = this.intRequest;
    state.dataRequest = this.dataRequest;
    state.dataReady = this.dataReady;
    state.stepDirection = this.stepDirection;
    state.step = this.step;
    state.curStep = this.curStep;
    state.headLoaded = this.headLoaded;
    state.dataRequsetTime = this.dataRequsetTime;
    state.stepTime = this.stepTime;
    state.sectorOffset = this.sectorOffset;
    state.dataAvailable = this.dataAvailable;
    state.drive = this.drive;
    state.track = this.track;
    state.side = this.side;
    state.density = this.density;

    state.tracks = SaveState.getArrayState(this.tracks);
    state.sectorBuf = SaveState.getArrayState(this.sectorBuf);

    return state;
  }

  public setState(state: any): void {
    this.regStatus = state.regStatus;
    this.regCommand = state.regCommand;
    this.regSector = state.regSector;
    this.regTrack = state.regTrack;
    this.regData = state.regData;
    this.immediateInt = state.immediateInt;
    this.intRequest = state.intRequest;
    this.dataRequest = state.dataRequest;
    this.dataReady = state.dataReady;
    this.stepDirection = state.stepDirection;
    this.step = state.step;
    this.curStep = state.curStep;
    this.headLoaded = state.headLoaded;
    this.dataRequsetTime = state.dataRequsetTime;
    this.stepTime = state.stepTime;
    this.sectorOffset = state.sectorOffset;
    this.dataAvailable = state.dataAvailable;
    this.drive = state.drive;
    this.track = state.track;
    this.side = state.side;
    this.density = state.density;

    SaveState.setArrayState(this.tracks, state.tracks);
    SaveState.setArrayState(this.sectorBuf, state.sectorBuf);

    this.disk = this.diskManager.getFloppyDisk(this.diskNo);
  }

  private disk: Disk;
  private diskNo = 0;

  private regStatus = 0;
  private regCommand = 0;
  private regSector = 0;
  private regTrack = 0;
  private regData = 0;
  private immediateInt = 0;
  private intRequest = 0;
  private dataRequest = 0;
  private dataReady = 0;
  private stepDirection = 0;
  private step = 0;
  private curStep = 0;
  private headLoaded = 0;
  private dataRequsetTime = 0;
  private stepTime = 0;
  private sectorOffset = 0;
  private dataAvailable = 0;
  private drive = 0;
  private track = 0;
  private tracks = [0, 0, 0, 0];
  private side = 0;
  private density = 0;

  private sectorBuf = new Uint8Array(512);
}
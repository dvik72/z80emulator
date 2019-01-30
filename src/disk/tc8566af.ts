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
import { Timer } from '../core/timeoutmanager';
import { SaveState } from '../core/savestate';


enum Command {
  UNKNOWN,
  READ_DATA,
  WRITE_DATA,
  WRITE_DELETED_DATA,
  READ_DELETED_DATA,
  READ_DIAGNOSTIC,
  READ_ID,
  FORMAT,
  SCAN_EQUAL,
  SCAN_LOW_OR_EQUAL,
  SCAN_HIGH_OR_EQUAL,
  SEEK,
  RECALIBRATE,
  SENSE_INTERRUPT_STATUS,
  SPECIFY,
  SENSE_DEVICE_STATUS,
};

enum Phase {
  IDLE,
  COMMAND,
  DATATRANSFER,
  RESULT,
};

const STM_DB0 = 0x01;
const STM_DB1 = 0x02;
const STM_DB2 = 0x04;
const STM_DB3 = 0x08;
const STM_CB = 0x10;
const STM_NDM = 0x20;
const STM_DIO = 0x40;
const STM_RQM = 0x80;

const ST0_DS0 = 0x01;
const ST0_DS1 = 0x02;
const ST0_HD = 0x04;
const ST0_NR = 0x08;
const ST0_EC = 0x10;
const ST0_SE = 0x20;
const ST0_IC0 = 0x40;
const ST0_IC1 = 0x80;

const ST1_MA = 0x01;
const ST1_NW = 0x02;
const ST1_ND = 0x04;
const ST1_OR = 0x10;
const ST1_DE = 0x20;
const ST1_EN = 0x80;

const ST2_MD = 0x01;
const ST2_BC = 0x02;
const ST2_SN = 0x04;
const ST2_SH = 0x08;
const ST2_NC = 0x10;
const ST2_DD = 0x20;
const ST2_CM = 0x40;

const ST3_DS0 = 0x01;
const ST3_DS1 = 0x02;
const ST3_HD = 0x04;
const ST3_2S = 0x08;
const ST3_TK0 = 0x10;
const ST3_RDY = 0x20;
const ST3_WP = 0x40;
const ST3_FLT = 0x80;

export class Tc8566af {
  public constructor(
    private diskManager: DiskManager,
    private board: Board
  ) {
    this.disk = this.diskManager.getFloppyDisk(this.diskNo = 0);

    this.timer = this.board.getTimeoutManager().createTimer('TC8566AF RQM timer', this.onTimer.bind(this));
  }

  public reset() {
    this.disk = this.diskManager.getFloppyDisk(this.diskNo = 0);

    this.mainStatus = STM_NDM | STM_RQM;

    this.mainStatus = 0;
    this.status0 = 0;
    this.status1 = 0;
    this.status2 = 0;
    this.status3 = 0;
    this.commandCode = 0;

    this.command = Command.UNKNOWN;
    this.phase = Phase.IDLE;
    this.phaseStep = 0;

    this.fillerByte = 0;

    this.cylinderNumber = 0;
    this.side = 0;
    this.sectorNumber = 0;
    this.number = 0;
    this.currentTrack = 0;
    this.sectorsPerCylinder = 0;

    this.sectorOffset = 0;
    this.dataTransferTime = 0;

    for (let i = 0; i < 512; i++) {
      this.sectorBuf[i] = this.fillerByte;
    }
    
    this.board.getLedManager().getLed(LedType.FDD1).set(false);
    this.board.getLedManager().getLed(LedType.FDD2).set(false);
  }

  public readRegister(reg: number): number {
    switch (reg) {
      case 4:
        if (~this.mainStatus & STM_RQM) {
          const elapsed = this.board.getTimeSince(this.dataTransferTime);
          if (elapsed > this.board.getSystemFrequency() * 60 / 1000000) {
            this.mainStatus |= STM_RQM;
          }
        }
        return (this.mainStatus & ~STM_NDM) | (this.phase == Phase.DATATRANSFER ? STM_NDM : 0);

      case 5:
        switch (this.phase) {
          case Phase.DATATRANSFER:
            reg = this.executionPhaseRead();
            this.dataTransferTime = this.board.getSystemTime();
            this.mainStatus &= ~STM_RQM;
            this.timer.setTimeout(this.board.getSystemTime() + this.board.getSystemFrequency() * 60 / 1000000);
            return reg;

          case Phase.RESULT:
            return this.resultsPhaseRead();
        }
    }

    return 0x00;
  }

  public writeRegister(reg: number, value: number): void {
    switch (reg) {
      case 2:
        this.disk = this.diskManager.getFloppyDisk(this.diskNo = value & 0x03);

        this.board.getLedManager().getLed(LedType.FDD1).set((value & 0x10) != 0 && this.diskManager.getFloppyDisk(0).isEnabled());
        this.board.getLedManager().getLed(LedType.FDD2).set((value & 0x20) != 0 && this.diskManager.getFloppyDisk(1).isEnabled());
        break;

      case 5:
        switch (this.phase) {
          case Phase.IDLE:
            this.idlePhaseWrite(value);
            break;

          case Phase.COMMAND:
            this.commandPhaseWrite(value);
            break;

          case Phase.DATATRANSFER:
            this.executionPhaseWrite(value);
            this.dataTransferTime = this.board.getSystemTime();
            this.mainStatus &= ~STM_RQM;
            this.timer.setTimeout(this.board.getSystemTime() + this.board.getSystemFrequency() * 60 / 1000000);
            break;
        }
        break;
    }
  }

  private onTimer(): void {
    this.mainStatus |= STM_RQM;
  }

  private executionPhaseRead(): number {
    switch (this.command) {
      case Command.READ_DATA:
        if (this.sectorOffset < 512) {
          const value = this.sectorBuf[this.sectorOffset++];
          if (this.sectorOffset == 512) {
            this.phase = Phase.RESULT;
            this.phaseStep = 0;
          }
          return value;
        }
        break;
    }
    return 0xff;
  }

  private resultsPhaseRead(): number {
    switch (this.command) {
      case Command.READ_DATA:
      case Command.WRITE_DATA:
      case Command.FORMAT:
        switch (this.phaseStep++) {
          case 0:
            return this.status0;
          case 1:
            return this.status1;
          case 2:
            return this.status2;
          case 3:
            return this.cylinderNumber;
          case 4:
            return this.side;
          case 5:
            return this.sectorNumber;
          case 6:
            this.phase = Phase.IDLE;
            this.mainStatus &= ~STM_CB;
            this.mainStatus &= ~STM_DIO;

            return this.number;
        }
        break;

      case Command.SENSE_INTERRUPT_STATUS:
        switch (this.phaseStep++) {
          case 0:
            return this.status0;
          case 1:
            this.phase = Phase.IDLE;
            this.mainStatus &= ~(STM_CB | STM_DIO);

            return this.currentTrack;
        }
        break;

      case Command.SENSE_DEVICE_STATUS:
        switch (this.phaseStep++) {
          case 0:
            this.phase = Phase.IDLE;
            this.mainStatus &= ~(STM_CB | STM_DIO);

            return this.status3;
        }
        break;
    }
    return 0xff;
  }

  private idlePhaseWrite(value: number) {
    this.command = Command.UNKNOWN;
    if ((value & 0x1f) == 0x06) this.command = Command.READ_DATA;
    if ((value & 0x3f) == 0x05) this.command = Command.WRITE_DATA;
    if ((value & 0x3f) == 0x09) this.command = Command.WRITE_DELETED_DATA;
    if ((value & 0x1f) == 0x0c) this.command = Command.READ_DELETED_DATA;
    if ((value & 0xbf) == 0x02) this.command = Command.READ_DIAGNOSTIC;
    if ((value & 0xbf) == 0x0a) this.command = Command.READ_ID;
    if ((value & 0xbf) == 0x0d) this.command = Command.FORMAT;
    if ((value & 0x1f) == 0x11) this.command = Command.SCAN_EQUAL;
    if ((value & 0x1f) == 0x19) this.command = Command.SCAN_LOW_OR_EQUAL;
    if ((value & 0x1f) == 0x1d) this.command = Command.SCAN_HIGH_OR_EQUAL;
    if ((value & 0xff) == 0x0f) this.command = Command.SEEK;
    if ((value & 0xff) == 0x07) this.command = Command.RECALIBRATE;
    if ((value & 0xff) == 0x08) this.command = Command.SENSE_INTERRUPT_STATUS;
    if ((value & 0xff) == 0x03) this.command = Command.SPECIFY;
    if ((value & 0xff) == 0x04) this.command = Command.SENSE_DEVICE_STATUS;

    this.commandCode = value;

    this.phase = Phase.COMMAND;
    this.phaseStep = 0;
    this.mainStatus |= STM_CB;

    switch (this.command) {
      case Command.READ_DATA:
      case Command.WRITE_DATA:
      case Command.FORMAT:
        this.status0 &= ~(ST0_IC0 | ST0_IC1);
        this.status1 &= ~(ST1_ND | ST1_NW);
        this.status2 &= ~ST2_DD;
        break;

      case Command.RECALIBRATE:
        this.status0 &= ~ST0_SE;
        break;

      case Command.SENSE_INTERRUPT_STATUS:
        this.phase = Phase.RESULT;
        this.mainStatus |= STM_DIO;
        break;

      case Command.SEEK:
      case Command.SPECIFY:
      case Command.SENSE_DEVICE_STATUS:
        break;

      default:
        this.mainStatus &= ~STM_CB;
        this.phase = Phase.IDLE;
    }
  }

  private commandPhaseWrite(value: number): void {
    switch (this.command) {
      case Command.READ_DATA:
      case Command.WRITE_DATA:
        switch (this.phaseStep++) {
          case 0:
            this.status0 &= ~(ST0_DS0 | ST0_DS1 | ST0_IC0 | ST0_IC1);
            this.status0 |= (this.disk.isPresent() ? 0 : ST0_DS0) | (value & (ST0_DS0 | ST0_DS1)) |
              (this.disk.isEnabled() ? 0 : ST0_IC1);
            this.status3 = (value & (ST3_DS0 | ST3_DS1)) |
              (this.currentTrack == 0 ? ST3_TK0 : 0) |
              (this.disk.getSides() == 2 ? ST3_HD : 0) |
              (this.disk.isReadOnly() ? ST3_WP : 0) |
              (this.disk.isPresent() ? ST3_RDY : 0);
            break;
          case 1:
            this.cylinderNumber = value;
            break;
          case 2:
            this.side = value & 1;
            break;
          case 3:
            this.sectorNumber = value;
            break;
          case 4:
            this.number = value;
            this.sectorOffset = (value == 2 && (this.commandCode & 0xc0) == 0x40) ? 0 : 512;
            break;
          case 7:
            if (this.command == Command.READ_DATA) {
              const rv = this.disk.readSector(this.sectorNumber, this.side, this.currentTrack);
              const diskError = rv[0];
              this.sectorBuf = rv[1] || this.sectorBuf;

              if (diskError == DiskError.NO_DATA) {
                this.status0 |= ST0_IC0;
                this.status1 |= ST1_ND;
              }
              if (diskError == DiskError.CRC_ERROR) {
                this.status0 |= ST0_IC0;
                this.status1 |= ST1_DE;
                this.status2 |= ST2_DD;
              }
              this.mainStatus |= STM_DIO;
            }
            else {
              this.mainStatus &= ~STM_DIO;
            }
            this.phase = Phase.DATATRANSFER;
            this.phaseStep = 0;
            break;
        }
        break;

      case Command.FORMAT:
        switch (this.phaseStep++) {
          case 0:
            this.status0 &= ~(ST0_DS0 | ST0_DS1 | ST0_IC0 | ST0_IC1);
            this.status0 |= (this.disk.isPresent() ? 0 : ST0_DS0) | (value & (ST0_DS0 | ST0_DS1)) |
              (this.disk.isEnabled() ? 0 : ST0_IC1);
            this.status3 = (value & (ST3_DS0 | ST3_DS1)) |
              (this.currentTrack == 0 ? ST3_TK0 : 0) |
              (this.disk.getSides() == 2 ? ST3_HD : 0) |
              (this.disk.isReadOnly() ? ST3_WP : 0) |
              (this.disk.isPresent() ? ST3_RDY : 0);
            break;
          case 1:
            this.number = value;
            break;
          case 2:
            this.sectorsPerCylinder = value;
            this.sectorNumber = value;
            break;
          case 4:
            this.fillerByte = value;
            this.sectorOffset = 0;
            this.mainStatus &= ~STM_DIO;
            this.phase = Phase.DATATRANSFER;
            this.phaseStep = 0;
            break;
        }
        break;

      case Command.SEEK:
        switch (this.phaseStep++) {
          case 0:
            this.status0 &= ~(ST0_DS0 | ST0_DS1 | ST0_IC0 | ST0_IC1);
            this.status0 |= (this.disk.isPresent() ? 0 : ST0_DS0) | (value & (ST0_DS0 | ST0_DS1)) |
              (this.disk.isEnabled() ? 0 : ST0_IC1);
            this.status3 = (value & (ST3_DS0 | ST3_DS1)) |
              (this.currentTrack == 0 ? ST3_TK0 : 0) |
              (this.disk.getSides() == 2 ? ST3_HD : 0) |
              (this.disk.isReadOnly() ? ST3_WP : 0) |
              (this.disk.isPresent() ? ST3_RDY : 0);
            break;
          case 1:
            this.currentTrack = value;
            this.status0 |= ST0_SE;
            this.mainStatus &= ~STM_CB;
            this.phase = Phase.IDLE;
            break;
        }
        break;

      case Command.RECALIBRATE:
        switch (this.phaseStep++) {
          case 0:
            this.status0 &= ~(ST0_DS0 | ST0_DS1 | ST0_IC0 | ST0_IC1);
            this.status0 |= (this.disk.isPresent() ? 0 : ST0_DS0) | (value & (ST0_DS0 | ST0_DS1)) |
              (this.disk.isEnabled() ? 0 : ST0_IC1);
            this.status3 = (value & (ST3_DS0 | ST3_DS1)) |
              (this.currentTrack == 0 ? ST3_TK0 : 0) |
              (this.disk.getSides() == 2 ? ST3_HD : 0) |
              (this.disk.isReadOnly() ? ST3_WP : 0) |
              (this.disk.isPresent() ? ST3_RDY : 0);

            this.currentTrack = 0;
            this.status0 |= ST0_SE;
            this.mainStatus &= ~STM_CB;
            this.phase = Phase.IDLE;
            break;
        }
        break;

      case Command.SPECIFY:
        switch (this.phaseStep++) {
          case 1:
            this.mainStatus &= ~STM_CB;
            this.phase = Phase.IDLE;
            break;
        }
        break;

      case Command.SENSE_DEVICE_STATUS:
        switch (this.phaseStep++) {
          case 0:
            this.status0 &= ~(ST0_DS0 | ST0_DS1 | ST0_IC0 | ST0_IC1);
            this.status0 |= (this.disk.isPresent() ? 0 : ST0_DS0) | (value & (ST0_DS0 | ST0_DS1)) |
              (this.disk.isEnabled() ? 0 : ST0_IC1);
            this.status3 = (value & (ST3_DS0 | ST3_DS1)) |
              (this.currentTrack == 0 ? ST3_TK0 : 0) |
              (this.disk.getSides() == 2 ? ST3_HD : 0) |
              (this.disk.isReadOnly() ? ST3_WP : 0) |
              (this.disk.isPresent() ? ST3_RDY : 0);

            this.phase = Phase.RESULT;
            this.phaseStep = 0;
            this.mainStatus |= STM_DIO;
            break;
        }
        break;
    }
  }

  private executionPhaseWrite(value: number): void {
    switch (this.command) {
      case Command.WRITE_DATA:
        if (this.sectorOffset < 512) {
          this.sectorBuf[this.sectorOffset++] = value;

          if (this.sectorOffset == 512) {
            const diskError = this.disk.writeSector(this.sectorBuf, this.sectorNumber, this.side, this.currentTrack);
            if (diskError != DiskError.OK) {
              this.status1 |= ST1_NW;
            }

            this.phase = Phase.RESULT;
            this.phaseStep = 0;
            this.mainStatus |= STM_DIO;
          }
        }
        break;

      case Command.FORMAT:
        switch (this.phaseStep & 3) {
          case 0:
            this.currentTrack = value;
            break;
          case 1:
            for (let i = 0; i < 512; i++) {
              this.sectorBuf[i] = this.fillerByte;
            }
            const diskError = this.disk.writeSector(this.sectorBuf, this.sectorNumber, this.side, this.currentTrack);
            if (diskError != DiskError.OK) {
              this.status1 |= ST1_NW;
            }
            break;
          case 2:
            this.sectorNumber = value;
            break;
        }

        if (++this.phaseStep == 4 * this.sectorsPerCylinder - 2) {
          this.phase = Phase.RESULT;
          this.phaseStep = 0;
          this.mainStatus |= STM_DIO;
        }
        break;
    }
  }

  public getState(): any {
    let state: any = {};

    state.mainStatus = this.mainStatus;
    state.status0 = this.status0;
    state.status1 = this.status1;
    state.status2 = this.status2;
    state.status3 = this.status3;
    state.commandCode = this.commandCode;

    state.command = this.command;
    state.phase = this.phase;
    state.phaseStep = this.phaseStep;

    state.fillerByte = this.fillerByte;

    state.cylinderNumber = this.cylinderNumber;
    state.side = this.side;
    state.sectorNumber = this.sectorNumber;
    state.number = this.number;
    state.currentTrack = this.currentTrack;
    state.sectorsPerCylinder = this.sectorsPerCylinder;

    state.sectorOffset = this.sectorOffset;
    state.dataTransferTime = this.dataTransferTime;

    state.sectorBuf = SaveState.getArrayState(this.sectorBuf);

    state.timer = this.timer.getState();

    return state;
  }

  public setState(state: any): void {
    this.mainStatus = state.mainStatus;
    this.status0 = state.status0;
    this.status1 = state.status1;
    this.status2 = state.status2;
    this.status3 = state.status3;
    this.commandCode = state.commandCode;

    this.command = state.command;
    this.phase = state.phase;
    this.phaseStep = state.phaseStep;

    this.fillerByte = state.fillerByte;

    this.cylinderNumber = state.cylinderNumber;
    this.side = state.side;
    this.sectorNumber = state.sectorNumber;
    this.number = state.number;
    this.currentTrack = state.currentTrack;
    this.sectorsPerCylinder = state.sectorsPerCylinder;

    this.sectorOffset = state.sectorOffset;
    this.dataTransferTime = state.dataTransferTime;

    SaveState.setArrayState(this.sectorBuf, state.sectorBuf);

    this.timer.setState(state.timer);

    this.disk = this.diskManager.getFloppyDisk(this.diskNo);
  }

  private disk: Disk;
  private diskNo = 0;

  private timer: Timer;

  private mainStatus = 0;
  private status0 = 0;
  private status1 = 0;
  private status2 = 0;
  private status3 = 0;
  private commandCode = 0;

  private command = Command.UNKNOWN;
  private phase = Phase.IDLE;
  private phaseStep = 0;

  private fillerByte = 0;

  private cylinderNumber = 0;
  private side = 0;
  private sectorNumber = 0;
  private number = 0;
  private currentTrack = 0;
  private sectorsPerCylinder = 0;

  private sectorOffset = 0;
  private dataTransferTime = 0;

  private sectorBuf = new Uint8Array(512);
}
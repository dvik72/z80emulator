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
import { Timer } from '../core/timeoutmanager';


const MASK = [
  [0x0f, 0x07, 0x0f, 0x07, 0x0f, 0x03, 0x07, 0x0f, 0x03, 0x0f, 0x01, 0x0f, 0x0f],
  [0x00, 0x00, 0x0f, 0x07, 0x0f, 0x03, 0x07, 0x0f, 0x03, 0x00, 0x01, 0x03, 0x00],
  [0x0f, 0x0f, 0x0f, 0x0f, 0x0f, 0x0f, 0x0f, 0x0f, 0x0f, 0x0f, 0x0f, 0x0f, 0x0f],
  [0x0f, 0x0f, 0x0f, 0x0f, 0x0f, 0x0f, 0x0f, 0x0f, 0x0f, 0x0f, 0x0f, 0x0f, 0x0f]
];

const DAYS_IN_MONTH = [
  [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31],
  [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31],
  [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31],
  [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31],
];

const MODE_BLOCKSELECT = 0x03;
const MODE_ALARMENABLE = 0x04;
const MODE_TIMERENABLE = 0x08;

const TEST_SECONDS = 0x01;
const TEST_MINUTES = 0x02;
const TEST_DAYS = 0x04;
const TEST_YEARS = 0x08;

const RESET_ALARM = 0x01;
const RESET_FRACTION = 0x02;

export let VERY_STRANGE_HACK = 0;

export class Rtc {
  constructor(
    private board: Board
  ) {
    this.board.getIoManager().registerPort(0xb4, new Port(undefined, this.writeLatch.bind(this)));
    this.board.getIoManager().registerPort(0xb5, new Port(this.read.bind(this), this.write.bind(this)));

    this.timer = this.board.getTimeoutManager().createTimer('RTC clock', this.onTimer.bind(this));
    this.timer.setTimeout(this.board.getSystemTime() + this.board.getSystemFrequency());

    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 13; j++) {
        this.registers[i][j] = 0;
      }
    }

    this.updateRegs();
  }

  public read(ioPort: number): number {
    switch (this.latch) {
      case 0x0d:
        return this.modeReg | 0xf0;

      case 0x0e:
      case 0x0f:
        return 0xff;
    }

    const block = this.modeReg & MODE_BLOCKSELECT;

    if (block == 0) {
      this.updateRegs();
    }

    return (this.registers[block][this.latch] & MASK[block][this.latch]) | 0xf0;
  }

  private write(ioPort: number, value: number): void {
    switch (this.latch) {
      case 0x0d:
        this.updateRegs();
        this.modeReg = value;
        return;

      case 0x0e:
        this.updateRegs();
        this.testReg = value;
        return;

      case 0x0f:
        this.resetReg = value;

        if (value & RESET_ALARM) {
          for (let i = 2; i <= 8; i++) {
            this.registers[1][i] = 0;
          }
        }
        if (value & RESET_FRACTION) {
          this.fraction = 0;
        }
        return;
    }

    const block = this.modeReg & MODE_BLOCKSELECT;

    if (block == 0) {
      this.updateRegs();
    }

    this.registers[block][this.latch] = value & MASK[block][this.latch];

    if (block == 0) {
      this.setTime();
    }
  }

  private writeLatch(ioPort: number, value: number): void {
    this.latch = value & 0x0f;
  }

  private onTimer(): void {
    this.updateRegs();
    this.timer.setTimeout(this.timer.getTimeout() + this.board.getSystemFrequency());

    //console.log(this.hours + ':' + this.minutes + ':' + this.seconds);
  }

  private setTime(): void {
    this.seconds  = this.registers[0][0] + 10 * this.registers[0][1];
    this.minutes  = this.registers[0][2] + 10 * this.registers[0][3];
    this.hours    = this.registers[0][4] + 10 * this.registers[0][5];
    this.dayWeek  = this.registers[0][6];
    this.days     = this.registers[0][7] + 10 * this.registers[0][8] - 1;
    this.months   = this.registers[0][9] + 10 * this.registers[0][10] - 1;
    this.years    = this.registers[0][11] + 10 * this.registers[0][12];
    this.leapYear = this.registers[1][11];

    if (!this.registers[1][10]) {
      if (this.hours >= 20) {
        this.hours = (this.hours - 20) + 12;
      }
    }
  }

  private setRegisters(): void {
    let hours = this.hours;
    if (!this.registers[1][10]) {
      if (hours >= 12) {
        hours = (hours - 12) + 20;
      }
    }

    this.registers[0][0] = this.seconds % 10;
    this.registers[0][1] = this.seconds / 10 | 0;
    this.registers[0][2] = this.minutes % 10;
    this.registers[0][3] = this.minutes / 10 | 0;
    this.registers[0][4] = hours % 10;
    this.registers[0][5] = hours / 10 | 0;
    this.registers[0][6] = this.dayWeek;
    this.registers[0][7] = (this.days + 1) % 10;
    this.registers[0][8] = (this.days + 1) / 10 | 0;
    this.registers[0][9] = (this.months + 1) % 10;
    this.registers[0][10] = (this.months + 1) / 10 | 0;
    this.registers[0][11] = this.years % 10;
    this.registers[0][12] = this.years / 10 | 0;
    this.registers[1][11] = this.leapYear;
  }

  private updateRegs(): void {
    VERY_STRANGE_HACK = this.refTime;
    const elapsed = 16384 * this.board.getTimeSince(this.refTime) + this.refFrag;
    this.refTime = this.board.getSystemTime();
    this.refFrag = elapsed % this.board.getSystemFrequency();
    const elapsedTime = elapsed / this.board.getSystemFrequency() | 0;

    this.fraction += (this.modeReg & MODE_TIMERENABLE) ? elapsedTime : 0;
    this.seconds  += (this.testReg & TEST_SECONDS) ? elapsedTime : this.fraction / 16384 | 0;
    this.fraction %= 16384;
    this.minutes += (this.testReg & TEST_MINUTES) ? elapsedTime : this.seconds / 60 | 0;
    this.seconds  %= 60;
    this.hours += this.minutes / 60 | 0;
    this.minutes  %= 60;
    const carryDays = (this.testReg & TEST_DAYS) ? elapsedTime : this.hours / 24 | 0;
    this.days     += carryDays;
    this.hours    %= 24;
    this.dayWeek   = (this.dayWeek + carryDays) % 7;

    while (this.days >= DAYS_IN_MONTH[this.leapYear][this.months]) {
      this.days -= DAYS_IN_MONTH[this.leapYear][this.months];
      this.months++;
    }

    const carryYears = (this.testReg & TEST_YEARS) ? elapsedTime : this.months / 12 | 0;
    this.years    = (this.years + carryYears) % 100;
    this.months  %= 12;
    this.leapYear = (this.leapYear + carryYears) % 4;

    this.setRegisters();
  }

  private modeReg = MODE_TIMERENABLE;
  private testReg = 0;
  private resetReg = 0;
  private registers = [new Uint8Array(13), new Uint8Array(13), new Uint8Array(13), new Uint8Array(13)];
  private refTime = 0;
  private refFrag = 0;
  private fraction = 0;
  private seconds = 0;
  private minutes = 0;
  private hours = 0;
  private dayWeek = 0;
  private days = 0;
  private months = 0;
  private years = 0;
  private leapYear = 0;

  private latch = 0;

  private timer: Timer;
}

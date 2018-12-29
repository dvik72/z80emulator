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

import { Timer } from '../core/timeoutmanager';
import { Board } from '../core/board';

const STAT_TXRDY = 0x01;
const STAT_RXRDY = 0x02;
const STAT_TXEMPTY = 0x04;
const STAT_PE = 0x08;
const STAT_OE = 0x10;
const STAT_FE = 0x20;
const STAT_SYNBRK = 0x40;
const STAT_DSR = 0x80;

const MODE_BAUDRATE = 0x03;
const MODE_SYNCHRONOUS = 0x00;
const MODE_RATE1 =  0x01
const MODE_RATE16 = 0x02;
const MODE_RATE64 = 0x03;
const MODE_WORDLENGTH = 0x0c;
const MODE_5BIT =   0x00
const MODE_6BIT = 0x04;
const MODE_7BIT = 0x08;
const MODE_8BIT = 0x0c;
const MODE_PARITYEN = 0x10;
const MODE_PARITODD = 0x00;
const MODE_PARITEVEN = 0x20;
const MODE_STOP_BITS = 0xc0;
const MODE_STOP_INV = 0x00;
const MODE_STOP_1 = 0x40;
const MODE_STOP_15 = 0x80;
const MODE_STOP_2 = 0xc0;
const MODE_SINGLESYNC = 0x80;

const CMD_TXEN = 0x01;
const CMD_DTR = 0x02;
const CMD_RXE = 0x04;
const CMD_SBRK = 0x08;
const CMD_RSTERR = 0x10;
const CMD_RTS = 0x20;
const CMD_RESET = 0x40;
const CMD_HUNT = 0x80;

const PHASE_MODE = 0;
const PHASE_SYNC1 = 1;
const PHASE_SYNC2 = 2;
const PHASE_CMD = 3;

const RX_QUEUE_SIZE = 16;

export enum I8251Parity { EVEN, ODD, NONE };

export class I8251 {
  constructor(
    private board: Board,
    private frequency: number,
    private transmit?: (value: number) => void,
    private signal?: () => void,
    private setDataBits?: (value: number) => void,
    private setStopBits?: (value: number) => void,
    private setParity?: (parity: I8251Parity) => void,
    private setRxReady?: (value: number) => void,
    private setDtr?: (value: number) => void,
    private setRts?: (value: number) => void,
    private getDtr?: () => boolean,
    private getRts?: () => boolean
  ) {
    this.timerRecv = this.board.getTimeoutManager().createTimer(name, this.onRecv.bind(this));
    this.timerRxPoll = this.board.getTimeoutManager().createTimer(name, this.onRxPoll.bind(this));
    this.timerTrans = this.board.getTimeoutManager().createTimer(name, this.onTrans.bind(this));
  }

  public reset() {
    this.charLength = 1024;
    this.rxPending = 0;

    this.status = STAT_TXRDY | STAT_TXEMPTY;
    this.command = 0xff;
    this.writeCommand(0);
    this.cmdFaze = PHASE_MODE;
  }

  public write(port: number, value: number): void {
    switch (port & 1) {
      case 0:
        this.writeTrans(value);
        break;
      case 1:
        switch (this.cmdFaze) {
          case PHASE_MODE:
            this.setMode(value);
            if ((this.mode & MODE_BAUDRATE) == MODE_SYNCHRONOUS) {
              this.cmdFaze = PHASE_SYNC1;
            }
            else {
              this.cmdFaze = PHASE_CMD;
            }
            break;
          case PHASE_SYNC1:
            this.sync1 = value;
            if (this.mode & MODE_SINGLESYNC) {
              this.cmdFaze = PHASE_CMD;
            }
            else {
              this.cmdFaze = PHASE_SYNC2;
            }
            break;
          case PHASE_SYNC2:
            this.sync2 = value;
            this.cmdFaze = PHASE_CMD;
            break;
          case PHASE_CMD:
            if (value & CMD_RESET) {
              this.cmdFaze = PHASE_MODE;
            }
            else {
              this.writeCommand(value);
            }
            break;
        }
        break;
    }
  }

  public read(port: number): number {
    switch (port & 1) {
      case 0:
        return this.readTrans();
      case 1:
        return this.readStatus();
    }
    return 0xff;
  }

  public rxData(value: number): void {
    if (this.rxPending < RX_QUEUE_SIZE) {
      this.rxQueue[this.rxHead & (RX_QUEUE_SIZE - 1)] = value;
      this.rxHead++;
      this.rxPending++;
    }
    else {
      this.status |= STAT_OE;
    }
  }

  private writeTrans(value: number): void {
    if (!(this.command & CMD_TXEN)) {
      return;
    }
    if (this.status & STAT_TXEMPTY) {
      this.status &= ~STAT_TXEMPTY;
      this.sendByte = value;

      this.timeTrans = this.board.getSystemTime() +
        this.board.getSystemFrequency() * this.charLength / this.frequency | 0;
      this.timerTrans.setTimeout(this.timeTrans);
    }
    else {
      this.sendBuffer = value;
      this.status &= ~STAT_TXRDY;
    }
  }

  private readTrans(): number {
    this.status &= ~STAT_RXRDY;
    this.setRxReady && this.setRxReady(0);
    return this.recvBuf;
  }

  private readStatus(): number {
    let result = this.status;
    if (this.getDtr && this.getDtr()) {
      result |= STAT_DSR;
    }
    return result;
  }

  private writeCommand(value: number): void {
    const oldCommand = this.command;
    this.command = value;

    this.setRts && this.setRts(value & CMD_RTS);
    this.setDtr && this.setDtr(value & CMD_DTR);

    if (!(value & CMD_TXEN)) {
      this.timerTrans.stop();
      this.status |= STAT_TXRDY | STAT_TXEMPTY;
    }
    if (value & CMD_RSTERR) {
      this.status &= ~(STAT_PE | STAT_OE | STAT_FE);
    }
    if ((value ^ oldCommand) & CMD_RXE) {
      if (value & CMD_RXE) {
        this.status &= ~(STAT_PE | STAT_OE | STAT_FE);
        this.recvReady = 1;
        this.rxPending = 0;
        this.onRxPoll(this.board.getSystemTime());
      }
      else {
        this.timerRecv.stop();
        this.timerRxPoll.stop();
        this.status &= ~(STAT_PE | STAT_OE | STAT_FE);
        this.status &= ~STAT_RXRDY;
      }
      this.signal && this.signal();
    }
  }

  private setMode(value: number): void {
    let baudrate = 1;
    let stopBits = 0;
    let dataBits = 8;
    let parityEnable = 1;

    this.mode = value;

    switch (value & MODE_WORDLENGTH) {
      case MODE_5BIT:
        dataBits = 5;
        break;
      case MODE_6BIT:
        dataBits = 6;
        break;
      case MODE_7BIT:
        dataBits = 7;
        break;
      case MODE_8BIT:
        dataBits = 8;
        break;
    }

    this.setDataBits && this.setDataBits(dataBits);

    switch (value & MODE_STOP_BITS) {
      case MODE_STOP_INV:
        stopBits = 0;
        break;
      case MODE_STOP_1:
        stopBits = 2;
        break;
      case MODE_STOP_15:
        stopBits = 3;
        break;
      case MODE_STOP_2:
        stopBits = 4;
        break;
    }

    this.setStopBits && this.setStopBits(stopBits);

    switch (value & (MODE_PARITYEN | MODE_PARITEVEN)) {
      case MODE_PARITYEN | MODE_PARITEVEN:
        this.setParity && this.setParity(I8251Parity.EVEN);
        break;
      case MODE_PARITYEN:
        this.setParity && this.setParity(I8251Parity.ODD);
        break;
      default:
        this.setParity && this.setParity(I8251Parity.NONE);
    }

    switch (value & MODE_BAUDRATE) {
      case MODE_SYNCHRONOUS:
        baudrate = 1;
        break;
      case MODE_RATE1:
        baudrate = 1;
        break;
      case MODE_RATE16:
        baudrate = 16;
        break;
      case MODE_RATE64:
        baudrate = 64;
        break;
    }

    parityEnable = (value & MODE_PARITYEN) ? 1 : 0;
    this.charLength = (((2 * (1 + dataBits + parityEnable)) + stopBits) * baudrate) >> 1;
  }


  private onRecv(time: number): void {
    this.timeRecv  = 0;
    this.recvReady = 1;
    this.signal && this.signal();

    this.onRxPoll(time);
  }

  private onRxPoll(time: number): void {
    let value = 0;

    if (this.timeRxPoll != 0) {
      this.timerRxPoll.stop();
      this.timeRxPoll = 0;
    }

    if (this.rxPending == 0) {
      this.timeRxPoll = this.board.getSystemTime() +
        this.board.getSystemFrequency() * this.charLength / this.frequency | 0;
      this.timerRxPoll.setTimeout(this.timeRxPoll);
      return;
    }

    if (this.rxPending != 0) {
      value = this.rxQueue[(this.rxHead - this.rxPending) & (RX_QUEUE_SIZE - 1)];
      this.rxPending--;
    }
    this.recvBuf = value;
    this.status |= STAT_RXRDY;
    this.setRxReady && this.setRxReady(1);
    this.recvReady = 0;

    this.timeRecv = this.board.getSystemTime() +
      this.board.getSystemFrequency() * this.charLength / this.frequency | 0;
    this.timerRecv.setTimeout(this.timeRecv);
  }

  private onTrans(time: number): void {
    this.timeTrans  = 0;

    this.transmit && this.transmit(this.sendByte);
    if (this.status & STAT_TXRDY) {
      this.status |= STAT_TXEMPTY;
    }
    else {
      this.status |= STAT_TXRDY;
      this.status &= ~STAT_TXEMPTY;
      this.sendByte = this.sendBuffer;

      this.timeTrans = this.board.getSystemTime() +
        this.board.getSystemFrequency() * this.charLength / this.frequency | 0;
      this.timerTrans.setTimeout(this.timeTrans);
    }
  }

  private timeRecv = 0;
  private timeRxPoll = 0;
  private timeTrans = 0;

  private status = 0;
  private command = 0;
  private mode = 0;
  private sync1 = 0;
  private sync2 = 0;
  private charLength = 0;
  private cmdFaze = 0;

  private dataBits = 0;
  private stopBits = 0;
  private parityEnabled = 0;
  private parity = 0;
  private recvBuf = 0;
  private recvReady = 0;
  private sendByte = 0;
  private sendBuffer = 0;
  private sendBuffered = 0;

  private rxPending = 0;
  private rxHead = 0;
  private rxQueue = new Uint8Array(RX_QUEUE_SIZE);

  private timerRecv: Timer;
  private timerRxPoll: Timer;
  private timerTrans: Timer;
}

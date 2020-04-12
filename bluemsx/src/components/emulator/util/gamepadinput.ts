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

import { Input } from '../../../emulator/api/input'

const AXIS_THRESHOLD = 0.5;

export class GamepadInput {
  public start(): void {
    this.poll = this.poll.bind(this);

    this.gamepadCache = Input.getGamepadKeys();

    this.running = true;

    requestAnimationFrame(this.poll);
  }

  public stop(): void {
    this.running = false;
  }

  private poll() {
    if (this.running) {
      this.pollGamepads();
      requestAnimationFrame(this.poll);
    }
  }

  private registerGamepadIndex(index: number): void {
    for (let i of this.gamepadMapping) {
      if (i == index) {
        return;
      }
    }
    this.gamepadMapping.push(index);
  }

  private getGamepadIndex(index: number): number {
    let offset = 0;
    for (let i of this.gamepadMapping) {
      if (i == index) {
        return offset;
      }
      offset++;
    }
    return -1;
  }

  private pollGamepads(): void {
    let gamepads = navigator.getGamepads ? navigator.getGamepads() : ((navigator as any).webkitGetGamepads ? (navigator as any).webkitGetGamepads() : []);

    for (let i = 0; i < gamepads.length; i++) {
      const gp = gamepads[i];

      if (gp) {
        for (let j = 0; j < gp.axes.length / 2; j++) {
          const up = gp.axes[2 * j + 1] < -AXIS_THRESHOLD;
          const down = gp.axes[2 * j + 1] > AXIS_THRESHOLD;
          const left = gp.axes[2 * j] < -AXIS_THRESHOLD;
          const right = gp.axes[2 * j] > AXIS_THRESHOLD;

          if (up || down || left || right) {
            this.registerGamepadIndex(i);
          }
          const gpIdx = this.getGamepadIndex(i) + 1;

          const keyCodeUp = 'Gamepad' + gpIdx + '_Up' + (j + 1);
          if (this.gamepadCache.indexOf(keyCodeUp) >= 0) {
            up ? Input.keyDown(keyCodeUp) : Input.keyUp(keyCodeUp);
          }
          const keyCodeDown = 'Gamepad' + gpIdx + '_Down' + (j + 1);
          if (this.gamepadCache.indexOf(keyCodeDown) >= 0) {
            down ? Input.keyDown(keyCodeDown) : Input.keyUp(keyCodeDown);
          }
          const keyCodeLeft = 'Gamepad' + gpIdx + '_Left' + (j + 1);
          if (this.gamepadCache.indexOf(keyCodeLeft) >= 0) {
            left ? Input.keyDown(keyCodeLeft) : Input.keyUp(keyCodeLeft);
          }
          const keyCodeRight = 'Gamepad' + gpIdx + '_Right' + (j + 1);
          if (this.gamepadCache.indexOf(keyCodeRight) >= 0) {
            right ? Input.keyDown(keyCodeRight) : Input.keyUp(keyCodeRight);
          }
        }

        for (let j = 0; j < gp.buttons.length; j++) {
          const b = gp.buttons[j];
          let pressed = false;
          if (typeof (b) == 'object') {
            pressed = !!b.pressed;
          }
          else {
            pressed = b == 1.0;
          }

          if (pressed) {
            this.registerGamepadIndex(i);
          }
          const gpIdx = this.getGamepadIndex(i) + 1;

          const keyCode = 'Gamepad' + gpIdx + '_Button' + (j + 1);
          if (this.gamepadCache.indexOf(keyCode) >= 0) {
            pressed ? Input.keyDown(keyCode) : Input.keyUp(keyCode);
          }
        }
      }
    }
  }

  private gamepadCache = new Array<string>(0);
  private gamepadMapping = new Array<number>(0);

  private running = false;
}

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

export class JoystickDevice {
  public read(): number {
    return 0xff;
  }

  public write(value: number): void {
  }

  public setPort(port: number): void {
    this.port = port;
  }

  protected port = -1;
}

export class JoystickPortManager {
  public static registerJoystick(port: number, device: JoystickDevice): void {
    device.setPort(port);
    JoystickPortManager.ports[port] = device;
  }

  public static read(port: number): number {
    return JoystickPortManager.ports[port].read();
  }

  public static write(port: number, value: number): void {
    return JoystickPortManager.ports[port].write(value);
  }

  private static ports = [new JoystickDevice(), new JoystickDevice()];
}
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

export class Fullscreen {
  public static fullscreenEnabled(): boolean {
    const doc = document as any;
    return doc.fullscreenEnabled ? true :
      doc.webkitFullscreenEnabled ? true :
        doc.mozFullScreenEnabled ? true :
          doc.msFullscreenEnabled ? true : false;
  }

  public static fullscreenElement(): Element | null {
    const doc = document as any;
    
    return doc.fullscreenElement ||
      doc.webkitCurrentFullScreenElement ||
      doc.mozFullScreenElement ||
      doc.msFullscreenElement ||
      null;
  }

  public static requestFullscreen(element: Element): void {
    const el = element as any;

    el.requestFullscreen ? el.requestFullscreen() :
      el.webkitRequestFullscreen ? el.webkitRequestFullscreen() :
        el.mozRequestFullScreen ? el.mozRequestFullScreen() :
          el.msRequestFullscreen ? el.msRequestFullscreen() : 0;
  }

  public static exitFullscreen(): void {
    const doc = document as any;

    doc.exitFullscreen ? doc.exitFullscreen() :
      doc.webkitExitFullscreen ? doc.webkitExitFullscreen() :
        doc.mozCancelFullScreen ? doc.mozCancelFullScreen() :
          doc.msExitFullscreen ? doc.msExitFullscreen() : 0; 
  }
}

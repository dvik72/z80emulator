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

import { BasicShader } from './shaders/basicshader';
import { Shader } from './shaders/shader';


export class WebGlRenderer {
  constructor() {
    this.canvas = WebGlRenderer.createCanvas('emuCanvas');
    const gl = this.canvas.getContext("webgl") || this.canvas.getContext("experimental-webgl");
    if (!gl) {
      throw new Error("Failed to initialize WebGL");
    }
    this.gl = gl;

    gl.clearColor(0, 0, 0.3, 1);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    this.shader = new BasicShader(this.gl);
    this.shader.use();

    this.initTexture();
  }

  private static createCanvas(elementId?: string): HTMLCanvasElement {
    let canvas: HTMLCanvasElement;

    if (elementId) {
      canvas = document.getElementById(elementId) as HTMLCanvasElement;
      if (!canvas) {
        throw new Error("Cannot find a canvas element named:" + elementId);
      }
    } else {
      canvas = document.createElement("canvas") as HTMLCanvasElement;
      document.body.appendChild(canvas);
    }
    return canvas;
  }

  private initTexture(): void {
    const positionLocation = this.shader.getAttributeLocation("a_position");
    
    var positionBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, positionBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array([
      0.0, 0.0,
      1.0, 0.0,
      0.0, 1.0,
      0.0, 1.0,
      1.0, 0.0,
      1.0, 1.0]), this.gl.STATIC_DRAW);
    this.gl.enableVertexAttribArray(positionLocation);
    this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, 0, 0);

    var texture = this.gl.createTexture();
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);

    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
  }
  
  public render(width: number, height: number, frameBuffer: Uint16Array): void {
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGB, width, height, 0, this.gl.RGB, this.gl.UNSIGNED_SHORT_5_6_5, frameBuffer);

    const dstX = 0;
    const dstY = 0;
    const dstWidth = 640;
    const dstHeight = 480;
  
    const clipX = dstX / this.gl.canvas.width * 2 - 1;
    const clipY = dstY / this.gl.canvas.height * -2 + 1;
    const clipWidth = dstWidth / this.gl.canvas.width * 2;
    const clipHeight = dstHeight / this.gl.canvas.height * -2;

    const matrixLocation = this.shader.getUniformLocation("u_matrix");
    this.gl.uniformMatrix3fv(matrixLocation, false, [
      clipWidth, 0, 0,
      0, clipHeight, 0,
      clipX, clipY, 1,
    ]);

    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
  }
  
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext;
  private shader: Shader;
}

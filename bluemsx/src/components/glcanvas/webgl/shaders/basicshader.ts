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

import { Shader } from './shader';

export class BasicShader extends Shader {
  public constructor(
    gl: WebGLRenderingContext,
  ) {
    super(gl, "basic");

    this.load(this.getVertexSource(), this.getFragmentSource());
  }
  
  private getVertexSource(): string {
    return `
attribute vec2 a_position;

uniform vec2 u_resolution;
uniform mat3 u_matrix;

varying vec2 v_texCoord;

void main() {
   gl_Position = vec4(u_matrix * vec3(a_position, 1), 1);
   v_texCoord = a_position;
}`;
  }

  private getFragmentSource(): string {
    return `
precision mediump float;

// our texture
uniform sampler2D u_image;

// the texCoords passed in from the vertex shader.
varying vec2 v_texCoord;

void main() {
   gl_FragColor = texture2D(u_image, v_texCoord);
}
  `;
  }

}

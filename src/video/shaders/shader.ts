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

export abstract class Shader {
  private name: string;
  private program: WebGLProgram | null = null;
  private attributes: { [name: string]: number } = {};
  private uniforms: { [name: string]: WebGLUniformLocation } = {};

  public constructor(
    private gl: WebGLRenderingContext,
      name: string) {
    this.name = name;
  }

  public getName(): string {
    return this.name;
  }

  public use(): void {
    if (this.program) {
      this.gl.useProgram(this.program);
    }
  }

  public getAttributeLocation(name: string): number {
    if (this.attributes[name] === undefined) {
      throw new Error(`Unable to find attribute named '${name}' in shader named '${this.name}'`);
    }

    return this.attributes[name];
  }

  public getUniformLocation(name: string): WebGLUniformLocation {
    if (!this.uniforms[name]) {
      throw new Error(`Unable to find uniform named '${name}' in shader named '${this.name}'`);
    }

    return this.uniforms[name];
  }

  protected load(vertexSource: string, fragmentSource: string): void {
    let vertexShader = this.loadShader(vertexSource, this.gl.VERTEX_SHADER);
    let fragmentShader = this.loadShader(fragmentSource, this.gl.FRAGMENT_SHADER);

    if (vertexShader && fragmentShader) {
      this.createProgram(vertexShader, fragmentShader);
    }
    this.detectAttributes();
    this.detectUniforms();
  }

  private loadShader(source: string, shaderType: number): WebGLShader | null {
    let shader: WebGLShader | null = this.gl.createShader(shaderType);

    if (shader) {
      this.gl.shaderSource(shader, source);
      this.gl.compileShader(shader);
      let error = this.gl.getShaderInfoLog(shader);
      if (error !== "") {
        throw new Error("Error compiling shader '" + this.name + "': " + error);
      }
    }
    return shader;
  }

  private createProgram(vertexShader: WebGLShader, fragmentShader: WebGLShader): void {
    this.program = this.gl.createProgram();

    if (this.program) {
      this.gl.attachShader(this.program, vertexShader);
      this.gl.attachShader(this.program, fragmentShader);

      this.gl.linkProgram(this.program);

      let error = this.gl.getProgramInfoLog(this.program);
      if (error !== "") {
        throw new Error("Error linking shader '" + this.name + "': " + error);
      }
    }
  }

  private detectAttributes(): void {
    if (this.program) {
      let attributeCount = this.gl.getProgramParameter(this.program, this.gl.ACTIVE_ATTRIBUTES);
      for (let i = 0; i < attributeCount; ++i) {
        let info: WebGLActiveInfo | null = this.gl.getActiveAttrib(this.program, i);
        if (info) {
          this.attributes[info.name] = this.gl.getAttribLocation(this.program, info.name);
        }
      }
    }
  }

  private detectUniforms(): void {
    if (this.program) {
      let uniformCount = this.gl.getProgramParameter(this.program, this.gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < uniformCount; ++i) {
        let info: WebGLActiveInfo | null = this.gl.getActiveUniform(this.program, i);
        if (info) {
          let uniform = this.gl.getUniformLocation(this.program, info.name);
          if (uniform) {
            this.uniforms[info.name] = uniform;
          }
        }
      }
    }
  }
}

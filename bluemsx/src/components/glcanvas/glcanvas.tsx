import { WebGlRenderer } from './webgl/webglrenderer';
import { MsxEmu } from '../../emulator/api/msx';

import * as React from "react";
const styles = require('./glcanvas.css');

const emptyFrameBuffer = new Uint16Array([0]);

interface Props {
  msxEmu?: MsxEmu;
}

interface State {
}

class GlCanvas extends React.Component<Props, State> {
  constructor(props) {
    super(props);
    this.emuCanvas = React.createRef();
  }

  private emuCanvas: React.RefObject<HTMLCanvasElement>;

  private glRenderer: WebGlRenderer;

  state = {
  }

  componentDidMount() {
    this.refreshScreen = this.refreshScreen.bind(this);

    this.glRenderer = new WebGlRenderer(this.emuCanvas.current);

    requestAnimationFrame(this.refreshScreen);
  }

  componentWillUnmount() {
  }

  private refreshScreen(): void {
    if (this.props.msxEmu) {
      this.glRenderer.render(
        this.props.msxEmu.getFrameBufferWidth(),
        this.props.msxEmu.getFrameBufferHeight(),
        this.props.msxEmu.getFrameBufferData());
    }
    else {
      this.glRenderer.render(1, 1, emptyFrameBuffer);
    }

    requestAnimationFrame(this.refreshScreen);
  }

  render() {
    return (
      <div className={styles.glcanvas}>
        <canvas className={styles.emuCanvas} ref={this.emuCanvas}></canvas>
      </div>
    );
  }
}

export default GlCanvas;

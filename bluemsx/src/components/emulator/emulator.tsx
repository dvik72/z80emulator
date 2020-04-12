import GlCanvas from '../../components/glcanvas/GlCanvas'
import { MsxEmu } from '../../emulator/api/msx';
import { WebAudio } from './util/webaudio';
import { KeyboardInput } from './util/keyboardinput';
import { GamepadInput } from './util/gamepadinput';

import * as React from "react";
const styles = require('./emulator.css');

const blueMsxIcon = require('./img/blueMSX.png');

interface WindowSizeInfo {
  zoom: number;
  label: string;
}

const WINDOW_SIZES: WindowSizeInfo[] = [
  { zoom: 0, label: 'Auto' },
  { zoom: 0.75, label: '0.75x' },
  { zoom: 1, label: '1x'},
  { zoom: 1.5, label: '1.5x' },
  { zoom: 2, label: '2x' },
];

interface Props {
}

interface State {
  windowSize: number;
  emuWidth: number;
  emuHeight: number;
}

class Emulator extends React.Component<Props, State> {
  constructor(props) {
    super(props);
    this.leftBarRef = React.createRef();
    this.rightBarRef = React.createRef();
  }

  private leftBarRef: React.RefObject<HTMLDivElement>;
  private rightBarRef: React.RefObject<HTMLDivElement>;

  private webAudio = new WebAudio();
  private keyboardInput = new KeyboardInput();
  private gamepadInput = new GamepadInput();

  private msxEmu: MsxEmu;

  state = {
    windowSize: 0,
    emuWidth: 0,
    emuHeight: 0,
  }

  componentDidMount() {
    window.addEventListener('resize', this.onResize.bind(this));
    window.addEventListener('click', this.onClick.bind(this));

    this.initEmulator();

    this.updateEmulatorSize();
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('click', this.onClick);
  }

  private onResize(event?: Event): void {
    this.updateEmulatorSize();
  }

  private onClick(event?: Event): void {
    this.webAudio.resume();
  }

  private updateEmulatorSize(): void {
    const windowSize = this.state.windowSize;
    let emuHeight = this.state.emuHeight;

    emuHeight = WINDOW_SIZES[windowSize].zoom * 480;

    if (emuHeight == 0) {
      let width = window.innerWidth || document.documentElement!.clientWidth;
      emuHeight = window.innerHeight || document.documentElement!.clientHeight;

      emuHeight = Math.max(240, Math.min(emuHeight,
        (width - this.leftBarRef.current.clientWidth -
          this.rightBarRef.current.clientWidth) * 3 / 4) - 20);
    }

    const emuWidth = emuHeight * 4 / 3;

    this.setState({
      emuHeight: emuHeight,
      emuWidth: emuWidth,
    });
  }

  private initEmulator() {
    this.keyboardInput.start();
    this.gamepadInput.start();

    this.runEmulator = this.runEmulator.bind(this);

    this.msxEmu = new MsxEmu(window.performance, this.webAudio, {});
    this.msxEmu.setMachine();
    this.runEmulator();
  }

  private runEmulator() {
    const timeout = this.msxEmu!.runStep();
    setTimeout(this.runEmulator, timeout);
  }

  render() {
    return (
      <div className={styles.emulator}>
        <div className={styles.rootContainer}>
          <div className={styles.leftBar} ref={this.leftBarRef}>
          </div>
          <div
            className={styles.emuCanvasContainer}
            style={{ width: `${this.state.emuWidth}px`, height: `${this.state.emuHeight}px` }}>
            <GlCanvas msxEmu={this.msxEmu}></GlCanvas>
          </div>
          <div className={styles.rightBar} ref={this.rightBarRef}>
            <div className={styles.barTop}></div>
            <div className={styles.barFiller}></div>
            <div className={styles.barLogoContainer}>
              <img className={styles.barLogo} src={blueMsxIcon} />
            </div>
            <div className={styles.barBottom}></div>
          </div>
        </div>
      </div>
    );
  }
}

export default Emulator;

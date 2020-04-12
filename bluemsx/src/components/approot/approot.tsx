import Emulator from '../../components/emulator/Emulator'

import * as React from "react";
const styles = require('./approot.css');

interface Props {
}

interface State {
}

class AppRoot extends React.Component<Props, State> {
  state = {
  }

  componentDidMount() {
  }

  componentWillUnmount() {
  }

  render() {
    return (
      <div className={styles.approot}>
        <Emulator></Emulator>
      </div>
    );
  }
}

export default AppRoot;

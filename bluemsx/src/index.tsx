import AppRoot from './components/approot/AppRoot'
import * as React from "react";
import * as ReactDOM from "react-dom";
var WebFont = require('webfontloader');

console.log("TADA");
WebFont.load({
  google: {
    families: [
      'Google Sans: wght@0, 400',
      'Montserrat Alternates: wght@0, 600',
      'Open Sans: ital, wght@0, 400; 0, 600; 0, 700; 1, 300; 1, 400',
      'sans-serif']
  }
});
ReactDOM.render(<AppRoot />, document.getElementById("root"));

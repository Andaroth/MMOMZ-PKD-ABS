//=============================================================================
// ZQSDWASD.js
//=============================================================================

/*:
 * @plugindesc Allow to move withz Wasd and ZQSD keys
 * @author Axel Fiolle
 *
 * @help This plugin enables ZQSD and WASD keys to move around.
 * @description This plugin enables ZQSD and WASD keys to move around.
 */

(() => {
  Input.keyMapper = {
    9: 'tab',       // tab
    // 13: 'ok',       // enter
    16: 'shift',    // shift
    17: 'control',  // control
    18: 'control',  // alt
    27: 'escape',   // escape
    32: 'ok',       // space
    33: 'pageup',   // pageup
    34: 'pagedown', // pagedown
    37: 'left',     // left arrow
    38: 'up',       // up arrow
    39: 'right',    // right arrow
    40: 'down',     // down arrow
    45: 'escape',   // insert
    65: 'left',     // Q
    68: 'right',    // D
    81: 'left',     // Q
    83: 'down',     // S
    87: 'up',       // W
    88: 'escape',   // X
    90: 'up',       // Z
    96: 'escape',   // numpad 0
    98: 'down',     // numpad 2
    100: 'left',    // numpad 4
    102: 'right',   // numpad 6
    104: 'up',      // numpad 8
    120: 'debug'    // F9
  };
})();
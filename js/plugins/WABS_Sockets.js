//=============================================================================
// WABS_Sockets.js
//=============================================================================

/*:
 * @plugindesc WABS_Sockets - Collection of emitters and listeners for World ABS
 * @author Axel FIOLLE
 *
 * @help Collection of emitters and listeners for World ABS
 */

function WABS_Sockets() {
    this.initialize.apply(this, arguments);
}

(() => {

    WABS_Sockets.emitAction = (payload) => {
        if (!payload) return;
        const { target, skillId, itemId, commonEventId } = payload;
        // console.log('emitAction', target, skillId, itemId, commonEventId );
        MMO_Core.socket.emit("wabs_action", {  target, skillId, itemId, commonEventId });
    }

    WABS_Sockets.on = (name,callback) => {
        if (name && callback) MMO_Core.socket.on(name, callback);
    }

})();
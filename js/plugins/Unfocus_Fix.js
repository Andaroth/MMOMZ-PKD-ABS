/*:
 * @target MZ
 * @plugindesc The game will remain active even if it loses focus.
 * @author Caethyril
 * @help Free to use and modify!
 */

// Override! Always return true (default: false if game doc is not in focus).
SceneManager.isGameActive = function() { return true; };


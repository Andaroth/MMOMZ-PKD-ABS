/*****************************
  RPG Maker Core Mock by Axel Fiolle
*****************************/

const { npcMoveTo } = require("./gameworld");

var exports = module.exports = {}
  , maker = exports;

maker._canPass = (initiator, direction) => {
  if (!initiator || !direction) return false;
  const _coords = {
    x: initiator.x,
    y: initiator.y
  };

  const nodeMapId = MMO_Core["gameworld"].getNodeBy('npcUniqueId', initiator.uniqueId) && MMO_Core["gameworld"].getNodeBy('npcUniqueId', initiator.uniqueId).mapId;
  if (!nodeMapId) return console.error('_canPass > cannot find nodeMapId');
  const _mapId = nodeMapId || MMO_Core["gameworld"].getNpcMapId(initiator.uniqueId);
  const x2 = maker._roundXWithDirection(_mapId,_coords.x, direction);
  const y2 = maker._roundYWithDirection(_mapId,_coords.y, direction);
  if (!maker._isValid(_mapId, _coords.x, _coords.y) || !maker._isValid(_mapId, x2, y2)) {
    // console.log(initiator.uniqueId, '!maker._isValid(_mapId, x2, y2)', _mapId, x2, y2)
    return false;
  }
  if (initiator._through && !initiator.summonable) return true;
  const isFollower = () => !!MMO_Core["gameworld"].getNodeBy('npcUniqueId', initiator.uniqueId).follows;
  const skipRegion = isFollower() || initiator._moveType === 3 || (initiator.path && initiator.path.isReturning);
  const skipCharacters = initiator._moveType === 3;
  if (!maker._isMapPassable(_mapId, _coords.x, _coords.y, direction, skipRegion)) {
    // console.log(initiator.uniqueId, '!maker._isMapPassable(_mapId, _coords.x, _coords.y, direction)', _mapId, _coords.x, _coords.y, direction)
    return false;
  }
  if (maker._isCollidedWithCharacters(_mapId, x2, y2, initiator, skipCharacters)) {
    // console.log(initiator.uniqueId, 'maker._isCollidedWithCharacters(_mapId, x2, y2)', _mapId, x2, y2)
    return false;
  }
  return true;
};
maker._getReverseDir = (direction) => {
  if (direction === 1) return 9;
  if (direction === 2) return 8;
  if (direction === 3) return 7;
  if (direction === 4) return 6;
  if (direction === 6) return 4;
  if (direction === 7) return 3;
  if (direction === 8) return 2;
  if (direction === 9) return 1;
  return false;
}
maker._getCaseInFrontOf = (mapId,x,y,direction) => {
  // console.log('_getCaseInFrontOf', mapId,x,y,direction);
  const x2 = maker._roundXWithDirection(mapId,x,direction);
  const y2 = maker._roundYWithDirection(mapId,y,direction);
  return { mapId, x: x2, y: y2 };
}
maker._isValid = (mapId,targetX,targetY) => {
  if (targetX < 0 || targetY < 0) return false;
  const _map = MMO_Core["gameworld"].getMapById(mapId);
  if (targetX >= _map.width || targetY >= _map.height) return false;
  return true;
}
maker._isMapPassable = (mapId,x,y,d, skipRegion = false) => {
  const x2 = maker._roundXWithDirection(mapId,x, d);
  const y2 = maker._roundYWithDirection(mapId,y, d);
  const d2 = maker._getReverseDir(d);
  return maker._isPassable(mapId,x, y, d) && maker._isPassable(mapId,x2, y2, d2) && !maker._isRegionBlocking(mapId,x2,y2, skipRegion);
}
maker._isPassable = (mapId,x,y,d) => {
  return maker._checkPassage(mapId, x, y, (1 << (d / 2 - 1)) & 0x0f);
};
maker._isRegionBlocking = (mapId,x,y, skip = false) => {
  if (skip === true) return false;
  const _map = MMO_Core["gameworld"].getMapById(mapId);
  const height = _map.height;
  const width = _map.width;
  return (_map.data[(5 * height + y ) * width + x]) === 1;
}

maker._roundX = function(mapId,x) {
  // console.log('_roundX', mapId,x)
  const _map = MMO_Core["gameworld"].getMapById(mapId);
  return (_map.scrollType === 2 || _map.scrollType === 3) ? x % _map.width : x;
};
maker._roundY = function(mapId,y) {
  const _map = MMO_Core["gameworld"].getMapById(mapId);
  return (_map.scrollType === 2 || _map.scrollType === 3) ? y % _map.height : y;
};
maker._xWithDirection = function(x, d) {
  return x + (d === 6 ? 1 : d === 4 ? -1 : 0);
};
maker._yWithDirection = function(y, d) {
  return y + (d === 2 ? 1 : d === 8 ? -1 : 0);
};
maker._roundXWithDirection = function(mapId, x, d) {
  return maker._roundX(mapId, x + (d === 6 ? 1 : d === 4 ? -1 : 0));
};
maker._roundYWithDirection = function(mapId, y, d) {
  return maker._roundY(mapId, y + (d === 2 ? 1 : d === 8 ? -1 : 0));
};

maker.__tilesetId = (mapId,x,y) => {
  return maker._layeredTiles(mapId, x, y);
}
maker._tilesetFlags = (mapId) => {
  const tileset = MMO_Core["gameworld"].tileSets[ MMO_Core["gameworld"].getMapById(mapId).tilesetId ];
  if (tileset) {
    return tileset.flags;
  } else {
    return [];
  }
}
maker._tileId = (mapId,x,y,z) => {
  const _map = MMO_Core["gameworld"].getMapById(mapId);
  const width = _map.width;
  const height = _map.height;
  return _map.data[(z * height + y) * width + x] || 0;
}
maker._layeredTiles = (mapId,x,y) => {
  const tiles = [];
  for (let i = 0; i < 4; i++) {
      tiles.push(maker._tileId(mapId, x, y, 3 - i));
  }
  return tiles;
}
maker._checkPassage = (mapId,x,y,bit) => {
  const flags = maker._tilesetFlags(mapId);
  const tiles = MMO_Core["gameworld"].mapTileFinder(mapId,x,y);

  for (const tile of tiles) { // Tileset passage
    const flag = flags[tile];
    if ((flag & 0x10) !== 0) {
      // [*] No effect on passage
      continue;
    }
    if ((flag & bit) === 0) {
      // [o] Passable
      return true;
    }
    if ((flag & bit) === bit) {
      // [x] Impassable
      return false;
    }
  }
  return false;
}

maker._distTo = (fromUniqueId,toUniqueId) => {
  const from = MMO_Core["gameworld"].getNode(fromUniqueId);
  const to = MMO_Core["gameworld"].getNode(toUniqueId);
  if (from && from.mapId && to) {
    const { mapId } = from;
    const x1 = from.x,
          x2 = to.x,
          y1 = from.y,
          y2 = to.y;
    return maker._distance(x1,x2,y1,y2,mapId);
  } else return false;
}
maker._distance = (x1,x2,y1,y2,mapId) => {
  const deltaX = maker._deltaX(x1,x2,mapId);
  const deltaY = maker._deltaY(y1,y2,mapId);
  const distance = Math.abs(deltaX) + Math.abs(deltaY);
  // console.log('distance', distance)
  return distance;
}

maker._deltaX = (x1,x2,mapId) => {
  const _map = MMO_Core["gameworld"].getMapById(mapId);
  let result = x1 - x2;
  // console.log("_deltaX", result, maker._isLoopHorizontal(mapId));
  if (maker._isLoopHorizontal(mapId) && Math.abs(result) > Number(_map.width) / 2) {
    if (result < 0) {
      result += Number(_map.width);
    } else {
      result -= Number(_map.width);
    }
  }
  return result;
}
maker._deltaXFrom =(x1,x2,mapId) => maker._deltaX(x1,x2,mapId);

maker._deltaY = (y1, y2,mapId) => {
  const _map = MMO_Core["gameworld"].getMapById(mapId);
  let result = y1 - y2;
  if (maker.isLoopVertical(mapId) && Math.abs(result) > Number(_map.height) / 2) {
      if (result < 0) {
          result += Number(_map.height);
      } else {
          result -= Number(_map.height);
      }
  }
  return result;
};
maker._deltaYFrom =(y1,y2,mapId) => maker._deltaY(y1,y2,mapId);

maker._isLoopHorizontal = (mapId) => {
  const _map = MMO_Core["gameworld"].getMapById(mapId);
  return _map.scrollType === 2 || _map.scrollType === 3;
}
maker.isLoopVertical = (mapId) => {
  const _map = MMO_Core["gameworld"].getMapById(mapId);
  return _map.scrollType === 1 || _map.scrollType === 3;
}

maker._isCollidedWithCharacters = (mapId,x,y,initiator, skipCharacters = false, skipPlayers = false) => {
  //MMO_Core.socket.modules.player.subs.player.getPlayer()
  if (!MMO_Core["gameworld"].getMapById(mapId)) return; // prevent .find() on null
  if (initiator.summonable && !initiator.isEnemy) return false; // Summoned NPCs can go through entities for better convenience
  const hasSameCoords = (_event) => _event.x && _event.y && _event.x === x && _event.y === y;
  const isOriginalElement = (_event) => initiator && _event.id === initiator.id;
  return MMO_Core["gameworld"].getAllEntitiesByMapId(mapId,skipCharacters,skipPlayers).find(obj => obj && !obj._through && hasSameCoords(obj) && !isOriginalElement(obj));
}

maker._findDirectionTo = (npc,goalX, goalY, searchLimit = 12) => {
  if (!npc
  || !npc.mapId
  || !npc.x
  || !npc.y
  ) return console.log('_findDirectionTo > Invalid initiator', npc.mapId, initiator.x, initiator.y); // prevent .find() on null

  if (!MMO_Core["gameworld"].getMapById(npc.mapId)) return console.log('_findDirectionTo > No Map');

  const { mapId } = npc;
  // const searchLimit = 12;
  const mapWidth = MMO_Core["gameworld"].getMapById(mapId).width;
  const nodeList = [];
  const openList = [];
  const closedList = [];
  const start = {};
  let best = start;

  if (npc.x === goalX && npc.y === goalY) {
      return 0;
  }

  start.parent = null;
  start.x = npc.x;
  start.y = npc.y;
  start.g = 0;
  start.f = maker._distance(start.x, start.y, goalX, goalY, mapId)// $gameMap.distance(start.x, start.y, goalX, goalY);
  nodeList.push(start);
  openList.push(start.y * mapWidth + start.x);

  while (nodeList.length > 0) {
      let bestIndex = 0;
      for (let i = 0; i < nodeList.length; i++) {
          if (nodeList[i].f < nodeList[bestIndex].f) {
              bestIndex = i;
          }
      }

      const current = nodeList[bestIndex];
      const x1 = current.x;
      const y1 = current.y;
      const pos1 = y1 * mapWidth + x1;
      const g1 = current.g;

      nodeList.splice(bestIndex, 1);
      openList.splice(openList.indexOf(pos1), 1);
      closedList.push(pos1);

      if (current.x === goalX && current.y === goalY) {
          best = current;
          break;
      }

      if (g1 >= searchLimit) {
          continue;
      }

      for (let j = 0; j < 4; j++) {
          const direction = 2 + j * 2;
          const x2 = maker._roundXWithDirection(mapId, x1, direction)//  $gameMap.roundXWithDirection(x1, direction);
          const y2 = maker._roundYWithDirection(mapId, y1, direction);
          const pos2 = y2 * mapWidth + x2;

          if (closedList.includes(pos2)) {
              continue;
          }

          if (!maker._canPass(npc, direction)) {
              continue;
          }

          const g2 = g1 + 1;
          const index2 = openList.indexOf(pos2);

          if (index2 < 0 || g2 < nodeList[index2].g) {
              let neighbor = {};
              if (index2 >= 0) {
                  neighbor = nodeList[index2];
              } else {
                  nodeList.push(neighbor);
                  openList.push(pos2);
              }
              neighbor.parent = current;
              neighbor.x = x2;
              neighbor.y = y2;
              neighbor.g = g2;
              neighbor.f = g2 + maker._distance(x2, y2, goalX, goalY, mapId)// $gameMap.distance(x2, y2, goalX, goalY);
              if (!best || neighbor.f - neighbor.g < best.f - best.g) {
                  best = neighbor;
              }
          }
      }
  }

  let node = best;
  while (node.parent && node.parent !== start) {
      node = node.parent;
  }

  const deltaX1 = maker._deltaX(node.x,start.x,mapId) // $gameMap.deltaX(node.x, start.x);
  const deltaY1 = maker._deltaY(node.y, start.y,mapId);
  if (deltaY1 > 0) {
      return 2;
  } else if (deltaX1 < 0) {
      return 4;
  } else if (deltaX1 > 0) {
      return 6;
  } else if (deltaY1 < 0) {
      return 8;
  }

  const deltaX2 = maker._deltaXFrom(npc.x, goalX, mapId) // this.deltaXFrom(goalX);
  const deltaY2 = maker._deltaYFrom(npc.y, goalY, mapId) // this.deltaYFrom(goalY);
  if (Math.abs(deltaX2) > Math.abs(deltaY2)) {
      return deltaX2 > 0 ? 4 : 6;
  } else if (deltaY2 !== 0) {
      return deltaY2 > 0 ? 8 : 2;
  }

  return 0;
};
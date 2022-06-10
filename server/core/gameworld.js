/*****************************
  GAME WORLD by Axel Fiolle

  - Will allow you to synchronize NPCs inter/actions through multiple clients

  i. A connected map must include "<Sync>" inside its note.
  i. A connected NPC must include "<Sync>" in a comment in any page.

  i. The Spawn map must have "<Summon>" inside its note
  i. There must be only one spawn map
  i. Command to summon : /addNpc [eventId*] [mapId] [x] [y]

*****************************/

const { path } = require("./gamedata");

var exports = module.exports = {}
  , world = exports;

// World State :
world.nodes             = []; // Nodes will track every connected entity
world.gameMaps          = []; // Formated exploitable files from gamedata
world.instanceableMaps  = []; // Formated maps to track players and npcs
world.instancedMaps     = []; // Maps that are currently up and synced
world.tileSets          = []; // Needed to test collisions
world.spawnedUniqueIds  = []; // Helper to find spawned NPCs without uniqueId
world.forbiddenMaps     = []; // Array of mapIds where user cannot go

// Global helpers
world.getNode            = (uniqueId) => world.nodes.find(node => node.uniqueId === uniqueId);
world.getNodeBy          = (name,prop) => world.nodes.find(node => node[name] === prop);
world.getNodesBy         = (name,prop) => world.nodes.filter(node => node[name] === prop) || [];
world.getMapById         = (mapId) => world.gameMaps.find(map => map.mapId === mapId);
world.getPlayerNodes     = () => world.nodes.filter(node => node && !!node.clientId);
world.getInstanceByMapId = (mapId) => world.instancedMaps.find(instance => instance.mapId === mapId);
world.getSummonMap       = () => world.gameMaps.find(map => map.isSummonMap);
world.getInstanceByUniqueId = (uniqueId) => world.instancedMaps.find(instance => instance.uniqueId === uniqueId);
// Testing functions
world.isMapInstanced     = (mapId) => world.instancedMaps.find(i => i.mapId === mapId);
world.isSummonMap        = (map) => map && map.note && map.note.toUpperCase().includes("<SUMMON>");
world.isMapInstanceable  = (map) => true; // map.note && map.note.toUpperCase().includes("<SYNC>");
// NPC helpers
world.removeNpc       = (uniqueId) => world.getNpcByUniqueId(uniqueId) ? world.removeConnectedNpc( uniqueId ) : null;
world.getNpcMapId     = (uniqueId) => world.npcFinder(uniqueId).mapId;
world.getNpcIndex     = (uniqueId) => world.npcFinder(uniqueId).npcIndex;
world.getNpcEventId   = (uniqueId) => world.npcFinder(uniqueId).eventId;
world.getNpcInstance  = (uniqueId) => world.getInstanceByMapId( world.getNpcMapId(uniqueId) );
world.getNpcByUniqueId = (uniqueId) => world.getNpcInstance(uniqueId) && world.getNpcInstance(uniqueId).connectedNpcs.find(npc => npc && npc.uniqueId && npc.uniqueId === uniqueId);
world.getConnectedNpcs = (mapId) => world.getInstanceByMapId(mapId) && world.getInstanceByMapId(mapId).connectedNpcs;

world.initialize = (callback) => {
  console.log("######################################");
  console.log('[WORLD] GAME WORLD by Axel Fiolle')
  world.fetchTilesets(); // Load collision informations
  world.fetchMaps(); // Load MMO_Core.gamedata maps
  console.log('[WORLD] GAME WORLD is ready!');
  console.log("######################################");
  return callback();
}

world.fetchTilesets = () => {
  world.tileSets = MMO_Core["gamedata"].data['Tilesets'] || [];
  console.log('[WORLD] Loaded Tilesets')
}

/*************************************************************************************** Nodes Operations */

world.generateUniqueId = (base = 16) => { // public(int):string
  if (isNaN(base) || base < 2 || base > 36) return;
  const timestamp = () => new Date().getTime();
  const uniqueIntegerOne = () => Number( `${999999999 + Math.floor(Math.random() * 999999999)}${timestamp()}` )
      , uniqueIntegerTwo = () => Number( `${999999999 + Math.floor(Math.random() * 999999999)}${timestamp()}` );
  const hexOne = () => uniqueIntegerOne().toString(base)
      , hexTwo = () => uniqueIntegerTwo().toString(base)
      , hexThree = () => ( uniqueIntegerOne() + uniqueIntegerTwo() ).toString(base);
  return `#${hexOne()}${hexTwo()}${hexThree()}T${timestamp()}`;
}; // endof generateUniqueHex()

world.dice = (max = 6) => {
  return Math.floor(Math.random() * max) + 1;
}

world.preventHack = (client,_player, payload) => {
  if (!client) return;
  if (!payload || !_player) return console.error('preventHack did not work => _player,payload', _player,payload);

  if (payload.mapId === 75 // Offline maps, do not prevent
  || payload.mapId === 76 // Offline maps, do not prevent
  || payload.mapId === 41 // Bank in Fileau
  || payload.mapId === 27 // HdH Caldi
  || payload.mapId === 16 // GdL
  || payload.mapId === 59) return false; // Offline maps, do not prevent

  if (client.playerData.permission >= 50) return false; // admin can cheat

  if (MMO_Core["rpgmaker"]._distance(_player.x,payload.x, _player.y,payload.y, client.playerData.mapId) > 2) {
    // user might skip a tile because of UDP lag, so TP hack only send a clip not a cheat
    return "clip";
  }

  if (payload.helpMe) return "cheat";  // payload "helpMe" secret word for "I use the debug menu"
  

  if (payload.moveSpeed > 5
  || payload.through // noclip
  ) return "hack";

  if (world.forbiddenMaps.includes(payload.mapId) && client.playerData.permission < 50) {
    return "forbiddenMap"
  }

  return false;
}

world.emitToMap = async (mapId, event, payload) => {
  const players = await MMO_Core.socket.modules.player.subs.player.getPlayers();
  world.getAllPlayersByMapId(mapId).map(({ username }) => {
    if (players[username.toLowerCase()]) players[username.toLowerCase()].emit(event, payload);
  });
}

world.emitToPlayerByUsername = async (username, event, payload) => {
  if (!username || !event || !payload) return console.log('cannot emit to ', username, event, payload);
  // console.log('emitToPlayerByUsername', username, event, payload)
  const players = await MMO_Core.socket.modules.player.subs.player.getPlayers();
  if (players[username.toLowerCase()]) players[username.toLowerCase()].emit(event, payload);
}

world.attachNode = (object,isPlayer,clientId,walletId) => {
  let _node = null;
  if (isPlayer) {
    _node = world.makeNode({
      nodeType: 'player',
      username: object.username,
      playerId: object.id,
      walletId,
      clientId,
      x: object.x,
      y: object.y,
      // oldX: object.x,
      // oldY: object.y,
      mapId: object.mapId,
      teamId: 0,
    });
  }
  else _node = world.makeNode(object);

  if (_node) return world.nodes.push( _node );
}

world.makeNode = (object) => {
  if (!object || !object.nodeType) return;
  if (!object.uniqueId && !object.playerId) return
  const playerId = object.playerId || null;
  const objectUniqueId = object.uniqueId || null;
  const instanceUniqueId = object.nodeType === "instance" ? objectUniqueId : null;
  const npcUniqueId = object.nodeType === "npc" ? objectUniqueId : null;
  const actionUniqueId = object.nodeType === "action" ? objectUniqueId : null;
  const spawnerUniqueId = object.nodeType === "spawner" ? objectUniqueId : null;
  const fightUniqueId = object.nodeType === "fight" ? objectUniqueId : null;
  const teamUniqueId = object.nodeType === "team" ? objectUniqueId : null;
  const assetUniqueId = object.nodeType === "asset" ? objectUniqueId : null;

  const _node = {
    uniqueId: object.clientId || world.generateUniqueId(),
    nodeType: object.nodeType,
    playerId,
    instanceUniqueId,
    npcUniqueId,
    actionUniqueId,
    spawnerUniqueId,
    fightUniqueId,
    teamUniqueId,
    assetUniqueId,
  };

  // Models assignations
  if (fightUniqueId) Object.assign(_node, {
    mapId: object.mapId || 1,
    startedAt: object.startedAt || new Date(),
    actors: object.actors || []
  });
  if (teamUniqueId) Object.assign(_node, {
    teamId: object.id
  });
  if (playerId || npcUniqueId) {
    const _uid = (playerId || npcUniqueId);

    // console.log('will construct with', object)

    Object.assign(_node, {
      mapId: object.mapId || 1,
      eventId: object.eventId,
      busy: npcUniqueId ? 0 : false, // An NPC can be busy by multiple entity but player can do 1 thing at a time
      follows: npcUniqueId ? false : null,
      hasPet: playerId ? false : null,
      lastTimeNftUsed: playerId ? new Date(new Date().getTime - 60000) : null,
      lastTimeAction: playerId ? new Date(new Date().getTime - 60000) : null,
      direction: 2,
      routeStep: npcUniqueId ? 0 : null,
      isDashing: playerId ? false : null,
      username: object.username || null,
      clientId: object.clientId || null,
      address: playerId ? (object.address || "Disconnected") : null,
      signature: playerId ? (object.signature || "Disconnected") : null,
      starkPublicKey: playerId ? (object.starkPublicKey || "Disconnected") : null,
      x: object.x || 0,
      y: object.y || 0,
      _isInFight: () => MMO_Core["wabs"].isActorInFight(_uid),
      _isAttacking: () => MMO_Core["wabs"].isActorAttacking(_uid),
      _isAttacked: () => MMO_Core["wabs"].isActorAttacked(_uid),
      nfts: playerId ? [] : null,
    });
  }
  if (spawnerUniqueId) {
    Object.assign(_node, {
      mapId: object.coords.mapId,
      x: object.coords.x,
      y: object.coords.y,
    });
  }
  // Sanitize before return
  const removeNull = (obj) => Object.fromEntries(Object.entries(obj).filter(([key, value]) => value !== null));
  return removeNull(_node);
}
world.removeNode = (node) => {
  if (!node || !node.uniqueId) return;
  return world.nodes.splice( world.nodes.indexOf(world.getNode(node.uniqueId)) , 1);
}
world.mutateNode = (node, props) => {
  if (!node || !node.uniqueId || !world.getNode(node.uniqueId)) return;
  // console.log('mutateNode')
  for (const key of Object.keys(props)) { // Prevent assigning protected or not existing keys :
    const protected = [
      "uniqueId",
      "nodeType",
      "playerId",
      "username",
      "instanceUniqueId",
      "npcUniqueId",
      "actionUniqueId",
      "spawnerUniqueId",
      "assetUniqueId"
    ];
    if (protected.includes(key) || !Object.keys(world.getNode(node.uniqueId)).find(k => k === key) ) {
      MMO_Core["security"].createLog(`Invalid Key "${key}" assignation on Node ${node.uniqueId}`, 'error');
      return;
    }
  }
  return Object.assign(world.getNode(node.uniqueId), props);
} // endof mutateNode

/*************************************************************************************** Maps Operations */

world.fetchMaps = () => {
  console.log('[WORLD] Loading world maps');
  world.gameMaps = [];
  // use the file name as key in the loop, keeping only filename starting with "Map" :
  for (let fileName of Object.keys(MMO_Core["gamedata"].data).filter(name => name.startsWith("Map") && name !== "MapInfos")) {
    // Format map from game file and and to world
    const _gameMap = world.getMapFromGameData(MMO_Core["gamedata"].data[fileName],fileName);
    const _isSummon = _gameMap.isSummonMap;
    const _isSync = world.isMapInstanceable(_gameMap);
    console.log(`[WORLD] ... ${fileName} ${_gameMap.isAdminMap ? '<Admin>' : ''}${_isSummon ? '<Summon>' : ''}${world.isMapInstanceable(_gameMap) ? '<Sync>' : ''}`);
    world.gameMaps.push( _gameMap ); 
    if (_isSync) world.instanceableMaps.push( _gameMap );
    if (_gameMap.isAdminMap) world.forbiddenMaps.push(_gameMap.mapId);
  }
}

world.isSpecialMap = (mapId) => {
  return mapId === 5 || mapId === 73 || mapId === 74
}

world.getMapFromGameData = (gameMap, fileName) => {
  // a GameMap is a raw map file + some additional useful datas
  return Object.assign(gameMap, {
    isAdminMap: gameMap.note && gameMap.note.toLowerCase().includes('<admin>'),
    mapId: world.getMapIdByFileName(fileName),
    fileName,
    isSummonMap: world.isSummonMap(gameMap),
    nodeType: 'map',
  });
}
world.getMapIdByFileName = (fileName) => Number(fileName.slice(3));

world.makeInstance = (map,initiator) => {
  // Assign needed props to make Instance :
  const _map = Object.assign({}, map); // Keep original map clean
  const _time = new Date();
  const permanent = JSON.stringify(_map).toLowerCase().includes('<permanent>');
  return Object.assign(_map, {  // an Instance is an extends of a GameMap
    uniqueId: `${map.fileName}#${world.instancedMaps.length}@${_time.getTime()}`,
    initiator: initiator || 'server', // playerId || 'server'
    startedAt: _time,
    lastPlayerLeftAt: null, // Date
    dieAfter: 24 * 60 * 60 * 1000,        // When no more players left, kill after X ms
    permanent,              // Make the instance never die
    pauseAfter: 30 * 1000,  // When no more player, interrupt lifecycle after X ms
    paused: false,          // Can prevent lifecycle execution
    connectedNpcs: [],      // Array of Objects
    playersOnMap: [],       // Array of String
    actionsOnMap: [],       // Array of Objects -> Actions currently running in instance
    allTiles: world.provideMapTiles(map), // Generate the map's tiles informations
    nodeType: 'instance'
  });
}

world.runInstance = (mapId,playerId) => {
  const _map = world.getMapById(mapId);
  if (_map && world.isMapInstanceable(_map) && !world.isMapInstanced(mapId)) {
    const _makeInstance = world.makeInstance(_map,playerId);
    world.instancedMaps.push( _makeInstance );
    world.attachNode( _makeInstance );
    console.log('[WORLD] # Started instance', _makeInstance.uniqueId, { // Output useful informations
      uniqueId: _makeInstance.uniqueId,
      initiator: _makeInstance.initiator,
      startedAt: _makeInstance.startedAt,
    });
    world.fetchConnectedNpcs(_map);
    world.startInstanceLifecycle(mapId);
    return _makeInstance;
  }
}

world.killInstance = (mapId) => {
  if (world.isMapInstanced(mapId) && !world.getInstanceByMapId(mapId).playersOnMap.length) {
    // Clean instance if no more players on it
    for (let _npc of world.getAllNpcsByMapId(mapId)) world.removeConnectedNpcByUniqueId(_npc.uniqueId);
    const index = world.instancedMaps.indexOf(world.getInstanceByMapId(mapId));
    const _node = world.getNodeBy('instanceUniqueId',world.instancedMaps[index].uniqueId);
    const _cleanedInstance = { // Keep useful datas
      uniqueId: world.instancedMaps[index].uniqueId,
      initiator: world.instancedMaps[index].initiator,
      startedAt: world.instancedMaps[index].startedAt,
      lastPlayerLeftAt: world.instancedMaps[index].lastPlayerLeftAt,
      deletedAt: new Date(),
      paused: true
    }
    Object.keys(world.instancedMaps[index]).map(key => delete world.instancedMaps[index][key]); // Clean useless datas
    Object.assign(world.instancedMaps[index], _cleanedInstance); // Assign cleaned instance in state
    world.removeNode( _node );
    console.log('[WORLD] # Killed instance', _cleanedInstance.uniqueId, world.instancedMaps[index]); // Output useful informations
  }
}

world.playerJoinInstance = async (playerId,mapId) => {
  if (!world.isMapInstanceable(world.getMapById(mapId)) || world.isSummonMap(world.getMapById(mapId))) return;
  if (!world.isMapInstanced(mapId)) await world.runInstance(mapId,playerId); // If instance not existing, run it before
  const _instance = await world.getInstanceByMapId(mapId);
  if (_instance) {
    if (_instance.paused) world.startInstanceLifecycle(mapId); // If paused, restart
    if (!world.getInstanceByMapId(mapId)['playersOnMap'].includes(playerId)) {
      world.getInstanceByMapId(mapId).playersOnMap.push(playerId); // Add playerId to Array
      console.log('[WORLD] playerJoinInstance', world.getInstanceByMapId(mapId).uniqueId);
    }
  } else console.error('cannot find instance', playerId, mapId);
}

world.playerLeaveInstance = (playerId,mapId) => {
  if (!world.isMapInstanceable(world.getMapById(mapId))) return;
  if (world.getInstanceByMapId(mapId) && world.getInstanceByMapId(mapId).playersOnMap.includes(playerId)) {
    const _players = world.getInstanceByMapId(mapId).playersOnMap;
    world.getInstanceByMapId(mapId).playersOnMap.splice(_players.indexOf(playerId), 1); // Remove playerId from Array
    console.log('[WORLD] playerLeaveInstance', mapId, JSON.stringify(world.getInstanceByMapId(mapId).playersOnMap) );
    if (!world.getInstanceByMapId(mapId).playersOnMap.length) world.getInstanceByMapId(mapId).lastPlayerLeftAt = new Date();
    if (!world.getInstanceByMapId(mapId).permanent) {
      setTimeout(() => world.killInstance(mapId), world.getInstanceByMapId(mapId).dieAfter); // Kill the instance after X ms
    }
  }
}

/*************************************************************************************** NPC Operations */

world.fetchConnectedNpcs = (map) => {
  if (!map || !world.isMapInstanced(map.mapId)) return;
  for (let npc of world.getInstanceByMapId(map.mapId).events.filter(event => JSON.stringify(event).includes('<Sync>'))) {
    const _generatedNpc = world.makeConnectedNpc(npc,map);
    if (_generatedNpc) {
      world.getConnectedNpcs(map.mapId).push( _generatedNpc );
      world.attachNode( _generatedNpc );
      world.makeNpcWaypoints(_generatedNpc,map.mapId)
      // console.log('[WORLD] Added synced NPC ' + _generatedNpc.uniqueId + ' on map ' + map.mapId);
    }
  }
}
world.getAllNpcsByMapId = (mapId) => {
  if (!mapId || !world.getMapById(mapId) || !world.getInstanceByMapId(mapId)) return;
  return ( // Concat multiple arrays into one :
    [].concat(world.getConnectedNpcs(mapId))
      .concat(world.getMapById(mapId).events) // add static events
  ).filter(event => !!event); // remove null events
}
world.getAllPlayersByMapId = (mapId) => {
  if (!mapId) return;
  return world.nodes.filter(node => !!node.playerId && node.mapId === mapId);
}
world.getAllEntitiesByMapId = (mapId, skipCharacters = false, skipPlayers = false) => {
  if (!mapId) return;
  return []
  // .concat(world.getNodesBy('mapId', mapId))
  .concat(skipCharacters ? [] : world.getAllNpcsByMapId(mapId))
  .concat(skipPlayers ? [] : world.getAllPlayersByMapId(mapId))
}

world.makeNpcWaypoints = (npc,mapId) => {
  if (!npc || !world.getInstanceByMapId(mapId)) return;
  const _npc = world.getConnectedNpcs(mapId).find(find => find.uniqueId === npc.uniqueId);
  
  const pathId = JSON.stringify(_npc).split("<Path:").length > 1 && Number(JSON.stringify(_npc).split("<Path:")[1].split('>')[0]);
  if (pathId) {
    // console.log('pathId', pathId)
    const steps = {
      0: { x: npc.x, y: npc.y, mapId, wait: 0 },
    };
    
    for (const point of world.getInstanceByMapId(mapId).events.filter(filtered => JSON.stringify(filtered).includes(`<Waypoint:${ pathId }`))) {
      const step = Number(JSON.stringify(point).split(`<Waypoint:${ pathId }/`)[1].split('>')[0]);
      const wait = JSON.stringify(point).split(`<Wait:`) && JSON.stringify(point).split(`<Wait:`)[1] && Number(JSON.stringify(point).split(`<Wait:`)[1].split('>')[0]) || 0;
      const { x, y } = point;
      steps[step] = {x,y, mapId, wait };
    }
    // console.log('steps', steps);
    world.getConnectedNpcs(mapId).find(find => find.uniqueId === npc.uniqueId).path.steps = steps;
  }
}

world.makeConnectedNpc = (npc,instance,pageIndex,initiator, forceCoords) => {
  if (!npc || !instance) return;
  // Target selected or first page to assign helpers :
  const formatedPageIndex = (pageIndex && !isNaN(pageIndex)) ? parseInt(pageIndex) : 0;
  const _instance = world.getInstanceByMapId(instance.mapId);
  const uniqueId = `Npc${npc.id}#${_instance.connectedNpcs.length}@${_instance.mapId}`; // Every NPC has to be clearly differentiable
  const _page = npc.pages && npc.pages[formatedPageIndex] || npc.pages[0];
  const _npc = Object.assign({}, npc); // Prevent rewrite existing when make

  const isAbs = JSON.stringify(npc).toUpperCase().includes('<ABS:');

  if (isAbs) {
    const absId = Number(JSON.stringify(npc).toUpperCase().split('<ABS:')[1].split('>')[0]);
    const isEnemy = JSON.stringify(npc).includes('<Is Enemy>');
    const isEvil = JSON.stringify(npc).includes('<Is Evil>');
    const stats = MMO_Core["wabs"].database.enemies.find(monster => monster.id == absId);
    const teamId = stats.teamId !== null ? stats.teamId : (isEvil || isEvil ? 1 : 0);

    const absData = {};
    const dbEnemy = MMO_Core["wabs"].findEnemy(absId);
    const { params } = dbEnemy;

    Object.assign(absData, {
      hp: params[0], mp: params[1],
      mhp: params[0], mpm: params[1],
      atk: params[2], def: params[3],
      mAtk: params[4], mDef: params[5],
      agi: params[6], luck: params[7],
      _actions: () => MMO_Core["wabs"].findEnemy(absId).actions,
      dropItems: dbEnemy.dropItems,
      _traits: () => MMO_Core["wabs"].findEnemy(absId).traits,
      gold: dbEnemy.gold,
      exp: dbEnemy.exp,
      summonId: dbEnemy.summonId, // event to trigger to CLIENT on npc death
      cEonDeath: dbEnemy.cEonDeath, // event to trigger to CLIENT on npc death
      cEonStart: dbEnemy.cEonStart, // event to trigger to CLIENT on fight start
      escapeOnBattle: dbEnemy.escapeOnBattle,
      heavy: dbEnemy.heavy,
      level: Number(dbEnemy.level) || 1,
      // noMove: dbEnemy.noMove,
      noTarget: dbEnemy.noTarget,
      reviveTime: Number(dbEnemy.reviveTime) * 1000 || 30 * 1000, // seconds to ms
      sideVisor: dbEnemy.sideVisor,
      teamId: dbEnemy.teamId,
      tVisor: dbEnemy.tVisor,
      viewRadius: dbEnemy.viewRadius,
      _origViewRadius: dbEnemy.viewRadius,
    });

    Object.assign(_npc, {
      absId,
      isEnemy,
      isEvil,
      stats,
      teamId,
      absData: Object.keys(absData).length ? absData : null,
    });
  } // endof absData

  return Object.assign(_npc, { // Add new properties
    uniqueId,
    initiator: initiator || 'server',
    eventId: npc.id, // Event "ID" client-side
    lastActionTime: new Date(),
    lastMoveTime: new Date(),
    summonable: false,
    busy: 0,
    follows: false,
    mapId: instance.mapId,
    nodeType: 'npc',
    // _ helpers
    _conditions: _page.conditions,
    _directionFix: _page.directionFix,
    _image: _page.image,
    _list: _page.list,
    _moveFrequency: _page.moveFrequency,
    _origMoveFrequency: _page.moveFrequency,
    _moveRoute: _page.moveRoute,
    _moveSpeed: _page.moveSpeed,
    _origMoveSpeed: _page.moveSpeed,
    _moveType: _page.moveType,
    _origMoveType: _page.moveType,
    _priorityType: !initiator ? _page.priorityType : 0,
    _stepAnime: _page.stepAnime,
    _through: _page.through,
    _trigger: _page.trigger,
    _walkAnime: _page.walkAnime,
    _selectedPageIndex: formatedPageIndex,
    path: {
      currentStep: 0,
      steps: {},
      backward: false,
      pathfinding: false,
      isReturning: false,
    },
    origX: forceCoords && Number(forceCoords.x) || _npc.x,
    origY: forceCoords && Number(forceCoords.y) || _npc.y,
  });
} // endof makeConnectedNpc

world.spawnNpc = (npcSummonId, coords, pageIndex, initiator, _forcePriority = 0) => {
  console.log('spawnNpc',npcSummonId, coords, pageIndex, initiator.uniqueId || initiator, _forcePriority);
  // coords = { mapId, x, y }
  if (!coords || !coords.mapId || !coords.x || !coords.y || !world.getSummonMap()) return;

  const _npcToReplicate = world.getSummonMap().events.find(npc => npc && (npc.id === npcSummonId || (npc.summonId && npc.summonId === npcSummonId)));
  const _targetInstance = world.getInstanceByMapId(coords.mapId);
  if (!_npcToReplicate || !_targetInstance) return;
  const _generatedNpc = world.makeConnectedNpc(_npcToReplicate,_targetInstance,pageIndex,initiator,coords);
  // console.log('_generated', _generatedNpc)
  if (!_generatedNpc) return
  const uniqueIntegerId = 99999 + Math.floor(Math.random() * 99999); // Prevents event id conflicts
  const uniqueId = `Npc${uniqueIntegerId}#${world.getConnectedNpcs(coords.mapId).length}@${coords.mapId}`;
  Object.assign(_generatedNpc, {
    uniqueId,
    summonId: npcSummonId,
    id: uniqueIntegerId,
    eventId: uniqueIntegerId,
    summonable: true,
    mapId: coords.mapId,
    x: coords.x,
    y: coords.y,
  });

  world.attachNode( _generatedNpc );

  // console.log('_generatedNpc', _generatedNpc)

  world.spawnedUniqueIds.push( _generatedNpc.uniqueId );
  const _spawnedIndex = world.spawnedUniqueIds.indexOf(_generatedNpc.uniqueId);
  Object.assign(_generatedNpc, { _spawnedIndex })
  world.getConnectedNpcs(coords.mapId).push( _generatedNpc );

  if (_generatedNpc._moveType === 2) { // If is a follower Npc
    const initiatedByPlayer = world.getNodeBy('playerId', initiator) || world.getNodeBy('uniqueId', initiator.uniqueId);
    if (initiatedByPlayer && initiatedByPlayer.uniqueId)
    world.mutateNode( // Set the target on the node
      world.getNodeBy('npcUniqueId', _generatedNpc.uniqueId), // target
      { follows: initiatedByPlayer.uniqueId } // new value
    );
  }

  if (_generatedNpc._moveType === 3) { // On spawn, try to find waypath
    world.makeNpcWaypoints(_generatedNpc,coords.mapId)
  }
  
  MMO_Core["security"].createLog(`[WORLD] Spawned NPC ${_generatedNpc.uniqueId} (${coords.x};${coords.y}) by "${_generatedNpc.initiator}"`)
  world.emitToMap(_generatedNpc.mapId, "npcSpawn", Object.assign({
    _through: _forcePriority !== 1, // Force neutral behavior in client to let server decide
    _priorityType: _forcePriority, // Force client to ignore this NPC hitbox
  }, world.getNpcByUniqueId(_generatedNpc.uniqueId)));

  return _generatedNpc;
} // endOf spawnNpc()

world.disableNpc = (npc) => {
  world.npcMoveTo(npc,-1,-1); // visually hide npc
  Object.assign(world.getNpcByUniqueId(npc.uniqueId), { disabled: true }); // Prevent turn execution
}
world.removeSpawnedNpcByIndex = (index) => {
  if (!world.spawnedUniqueIds[index]) return;
  return world.removeConnectedNpcByUniqueId(world.spawnedUniqueIds[index]);
}
world.removeConnectedNpcByUniqueId = (uniqueId) => {
  if (!world.getNpcByUniqueId(uniqueId) || !world.getNpcInstance(uniqueId)) return;
  const _parentInstance = world.getNpcInstance(uniqueId);
  const _npc = world.getNpcByUniqueId(uniqueId);
  const _node = world.getNodeBy('npcUniqueId', _npc.uniqueId);
  const _spawnedIndex = world.spawnedUniqueIds.indexOf(uniqueId);

  // Destroy NPC :
  world.disableNpc(_npc); // Prevent tick to run this NPC
  world.getConnectedNpcs(_parentInstance.mapId).splice(world.getConnectedNpcs(_parentInstance.mapId).indexOf(_npc), 1);
  if (_spawnedIndex != -1) world.spawnedUniqueIds.splice(_spawnedIndex, 1, ""); // replace item with empty str to keep spawned index
  world.removeNode( _node );

  console.log(`[WORLD] Removed NPC ${uniqueId} at ${new Date()}`)
  world.emitToMap(_npc.mapId, "npcRemove", { uniqueId });
  return uniqueId;
}

world.npcMoveStraight = (npc,direction,skip = false) => {
  if (!npc || !world.getNpcByUniqueId(npc.uniqueId)) return
  // console.log('[WORLD] npcMoveStraight (1/2)', npc.uniqueId, { x: npc.x,y: npc.y }, {direction});
  if (skip || MMO_Core["rpgmaker"]._canPass(npc,direction)) {
    const { mapId } = world.getNodeBy('npcUniqueId', npc.uniqueId);
    world.getNpcByUniqueId(npc.uniqueId).x = MMO_Core["rpgmaker"]._roundXWithDirection(mapId, world.getNpcByUniqueId(npc.uniqueId).x, direction);
    world.getNpcByUniqueId(npc.uniqueId).y = MMO_Core["rpgmaker"]._roundYWithDirection(mapId, world.getNpcByUniqueId(npc.uniqueId).y, direction);
    world.mutateNode(world.getNodeBy('npcUniqueId', npc.uniqueId), {
      x: world.getNpcByUniqueId(npc.uniqueId).x,
      y: world.getNpcByUniqueId(npc.uniqueId).y
    });
    world.emitToMap(mapId, "npc_moving", {
      uniqueId: npc.uniqueId,
      mapId,
      id: npc.eventId,
      moveSpeed: npc._moveSpeed,
      moveFrequency: npc._moveFrequency,
      direction: direction,
      x: world.getNpcByUniqueId(npc.uniqueId).x,
      y: world.getNpcByUniqueId(npc.uniqueId).y,
      skip,
    });
    // console.log('[WORLD] npcMoveStraight (2/2)', npc.uniqueId, {
    //   x: world.getNpcByUniqueId(npc.uniqueId).x,
    //   y: world.getNpcByUniqueId(npc.uniqueId).y
    // });
    return true;
  } else return false;
}
world.npcMoveTo = (npc,x,y) => {
  if (!npc || !x || !y || !world.getNpcByUniqueId(npc.uniqueId))
  world.getNpcByUniqueId(npc.uniqueId).x = x;
  world.getNpcByUniqueId(npc.uniqueId).y = y;
  world.mutateNode(world.getNodeBy('npcUniqueId', npc.uniqueId), {x,y});
  MMO_Core["socket"].emitToAll("npc_moving", {
    uniqueId: world.getNpcByUniqueId(npc.uniqueId).uniqueId,
    mapId: world.getNpcByUniqueId(npc.uniqueId).mapId,
    id: world.getNpcByUniqueId(npc.uniqueId).eventId,
    x: world.getNpcByUniqueId(npc.uniqueId).x,
    y: world.getNpcByUniqueId(npc.uniqueId).y,
    skip: true,
  });
}

world.npcMoveRandom = (npc) => {
  const direction = 2 + Math.floor(Math.random() * 4) * 2; // No diag
  return world.npcMoveStraight(npc, direction);
};

world.npcMoveTowardEntity = async (npc,targetUniqueId) => {
  // console.log('npcMoveTowardEntity', npc.uniqueId, targetUniqueId);
  const _npcNode = await world.getNodeBy('npcUniqueId', npc.uniqueId);
  const _entity = await world.getNode(targetUniqueId);
  if (!_npcNode) return;
  const isEnemy = npc.isEnemy || npc.isEvil;
  if (!_entity) { // If target not existing
    if (!isEnemy) { // If npc is ally, remove
      const indexRemove = world.spawnedUniqueIds.indexOf(npc.uniqueId)
      return world.removeSpawnedNpcByIndex(indexRemove);
    } else return world.stopNpcFollowing(npc.uniqueId, true); // else juste reset normal behavior
  }

  const sameMap = _npcNode.mapId === _entity.mapId;
  // if (!sameMap) return;

  const distance = MMO_Core["rpgmaker"]._distTo(_npcNode.uniqueId,targetUniqueId);
  const isCloseToEntity = distance <= 1;
  // console.log('distance, close', distance, isCloseToEntity)

  if (isCloseToEntity) return world.npcLookTowardEntity(npc,targetUniqueId);
  else world.setNpcFollowing(npc.uniqueId, { disabled: false, _priority: 1 }); // make sure to unpause if no error

  // console.log('check', npc)
  const enemyDisabled = isEnemy && (!sameMap || distance > npc.absData.viewRadius);
  const allyChangedMap = !isEnemy && !sameMap;
  const allyDisabled = !isEnemy && !sameMap && isCloseToEntity;
  const allyTooFar = !isEnemy && (sameMap && distance > 8);

  // console.log("enemy, 2 disabled, priority", isEnemy, enemyDisabled, allyDisabled, _priority)
  if (allyChangedMap) {
    console.log('allyChangedMap!!')
    const { x, y, mapId } = world.getNode(targetUniqueId)
    if (!world.isSpecialMap(mapId)) world.companionTeleport(npc, { x, y, mapId }, {
      follows: _entity.hasPet ? targetUniqueId : false
    });
    return;
  }
  else if (enemyDisabled) return world.stopNpcFollowing(npc.uniqueId, true); // true = randomMoves
  else if (allyDisabled) return world.setNpcFollowing(npc.uniqueId, { disabled: false }); // pause/through
  else if (allyTooFar) {
    // console.log('allyTooFar!!')
    const { x,y } = world.getNode(targetUniqueId)
    world.getNpcByUniqueId(npc.uniqueId).x = x;
    world.getNpcByUniqueId(npc.uniqueId).y = y;
    world.mutateNode(_npcNode, { x, y });
  }

  const realTimeNode = await world.getNodeBy('npcUniqueId', npc.uniqueId);
  const sx = MMO_Core["rpgmaker"]._deltaX( realTimeNode.x, _entity.x, _npcNode.mapId );
  const sy = MMO_Core["rpgmaker"]._deltaY( realTimeNode.y, _entity.y, _npcNode.mapId );

  // console.log('sx,sy', sx, sy)

  if (_npcNode.uniqueId === _entity.hasPet) {
    if (distance > 2) MMO_Core["wabs"].npcUpdateMoveSpeed(_npcNode.uniqueId, 5);
    else MMO_Core["wabs"].npcUpdateMoveSpeed(_npcNode.uniqueId, 4);
  }

  const skip = allyTooFar;

  const bestDirection = MMO_Core["rpgmaker"]._findDirectionTo(
    world.getNpcByUniqueId(npc.uniqueId),
    _entity.x,
    _entity.y
  );
  // console.log('bestDirection', bestDirection)
  
  
  // if (!world.npcMoveStraight(npc,bestDirection,skip)) { 
  if (Math.abs(sx) > Math.abs(sy)) {
    if (!world.npcMoveStraight(npc, (sx > 0 ? 4 : 6), skip)) {
      return world.npcMoveStraight(npc, (sy > 0 ? 8 : 2), skip);
    }
  } else if (sy !== 0) {
    if (!world.npcMoveStraight(npc, (sy > 0 ? 8 : 2), skip)) {
      return world.npcMoveStraight(npc, (sx > 0 ? 4 : 6), skip);
    }
  }
};

world.npcMoveTowardCoords = (npc,coords,pathfinding = false) => {
  if (!npc || !coords || !coords.x || !coords.y) return console.warn('npcMoveTowardCoords error', npc, coords, pathfinding);
  const sx = MMO_Core["rpgmaker"]._deltaX( npc.x, coords.x, coords.mapId );
  const sy = MMO_Core["rpgmaker"]._deltaY( npc.y, coords.y, coords.mapId );

  if (Math.abs(sx) > Math.abs(sy)) {
    if (!world.npcMoveStraight(npc, (sx > 0 ? 4 : 6))) {
      if (pathfinding) world.npcMoveStraight(npc, (sy > 0 ? 8 : 2));
    }
  } else if (sy !== 0) {
    if (!world.npcMoveStraight(npc, (sy > 0 ? 8 : 2))) {
      if (pathfinding) world.npcMoveStraight(npc, (sx > 0 ? 4 : 6));
    }
  }
  const {x,y,mapId} = world.getNodeBy('npcUniqueId', npc.uniqueId);
  return {x,y,mapId};
}

world.npcUpdateMoveSpeed = (npcUniqueId, dashSpeed = 4) => {
  console.log('npcUpdateMoveSpeed', npcUniqueId, dashSpeed);
  if (MMO_Core["gameworld"].getNpcByUniqueId(npcUniqueId)
  && !isNaN(dashSpeed)
  && dashSpeed >= 1
  && dashSpeed <= 6
  ) {
    MMO_Core["gameworld"].getNpcByUniqueId(npcUniqueId)._moveSpeed = dashSpeed;
    console.log('MMO_Core["gameworld"].getNpcByUniqueId(npcUniqueId)._moveSpeed', MMO_Core["gameworld"].getNpcByUniqueId(npcUniqueId)._moveSpeed)
  }
}

world.companionTeleport = async (npc, coords, assign = {}) => {
  const npcSummonId = npc.summonId;
  const indexRemove = world.spawnedUniqueIds.indexOf(npc.uniqueId)
  world.removeSpawnedNpcByIndex(indexRemove);
  // console.log('companionTeleport', assign)
  if (assign.follows) {
    const _targetNode = MMO_Core["gameworld"].getNodeBy('uniqueId', assign.follows);
    world.mutateNode(_targetNode, { hasPet: false });
    world.toggleCompanion(_targetNode,npcSummonId);
    if (MMO_Core["gameworld"].getNodeBy('uniqueId', assign.follows).isDashing) {
      world.npcUpdateMoveSpeed(_targetNode.hasPet, _targetNode.isDashing ? 5 : 4);
    }
  } else {
    world.spawnNpc(npcSummonId, coords, 0, npc.initiator);
  }
}

world.npcLookTowardEntity = (npc,targetUniqueId) => {
  const _npcNode = world.getNodeBy('npcUniqueId', npc.uniqueId);
  const _entity = world.getNode(targetUniqueId);
  if (!_npcNode || !_entity) return;
  if (_npcNode.mapId !== _entity.mapId) return;
  const sx = MMO_Core["rpgmaker"]._deltaX(_npcNode.x,_entity.x,_npcNode.mapId);
  const sy = MMO_Core["rpgmaker"]._deltaY(_npcNode.y,_entity.y,_npcNode.mapId);
  const direction = (Math.abs(sx) > Math.abs(sy)) ? (sx > 0 ? 4 : 6) : (sy > 0 ? 8 : 2);
  return MMO_Core["socket"].emitToAll("npcTurn", {
    npcUniqueId: npc.uniqueId,
    direction
  });
};

world.setNpcFollowing = (npcUniqueId,follows) => {
  if (!npcUniqueId || !follows) return;
  const _npcNode = world.getNodeBy('npcUniqueId', npcUniqueId);
  if (!_npcNode.follows && world.getNpcByUniqueId(npcUniqueId)) {
    if (world.getNpcByUniqueId(npcUniqueId).isEnemy || world.getNpcByUniqueId(npcUniqueId).isEvil) {
      // if (world.getNpcByUniqueId(npcUniqueId)._moveSpeed < 6) world.getNpcByUniqueId(npcUniqueId)._moveSpeed += 1;
      if (world.getNpcByUniqueId(npcUniqueId).heavy) {
        world.getNpcByUniqueId(npcUniqueId)._moveSpeed = 3;
        world.getNpcByUniqueId(npcUniqueId)._moveFrequency = 4;
      } else {
        world.getNpcByUniqueId(npcUniqueId)._moveSpeed = 2;
        world.getNpcByUniqueId(npcUniqueId)._moveFrequency = 5;
      }
    }
    world.getNpcByUniqueId(npcUniqueId)._moveType = 2; 
    world.getNpcByUniqueId(npcUniqueId)._priorityType = 0;
    return world.mutateNode(_npcNode, { follows });
  }
}
world.stopNpcFollowing = (npcUniqueId, randomMoves = false) => {
  if (!npcUniqueId) return;
  // console.log('stopNpcFollowing', npcUniqueId)
  const _npcNode = world.getNodeBy('npcUniqueId', npcUniqueId);
  if (_npcNode && randomMoves && world.getNpcByUniqueId(npcUniqueId)) {
    if (world.getNpcByUniqueId(npcUniqueId).isEnemy || world.getNpcByUniqueId(npcUniqueId).isEvil) {
      world.getNpcByUniqueId(npcUniqueId).path.isReturning = true;
    }
    world.getNpcByUniqueId(npcUniqueId)._moveFrequency = world.getNpcByUniqueId(npcUniqueId)._origMoveFrequency;
    world.getNpcByUniqueId(npcUniqueId)._moveSpeed = world.getNpcByUniqueId(npcUniqueId)._origMoveSpeed;
    world.getNpcByUniqueId(npcUniqueId)._moveType = world.getNpcByUniqueId(npcUniqueId)._origMoveType || 1;
    world.getNpcByUniqueId(npcUniqueId)._priorityType = 1;
    world.mutateNode(_npcNode, { follows: false });
    // console.log('stoip', world.getNpcByUniqueId(npcUniqueId))
  }
}

world.npcAddBusy = (npcUniqueId) => {
  console.log('npcAddBusy', npcUniqueId);
  if (!npcUniqueId || !world.getNodeBy('npcUniqueId', npcUniqueId)) return;
  world.getNodeBy('npcUniqueId', npcUniqueId).busy++;
}
world.npcRemoveBusy = (npcUniqueId) => {
  console.log('npcRemoveBusy', npcUniqueId);
  if (!npcUniqueId || !world.getNodeBy('npcUniqueId', npcUniqueId)) return;
  if (world.getNodeBy('npcUniqueId', npcUniqueId).busy > 0) world.getNodeBy('npcUniqueId', npcUniqueId).busy--;
}

world.toggleCompanion = (_player, idOnTpMap, _forcePriority = 0) => {
  if (!_player || !idOnTpMap) return;
  console.log('toggleCompanion', _player.uniqueId, idOnTpMap);
  if (_player.hasPet !== false) {
    const _petNpc = world.getNpcByUniqueId(_player.hasPet);
    MMO_Core["gameworld"].removeConnectedNpcByUniqueId(_petNpc.uniqueId);
    MMO_Core["gameworld"].mutateNode(_player, { hasPet: false })
  } else {
    const { x, y, mapId } = _player;
    const companionNpc = MMO_Core["gameworld"].spawnNpc(idOnTpMap, { x, y, mapId }, 0, _player.playerId, _forcePriority);
    MMO_Core["gameworld"].mutateNode(_player, { hasPet: companionNpc.uniqueId })
  }
}

/*************************************************************************************** Instance Life Cycle Operations */

world.handleInstanceAction = (action,instance,currentTime) => {
  // This function will interpret/mock a game script then emit 
  // an event to replicate it on every concerned player
  if (!action || !instance || !currentTime) return;
  return;
}

world.handleNpcTurn = async (npc,_currentTime,_cooldown) => {
  // This function will read basic NPC behavior and mock it on
  // server-side then replicate it on every concerned player
  if (!npc 
  || npc.disabled
  || !npc.uniqueId
  || !world.getNpcByUniqueId(npc.uniqueId)
  || world.getNodeBy('npcUniqueId', npc.uniqueId).busy
  ) return;

  if (npc.absData && npc.absData.hp <= 0) {
    const _currState = Object.assign({}, npc);
    // const originalEnemy = world.getInstanceByMapId(map.mapId).events.find(event => JSON.stringify(event).includes('<Sync>')))
    const  { origX,origY,mapId } = _currState;
    let summonId = _currState.absData.summonId
    // console.log('summonId', summonId)
    world.removeConnectedNpcByUniqueId(npc.uniqueId);
    return setTimeout(() => {
      // console.log('setTimeout')
      if (isNaN(summonId)) {
        const arr = summonId.split(',')
        const randIndex = Math.floor(Math.random() * arr.length - 1)
        summonId = arr[randIndex] || arr[0];
        // console.log('summonId rand', summonId)
      }
      world.spawnNpc(Number(summonId), {
        x: origX,
        y: origY,
        mapId
      }, 0, "server", 1);
    }, _currState.absData.reviveTime)
  }

  const currentTime = _currentTime || new Date()
      , cooldown = _cooldown || Infinity;
  
  // read NPCs infos (speed, rate, etc, ...)
  const delayedActionTime = currentTime.getTime() - world.getNpcByUniqueId(npc.uniqueId).lastActionTime.getTime();
  const delayedMoveTime = currentTime.getTime() - world.getNpcByUniqueId(npc.uniqueId).lastMoveTime.getTime();
  
  // make NPCs behavior
  let canMoveThisTurn = delayedMoveTime > cooldown;

  const _npcNode = world.getNodeBy('npcUniqueId', npc.uniqueId);

  if (MMO_Core["gameworld"].getNode(_npcNode.follows) 
  && MMO_Core["gameworld"].getNode(_npcNode.follows).hasPet === npc.uniqueId) canMoveThisTurn = true;

  if (npc.isEnemy) { // If hostile
    const getDist = (n,p) => MMO_Core["rpgmaker"]._distTo(n.uniqueId,p.uniqueId); // helper to get distance
    const playersInRange = world.getPlayerNodes()
      .filter(p => p.mapId === npc.mapId) // on map
      .filter(player => MMO_Core["wabs"].canEnemySee(npc,player.uniqueId)) // in range
      .sort((a,b) => getDist(a,npc) - getDist(b,npc)) // sorted by distance
    if (playersInRange[0]) { // the closest player
      world.getNpcByUniqueId(npc.uniqueId).absData.viewRadius = world.getNpcByUniqueId(npc.uniqueId).absData._origViewRadius * 2;
      if (!world.getNodeBy('npcUniqueId', npc.uniqueId).follows) {
        if (npc.absData.cEonStart) { // try start fight event
          world.emitToPlayerByUsername(playersInRange[0].username, "common_event", { id: npc.absData.cEonStart})
        }
        world.getNpcByUniqueId(npc.uniqueId).lastMoveTime = new Date();
      }
      world.getNpcByUniqueId(npc.uniqueId).path.pathfinding = true; // aggro
      world.setNpcFollowing(npc.uniqueId,playersInRange[0].uniqueId); // aggro
    } else world.getNpcByUniqueId(npc.uniqueId).absData.viewRadius = world.getNpcByUniqueId(npc.uniqueId).absData._origViewRadius;
  }

  // Random Move :
  if (npc._moveType === 1 && canMoveThisTurn) {
    const didMove = world.npcMoveRandom(world.getNpcByUniqueId(npc.uniqueId));
    if (didMove) {
      world.getNpcByUniqueId(npc.uniqueId).lastMoveTime = new Date();
      // console.log('[WORLD] handleNpcTurn', npc.uniqueId, world.getNpcByUniqueId(npc.uniqueId).lastMoveTime);
    }
  }

  // Move toward entity :
  else if ((npc._moveType === 2 || npc._moveType === 3) && canMoveThisTurn && _npcNode.follows) {
    if (MMO_Core["rpgmaker"]._distTo(_npcNode.uniqueId,_npcNode.follows) <= 1) {
      if (npc.isEnemy || npc.isEvil) {
        if (!_npcNode.follows) return;
        const coords = await MMO_Core["gameworld"].getNode(_npcNode.follows);
        if (coords) {
          const attacking = MMO_Core["wabs"].makeAction(_npcNode.uniqueId,_npcNode.follows, { skillId: 1, coords});
          // console.log('attacking', attacking)
          MMO_Core["wabs"].state.actionsCount++;
          MMO_Core["wabs"].actions.push(attacking);
          world.attachNode(attacking);
        }
      }
    } else world.npcMoveTowardEntity(world.getNpcByUniqueId(npc.uniqueId),_npcNode.follows);
    world.getNpcByUniqueId(npc.uniqueId).lastMoveTime = new Date(new Date().getTime() + 1000);
    // console.log('[WORLD] handleNpcTurn', npc.uniqueId, world.getNpcByUniqueId(npc.uniqueId).lastMoveTime);
  }

  else if (npc._moveType === 3 && canMoveThisTurn) {
    let factor = 1;
    if (npc.path.backward) factor = -1;

    // if (npc.path.currentStep < Object.keys(npc.path.steps).length - 2) {

      if (npc.path.currentStep === Object.keys(npc.path.steps).length - 1) {
        factor = -1;
        world.getNpcByUniqueId(npc.uniqueId).path.backward = true;
      }
      if (npc.path.currentStep === 0) {
        factor = 1;
        world.getNpcByUniqueId(npc.uniqueId).path.backward = false;
      }

      // const currentPoint = npc.path.steps[npc.path.currentStep];
      const nextPoint = npc.path.steps[npc.path.currentStep+(1 * factor)];
      // console.log('nextPoint', nextPoint)

      if (nextPoint && world.npcMoveTowardCoords(npc, nextPoint, npc.path.pathfinding)) {
        world.getNpcByUniqueId(npc.uniqueId).lastMoveTime = new Date();
      }
      const { x,y, mapId } = world.getNodeBy('npcUniqueId', npc.uniqueId);
      const coords = {x,y,mapId};

      if (nextPoint
      && coords.x === nextPoint.x
      && coords.y === nextPoint.y
      && coords.mapId === nextPoint.mapId
      ) {
        const waitUntill = nextPoint.wait || 0;
        const now = new Date().getTime();
        const lastMoveTime = new Date(waitUntill + now);
        world.getNpcByUniqueId(npc.uniqueId).lastMoveTime = lastMoveTime;
        world.getNpcByUniqueId(npc.uniqueId).path.isReturning = false;
        npc.path.currentStep += 1 * factor;
      }
    // } else {
    //   npc.path.backward = true;
    //   world.getNpcByUniqueId(npc.uniqueId).lastMoveTime = new Date();
    // }
  }
}

world.startInstanceLifecycle = (mapId) => {
  const interval = 1000 / 60; // Tick 1 action every RPG Maker Frame (60f = 1s)
  const tick = setInterval(() => {
    const currentTime = new Date(); // Use precise tick time

    if (!world.getInstanceByMapId(mapId)) { // If no instance, interrupt lifecycle
      clearInterval(tick);
      return;
    }

    world.getInstanceByMapId(mapId).paused = false; // Flag as running
    world.getConnectedNpcs(mapId).map(npc => { // Animate NPCS :
      const moveDuration = npc._moveSpeed < 5
        ? 650 - (npc._moveSpeed * 100)
        : 350 - (npc._moveSpeed * 50)
      const moveCooldown = npc._moveFrequency === 5
        ? interval + moveDuration + 5000 - (1000 * npc._moveFrequency)
        : interval + moveDuration + 5000 - (1000 * npc._moveFrequency) + Math.floor(Math.random() * 2250)
      npc && world.handleNpcTurn(npc, currentTime, moveCooldown)
    });

    if (!world.getInstanceByMapId(mapId).playersOnMap.length) { // If no players on map at tick :
      setTimeout(() => {
        if (!world.getInstanceByMapId(mapId)) {
          // If instance is not loaded anymore :
          clearInterval(tick);
          return;
        } else if (!world.getInstanceByMapId(mapId).playersOnMap.length) {
          // If instance alive && no more players in it
          clearInterval(tick); // Will suspend instance (not kill)
          world.getInstanceByMapId(mapId).paused = true; // Flag paused
        }
      }, world.getInstanceByMapId(mapId).pauseAfter); 
    }
  }, interval);
}

/*************************************************************************************** DataProviders */

world.provideMapTiles = (map) => {
  const grid = [
    [ // x: [ y, ]
      [], // y: [A,B,C,R]
    ],
  ];
  const _data = map.data || [];
  const _width = map.width; // Limit the iteration in horizontal
  const _height = map.height; // Paginate the iteration in vertical (handle layers)
  let heightIndex = 0, widthIndex = 0;

  for (let dataIndex = 0; dataIndex < _data.length; dataIndex++) { // i = cell xy informations by layer
    if (!grid[widthIndex]) grid[widthIndex] = [[]]; // if no X yet
    if (!grid[widthIndex][heightIndex]) grid[widthIndex][heightIndex] = []; // if no Y yet
    grid[widthIndex][heightIndex] = [_data[dataIndex]].concat(grid[widthIndex][heightIndex]); // Add to tile layers

    if (widthIndex + 1 < _width) { // if still on current line
      widthIndex++; // next cell
    } else { 
      heightIndex++; // next line
      widthIndex = 0; // first cell
      // (if next): layer first row, (else): next row
      if (heightIndex >= _height) heightIndex = 0;
    }
  }
  // console.log('grid', grid)
  return grid;
}
world.mapTileFinder = (mapId,x,y) => {
  // console.log('mapTileFinder', mapId, x, y);
  return world.getInstanceByMapId(mapId).allTiles[x][y];
}

world.npcFinder = (uniqueId) => {
  // `Npc${uniqueIntegerId}#${world.getConnectedNpcs(coords.mapId).length}@${coords.mapId}`
  try {
    return {
      eventId: parseInt(uniqueId.split('Npc')[1].split('#')[0]),
      npcIndex: parseInt(uniqueId.split('#')[1].split('@')[0]),
      mapId: parseInt(uniqueId.split('@')[1]),
    };
  } catch (_) {
    return { mapId: -1, npcIndex: -1, eventId: -1 };
  }
}

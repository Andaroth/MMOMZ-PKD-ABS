/*****************************
  World Action Battle System (WABS) by Axel Fiolle

  - Will allow you to make fight in real time on the map with sync entities

  /!\ Read gameworld.js header FIRST!

*****************************/

var exports = module.exports = {}
  , wabs = exports;

wabs.lifecycle = null;

wabs.maxPlayerLevel = 12;

wabs.state = { // System useful state informations
  actionsCount: 0,
  fightsCount: 0,
};
wabs.database = { // Formated game datas
  armors: [],
  classes: [],
  enemies: [],
  items: [],
  skills: [],
  weapons: [],
};
// Database helpers
wabs.findArmor  = (dbId) => wabs.database.armors.find(el => el.id === dbId);
wabs.findEnemy  = (dbId) => wabs.database.enemies.find(el => el.id === dbId);
wabs.findItem   = (dbId) => wabs.database.items.find(el => el.id === dbId);
wabs.findSkill  = (dbId) => wabs.database.skills.find(el => el.id === dbId);
wabs.findWeapon = (dbId) => wabs.database.weapons.find(el => el.id === dbId);

wabs.findPlayerClass        = (dbId) => wabs.database.classes.find(el => el.id === dbId);
wabs.findPlayerClassById    = (dbId) => wabs.findClass(el => el.id === dbId);
wabs.findPlayerClassByName  = (name) => wabs.findClass(el => el.name === name);

wabs.getFlatDb  = () => (Object.keys(wabs.database).map(key => wabs.database[key]).flat() || []);

wabs.getEthObjects = () => wabs.getFlatDb().filter(elem => !!elem["ETH"]) || [];

// Global helpers
wabs.fights   = []; // => MMO_Core["gameworld"].nodes.filter(n => n.nodeType === 'fight'); // Find all fights
wabs.teams    = []; // => MMO_Core["gameworld"].nodes.filter(n => n.nodeType === 'team'); // Find all teams
wabs.actions  = [];
wabs.spawners = [];
wabs.getNpcs  = () => MMO_Core["gameworld"].nodes.filter(n => n.nodeType === 'npc')
  .filter(n => wabs.isNpcABs(MMO_Core["gameworld"].getNpcByUniqueId(n.npcUniqueId))); // Find ABS NPCs
wabs.getSpawnerByUniqueId = (uniqueId) => wabs.spawners.find(s => s.uniqueId === uniqueId);
// Player helpers
wabs.getPlayers     = () => MMO_Core["gameworld"].nodes.filter(n => n.nodeType === "player");
wabs.findPlayerNode = (playerId) => MMO_Core["gameworld"].nodes.find(n => n.playerId === playerId);
// NPC helpers
wabs.isNpcABs         = (npc) => JSON.stringify(npc).toUpperCase().includes('<ABS:');
wabs.npcFinder        = (uniqueId) => MMO_Core["gameworld"].npcFinder(uniqueId); // returns { eventId, npcIndex, mapId }
wabs.getNpcNode       = (uniqueId) => MMO_Core["gameworld"].nodes.find(n => n.npcUniqueId === uniqueId);
wabs.getNpcMapId      = (uniqueId) => MMO_Core["gameworld"].getNpcMapId(uniqueId);
wabs.getNpcIndex      = (uniqueId) => MMO_Core["gameworld"].getNpcIndex(uniqueId);
wabs.getNpcEventId    = (uniqueId) => MMO_Core["gameworld"].getNpcEventId(uniqueId);
wabs.getNpcInstance   = (uniqueId) => MMO_Core["gameworld"].getNpcInstance(uniqueId);
wabs.getNpcEventId    = (uniqueId) => MMO_Core["gameworld"].getNpcEventId(uniqueId);
wabs.getNpcByUniqueId = (uniqueId) => MMO_Core["gameworld"].getNpcByUniqueId(uniqueId);
// Team helpers
wabs.getTeamNode    = (uniqueId) => MMO_Core["gameworld"].nodes.find(n => n.teamUniqueId === uniqueId);
wabs.findTeamById   = (id) => wabs.teams.find(f => f.id === id);
wabs.findTeamByName = (name) => wabs.teams.find(f => f.name === name);
// Actions helpers
wabs.getActionNode          = (uniqueId) => MMO_Core["gameworld"].nodes.find(n => n.actionUniqueId === uniqueId);
wabs.findAction             = (uniqueId) => wabs.actions.find(a => a.uniqueId === uniqueId);
wabs.findActionByIndex      = (index) => wabs.actions.find(a => a.index === index);
wabs.findActionsByMapId     = (mapId) => wabs.actions.filter(a => a.mapId === mapId);
wabs.findActionsByInitiator = (uniqueId) => wabs.actions.filter(a => a.from === uniqueId);
wabs.findActionsByTarget    = (uniqueId) => wabs.actions.filter(a => a.to === uniqueId);
// Fight helpers
wabs.getFightNode       = (uniqueId) => MMO_Core["gameworld"].nodes.find(n => n.fightUniqueId === uniqueId);
wabs.findFight          = (uniqueId) => wabs.fights.find(f => f.uniqueId === uniqueId);
wabs.findFightsByActor  = (uniqueId) => wabs.fights.filter(f => f.actors.includes(uniqueId));
wabs.isActorATarget     = (uniqueId) => !!wabs.findActionsByTarget(uniqueId).length;
wabs.findActorOffenders = (uniqueId) => wabs.isActorATarget(uniqueId) && wabs.findActionsByTarget(uniqueId).map(a => a.from);
wabs.findActorTargets   = (uniqueId) => wabs.findActionsByInitiator(uniqueId).map(a => a.to);
wabs.isActorInFight     = (uniqueId) => wabs.findFightsByActor(uniqueId).length || !!wabs.findActorOffender(uniqueId) || wabs.findActorTargets(uniqueId).length;
wabs.isActorAttacking   = (uniqueId) => !!wabs.findActorTargets(uniqueId).length
wabs.isActorAttacked    = (uniqueId) => !!wabs.findActorOffenders(uniqueId).length
// Node helpers
wabs.mutate = (uniqueId, newProps) => {
  if (wabs.findAction(uniqueId)) MMO_Core["gameworld"].mutateNode(wabs.findAction(uniqueId),newProps);
  if (wabs.getNpcNode(uniqueId)) MMO_Core["gameworld"].mutateNode(wabs.getNpcNode(uniqueId),newProps);
  if (wabs.findFight(uniqueId)) MMO_Core["gameworld"].mutateNode(wabs.findFight(uniqueId),newProps);
}
wabs.isValidWabsCoords = (object) => {
  if (!object) return false;
  if (object.mapId === undefined || object.mapId === null || isNaN(object.mapId)) return false;
  if (object.x === undefined || object.x === null || isNaN(object.x)) return false;
  if (object.y === undefined || object.y === null || isNaN(object.y)) return false;
  return true;
}


wabs.initialize = () => {
  console.log('[WABS] World Action Battle System by Axel Fiolle');
  wabs.fetchDatabase(); // Load enemies datas from game
  wabs.initiateTeams(); // Set enemies behavior parameters

  wabs.initWabsLifeCycle();

  console.log('[WABS] World Action Battle System is ready!');
  console.log("######################################");
}

wabs.getObjectDatas = (object, lookupProps = [], static = false) => { // Transform note into keys/value Object 
  const newProps = {}; // Prepare Object to return
  let _iterationString = object.note; // Iterate through a string
  const foundTagsCount = (object.note.match(/</g) || []).length; // Count "<" occurences 
  if (foundTagsCount) { // If contains "<"
    for (let i = 0; i < foundTagsCount; i++) { // loop "<" occurences 
      const rightToTag = _iterationString.substring(_iterationString.indexOf('>')+1,_iterationString.length); // Remember current lookup state
      const insideTag = _iterationString.split('<')[1].split('>')[0]; // Get string between tags
      if (insideTag.includes(':')) { // If valid ABS tag (key:value)
        let label = insideTag.split(':')[0]; // Left of ":" is key
        if (lookupProps.includes(label)) { // If is a key we are looking for
          if (label.includes(' ')) label.replace(' ', '')
          let value = insideTag.split(':')[1]; // Right of ":" is value
          if (!isNaN(value)) value = Number(value); // type
          newProps[label] = value; // assign new property
        }
      }
      _iterationString = rightToTag; // Prepare iteration string for next loop
    } // endof for
  }

  // Bring useful datas :
  if (object.params) {
    if (static) Object.assign(newProps, {
      _hp: () => object.params[0],
      _mp: () => object.params[1],
      _atk: () => object.params[2],
      _def: () => object.params[3],
      _mAtk: () => object.params[4],
      _mDef: () => object.params[5],
      _agi: () => object.params[6],
      _luck: () => object.params[7]
    });
    else Object.assign(newProps, {
      hp: object.params[0],
      mp: object.params[1],
      atk: object.params[2],
      def: object.params[3],
      mAtk: object.params[4],
      mDef: object.params[5],
      agi: object.params[6],
      luck: object.params[7]
    });
  } // endif object.params
  return newProps;
}

wabs.fetchDatabase = () => {
  console.log('[WABS] Loading game datas');

  // armors :
  const armors = [];
  for (let armor of MMO_Core["gamedata"].data['Armors'].filter(elem => !!elem)) {
    const newProps = wabs.getObjectDatas(armor, [
      "blockState",
      "Max Item",
      "ETH"
    ], true);
    armors.push(Object.assign(armor, newProps));
  }
  wabs.database.armors = armors;
  console.log('[WABS] ... Armors', `(${wabs.database.armors.length})`);

  // classes :
  const classes = [];
  for (let playerClass of MMO_Core["gamedata"].data['Classes'].filter(elem => !!elem)) {
    // 0: Maximum hit points 1: Maximum magic points 2: Attack power 3: Defense power 4: Magic attack power 5: Magic defense power 6: Agility 7: Luck
    const newProps = wabs.getObjectDatas(playerClass, [], true);
    classes.push(Object.assign(playerClass,newProps));
  }
  wabs.database.classes = classes;
  console.log('[WABS] ... Classes', `(${wabs.database.classes.length})`);

  // enemies :
  const enemies = [];
  for (let enemy of MMO_Core["gamedata"].data['Enemies'].filter(elem => !!elem)) {
    const newProps = wabs.getObjectDatas(enemy, [
      "summonId",
      "cEonDeath",
      "cEonStart",
      "escapeOnBattle",
      "heavy",
      "level",
      "noMove",
      "noTarget",
      "reviveTime",
      "sideVisor",
      "teamId",
      "tVisor",
      "viewRadius"
    ]);
    if (enemy.note.includes('noTargetable')) Object.assign(newProps, { noTarget: 1 });
    enemies.push(Object.assign(enemy,newProps));
  };
  wabs.database.enemies = enemies;
  console.log('[WABS] ... Enemies', `(${wabs.database.enemies.length})`);

  // items : 
  const items = [];
  for (let item of MMO_Core["gamedata"].data['Items'].filter(elem => !!elem)) {
    const newProps = wabs.getObjectDatas(item, [
      "Max Item",
      "ETH"
    ], true);
    items.push(Object.assign(item,newProps));
  }
  wabs.database.items = items;
  console.log('[WABS] ... Items', `(${wabs.database.items.length})`);

  // skills :
  const skills = [];
  for (let skill of MMO_Core["gamedata"].data['Skills'].filter(elem => !!elem)) {
    const newProps = wabs.getObjectDatas(skill, [
      "ETH"
    ]);
    skills.push(Object.assign(skill, newProps));
  }
  wabs.database.skills = skills;
  console.log('[WABS] ... Skills', `(${wabs.database.skills.length})`);

  // weapons :
  const weapons = [];
  for (let weapon of MMO_Core["gamedata"].data['Weapons'].filter(elem => !!elem)) {
    const newProps = wabs.getObjectDatas(weapon, [
      "ammo",
      "img",
      "noTarget",
      "range",
      "Max Item",
      "ETH"
    ], true);
    weapons.push(Object.assign(weapon, newProps));
  }
  wabs.database.weapons = weapons;
  console.log('[WABS] ... Weapons', `(${wabs.database.weapons.length})`);

  return console.log('[WABS] Game Datas loaded!');
} // endof fetchDatabase

wabs.initiateTeams = async () => {
  await wabs.makeTeam({id: 0, name: "Ally_0", behavior: 'ally', hostiles: [0,1,2,3,4,5]});
  await wabs.makeTeam({id: 1, name: "Enemy_1", behavior: 'hostile', hostiles: ["*",-1]});
  await wabs.makeTeam({id: 2, name: "Enemy_2", behavior: 'hostile', hostiles: ["*",-2]});
  await wabs.makeTeam({id: 3, name: "Enemy_3", behavior: 'hostile', hostiles: ["*",-3]});
  await wabs.makeTeam({id: 4, name: "Enemy_4", behavior: 'hostile', hostiles: ["*",-4]});
  await wabs.makeTeam({id: 5, name: "Enemy_5", behavior: 'hostile', hostiles: ["*",-5]});
  return wabs.teams;
}

wabs.makeTeam = ({
  id,
  name,
  behavior = 'neutral',
  hostiles = [],
  fear = [],
}) => {
  if (!name) return
  if (!id) id = wabs.teams.length;
  if (wabs.findTeamById(id)) do { id++ } while (wabs.findTeamById(id)); // Find a free id
  if (wabs.findTeamByName(name)) do { name += `_${id}` } while (wabs.findTeamByName(name)); 
  const _team = {
    uniqueId: `Team${id}T${new Date().getTime()}`,
    nodeType: 'team',
    id,
    name,
    behavior, // 'neutral' | 'ally' | 'hostile'
    hostiles,
    fear
  };
  wabs.teams.push(_team);
  return MMO_Core["gameworld"].attachNode(_team);
}

wabs.getActionActorsDetails = (uniqueId) => {
  const action = wabs.findAction(uniqueId);
  if (action) {
    return {
      from: MMO_Core["gameworld"].getNode(action.from),
      to: MMO_Core["gameworld"].getNode(action.to),
    }
  }
}

wabs.makeSpawnerInitator = (coords) => {
  if (!coords || !wabs.isValidWabsCoords(coords)) return;
  return Object.assign({ uniqueId: "server", nodeType: "spawner" }, { coords });
}

wabs.registerSpawner = (spawner) => {
  if (!spawner
  || spawner.nodeType !== "spawner"
  || !spawner.coords
  || !wabs.isValidWabsCoords(spawner.coords)
  ) return console.error("[WABS] registerSpawner > Invalid arguments");

  const uniqueId = `Spawner${wabs.spawners.length}@${spawner.coords.mapId}T${new Date().getTime()}`;

  const _makeSpawner = {
    uniqueId,
    nodeType: "spawner",
    coords: spawner.coords,
  };

  wabs.spawners.push(_makeSpawner);
  MMO_Core["gameworld"].attachNode(_makeSpawner); // Add spawner to nodelist

  return _makeSpawner;
} // endof registerSpawner

wabs.makeAction = (initiatorUniqueId, targetUniqueId = null, payload) => {
  if (!initiatorUniqueId
  || !payload
  ) return console.error("[WABS] makeAction > Invalid arguments");

  // console.log('[WABS] makeAction > ', initiatorUniqueId, targetUniqueId, payload);

  const initiatedByServer = initiatorUniqueId === "server" || initiatorUniqueId.startsWith("Spawner");

  const _initiator = initiatedByServer ? wabs.makeSpawnerInitator(payload.coords) : MMO_Core["gameworld"].getNode(initiatorUniqueId);
  if (!_initiator) return console.error("[WABS] makeAction > Invalid initator");

  // console.log('_initiator', _initiator)

  const _target = MMO_Core["gameworld"].getNode(targetUniqueId);

  const initiatedByPlayer = _initiator.nodeType === "player"
      , initiatedByNpc    = _initiator.nodeType === "npc"
      , targetToPlayer  = _target && _target.nodeType === "player"
      , targetToNpc     = _target && _target.nodeType === "npc";

  if (_target && _initiator.mapId !== _target.mapId) return console.log("[WABS] makeAction > Out of scope");

  const uniqueId = `Action${wabs.state.actionsCount}@${_initiator.mapId}T${new Date().getTime()}`;
  const relation = _target ? ( // If there is a target
    (_initiator.uniqueId === _target.uniqueId) ? 'self' : // on itself
    (initiatedByServer && targetToPlayer) ? 's/p' : // server to player
    (initiatedByServer && targetToNpc) ? 's/e' : // server to enemy
    (initiatedByPlayer && targetToPlayer)  ? 'p/p' : // player to player
    (initiatedByPlayer && targetToNpc)  ? 'p/e' : // player to enemy
    (initiatedByNpc && targetToPlayer)  ? 'e/p' : // enemy to player
    (initiatedByNpc && targetToNpc)  ? 'e/e' : // enemy to enemy
    "other" // exception
  ) : ( // If there is no target
    (initiatedByServer && wabs.isValidWabsCoords(payload.coords)) ? 's/coords' : // server to coords
    (initiatedByPlayer && wabs.isValidWabsCoords(payload.coords))  ? 'p/coords' : // player to coords
    'other' // error
  );

  
  const _absData = payload.skillId && wabs.findSkill(payload.skillId);
  // console.log('_absData', _absData)

  const to = _target ? _target.uniqueId : (_absData.scope === 11 ? initiatorUniqueId : 'air');
  // console.log('from,to', initiatorUniqueId, to)

  const _action = {
    uniqueId,
    fightUniqueId: payload.fightUniqueId,
    nodeType: 'action',
    index: wabs.state.actionsCount,
    from: _initiator.uniqueId,
    to,
    relation,
    // track action :
    mapId: _initiator.mapId,
    x: payload.coords.x,
    y: payload.coords.y,
    range: payload.range,
    lifetime: payload.lifetime || (1000 / 6), // Duration in ms
    // determine what kind of action server must resolve :
    type: ( // 'skill' | 'item' | 'script' | 'other',
      payload.skill ? 'skill'
      : payload.itemId ? 'item'
      : payload.scriptId ? 'script'
      : 'other' // <- error
    ), 
    skillId: payload.skillId,
    absData: Object.assign({
      animationId: _absData.animationId,
      hitType: _absData.hitType,
      damage: _absData.damage,
      mpCost: _absData.mpCost,
      tpCost: _absData.tpCost,
      occasion: _absData.occasion,
      successRate: _absData.successRate,
      stypeId: _absData.stypeId,
      repeats: _absData.repeats,
      note: _absData.note,
      effects: _absData.effects,
      scope: _absData.scope,
    }, wabs.getObjectDatas(_absData, [
      "ABS", // type of attack (Integer)
      "reloadParam", // reload time formula
      "blockState",
      "impulse", // pushes the target
      "range", // for distance, max range
      "img", // attack img on map
      "reloadTime", // cooldown
      "castTimeFormula", // cast duration
      "ETH", // token ID
      "ammo",
      "noTarget", // targets "air"
      "radius", // range of effect
    ])),
    itemId: payload.itemId,
    scriptId: payload.scriptId,
    isFromPlayer: _initiator.nodeType === 'player',
    isToPlayer: (_target && _target.nodeType === 'player') || (_absData.scope === 11 && _initiator.nodeType === 'player'),
    // Look of the action
    appearence: payload && payload.appearence,
    // monitoring :
    queryDate: payload && payload.queryDate || new Date(),
    createdDate: new Date(),
  };
  const removeNull = (obj) => Object.fromEntries(Object.entries(obj).filter(([key, value]) => value != null));
  return removeNull(_action);
} // endof makeAction

wabs.spawnAction = (clientId,target,action, spawnerCoords) => {
  // console.log('spawnAction', clientId,target,action, spawnerCoords)
  if (!action || !clientId) return console.error('[WABS] spawnAction > Invalid arguments');

  const initiatedByServer = clientId === "server";
  
  const _initiator = initiatedByServer ? wabs.makeSpawnerInitator(spawnerCoords) : MMO_Core["gameworld"].getNodeBy('clientId', clientId);
  // console.log('initiator', _initiator);

  if (!_initiator || !wabs.isValidWabsCoords(_initiator)) return console.error('[WABS] spawnAction > Invalid initator');
  
  // must happen on existing instance:
  if (!MMO_Core["gameworld"].getInstanceByMapId(_initiator.mapId)) return console.error("[WABS] spawnAction > Instance not found !");

  const coords = !initiatedByServer ? MMO_Core["rpgmaker"]._getCaseInFrontOf( // Make new properties
    _initiator.mapId,
    _initiator.x,
    _initiator.y,
    _initiator.direction
  ) : spawnerCoords;
  // console.log('_getCaseInFrontOf => ', coords);

  // Make new action
  const _generatedAction = MMO_Core["wabs"].makeAction(
    _initiator.uniqueId,
    target,
    Object.assign(action,{ coords })
  );

  if (_generatedAction) {
    if (!action) return console.error('[WABS] spawnAction > Action is not correctly defined');
    else if (action.skillId !== null && action.skillId !== undefined) Object.assign(_generatedAction, { type: "skill" });
    else if (action.itemId !== null && action.itemId !== undefined) Object.assign(_generatedAction, { type: "item" });
    else if (action.scriptId !== null && action.scriptId !== undefined) Object.assign(_generatedAction, { type: "script" });
    else return console.error('[WABS] spawnAction > Must be a skill, an item or a script');

    // console.log('_initiator of action', _initiator);

    // Commit generated action
    wabs.state.actionsCount++;
    wabs.actions.push(_generatedAction);
    MMO_Core["gameworld"].attachNode(_generatedAction); // Add action to nodelist
    MMO_Core["security"].createLog(`[WABS] Spawned Action (${_generatedAction.mapId} ${_generatedAction.x};${_generatedAction.y}) by "${_generatedAction.from}"`)
    // Emit new action
    MMO_Core["socket"].emitToAll("actionSpawn", wabs.findAction(_generatedAction.uniqueId));
  
     if (_generatedAction.absData.scope !== 11) return _generatedAction
     else wabs.runAction(_generatedAction.uniqueId);
  }
} // endof spawnAction

wabs.canEnemySee = (npc,targetEventId) => {
  if (!npc || !targetEventId) return false;
  const _npcNode = MMO_Core["gameworld"].getNodeBy('npcUniqueId', npc.uniqueId);
  const _target = MMO_Core["gameworld"].getNode(targetEventId);
  if (_npcNode && _target) {
    return MMO_Core["rpgmaker"]._distTo(_npcNode.uniqueId,targetEventId) <= npc.absData.viewRadius;
  }
}

wabs.runAction = async (actionUniqueId) => {
  if (wabs.findAction(actionUniqueId)) {
    const _action = Object.assign({}, wabs.findAction(actionUniqueId));
    if (_action) {
      const dieAt = _action.lifetime !== Infinity ? (_action.createdDate.getTime() + _action.lifetime) : false;
      console.log('runAction', _action.uniqueId, dieAt)

      // Remove action if expired
      if (dieAt && dieAt <= new Date().getTime()) return wabs.endAction(actionUniqueId);

      // Execute action if entity at coords
      const {x,y,mapId} = _action;
      const entityAtSameCoords = await MMO_Core["gameworld"].getNodesBy('mapId', mapId).find(entity => entity.x === x && entity.y === y);
      if (entityAtSameCoords) {
        if (entityAtSameCoords.uniqueId === _action.from) return console.log('from emitter');

        const _npc = MMO_Core["gameworld"].getNpcByUniqueId(entityAtSameCoords.npcUniqueId);
        // console.log('_npc atSameCoords', _npc);

        if (_npc) {
          wabs.findAction(actionUniqueId).to = _npc.uniqueId;
        }
        // then remove action
        return wabs.executeAction(actionUniqueId);
      } else if (_action.absData.scope === 11) return wabs.executeAction(actionUniqueId);

    } else console.error('cannot run action, not found', actionUniqueId);
  }
}

wabs.executeAction = async (actionUniqueId) => {
  if (wabs.findAction(actionUniqueId)) {
    const _action = Object.assign({}, wabs.findAction(actionUniqueId));
    const players = await MMO_Core.socket.modules.player.subs.player.getPlayers();
    // console.log('_action', _action)
    
    const _from = {};
    if (_action.isFromPlayer) {
      const { username } = MMO_Core["gameworld"].getNodeBy('uniqueId', _action.from);
      _from.stats = await wabs.getPlayerStats(username);
      if (_from.stats.mp < _action.absData.mpCost) return;
      else {
        players[username.toLowerCase()].playerData.stats.mp -= _action.absData.mpCost;
        // if (Number(players[username.toLowerCase()].playerData.stats.pt)) {
        //   players[username.toLowerCase()].playerData.stats.pt += 5;
        // }
      }
    } else {
      const fromNode = MMO_Core["gameworld"].getNode(_action.from);
      const npc = MMO_Core["gameworld"].getNpcByUniqueId(fromNode.npcUniqueId);
      const { hp, mp, mhp, mpm, level, atk, def, mAtk, mDef, agi, luck } = npc.absData;
      _from.stats = { hp, mp, mhp, mpm, level, atk, def, mAtk, mDef, agi, luck };
    }

    const getAnimationId = (_action,deltaHp) => _action.absData.animationId 
      && _action.absData.animationId >= 122 
        ? _action.absData.animationId 
        : deltaHp <= 0 ? (_action.absData.mpCost > 5 ? 124 : 122) : 123;
        // console.log('animationId', _action.absData.animationId);

    // Execute effects
    if (_action.to !== 'air') {
      if (_action.isToPlayer) {
        // console.log('to player')
        const player = await MMO_Core["gameworld"].getNodeBy('uniqueId', _action.to);
        if (player) {
          const { username } = player;
          const targetStats = await wabs.getPlayerStats(username);
  
          if (players[username.toLowerCase()].playerData.hp <= 0
          || MMO_Core["gameworld"].getNodeBy('uniqueId', _action.to).mapId !== _action.mapId
          ) return;
  
          const { formula, type } = _action.absData.damage;
          const effects = wabs.applyStatsFormula( formula, _from.stats, targetStats, type );
          wabs.affectPlayerStats(username,effects);
          MMO_Core["gameworld"].emitToMap(_action.mapId, "request_animation", {
            username,
            player: MMO_Core["gameworld"].getNodeBy('uniqueId', _action.to).uniqueId,
            coords: MMO_Core["gameworld"].getNodeBy('uniqueId', _action.to),
            animationId: getAnimationId(_action,effects.hp || 0)
          });
        }
      } else {
        // console.log('to NPC')
        const npc = MMO_Core["gameworld"].getNpcByUniqueId(_action.to);
        if (npc && npc.absData) {
          const { hp, mp, mhp, mpm, level, atk, def, mAtk, mDef, agi, luck } = npc.absData;
          const targetStats = { hp, mp, mhp, mpm, level, atk, def, mAtk, mDef, agi, luck };
          if (targetStats.hp <= 0) return;
          const { formula, type } = _action.absData.damage;
          // Execute effect ON target actor
          const effects = wabs.applyStatsFormula( formula, _from.stats, targetStats, type );
          for (const key of Object.keys(effects)) if (targetStats[key]) targetStats[key] += effects[key];
          // console.log('newStats =>', targetStats);
          wabs.updateNpcStat(npc.uniqueId,targetStats);
          MMO_Core["gameworld"].emitToMap(_action.mapId, "request_animation", {
            npc: npc,
            coords: MMO_Core["gameworld"].getNpcByUniqueId(_action.to),
            animationId: getAnimationId(_action,effects.hp || 0)
          });
          // console.log('> ', MMO_Core["gameworld"].getNpcByUniqueId(_action.to).absData)
          if (targetStats.hp <= 0) {
            // console.log('MMO_Core["gameworld"].getNode(_action.from).username',_action.from, MMO_Core["gameworld"].getNode(_action.from), MMO_Core["gameworld"].getNode(_action.from).username)
            if (_action.isFromPlayer) {
              wabs.playerFightReward(
                MMO_Core["gameworld"].getNode(_action.from).username,
                npc.absData.exp,
                npc.absData.gold,
                npc.absData.dropItems,
              );
              if (npc.absData.cEonDeath) MMO_Core["gameworld"].emitToPlayerByUsername(
                MMO_Core["gameworld"].getNode(_action.from).username.toLowerCase(),
                "common_event",
                { id: npc.absData.cEonDeath }
              );
            }
          } else {
            if (!MMO_Core["gameworld"].getNodeBy('npcUniqueId', npc.uniqueId).follows) {
              if (npc.absData.cEonStart && _action.isFromPlayer) {
                MMO_Core["gameworld"].emitToPlayerByUsername(
                  MMO_Core["gameworld"].getNode(_action.from).username.toLowerCase().username,
                  "common_event",
                  { id: npc.absData.cEonStart}
                );
              }
              MMO_Core["gameworld"].setNpcFollowing(npc.uniqueId,_action.from);  // set enemy behavior
            }
          }
        }
      }
    }
    
    else if (_action.relation === "p/coords") {
      const coords = {x: _action.x, y: _action.y};
      // Execute effect ON coords
    }
    
    else if (_action.relation === "self") {
      // Execute effect ON player
    }
    
    else console.warn('WABS > executeAction > Unhandled exception!');

    wabs.endAction(actionUniqueId);
  }
} // endof executeAction

wabs.endAction = (actionUniqueId) => {
  console.log('endAction', actionUniqueId);
  if (actionUniqueId && wabs.findAction(actionUniqueId)) wabs.actions.splice(wabs.actions.indexOf(wabs.findAction(actionUniqueId)),1);
  else console.warn('WABS > endAction > Cannot find action:', actionUniqueId);
}

wabs.updateNpcStat = (npcUniqueId,newStats) => {
  if (!MMO_Core["gameworld"].getNpcByUniqueId(npcUniqueId) || !newStats) return; 
  const removeNull = (obj) => Object.fromEntries(Object.entries(obj).filter(([key, value]) => value !== null));
  const _npc = MMO_Core["gameworld"].getNpcByUniqueId(npcUniqueId);
  const { absData } = _npc;
  if (absData) {
    const updatedStats = Object.assign(absData,removeNull(newStats));
    if (updatedStats.hp > _npc.absData.mhp) updatedStats.hp = _npc.absData.mhp;
    if (updatedStats.mp > _npc.absData.mpm) updatedStats.hp = _npc.absData.mpm;
    // console.log('updatedStats', updatedStats);
    MMO_Core["gameworld"].mutateNode(_npc,{ absData: updatedStats });
  }
}

wabs.makeFight = (initiatorUniqueId,targetUniqueId) => {
  if (initiatorUniqueId === targetUniqueId) return;
  const uniqueId = `Fight${wabs.state.fightsCount}T${new Date().getTime()}`;
  const mapId = MMO_Core["gameworld"].getNode(initiatorUniqueId).mapId;
  wabs.state.fightsCount++;
  const _fight = {
    uniqueId,
    nodeType: "fight",
    mapId,
    startedAt: new Date().getTime(),
    actors: [initiatorUniqueId,targetUniqueId],
    defeated: [],
  }
  wabs.fights.push(_fight);
  MMO_Core["gameworld"].attachNode(_fight);
}
wabs.onActorJoinFight = (actorUniqueId,fightUniqueId) => {
  if (wabs.findFight(fightUniqueId) && !wabs.findFight(fightUniqueId).actors.includes(actorUniqueId)) {
    wabs.findFight(fightUniqueId).actors.push(actorUniqueId)
  }
}
wabs.onActorLeaveFight = (actorUniqueId,fightUniqueId) => {
  if (wabs.findFight(fightUniqueId) && wabs.findFight(fightUniqueId).actors.includes(actorUniqueId)) {
    const _fight = wabs.findFight(fightUniqueId);
    const spliceIndex = _fight.actors.indexOf(actorUniqueId);
    wabs.findFight(fightUniqueId).actors.splice(spliceIndex,1);
  }
}
wabs.onActorDie = (actorUniqueId) => {
  const _fights = wabs.findFightsByActor(actorUniqueId);
  wabs.findFightsByActor(actorUniqueId).map(fight => wabs.onActorLeaveFight(actorUniqueId,fight.uniqueId)); // remove from fight node
  _fights.map(_fight => {
    if (wabs.isFightFinished(_fight.uniqueId)) wabs.endFight(_fight.uniqueId);
    else wabs.findFight(_fight.uniqueId).defeated.push(actorUniqueId);
  }); // Try end fight
}

wabs.isFightFinished = (fightUniqueId) => {
  if (wabs.findFight(fightUniqueId).actors.length <= 1) return true;
  const firstTeamId = abs.findFight(fightUniqueId).actors[0].teamId;
  for (let i = 1; i <= wabs.findFight(fightUniqueId).actors.length; i++) {
    // Try to find another team in the fight
    if (wabs.findFight(fightUniqueId).actors[i].teamId !== firstTeamId) return false;
  }

  return false;
}

wabs.endFight = (fightUniqueId) => {
  if (!wabs.findFight(fightUniqueId)) return;
  if (!wabs.isFightFinished(fightUniqueId)) return;

  const _fight = Object.assign({}, wabs.findFight(fightUniqueId));
  wabs.fights.splice(wabs.fights.indexOf(_fight),1);

  const toRewards = _fight.actors.filter(n => n.nodeType === 'player');
  const loots = [];

  _fight.defeated.map(actor => {
    if (actor.nodeType === 'npc') {
      wabs.database.enemies
        .find(monster => monster.id == actor.absId).dropItems
        .map(dropItem => loots.push(Object.assign(dropItem, { teamId: actor.teamId })));
    }
  });

  toRewards.map(player => {
    // TODO add loots
    loots.map(loot => loot > player)
  });
}

wabs.applyStatsFormula = (formula,source,target,type = 1) => {
  const { evaluate } = require('mathjs');
  // console.log('applyStatsFormula('+ formula + ')');
  // console.log('a =', source);
  // console.log('b =', target);
  if (!formula || !source || !target) return;

  const scope = {
    a: {
      hp:     source.hp,
      mp:     source.mp,
      mhp:    source.mhp,
      mmp:    source.mpm,
      atk:    source.atk,
      def:    source.def,
      mat:    source.mAtk,
      mdf:    source.mDef,
      agi:    source.agi,
      luk:    source.luck,
      level:  source.level,
    },
    b: {
      hp:     target.hp,
      mp:     target.mp,
      mhp:    target.mhp,
      mmp:    target.mpm,
      atk:    target.atk,
      def:    target.def,
      mat:    target.mAtk,
      mdf:    target.mDef,
      agi:    target.agi,
      luk:    target.luck,
      level:  target.level,
    },
  };

  const stats = { 1: 'hp', 2: 'mp', 3: 'hp', 4: 'mp', 5: 'hp', 6: 'mp' };
  const factors = { 1: -1, 2: -1, 3: 1, 4: 1, 5: -1, 6: -1 };
  if (target.isUndead && (type === 3 || type === 4)) factors[type] = -1; // If Undead receive heal, force receive damage
  const result = {};
  result[stats[type]] = evaluate(formula,scope) > 0 ? evaluate(formula,scope) * factors[type] : 0;
  console.log('applyStatsFormula >', type, stats[type], result[stats[type]])

  return result;
}

wabs.getPlayerStats = async (username) => {
  // console.log('username', username)
  const players = await MMO_Core.socket.modules.player.subs.player.getPlayers();
  // console.log('players', players)
  if (!players[username.toLowerCase()]) return;
  const player = players[username.toLowerCase()].playerData;
  const playerClass = wabs.findPlayerClass(player.stats.classId);

  const { hp, mp, level, equips } = player.stats;

  const notFoundItem = { _hp: () => 0, _mp: () => 0, _atk: () => 0, _def: () => 0, _mAtk: () => 0, _mDef: () => 0, _agi: () => 0, _luck: () => 0 };

  const weapon = wabs.findWeapon(equips[0]) || notFoundItem;
  const shield = wabs.findArmor(equips[1]) || notFoundItem;
  const helmet = wabs.findArmor(equips[2]) || notFoundItem;
  const armor = wabs.findArmor(equips[3]) || notFoundItem;
  const jewel = wabs.findArmor(equips[4]) || notFoundItem;

  const stats = {
    baseStats: {
      hp: playerClass._hp()[level],
      mp: playerClass._mp()[level],
      pt: 0,
      atk: playerClass._atk()[level],
      def: playerClass._def()[level],
      mAtk: playerClass._mAtk()[level],
      mDef: playerClass._mDef()[level],
      agi: playerClass._agi()[level],
      luck: playerClass._luck()[level],
    },
    equipmentStats: {
      hp: weapon._hp() + shield._hp() + helmet._hp() + armor._hp() + jewel._hp(),
      mp: weapon._mp() + shield._mp() + helmet._mp() + armor._mp() + jewel._mp(),
      atk: weapon._atk() + shield._atk() + helmet._atk() + armor._atk() + jewel._atk(),
      def: weapon._def() + shield._def() + helmet._def() + armor._def() + jewel._def(),
      mAtk: weapon._mAtk() + shield._mAtk() + helmet._mAtk() + armor._mAtk() + jewel._mAtk(),
      mDef: weapon._mDef() + shield._mDef() + helmet._mDef() + armor._mDef() + jewel._mDef(),
      agi: weapon._agi() + shield._agi() + helmet._agi() + armor._agi() + jewel._agi(),
      luck: weapon._luck() + shield._luck() + helmet._luck() + armor._luck() + jewel._luck(),
    },
  };

  return {
    hp: hp,
    mp: mp,
    pt: stats.baseStats.pt,
    level,
    mhp: stats.baseStats.hp + stats.equipmentStats.hp,
    mpm: stats.baseStats.mp + stats.equipmentStats.mp,
    atk: stats.baseStats.atk + stats.equipmentStats.atk,
    def: stats.baseStats.def + stats.equipmentStats.def,
    mAtk: stats.baseStats.mAtk + stats.equipmentStats.mAtk,
    mDef: stats.baseStats.mDef + stats.equipmentStats.mDef,
    agi: stats.baseStats.agi + stats.equipmentStats.agi,
    luck: stats.baseStats.luck + stats.equipmentStats.luck,
  };
}

wabs.affectPlayerStats = async (username, stats) => {
  console.log('affectPlayerStats', username, stats)
  const players = await MMO_Core.socket.modules.player.subs.player.getPlayers();
  for (const key of Object.keys(stats)) if (players[username.toLowerCase()].playerData.stats[key]) {
    players[username.toLowerCase()].playerData.stats[key] += stats[key];
  }
  if (players[username.toLowerCase()].playerData.stats.hp > players[username.toLowerCase()].playerData.stats.mhp) {
    players[username.toLowerCase()].playerData.stats.hp = players[username.toLowerCase()].playerData.stats.mhp;
  }
  if (players[username.toLowerCase()].playerData.stats.mp > players[username.toLowerCase()].playerData.stats.mpm) {
    players[username.toLowerCase()].playerData.stats.mp = players[username.toLowerCase()].playerData.stats.mpm;
  }
  if (players[username.toLowerCase()].playerData.permission < 100) {
    if (players[username.toLowerCase()].playerData.stats.hp <= 0) wabs.makePlayerDead(username, "fainted");
  }
  MMO_Core["gameworld"].emitToPlayerByUsername(username, "stats_update", players[username.toLowerCase()].playerData.stats);
}

wabs.makePlayerDead = async (username, reason = "fainted") => {
  console.log('makePlayerDead', username);
  MMO_Core["gameworld"].emitToPlayerByUsername(username, "bang", reason);
  MMO_Core["gameworld"].mutateNode(MMO_Core["gameworld"].getNodesBy('username', username), { mapId: 0 }); // Make unreachable for enemies
}

wabs._expForLevel = function(classId,level) {
  const c = wabs.findPlayerClass(classId);
  const basis = c.expParams[0];
  const extra = c.expParams[1];
  const acc_a = c.expParams[2];
  const acc_b = c.expParams[3];
  return Math.round(
      (basis * Math.pow(level - 1, 0.9 + acc_a / 250) * level * (level + 1)) /
          (6 + Math.pow(level, 2) / 50 / acc_b) +
          (level - 1) * extra
  );
};


wabs.resolvePlayerLevel = (classId,exp) => {
  for (let i = 0; i <= wabs.maxPlayerLevel; i++) if (wabs._expForLevel(classId,i) > exp) return i - 1 || 1;
}

wabs.playerFightReward = async (username,exp = 0,gold = 0,dropItems = []) => {
  console.log('playerFightReward', username, exp, gold, dropItems.length)
  const players = await MMO_Core.socket.modules.player.subs.player.getPlayers();
  if (players[username.toLowerCase()]) {
    const { classId } = players[username.toLowerCase()].playerData.stats;

    // Handle XP
    players[username.toLowerCase()].playerData.stats.exp[classId] += exp;
    if (players[username.toLowerCase()].playerData.stats.exp[classId] > wabs.findPlayerClass(classId).params[0][wabs.maxPlayerLevel]) {
      players[username.toLowerCase()].playerData.stats.exp[classId] = wabs._expForLevel(classId,12);
    }
    console.log('newExp', players[username.toLowerCase()].playerData.stats.exp[classId])

    // Handle Level
    players[username.toLowerCase()].playerData.stats.gold += gold;
    let resolvedLevel = wabs.resolvePlayerLevel(
      classId,
      players[username.toLowerCase()].playerData.stats.exp[classId]
    );
    if (resolvedLevel > wabs.maxPlayerLevel) resolvedLevel = wabs.maxPlayerLevel;
    if (resolvedLevel) players[username.toLowerCase()].playerData.stats.level = resolvedLevel;
    console.log('newLevel', resolvedLevel, players[username.toLowerCase()].playerData.stats.level)

    for (const item of dropItems) {
      if (item.kind) {
        // console.log('reward', item)
        const luck = item.denominator;
        const type = item.kind; // 1 = item | 2 = weapon | 3 = armor
        const itemId = item.dataId.toString();

        const dice = MMO_Core["gameworld"].dice(luck);

        if (dice === luck) {
          // console.log('success!')
          if (type === 1) {
            // console.log('from', players[username.toLowerCase()].playerData.stats.items)
            if (players[username.toLowerCase()].playerData.stats.items[itemId]) players[username.toLowerCase()].playerData.stats.items[itemId] += 1;
            else players[username.toLowerCase()].playerData.stats.items[itemId] = 1;
            // console.log('to', players[username.toLowerCase()].playerData.stats.items)
          }
          else if (type === 2) {
            // console.log('from', players[username.toLowerCase()].playerData.stats.weapons)
            if (players[username.toLowerCase()].playerData.stats.weapons[itemId]) players[username.toLowerCase()].playerData.stats.weapons[itemId] += 1;
            else players[username.toLowerCase()].playerData.stats.weapons[itemId] = 1;
            // console.log('to', players[username.toLowerCase()].playerData.stats.weapons)
          }
          else if (type === 3) {
            // console.log('from', players[username.toLowerCase()].playerData.stats.armors)
            if (players[username.toLowerCase()].playerData.stats.armors[itemId]) players[username.toLowerCase()].playerData.stats.armors[itemId] += 1;
            else players[username.toLowerCase()].playerData.stats.armors[itemId] = 1;
            // console.log('to', players[username.toLowerCase()].playerData.stats.armors)
          }
        }
      }
    }

    MMO_Core["gameworld"].emitToPlayerByUsername(username, "stats_update", players[username.toLowerCase()].playerData.stats);
  }
}

wabs.initWabsLifeCycle = () => {
  console.log('[WABS] initWabsLifeCycle ...')
  const frameDuration = 1000 / 60; // game runs at 60fps
  let tick = 0;

  // For every live action 
  wabs.lifecycle = setInterval(async () => {
    // console.log('tick', tick, tick / 60, tick / 60 % 5)

    // ... handle WABS Actions
    wabs.actions
      .filter(action => action.absData.scope !== 11)
      .map(action => wabs.runAction(action.uniqueId)) 

    // Repeaters:

    // every 5s
    if (tick / 60 % 5 === 0) {
      // console.log('5s')
      if (!MMO_Core.socket.modules.player) return console.warn('not ready');
      const players = await MMO_Core.socket.modules.player.subs.player.getPlayers();
      MMO_Core["gameworld"].getPlayerNodes().forEach(async player => {
        const _client = players[player.username.toLowerCase()];
        if (!_client) return console.log('player cannot be found', player.username.toLowerCase());
        // Do not heal during fight:
        if (await MMO_Core["gameworld"].getConnectedNpcs(player.mapId)
          .find(npc => 
            (npc.isEnemy || npc.isEvil) 
            && MMO_Core["gameworld"].getNodeBy('npcUniqueId', npc.uniqueId)
            && MMO_Core["gameworld"].getNodeBy('npcUniqueId', npc.uniqueId).follows === player.uniqueId
          )
        ) return // console.log('prevent heal during fight');

        if (wabs.isActorAttacked(player.uniqueId)) return // console.log('prevent heal during fight');
        // Get the players stats
        // console.log('player', player.username)
        const { hp, mp, mhp, mpm, pt } = await wabs.getPlayerStats(player.username);
        // console.log('_client.playerData', _client.playerData)
        const { classId } = _client.playerData.stats;
        const hpRatios = { 2: 6, 3: 12 };
        const mpRatios = { 2: 12, 3: 6 };
        const hpRatio = hpRatios[classId] || 1;
        const mpRatio = mpRatios[classId] || 1;
        const moreHp = Number((mhp / hpRatio).toFixed(0));
        const moreMp = Number((mpm / mpRatio).toFixed(0));
        // compare:
        let makeHp = (hp + moreHp <= mhp) ? moreHp : mhp - hp; // the amount of hp to ADD
        let makeMp = (mp + moreMp <= mpm) ? moreMp : mpm - mp; // the amount of mp to ADD
        // Prevent getting over max stat:
        if (hp > mhp) makeHp = -1 * (hp - mhp); 
        if (mp > mpm) makeMp = -1 * (mp - mpm);
        // propagate:
        if (makeHp !== 0) wabs.affectPlayerStats(player.username, { hp: makeHp });
        if (makeMp !== 0) wabs.affectPlayerStats(player.username, { mp: makeMp });
        // handle PT
        if (pt > 0) wabs.affectPlayerStats(player.username, { pt: (pt - 3 >= 0) ? - 3 : 0 - pt });
      });
    }

    if (tick > 300) tick = 0; // reset after longest repeater
    tick++;
  }, frameDuration); // ... once per frame
};
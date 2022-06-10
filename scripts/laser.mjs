/*
▓█████▄  ██▀███           ▒█████  
▒██▀ ██▌▓██ ▒ ██▒        ▒██▒  ██▒
░██   █▌▓██ ░▄█ ▒        ▒██░  ██▒
░▓█▄   ▌▒██▀▀█▄          ▒██   ██░
░▒████▓ ░██▓ ▒██▒ ██▓    ░ ████▓▒░
 ▒▒▓  ▒ ░ ▒▓ ░▒▓░ ▒▓▒    ░ ▒░▒░▒░ 
 ░ ▒  ▒   ░▒ ░ ▒░ ░▒       ░ ▒ ▒░ 
 ░ ░  ░   ░░   ░  ░      ░ ░ ░ ▒  
   ░       ░       ░         ░ ░  
 ░                 ░              
 */
 import * as utils from "./utils.mjs";

const MOD_NAME = 'lasers';
const LANG_PRE = 'LASERS';


const ACTIVE_LIGHTS = 'active_lights';
const IS_MIRROR     = 'is_mirror';
const IS_LAMP       = 'is_lamp';
const IS_SENSOR     = 'is_sensor'
const IS_PRISM      = 'is_prism';
const BACK_WALL     = 'back_wall';
const RAY_CHAIN     = 'ray_chain';
const MACRO_NAME    = 'macro_name';
const LIGHTS        = 'lights';
const WAS_LAMP      = 'was_lamp';

/**
 * @typedef {Object} Vec2
 * @property {number} x 
 * @property {number} y
 */


/**
 * Get translated string
 * @param {String} key The key of the text string within this module you wish to fetch
 * @returns {String} Translated string
 */
function lang(key){
  return game.i18n.localize(LANG_PRE+'.'+key);
}

// Default light, 
let laser_light = {
  angle:5,
  bright:100,
  dim:100,
  gradual: false,
  luminosity: 0.6,
  color: '#ffffff'
};


// Returns the set of all tokens at point p
/* sadly we have to retire the quadtree method - it isn't kept up to date by foundry
function tokenAtPoint(p){  
  let potential_hits = canvas.tokens.quadtree.getObjects( new NormalizedRectangle( p.x-5, p.y-5, 10, 10 ) );
  let hits = [...potential_hits].filter((token)=>{
    return (p.x > token.x) &&
           (p.x < token.x+token.hitArea.width) &&
           (p.y > token.y)&&
           (p.y < token.y+token.hitArea.height);           
  });
  return hits;
}*/

function tokenAtPoint(p){
  return canvas.tokens.placeables.filter((t)=>{return t.bounds.contains(p.x, p.y);});
}

// Return potential mirrors at point p
function mirrorAtPoint(p){
    return [...tokenAtPoint(p)].filter(tok=>tok.document.getFlag(MOD_NAME, IS_MIRROR));
}


/**
 * 
 * @param {Vec2} vec 
 * @param {Vec2} norm 
 * @returns {Vec2} Reflected vectorS
 */
function reflect(vec, norm){
  // 2(N ⋅ L) N - L
  let c = 2*(vec.x*norm.x + vec.y*norm.y);
  return {
    x: -(c * norm.x - vec.x),
    y: -(c * norm.y - vec.y)
  };
}


function isString(val){
    return (typeof val === 'string' || val instanceof String);
}


async function mergeDocuments(token, docs, type, type_id ){
    let old_ids = token.getFlag(MOD_NAME, type_id);
    old_ids = isString(old_ids)?[old_ids]:old_ids;
    old_ids = (old_ids)?old_ids:[];
    let diff = docs.length - old_ids.length;
    if (diff>0){
        canvas.scene.createEmbeddedDocuments(type, docs.splice(-diff)).then(async res=>{
            let updated_old = token.getFlag(MOD_NAME, type_id);
            updated_old = (updated_old)?updated_old:[];
            let nudoc = updated_old.concat(res.map(t=>t.id));
            await token.setFlag(MOD_NAME, type_id, nudoc);
        });
        
    }else if (diff<0){
        canvas.scene.deleteEmbeddedDocuments(type, old_ids.splice(diff));        
        await token.setFlag(MOD_NAME, type_id, old_ids);
    }
    // Re-use old id's
    for (let i=0; i < docs.length; ++i){
        docs[i]._id = old_ids[i];
    }
    if (docs.length){
        canvas.scene.updateEmbeddedDocuments(type, docs, {animate:false});
    }
}

/*
async function mergeDocuments(token, docs, type, type_id ){
    let old_ids = token.getFlag(MOD_NAME, type_id);
    old_ids = isString(old_ids)?[old_ids]:old_ids;
    old_ids = (old_ids)?old_ids:[];
    let diff = docs.length - old_ids.length;
    if (diff>0){
        let res = await canvas.scene.createEmbeddedDocuments(type, docs.splice(-diff));
        let nudoc = old_ids.concat(res.map(t=>t.id));
        await token.setFlag(MOD_NAME, type_id, nudoc);
    }else if (diff<0){
        await canvas.scene.deleteEmbeddedDocuments(type, old_ids.splice(diff));
        token.flags.lasers[type_id] = old_ids;
        await token.setFlag(MOD_NAME, type_id, old_ids);
    }
    // Re-use old id's
    for (let i=0; i < docs.length; ++i){
        docs[i]._id = old_ids[i];
    }
    if (docs.length){
        await canvas.scene.updateEmbeddedDocuments(type, docs, {animate:false});
    }
}
*/


async function updateBackWall(token){
  let doc = hasProperty(token, 'getFlag')?token:token.document;
  let is_prism = doc.getFlag(MOD_NAME ,IS_PRISM);
  let back_wall_ids = doc.getFlag(MOD_NAME, BACK_WALL);
  back_wall_ids = (back_wall_ids)?back_wall_ids:[];
  // Porting old id's where we only had one
  //back_wall_ids = ?[back_wall_ids]:back_wall_ids;

  let pos  = new utils.Vec2(doc.data.x, doc.data.y);
  let size = new utils.Vec2(token.data.width*canvas.grid.size, token.data.height*canvas.grid.size);
 
  let rn = Math.toRadians(-token.data.rotation);
  // The mirrors N vec
  let m_nvec = new utils.Vec2( Math.sin(rn), Math.cos(rn));

  let walls = [];  
  let center = pos.added( size.scaled(.5) );

  // 90 degrees rotated
  let p1 = new utils.Vec2(-m_nvec.y,  m_nvec.x);
  //-90 degrees roated
  let p2 = new utils.Vec2( m_nvec.y, -m_nvec.x);
  
  let offset = -0.1*size.x;
  if (is_prism){
    offset = .3*size.x;
    let q1 = center.added(m_nvec.scaled( 0.3*size.x));
    let q2 = center.added(m_nvec.scaled(-0.4*size.x));
    walls.push({c: [q1.x, q1.y, q2.x, q2.y],
                light: 20,
                move: 0,
                sight: 0,
                sound: 0 });
  }
  let w1 = center.added(m_nvec.scaled(offset)).add(p1.scaled(size.x*0.5));
  let w2 = center.added(m_nvec.scaled(offset)).add(p2.scaled(size.x*0.5));    

  let wall_data = {
    c: [w1.x, w1.y, w2.x, w2.y],
    light: 20,
    move: 0,
    sight: 0,
    sound: 0
  };
  walls.push(wall_data);
  await mergeDocuments(doc, walls, 'Wall', BACK_WALL);  
}


/**
 * Check whether a mirrors move affects some lights.
 * @param {Vec2} pos 
 * @returns {Set} The set of lights affected by this mirrors move
 */
function checkMirrorsMove(pos){
  // Get all lights in scene
  let lights = canvas.tokens.placeables.filter(t=>(t.document.getFlag(MOD_NAME, IS_LAMP) ))
  let lights_affected = new Set();
  // Round this mirros position to the closest grid cell
  let uv = coord2uv(pos.x, pos.y);

  // Iterate through all the lights in the scene, and check their ray chains if they contain our uv
  for (let light of lights){
    let rchain = new Set(light.document.getFlag(MOD_NAME, RAY_CHAIN));
    if (rchain.has(uv)){
      lights_affected.add(light.id);
    }
  }
  return lights_affected;
}

/**
 * Update a given mirror.
 * @param {*} token The token representing the mirror
 * @param {*} change The change broadcasted by foundry
 * @param {*} options 
 */
function updateMirror(token, change, options){
    updateBackWall(token);

    if (hasProperty(change, 'rotation')){
        // Update the tokens document to match the current change
        token.document.data.rotation = change.rotation;
    }
    // Check which ligths are affected by this movement
    let lights_affected = checkMirrorsMove(token.center);
    // Create the union between these, and the potientially affected lights by preUpdate in the options
    lights_affected = utils.setUnion(lights_affected, new Set(options.lights_affected));

    for (let light of lights_affected){
        // Update those lights
        let l = canvas.tokens.get(light);
        updateLamp(l);
    }
}

/**
 * Convert from canvas coords to grid cell coords
 * @param {Number} x 
 * @param {Number} y 
 * @returns {String} Comma separated string with U and V, grid cell coordinates
 */
function coord2uv(x, y){
  let gs = canvas.grid.size;
  return Math.floor(x/gs) + ',' + Math.floor(y/gs);
}


// Activate / Deactivate sensors
function activateSensor(  sensor, lamp_id){changeSensor(sensor, lamp_id, true);}
function deactivateSensor(sensor, lamp_id){changeSensor(sensor, lamp_id, false);}
function changeSensor(sensor, lamp_id, add=true){
    let sensor_doc = sensor.document;

    // Fetch previously active lighs on this sensor
    let active = new Set(sensor_doc.getFlag(MOD_NAME, ACTIVE_LIGHTS));
    if (add){
        // If our size is zero, and we add one, we "turn on" its light.
        if (active.size==0 && sensor.data.light.alpha==0){
            sensor_doc.update({'light.alpha':0.8});
        }
        active.add(lamp_id);
    }else{
        active.delete(lamp_id);
        // If the active lights are down to zero (after removing the one) we "turn off" the sensors light
        if (active.size == 0 && sensor.data.light.alpha>0){
            sensor_doc.update({'light.alpha':0.0});
        }
    }

    sensor_doc.setFlag(MOD_NAME, ACTIVE_LIGHTS, Array.from(active));  
    sensor_doc.data.flags.lasers.active_lights = Array.from(active);

    let macro_name = sensor_doc.getFlag(MOD_NAME, MACRO_NAME);    
    let macro = game.macros.getName(macro_name);
    if (macro_name && !macro){
      ui.notifications.warn(MOD_NAME+": Failed to find macro:" + macro_name);
    }
    if (macro){
      macro.execute({token:sensor, light_count:active.size});
    }

    let p = sensor.center;
    let opts = { tokens: Array.from(active).map(i=>canvas.tokens.get(i)?.document), method: "lasers sensor", pt: p};
    
    // Trigger Monks Active Tiles:
    let tiles = canvas.scene.tiles.filter(t=>t.object.bounds.contains(p.x, p.y));
    tiles = tiles.filter(t=>t.data.flags['monks-active-tiles']?.active);
    try{
        tiles.map(t=>t.trigger(opts));
    }catch (err){
        console.error("Failed triggering Monks Tile from sensor:", err);
    }
}



/**
 * Main body, tracing the light in a straight line from the middle of a lamp.
 * If this middle line hits a mirror on its way, 
 * @param {Vec3} start 
 * @param {Vec3} dir 
 * @param {Array} chain 
 * @param {Array} lights 
 * @param {Array} sensors 
 * @returns {*} Result
 */
function traceLight(token, start, dir, chain, lights, sensors, dg=null){
    
  let gs = canvas.grid.size;
  let step = gs*0.66;
  const MAX_CHAIN = game.settings.get(MOD_NAME, "ray_length");

    
  chain.push(coord2uv(start.x, start.y));  

  for (let i = 1; i < MAX_CHAIN; ++i){    
    let nray = new Ray(start, {x:start.x + i*step*dir.x, 
                               y:start.y + i*step*dir.y });
    
    // Checking against movement collision is not quite right
    // This is a work-around for the 'early exit' we do here
    // FIXME: move to more excact collision testing.
    // The problem is that the mirrors have "back walls", that if 
    // we are unlucky will stop the reflection.

    // Lets push it to the chain
    chain.push(coord2uv(nray.B.x, nray.B.y));
    
    if (canvas.walls.checkCollision(nray, {type:'sight'})){
      // console.log( "Hit a wall, aborting");
      dg?.drawCircle(nray.B.x, nray.B.y, 16);
      break;
    }
    
    // We haven't hit a wall, yet
    // look for a token/mirror/sensor here
    
    // Get all tokens at point B
    let tkps = tokenAtPoint({x: nray.B.x, y: nray.B.y} );

    // Visualize the point
    if (tkps.length){
      dg?.lineStyle(1, 0x00FFFF, 1.0).beginFill(0xFF0000, 0.5);
      dg?.drawCircle(nray.B.x, nray.B.y, 16);
      dg?.lineStyle(1, 0x00FFFF, 1.0).beginFill(0x00FFFF, 0.5);
    }else{
      dg?.drawCircle(nray.B.x, nray.B.y, 4);
    }

    // Filter out mirrors and sensors
    let mirrors_and_prisms = tkps.filter((tok)=>{
      return (tok.id != token.id) && 
            (tok.document.getFlag(MOD_NAME, IS_MIRROR) ||
             tok.document.getFlag(MOD_NAME, IS_PRISM))
      });
    let sns     = tkps.filter((tok)=>{return tok.document.getFlag(MOD_NAME, IS_SENSOR)});
    for (let sensor of sns){
        sensors.push(sensor);
    }

    for (let tkp of mirrors_and_prisms){
      let is_mirror = tkp.document.getFlag(MOD_NAME, IS_MIRROR);

      // We found a mirror, or a prism
      let rn = Math.toRadians(-tkp.data.rotation);
      // The N vec
      let m_nvec =  {x:Math.sin(rn), y:Math.cos(rn)};
      
      if(is_mirror){
        // Calculate the dot product, to check if it is facing towards "us"
        let dot = dir.x*m_nvec.x + dir.y*m_nvec.y;
        if (dot>0.1){
          // We hit the backside of a mirror, abort.          
          return;
        }
      }

      // Lets reflect this vector, or redirect if it is a prism
      let r_vec = (is_mirror)?reflect(dir, m_nvec): m_nvec;

      // vec to rotation
      let lrot = -Math.atan2(r_vec.x, r_vec.y) * 180 / Math.PI;
      let x = tkp.center.x; //tkp.data.x;
      let y = tkp.center.y; //tkp.data.y;
      if (!is_mirror){
        x+=m_nvec.x*.4*gs;
        y+=m_nvec.y*.4*gs;
      }

      let mirrored_light_data = {
        x: x, 
        y: y,
        hidden: false,
        name: 'light reflected from '+tkp.id,
        light: laser_light,
        rotation: lrot,
        img: 'modules/lasers/media/anger.png'
      }
      lights.push(mirrored_light_data);        
      
      if (chain.length<MAX_CHAIN){
        // And on we go
        traceLight(tkp, tkp.center, r_vec, chain, lights, sensors, dg);
      }

      // Stop the trace here, since we found a mirror
      return;
    }

  }

}



// Is this token change a transform that would modify its wall, or it's light direction
function isChangeTransform(change){
  return (hasProperty(change, 'rotation')||
          hasProperty(change, 'x')||
          hasProperty(change, 'y') ||
          change?.flags?.forced );
}


// Require an updated tracing path from this lamp.
async function updateLamp(lamp, change){
  let chain = [];
  let lights = [];
  
  // Update its wall
  if (change){
    updateBackWall(lamp);
  }
 
  if(lamp.data.light.angle==360 && !(change.flags?.lasers?.is_lamp === false)){
    lamp.document.update({light:laser_light});
  }


  // Starting point at the center of the lamp
  let start = lamp.center;
  // Its rotation in radians
  let r = Math.toRadians(-lamp.data.rotation);
  // Its normalized direction vector
  let dir = {x:Math.sin(r), y:Math.cos(r)};

  let sensors = [];
  // And lets go
  
  let dg = (game.settings.get(MOD_NAME, "debug"))?canvas.controls.debug:null;
  dg?.clear();
  dg?.lineStyle(1, 0x00FFFF, 1.0).beginFill(0x00FFFF, 0.5);
  // Lets trace
  if (lamp.document.getFlag(MOD_NAME, IS_LAMP)){
    traceLight(lamp, start, dir, chain, lights, sensors, dg);
  }
  // End trace
  dg?.endFill();

  // Sensors we shone a light on now
  let current_sensors = new Set(sensors);
 
  // All sensors in scene
  let all_sensors = canvas.tokens.placeables.filter((tok)=>{
    return tok.document.getFlag(MOD_NAME, IS_SENSOR);
  });
    
  // All sensors we shone on before
  let prev_sensors = all_sensors.filter((s)=>{
      return (new Set(s.document.getFlag(MOD_NAME, ACTIVE_LIGHTS))).has(lamp.id);
  });

  // The difference between those that aren't lit up, but was lit last cycle
  let turn_off = utils.setDifference(prev_sensors, current_sensors);
  // The difference between those that weren't lit up last cycle, but are now.
  let turn_on  = utils.setDifference(current_sensors, prev_sensors);
  for (let s of turn_off){deactivateSensor(s, lamp.id);}
  for (let s of turn_on ){  activateSensor(s, lamp.id);}

 
  // Replace mirror lights with this lamps settings.
  for (let l of lights){
    l.light = duplicate(lamp.data.light);
    l.config = l.light;
    if (l.flags == undefined){l.flags = {};}
    if(l.flags.lasers==undefined){l.flags.lasers={};};
    l.flags.lasers.is_laser = true;
  }
  lights = Array.from(lights);
  await mergeDocuments(lamp.document, lights, 'AmbientLight', LIGHTS);

  // Keep the trace chain
  lamp.document.setFlag(MOD_NAME, RAY_CHAIN, chain);
  
}



// Bind to pre-update to pick up those mirrors and prisms moving away from a beam
Hooks.on('preUpdateToken', (token, change, options, user_id)=>{
  if (!game.user.isGM)return true;

  let is_mirr = token.getFlag(MOD_NAME, IS_MIRROR);
  let is_prism= token.getFlag(MOD_NAME, IS_PRISM);

  let sz2 = canvas.grid.size/2;
  // We need to also notify change if a mirror moves out of an 'active' ray  
  if ( (is_mirr || is_prism) && isChangeTransform(change)){
    let pos = {x:token.data.x+sz2, y:token.data.y+sz2};
    let lights_affected = checkMirrorsMove(pos);    
    if (lights_affected.size){
      options.lights_affected = Array.from(lights_affected);
    }
  }
});


// Delete token
Hooks.on('deleteToken', (token, options, user_id)=>{
  if (!game.user.isGM)return true;

  let is_lamp = token.getFlag(MOD_NAME, IS_LAMP);
  let is_mirr = token.getFlag(MOD_NAME, IS_MIRROR);
  let is_prism= token.getFlag(MOD_NAME, IS_PRISM);
  if (is_lamp||is_mirr||is_prism){
      let bcw = token.getFlag(MOD_NAME, BACK_WALL);
      if (bcw){
        canvas.scene.deleteEmbeddedDocuments("Wall", bcw);
      }

      if (is_lamp){
        let lights = token.getFlag(MOD_NAME, LIGHTS);
        if (lights && hasProperty(lights, 'length') && lights.length){
          canvas.scene.deleteEmbeddedDocuments("Token", lights);
        }
      } else { // is mirror
        // TODO: Notify lights if this mirror is in active chain
      }      
  }
});


Hooks.on('createToken', (token, options, user_id)=>{
  if (!game.user.isGM)return true;
  let is_lamp = token.getFlag(MOD_NAME, IS_LAMP);
  let is_mirr = token.getFlag(MOD_NAME, IS_MIRROR);
  let is_prism = token.getFlag(MOD_NAME, IS_PRISM);

  if(is_lamp||is_mirr||is_prism){
    updateBackWall(token);
    // Check for default settings.
    if (is_lamp){
      if (token.data.light.angle == 360){
        console.log("Creating light, found default light settings(360 degrees), replacing with 'laser settings'");        
        token.update({ 
          light:laser_light,
          'flags.lasers.is_laser':true
        });
      }
    }
  }
});



// Fetch copy and paste, to extract and copy our flags
Hooks.on('pasteToken', (copied, createData)=>{  
  for (let i = 0; i < copied.length; ++i){
    let tok = copied[i];
    let data= createData[i];
    let is_lamp = tok.document.getFlag(MOD_NAME, IS_LAMP);
    let is_mirr = tok.document.getFlag(MOD_NAME, IS_MIRROR);
    if (is_lamp || is_mirr){
      tok.document.setFlag(MOD_NAME, BACK_WALL, null);
      tok.document.setFlag(MOD_NAME, LIGHTS, null);
    }
  }
});



// Let's grab those token updates
Hooks.on('updateToken', (token, change, options, user_id)=>{
  if (!game.user.isGM)return true;
  
  //console.error( change );

  // Did we turn off a lamp  
  if (change.flags?.lasers?.is_lamp === false && token.getFlag(MOD_NAME, WAS_LAMP) === true){
    //console.error("We turned OFF a lamp!", token);
    token.setFlag(MOD_NAME,WAS_LAMP, false);
    //if (lights) canvas.scene.deleteEmbeddedDocuments('AmbientLight', lights);
    //token.update({'light.alpha': 0.0, 'flags.lasers.lights': []});
    token.update({'light.alpha': 0.0});    
    updateLamp(token.object, change);
  }
  // Did we turn on a lamp?
  if (change.flags?.lasers?.is_lamp === true && !token.getFlag(MOD_NAME, WAS_LAMP)){
    //console.error("We turned ON a lamp!", token);
    token.setFlag(MOD_NAME, WAS_LAMP, true);
    token.update({'light.alpha':0.5}).then(()=>updateLamp(token.object, change));
  }
  

  // Is this "type" disabled
  if (change.flags?.lasers?.is_lamp   === false ||
      change.flags?.lasers?.is_prism  === false ||
      change.flags?.lasers?.is_mirror === false  ){
    // We turned off a mirror, lamp or prism
    let walls = token.getFlag(MOD_NAME, BACK_WALL);
    token.setFlag(MOD_NAME, BACK_WALL, null).then(()=>canvas.scene.deleteEmbeddedDocuments('Wall', walls));
  }



  if ( isChangeTransform(change) || 
       hasProperty(options, 'lights_affected')||
       change?.flags?.lasers?.is_lamp ||
       change?.flags?.lasers?.is_mirror ||
       change?.flags?.lasers?.is_prism
  ){
    if (token.getFlag(MOD_NAME, IS_LAMP)){
      // console.warn("Updating LAMP");
      updateLamp(canvas.tokens.get(token.id), change);
    }
    if (token.getFlag(MOD_NAME, IS_MIRROR)||token.getFlag(MOD_NAME, IS_PRISM) ){
      updateMirror(canvas.tokens.get(token.id), change, options);
    }
  }
});


// Settings and Initialization:
Hooks.once("init", () => {    
  
  // How far to trace rays before giving up
  game.settings.register(MOD_NAME, "ray_length", {
    name: lang('ray'),
    hint: lang('ray_hint'),
    scope: 'world',
    config: true,
    type: Number,
    default: 150
  });
  
  // Ray width
  game.settings.register(MOD_NAME, "ray_width", {
    name: lang('width'),
    hint: lang('width_hint'),
    scope: 'world',
    config: true,
    type: Number,
    default: 0.6
  });

  

  libWrapper.register('lasers', 'ClockwiseSweepPolygon.create', function(wrapped, ...args) {
    // Get the wrapped output
    let los = wrapped(...args);
    
    let rw = game.settings.get(MOD_NAME, 'ray_width');
    let width = 0.5 * rw * canvas.grid.size;
    
    // If this is a laser, modify the output
    if ((args[1].source?.object?.data?.flags?.lasers?.is_laser)||
        (args[1].source?.object?.data?.flags?.lasers?.is_lamp) ){
      //console.log("Wrapped method los 'create' intercepted.");
      let rot = args[1].rotation;
      let rr = Math.toRadians(rot);
      let p = {
        x:width*Math.cos(rr), 
        y:width*Math.sin(rr)
      };
      
      let new_points = [];
      let p1 = utils.vSub(los.origin, p);
      let p2 = utils.vAdd(los.origin, p);
      new_points.push(p1);
      new_points.push(p2);
      for (let i = 2; i< los.points.length-2; i+=2){
        new_points.push({x: los.points[i],
                         y: los.points[i+1]});
      }

      let angles = new_points.map((p)=>{90-utils.vAngle( utils.vSub(p, los.origin) ) });
      
      // sort points by angles
      let sorted_points = utils.dsu(new_points, angles);
      // flatten points
      let res_points = [];
      for (let p of sorted_points) {
        res_points.push(p.x);res_points.push(p.y);
      }
      los.points = res_points;
    
    }

    // Return the potentially changed output
    return los;
  }, 'MIXED');


  game.settings.register(MOD_NAME, "debug", {
    name: lang('debug'),
    hint: lang('debug_hint'),
    scope: 'world',
    config: true,
    type: Boolean,
    default: false
  });  


  /*
  game.settings.register(MOD_NAME, "activate_MATT", {
    name: lang('matt'),
    hint: lang('matt_hint'),
    scope: 'world',
    config: true,
    type: Boolean,
    default: true
  });  
  game.settings.register(MOD_NAME, MULTI_LIGHT_MODEL, {
    name: lang('multi_light_model'),
    hint: lang('multi_light_model_hint'),
    scope: 'world',
    config: true,
    type: Boolean,
    default: false
  });*/

  /*
  game.settings.register(MOD_NAME, "dual_lights", {
    name: "Dual Lights",
    hint: "Create light sources in 'both' directions, looks better, but can in some cases create artifacts",
    scope: 'world',
    config: true,
    type: Boolean,
    default: true
  });
  */
});




function createCheckBox(app, fields, data_name, title, hint){  
  const label = document.createElement('label');
  label.textContent = title; 
  const input = document.createElement("input");
  input.name = 'flags.'+MOD_NAME+'.' + data_name;
  input.type = "checkbox";
  input.title = hint;
  
  if (app.token.getFlag(MOD_NAME, data_name)){
    input.checked = "true";
  }
  fields.append(label);
  fields.append(input);
}

function createSeparator(){
  let d = document.createElement('div');
  d.style.cssText = 'border-left:1px solid #000;height:1em';
  return d;
}



// Hook into the token config render
Hooks.on("renderTokenConfig", (app, html) => {
  // Create a new form group
  const formGroup = document.createElement("div");
  formGroup.classList.add("form-group");
  formGroup.classList.add("slim");

  // Create a label for this setting
  const label = document.createElement("label");
  label.textContent = "Laser";
  formGroup.prepend(label);

  // Create a form fields container
  const formFields = document.createElement("div");
  formFields.classList.add("form-fields");
  formGroup.append(formFields);

  formFields.append(createSeparator());
  createCheckBox(app, formFields, IS_LAMP,   lang('lightsource'), lang('light_hint'));
  formFields.append(createSeparator());
  createCheckBox(app, formFields, IS_MIRROR, lang('mirror'),      lang('mirror_hint'));
  formFields.append(createSeparator());
  createCheckBox(app, formFields, IS_PRISM,  lang('prism'),       lang('prism_hint'));
  formFields.append(createSeparator());
  createCheckBox(app, formFields, IS_SENSOR, lang('sensor'),      lang('sensor_hint'));

  const mname = document.createElement('input');
  mname.name = 'flags.'+MOD_NAME+'.macro_name';
  mname.type = 'text';
  mname.placeholder = lang('macro_name');
  mname.hint        = lang('macro_hint');
  let mn = app.token.getFlag(MOD_NAME, 'macro_name');  
  mname.value = (mn)?mn:"";
  formFields.append(mname);


  // Add the form group to the bottom of the Identity tab
  html[0].querySelector("div[data-tab='character']").append(formGroup);

  // Set the apps height correctly
  app.setPosition();
});
//*/

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


const MOD_NAME = 'lasers';
const LANG_PRE = 'LASERS';

const ACTIVE_LIGHTS = 'active_lights';
const IS_MIRROR     = 'is_mirror';
const IS_LAMP       = 'is_lamp';
const IS_SENSOR     = 'is_sensor'
const BACK_WALL     = 'back_wall';
const RAY_CHAIN     = 'ray_chain';
const MACRO_NAME    = 'macro_name';
const LIGHTS        = 'lights';

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


/**
 * @param {Set} setA 
 * @param {Set} setB 
 * @returns {Set} Union of set A and B
 */
function setUnion(setA, setB) {
  const union = new Set(setA);
  for (const elem of setB) {
      union.add(elem);
  }
  return union;
}

/**
 * @param {Set} setA 
 * @param {Set} setB 
 * @returns {Set} Union of set A and B
 */
function setDifference(setA, setB) {
  let _difference = new Set(setA)
  for (let elem of setB) {
      _difference.delete(elem)
  }
  return _difference
}

/**
 * @param {Set} setA 
 * @param {Set} setB 
 * @returns {Set} Intersection of set A and B
 */
function setIntersection(setA, setB) {
  let _intersection = new Set()
  for (let elem of setB) {
      if (setA.has(elem)) {
          _intersection.add(elem)
      }
  }
  return _intersection
}



// TODO: investigate AmbientLight.prototype.refresh


// Returns the set of all tokens at point p
function tokenAtPoint(p){
  let potential_hits = canvas.tokens.quadtree.getObjects( new NormalizedRectangle( p.x-5, p.y-5, 10, 10 ) );
  let hits = [...potential_hits].filter((token)=>{
    return (p.x > token.x) &&
           (p.x < token.x+token.hitArea.width) &&
           (p.y > token.y)&&
           (p.y < token.y+token.hitArea.height);           
  });
  return hits;
}

// Return potential mirrors at point p
function mirrorAtPoint(p){
  return [...tokenAtPoint(p)].filter(tok=>tok.document.getFlag(MOD_NAME, IS_MIRROR));
}



function reflect(vec, norm){
  // 2(N ⋅ L) N - L
  let c = 2*(vec.x*norm.x + vec.y*norm.y);
  return {
    x: -(c * norm.x - vec.x),
    y: -(c * norm.y - vec.y)
  };
}

function isTokenMirror(tok){
  if (hasProperty(tok, 'getFlag')) return tok.getFlag(MOD_NAME, IS_MIRROR);
  return tok.document.getFlag(MOD_NAME, IS_MIRROR); 
}
function isTokenSensor(tok){
  if (hasProperty(tok, 'getFlag')) return tok.getFlag(MOD_NAME, IS_SENSOR);
  return tok.document.getFlag(MOD_NAME, IS_SENSOR); 
}


function updateBackWall(token){
  let back_wall_id = token.document.getFlag(MOD_NAME, BACK_WALL);
  let back_wall = canvas.walls.get(back_wall_id);
  let w = token.hitArea.width;
 
  let rn = Math.toRadians(-token.data.rotation);
  // The mirrors N vec
  let m_nvec =  {x:Math.sin(rn), y:Math.cos(rn)};
  let offset = -0.1*w;
  
  // 90 degrees rotated
  let p1 = {x: -m_nvec.y, y:m_nvec.x};
  //-90 degrees roated
  let p2 = {x: m_nvec.y, y: -m_nvec.x};

  let w1 = {
    x: token.center.x + m_nvec.x * offset + p1.x *w* 0.5,
    y: token.center.y + m_nvec.y * offset + p1.y *w* 0.5
  }
  let w2 = {
    x: token.center.x + m_nvec.x * offset + p2.x *w* 0.5,
    y: token.center.y + m_nvec.y * offset + p2.y *w* 0.5
  }
  let wall_data = {
    c: [w1.x, w1.y, w2.x, w2.y],
    light: 20,
    move: 0,
    sight: 0,
    sound: 0
  };
 
  if (back_wall == null){
    // create it    
    canvas.scene.createEmbeddedDocuments("Wall", [wall_data] ).then( (wall)=> {
      token.document.setFlag(MOD_NAME, BACK_WALL, wall[0].id);
    });
  }else{    
    // update it
    back_wall.document.update(wall_data);
  }
}

function checkMirrorsMove(pos){
  let lights = canvas.tokens.placeables.filter(t=>(t.document.getFlag(MOD_NAME, IS_LAMP) ))
  let lights_affected = new Set();
  let uv = coord2uv(pos.x, pos.y);
  
  for (let light of lights){
    let rchain = new Set(light.document.getFlag(MOD_NAME, RAY_CHAIN));
    if (rchain.has(uv)){
      lights_affected.add(light.id);
    }
  }
  return lights_affected;
}

function updateMirror(token, change, options){
  updateBackWall(token);
  
  let lights_affected = checkMirrorsMove(token.center); 
  lights_affected = setUnion(lights_affected, new Set(options.lights_affected));

  for (let light of lights_affected){
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

function activateSensor(  sensor, lamp_id){changeSensor(sensor, lamp_id, true);}
function deactivateSensor(sensor, lamp_id){changeSensor(sensor, lamp_id, false);}

function changeSensor(sensor, lamp_id, add=true){
  let sensor_doc = sensor.document;
  
  // Fetch previously active lighs on this sensor
  let active = new Set(sensor_doc.getFlag(MOD_NAME, ACTIVE_LIGHTS));
  if (add){
    if (active.size==0){
      sensor_doc.update({'light.alpha':0.8});
    }
    active.add(lamp_id);
  }else{
    active.delete(lamp_id);
    if (active.size == 0){
      sensor_doc.update({'light.alpha':0.0});
    }
  }

  sensor_doc.setFlag(MOD_NAME, ACTIVE_LIGHTS, Array.from(active));  
  sensor_doc.data.flags.lasers.active_lights = Array.from(active);

  let macro_name = sensor_doc.getFlag(MOD_NAME, MACRO_NAME);
  let macro = game.macros.getName(macro_name);
  if (macro){
    macro.execute({token:sensor, light_count:active.size});
  }
}



function traceLight(start, dir, chain, lights, sensors){
  let gs = canvas.grid.size;  
  //let ray = new Ray(start, {x:0, y:0});
  const MAX_CHAIN = game.settings.get(MOD_NAME, "ray_length");
  
  chain.push(coord2uv(start.x, start.y));  

  for (let i = 1; i < MAX_CHAIN; ++i){
    //ray.B.x = start.x + i*gs*dir.x;
    //ray.B.y = start.y + i*gs*dir.y;
    let nray = new Ray(start, {x:start.x + i*gs*dir.x, y:start.y + i*gs*dir.y });

    // Checking against movement collision is not quite right
    // This is a work-around for the 'early exit' we do here
    // FIXME: move to more excact collision testing.
    // The problem is that the mirrors have "back walls", that if 
    // we are unlucky will stop the reflection.
    
    if (canvas.walls.checkCollision(nray)){      
      break;
    }
    // Lets push it to the chain
    chain.push(coord2uv(nray.B.x, nray.B.y));    
    
    // We haven't hit a wall, yet
    // look for a token/mirror/sensor here
    let tkps = Array.from(tokenAtPoint(nray.B));
    let mirrors = tkps.filter(tok=>tok.document.getFlag(MOD_NAME, IS_MIRROR));
    let sns = tkps.filter(tok=>tok.document.getFlag(MOD_NAME, IS_SENSOR));
    for (let sensor of sns){
        sensors.push(sensor);        
    }
    

    if (mirrors.length){
      let tkp = tkps[0]; // #TODO: Fix this...later
      // We found a mirror
      let rn = Math.toRadians(-tkp.data.rotation);
      // The mirrors N vec
      let m_nvec =  {x:Math.sin(rn), y:Math.cos(rn)};

      // Lets reflect this vector
      let r_vec = reflect(dir, m_nvec);
              
      // vec to rotation
      let lrot = -Math.atan2(r_vec.x, r_vec.y) * 180 / Math.PI;

      let mirrored_light_data = {
        x: tkp.data.x, 
        y: tkp.data.y,
        hidden: false,
        name: 'light reflected from '+tkp.id,
        light: laser_light,
        rotation: lrot,
        img: 'modules/lasers/media/anger.png'
      }        
      lights.push(mirrored_light_data);        
      
      if (chain.length<MAX_CHAIN){
        // And on we go
        traceLight(tkp.center, r_vec, chain, lights, sensors);
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
          ( 
            hasProperty(change, 'flags')&&
            hasProperty(change.flags, 'lasers')&&
            hasProperty(change.flags.lasers, 'forced')
          ));
}


function updateLamp(lamp, change){
  let chain = [];
  let lights = [];
  
  // Update its wall
  updateBackWall(lamp);

  // Starting point at the center of the lamp
  let start = lamp.center;
  // Its rotation in radians
  let r = Math.toRadians(-lamp.data.rotation);
  // Its normalized direction vector
  let dir = {x:Math.sin(r), y:Math.cos(r)};

  let sensors = [];
  // And lets go
  traceLight(start, dir, chain, lights, sensors);  
  
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

  //console.log("All :", all_sensors);
  //console.log("Crnt:", current_sensors);
  //console.log('prev:', prev_sensors);
  let turn_off = setDifference(prev_sensors, current_sensors);
  let turn_on  = setDifference(current_sensors, prev_sensors);
  for (let s of turn_off){deactivateSensor(s, lamp.id);}
  for (let s of turn_on ){  activateSensor(s, lamp.id);}


  // Existing lights
  let old_lights = lamp.document.getFlag(MOD_NAME, LIGHTS);

  // Replace mirror lights with this lamps settings.
  for (let l of lights){
    l.light = duplicate(lamp.data.light);
  }

  // Creat lights if neccesarry:
  let mirrored_light_promise = canvas.scene.createEmbeddedDocuments("Token", lights );
  
  // Clean up old lights
  if(old_lights){
    // Delete em'
    canvas.scene.deleteEmbeddedDocuments("Token",old_lights);
  }

  // Keep the trace chain
  lamp.document.setFlag(MOD_NAME, RAY_CHAIN, chain);
  // And, finally keep the new lights (tokens)
  mirrored_light_promise.then((new_lights)=>{
    lamp.document.setFlag(MOD_NAME, LIGHTS, new_lights.map((l)=>{return l.id;}));
  });
}


// Bind to pre-update to pick up those mirrors moving away from a beam
Hooks.on('preUpdateToken', (token, change, options, user_id)=>{
  if (!game.user.isGM)return true;

  let sz2 = canvas.grid.size/2;
  // We need to also notify change if a mirror moves out of an 'active' ray  
  if (token.getFlag(MOD_NAME,IS_MIRROR) && isChangeTransform(change)){
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
  if (is_lamp||is_mirr){
      let bcw = token.getFlag(MOD_NAME, BACK_WALL);
      if (bcw){canvas.scene.deleteEmbeddedDocuments("Wall", [bcw]);}

      if (is_lamp){
        let lights = token.getFlag(MOD_NAME, LIGHTS);
        if (lights){canvas.scene.deleteEmbeddedDocuments(lights);}
      } else { // is mirror
        // TODO: Notify lights if this mirror is in active chain
      }      
  }
});


Hooks.on('createToken', (token, options, user_id)=>{
  if (!game.user.isGM)return true;

  if(token.getFlag(MOD_NAME, IS_LAMP)){
    // Check for default settings.
    if (token.data.light.angle == 360){
      console.warn("Creating light, found default light settings(360 degrees), replacing with 'laser settings'");
      token.update({light:laser_light});
    }
  }
});




// Let's grab those token updates
Hooks.on('updateToken', (token, change, options, user_id)=>{
  if (!game.user.isGM)return true;

  if (isChangeTransform(change) || hasProperty(options, 'lights_affected')){  
    if (token.getFlag(MOD_NAME, IS_LAMP)){
      updateLamp(canvas.tokens.get(token.id), change);
    }
    if (token.getFlag(MOD_NAME, IS_MIRROR) ){
      updateMirror( canvas.tokens.get(token.id), change, options);
    }
  }
});


// Settings:
Hooks.once("init", () => {    
  game.settings.register(MOD_NAME, "ray_length", {
    name: lang('ray'),
    hint: lang('ray_hint'),
    scope: 'world',
    config: true,
    type: Number,
    default: 100
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
  */
  game.settings.register(MOD_NAME, "multi_light_model", {
    name: lang('multi_light_model'),
    hint: lang('multi_light_model_hint'),
    scope: 'world',
    config: true,
    type: Boolean,
    default: false
  });

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

  createCheckBox(app, formFields, IS_LAMP,   lang('lightsource'), lang('light_hint'));
  createCheckBox(app, formFields, IS_MIRROR, lang('mirror'),      lang('mirror_hint'));
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

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


let MOD_NAME = "lasers";

let laser_light = {
  angle:5,
  bright:100,
  dim:100,
  gradual: false,
  luminosity: 0.6,
  color: '#ffffff'
};

function unionSet(setA, setB) {
  const union = new Set(setA);
  for (const elem of setB) {
      union.add(elem);
  }
  return union;
}

// TODO: investigate AmbientLight.prototype.refresh


// Returns a token overlapping point 'p', return null if none exists.
function tokenAtPoint(p){
  for (let tok of canvas.tokens.placeables){
    if (p.x > tok.data.x && 
        p.x < tok.data.x+tok.hitArea.width &&
        p.y > tok.data.y &&
        p.y < tok.data.y+tok.hitArea.height){
          return tok;
        }
  }
  return null;
}

function mirrorAtPoint(p){
  for (let tok of canvas.tokens.placeables){
    if (p.x > tok.data.x && 
        p.x < tok.data.x+tok.hitArea.width &&
        p.y > tok.data.y &&
        p.y < tok.data.y+tok.hitArea.height &&
        tok.document.getFlag(MOD_NAME, 'is_mirror')
        ){
          return tok;
        }
  }
  return null;
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
  if (hasProperty(tok, 'getFlag')) return tok.getFlag(MOD_NAME, 'is_mirror');
  return tok.document.getFlag(MOD_NAME, 'is_mirror'); 
}

function updateBackWall(token){
  let back_wall_id = token.document.getFlag(MOD_NAME, "back_wall");
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
      //console.log("As promised: ", wall);
      token.document.setFlag(MOD_NAME, "back_wall", wall[0].id);
    });
  }else{    
    // update it
    //console.log("Updating wall:", back_wall, wall_data);
    back_wall.document.update(wall_data);
  }
}

function checkMirrorsMove(pos){
  let lights = canvas.tokens.placeables.filter(t=>(t.document.getFlag(MOD_NAME, 'is_lamp') ))
  let lights_affected = new Set();
  let uv = coord2uv(pos.x, pos.y);
  
  for (let light of lights){
    let rchain = new Set(light.document.getFlag(MOD_NAME, 'ray_chain'));    
    if (rchain.has(uv)){
      lights_affected.add(light.id);
    }
  }
  return lights_affected;
}

function updateMirror(token, change, options){
  updateBackWall(token);
  
  let lights_affected = checkMirrorsMove(token.center); 
  lights_affected = unionSet(lights_affected, new Set(options.lights_affected));

  for (let light of lights_affected){    
    let l = canvas.tokens.get(light);
    updateLamp(l);
  }
}

function coord2uv(x, y){
  let gs = canvas.grid.size;
  return Math.floor(x/gs) + ',' + Math.floor(y/gs);
}

function traceLight(start, dir, chain, lights){
  let gs = canvas.grid.size;  
  let ray = new Ray(start, {x:0, y:0});
  
  chain.push(coord2uv(start.x, start.y));

  for (let i = 1; i < 128; ++i){
    ray.B.x = start.x + i*gs*dir.x;
    ray.B.y = start.y + i*gs*dir.y;            
    if (canvas.walls.checkCollision(ray, {type:'movement'})){
      break;
    }
    // Lets push it to the chain
    chain.push(coord2uv(ray.B.x, ray.B.y));
    
    // We haven't hit a wall, yet
    // look for a token/mirror here
    let tkp = mirrorAtPoint(ray.B);
    if (tkp!=null){
      //console.log("We found a token", tkp);
      if (isTokenMirror(tkp)){
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
        
        if (chain.length<game.settings.get(MOD_NAME, "ray_length")){
          // And on we go
          traceLight(tkp.center, r_vec, chain, lights);
        }
        return;
      }
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
  
  // Turn on the light on this lamp
  //lamp.document.update({light:laser_light});
  updateBackWall(lamp);

  // Starting point at the center of the lamp
  let start = lamp.center;
  // Its rotation in radians
  let r = Math.toRadians(-lamp.data.rotation);
  // Its normalized direction vector
  let dir = {x:Math.sin(r), y:Math.cos(r)};

  // And lets go
  traceLight(start, dir, chain, lights);
  //console.log("Tracing lights(",lights.length,")", chain);

  // Existing lights
  let old_lights = lamp.document.getFlag(MOD_NAME, 'lights');

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
  lamp.document.setFlag(MOD_NAME, 'ray_chain', chain);
  // And, finally keep the new lights (tokens)
  mirrored_light_promise.then((new_lights)=>{
    lamp.document.setFlag(MOD_NAME, 'lights', new_lights.map((l)=>{return l.id;}));
  });
}


// Bind to pre-update to pick up those mirrors moving away from a beam
Hooks.on('preUpdateToken', (token, change, options, user_id)=>{
  if (!game.user.isGM)return true;

  let sz2 = canvas.grid.size/2;
  // We need to also notify change if a mirror moves out of an 'active' ray  
  if (token.getFlag(MOD_NAME,'is_mirror') && isChangeTransform(change)){
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

  let is_lamp = token.getFlag(MOD_NAME, 'is_lamp');
  let is_mirr = token.getFlag(MOD_NAME, 'is_mirror');
  if (is_lamp||is_mirr){
      let bcw = token.getFlag(MOD_NAME, 'back_wall');
      if (bcw){canvas.scene.deleteEmbeddedDocuments("Wall", [bcw]);}

      if (is_lamp){
        let lights = token.getFlag(MOD_NAME, 'lights');
        if (lights){canvas.scene.deleteEmbeddedDocuments(lights);}
      } else { // is mirror
        // TODO: Notify lights if this mirror is in active chain
      }      
  }
});

Hooks.on('createToken', (token, options, user_id)=>{
  if (!game.user.isGM)return true;

  if(token.getFlag(MOD_NAME, 'is_lamp')){
    // Check for default settings.
    if (token.data.light.angle == 360){
      console.log("Found, default light settings, replacing with 'laser settings'");
      token.update({light:laser_light});
    }
  }
});




// Let's grab those token updates
Hooks.on('updateToken', (token, change, options, user_id)=>{
  if (!game.user.isGM)return true;

  if (isChangeTransform(change) || hasProperty(options, 'lights_affected')){  
    if (token.getFlag(MOD_NAME, 'is_lamp')){
      updateLamp(canvas.tokens.get(token.id), change);
    }
    if (token.getFlag(MOD_NAME, 'is_mirror') ){
      updateMirror( canvas.tokens.get(token.id), change, options);
    }
  }
});


// Settings:
Hooks.once("init", () => {    
  game.settings.register(MOD_NAME, "ray_length", {
    name: "Max ray length",
    hint: "The maximum lenth we trace a light ray, in grid cells",
    scope: 'world',
    config: true,
    type: Number,
    default: 100
  });


  /*
  game.settings.register(MOD_NAME, "ray_width", {
    name: "The ray spread",
    hint: "The width / spread of the ray, purely visual.",
    scope: 'world',
    config: true,
    type: Number,
    default: 5
  });
  game.settings.register(MOD_NAME, "ray_reach", {
    name: "Visual light lenght",
    hint: "The length of the ligth, purely visual. Setting this too long, will have the light visually start later.",
    scope: 'world',
    config: true,
    type: Number,
    default: 100
  });  
  game.settings.register(MOD_NAME, "ray_luminosity", {
    name: "Light Luminosity",
    hint: "The length of the ligth, purely visual. Setting this too long, will have the light visually start later.",
    scope: 'world',
    config: true,
    type: Number,
    default: 0.6,
    range: {             // If range is specified, the resulting setting will be a range slider
      min: 0,
      max: 1,
      step: 0.1
    }
  });
  */
 // luminosity: 0.6,
    
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

  createCheckBox(app, formFields, 'is_lamp',   'Lamp',   'Check true to indicate that this is a lamp.');
  createCheckBox(app, formFields, 'is_mirror', 'Mirror', 'Check true to indicate that this is a mirror.');
  createCheckBox(app, formFields, 'is_sensor', 'Sensor', 'Check true to indicate this as a light sensor.');

  // Add the form group to the bottom of the Identity tab
  html[0].querySelector("div[data-tab='character']").append(formGroup);

  // Set the apps height correctly
  app.setPosition();
});
//*/

let module_name = "lasers";
let laser_socket;
Hooks.once("socketlib.ready", () => {
  // socketlib is activated, lets register our function moveAsGM
	laser_socket = socketlib.registerModule(module_name);	
	//laser_socket.register("moveAsGM", doMoveAsGM);
});


let laser_light = {
  angle:5,
  bright:100,
  dim:100,
  gradual: false,
  luminosity: 0.9,
  color: '#ffffff'
};



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

function reflect(vec, norm){
  // 2(N ⋅ L) N - L
  let c = 2*(vec.x*norm.x + vec.y*norm.y);
  return {
    x: c * norm.x - vec.x,
    y: c * norm.y - vec.y
  };
}

function isTokenMirror(tok){
  if (hasProperty(tok, 'getFlag')) return tok.getFlag(module_name, 'is_mirror');
  return tok.document.getFlag(module_name, 'is_mirror'); 
}

function updateMirror(token){
  // let mrls = token.document.getFlag(module_name, 'mirrored_lights');
  let back_wall_id = token.document.getFlag(module_name, "back_wall");
  let back_wall = canvas.walls.get(back_wall_id);
  let w = token.hitArea.width;
 
  let rn = Math.toRadians(token.data.rotation);
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
  let wall_data = {c: [w1.x, w1.y, w2.x, w2.y]};
 
  if (back_wall == null){
    // create it
    console.log("Creating wall:", wall_data);
    canvas.scene.createEmbeddedDocuments("Wall", [wall_data] ).then( (wall)=> {
      console.log("As promised: ", wall);
      token.document.setFlag(module_name, "back_wall", wall[0].id);
    });
  }else{    
    // update it
    console.log("Updating wall:", back_wall, wall_data);    
    back_wall.document.update(wall_data);
  }

}



function traceLight(start, dir, chain){
  let gs = canvas.grid.size;
  
  let ray = new Ray(start, {x:0, y:0});
  for (let i = 1; i < 128; ++i){
    ray.B.x = start.x + i*gs*dir.x;
    ray.B.y = start.y + i*gs*dir.y;            
    if (canvas.walls.checkCollision(ray)){
      break;
    }
    
    // We haven't hit a wall, yet
    // look for a token/mirror here
    let tkp = tokenAtPoint(ray.B);
    if (tkp!=null){
      console.log("Mirror token", tkp);
      if (isTokenMirror(tkp)){
        // We found a mirror
        //console.log("We intersect a mirror!!!")
        
        let rn = Math.toRadians(tkp.data.rotation);
        // The mirrors N vec
        let m_nvec =  {x:Math.sin(rn), y:Math.cos(rn)};
        
        // Lets reflect this vector
        r_vec = reflect(dir, m_nvec);
        
        // vec to rotation
        let lrot = Math.atan2(r_vec.x, r_vec.y) * 180 / Math.PI;                
        lrot += (lrot<0)?180:0;

        let mirrored_light_data = {
          x: tkp.x, 
          y: tkp.y,
          hidden: false,
          name: 'light reflected from '+tkp.id,
          light: laser_light,
          rotation: lrot,
          img: 'modules/lasers/media/anger.png'
        }
        let mirrored_light_promise = canvas.scene.createEmbeddedDocuments("Token", [mirrored_light_data] );

        console.log(tkp.data.rotation, rn, m_nvec, r_vec, lrot);
        console.log("We created a light", mirrored_light_data);
        console.log(mirrored_light_promise);
        
        // lets keep this promise of a token for later
        chain.push(mirrored_light_promise);
        if (chain.length<11){
          // And on we go
          traceLight(tkp.center, r_vec, chain);
        }
        return;
      }
    }

  }

}

function isChangeTransform(change){
  return (hasProperty(change, 'rotation')||
          hasProperty(change, 'x')||
          hasProperty(change, 'y'));
}

Hooks.on('updateToken', (token, change, options, user_id)=>{
  console.log("Lasers update:", token, change, options, user_id );
  let tok = canvas.tokens.get(token.id);
  //let mirror = token.getFlag(module_name, 'is_mirror');
  let lamp = token.getFlag(module_name, 'is_lamp');
  if (lamp){
    let chain = [];

    let l = canvas.tokens.get(token.id).light;
    let light = laser_light;
    // updates that trigger mirror things.
    if (isChangeTransform(change)){
          
          // Turn on the light on this lamp
          token.update({light:light});     
          
          // Starting point at the center of the lamp
          let start = tok.center;
          // Its rotation in radians
          let r = Math.toRadians(token.data.rotation);
          // Its normalized direction vector
          let dir = {x:Math.sin(r), y:Math.cos(r)};

          // And lets go
          traceLight(start, dir, chain);
    }
  }

  if (token.getFlag(module_name, 'is_mirror') && isChangeTransform(change) ){    
    updateMirror(tok);
  }

});


// Settings:
Hooks.once("init", () => {    
  game.settings.register(module_name, "ray_bounces", {
    name: "Max ray bounce",
    hint: "The maximum number a ray can be reflected",
    scope: 'world',
    config: true,
    type: Number,
    default: 10
  });  
});


// Hook into the token config render
Hooks.on("renderTokenConfig", (app, html) => {
  // Create a new form group
  const formGroup = document.createElement("div");
  formGroup.classList.add("form-group");

  // Create a label for this setting
  const label = document.createElement("label");
  label.textContent = "Laser";
  formGroup.prepend(label);

  // Create a form fields container
  const formFields = document.createElement("div");
  formGroup.classList.add("form-fields");
  formGroup.append(formFields);

  // Create a lamp input box
  const input = document.createElement("input");
  input.name = "flags.lasers.is_lamp";
  input.type = "checkbox";
  input.title = 'Is this a lamp/laser';
  formFields.append(input);  
  // Insert the flags current value into the input box  
  if ((app.object.data.flags.lasers)&&(app.object.data.flags.lasers.is_lamp)){ input.checked="true"; } //lets take the long way around
  
  // Create mirror input box
  const mirr = document.createElement("input");
  mirr.name = "flags.lasers.is_mirror";
  mirr.type = "checkbox";
  mirr.title = 'Is this a mirror';
  formFields.append(mirr);  
  // Insert the flags current value into the input box  
  if ((app.object.data.flags.lasers)&&(app.object.data.flags.lasers.is_mirror)){ mirr.checked="true"; } //lets take the long way around

  // Add the form group to the bottom of the Identity tab
  html[0].querySelector("div[data-tab='character']").append(formGroup);

  // Set the apps height correctly
  app.setPosition();
});
//*/

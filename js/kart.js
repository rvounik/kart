
// init general vars & constants
var pi            = 3.14, // shortened pi to speed up math
  ts              = 0, // initial sine offset
  texWidth        = 1024, // keep this tied to real texture size
  texHeight       = 1024,
  screenWidth     = 800, // width of entire element
  screenHeight    = 600,
  w               = 800, // the actual projection width
  h               = 360, // the actual projection height
  linecount       = 360,  // how many lines? if not equal to h, pixels may be doubled
  lineList        = [], // will hold the 'scanline' instances
  bmpList         = [], // will hold the masked bitmaps
  speed           = 0, // player speed
  maxspeed        = 85, // vary per vehicle
  speedinc        = 0.24, // vary per vehicle
  handling        = 7, // the higher, the more understeer the car gets (default = 7)
  slowdown_sand   = 12, // the higher, the less effect sand has on the speed (default = 10)
  loadingInterval = 0, preload, // set preload interval
  mapsize         = 128, // size of the minimap
  maxzoom         = 20, // max zoom in factor. determines output quality and 'height' of projection
  globalFps       = 30, // set global fps
  oldregx         = 99999, // used for checking pivot point
  gamestarted     = false, // indicates whether game has started and player has controls
  debug           = false, // by default, debug should be false
  startx          = 930,  // start x,y for player. this should come from external data file in the end and needs to vary per level
  starty          = 585,
  sound           = true, // disable / enable sound at start
  tilt            = 0, // when increased, will countdown and rotate view around player like in mario kart - banana mode
  rmpl            = 0, // offset for righthand direction
  lmpl            = 0, // offest for lefthand direction
  laptimes        = [], // holds laptimes
  objList         = [], // holds roadside objects
  fov             = 100, // field of vision (used for objects only)
  objects         = false, // enable / disable objects
  particleList    = [], // holds particles for various effects
  z               = 2250; // start with a zoomed-out view of the track

// set some vars that handle key mapping
var KEYCODE_LEFT = 37, KEYCODE_RIGHT = 39, KEYCODE_UP = 38, KEYCODE_DOWN = 40, KEYCODE_W = 87, KEYCODE_A = 65, KEYCODE_S = 83, KEYCODE_D = 68, KEYCODE_I = 73, KEYCODE_M = 77,
  upHeld    = false,
  downHeld  = false,
  leftHeld  = false,
  rightHeld = false;

// disable page movement using cursor keys
window.addEventListener("keydown", function(e) {
  if([37, 38, 39, 40, 65, 68, 73, 77, 83, 84, 87].indexOf(e.keyCode) > -1) {
    e.preventDefault();
  }
}, false);

// preload all assets
function preload() {

  // open screen
  canvas = document.getElementById("myCanvas");
  stage = new createjs.Stage(canvas);
  context = canvas.getContext("2d");

  // add preload assets
  progresstext = new createjs.Text('please wait', "40px VT323", "#fff");
  progresstext.x = 300;
  progresstext.y = 210;
  stage.addChild(progresstext);
  progressbar = new createjs.Shape();
  progressbar.graphics.beginFill("#000").drawRect(280, 320, 200, 25);
  stage.addChild(progressbar);
  progress = new createjs.Shape();
  stage.addChild(progress);
  stage.update(); // update so preloader is shown

  // define all preloaded assets
  var manifest = [
    {id:"world", src:"img/mariokart_1024.png"},
    {id:"map_sand", src:"img/mariokart_1024_sand.png"},
    {id:"minimap", src:"img/mariokart_minimap.png"},
    {id:"sky", src:"img/texture_sky.jpg"},
    {id:"accelerate", src:"audio/accelerate.mp3"},
    {id:"sand", src:"audio/sand.mp3"},
    {id:"skid", src:"audio/skid.mp3"},
    {id:"beginrace", src:"audio/beginrace.mp3"},
    {id:"level01", src:"audio/level01.mp3"},
    {id:"distantfogging", src:"img/kart_distantfogging.png"},
    {id:"mountain", src:"img/kart_mountains.png"},
    {id:"smoke", src:"img/kart_smokesheet.png"},
    {id:"map_walls", src:"img/mariokart_1024_walls.png"},
    {id:"map_kerbs", src:"img/mariokart_1024_kerbs.png"},
    {id:"tree", src:"img/tree.png"},
    {id:"kart", src:"img/kart_spritesheet.png"},
    {id:"kerb", src:"audio/kerbstone.mp3"},
    {id:"beep", src:"audio/beep.mp3"}
  ];

  // preload the assets
  preload = new createjs.LoadQueue();
  preload.installPlugin(createjs.Sound);
  preload.installPlugin(createjs.Image);
  preload.addEventListener("complete", doneLoading);
  preload.addEventListener("progress", updateLoading);
  preload.loadManifest(manifest);

}

function updateLoading(event) {
  progress.graphics.clear();
  progress.graphics.beginFill("#fff").drawRect(280, 320, 200 * (event.loaded / event.total), 25); // update loading graph
  stage.update();
}

function doneLoading(event) {

  // clean up preload assets
  clearInterval(loadingInterval);
  stage.removeChild(progress);
  stage.removeChild(progressbar);
  stage.removeChild(progresstext);

  // create ticker
  createjs.Ticker.addEventListener("tick", handleTick);
  createjs.Ticker.setFPS(globalFps);
  createjs.Ticker.useRAF = true; // use Request Animation Frame - doesnt seem to be faster!

  // create main container
  mainContainer = new createjs.Container();
  mainContainer.x = mainContainer.y = 0;
  stage.addChild(mainContainer);

  // create projection container
  projContainer = new createjs.Container();
  projContainer.x = 0;
  projContainer.y = screenHeight - h; // bottom align
  stage.addChild(projContainer);

  // create obj container
  objContainer = new createjs.Container();
  objContainer.x = objContainer.y = 0;
  stage.addChild(objContainer);

  // create sprite container for player sprite
  spriteContainer = new createjs.Container();
  spriteContainer.x = spriteContainer.y = 0;
  stage.addChild(spriteContainer);

  // create particle container for particle effects
  particleContainer = new createjs.Container();
  particleContainer.x = particleContainer.y = 0;
  stage.addChild(particleContainer);

  // create player object which handles location in 2d space
  player = {
    x:        0,
    y:        0,
    rotation: -180
  };

  // create mini map container
  mapContainer   = new createjs.Container();
  mapContainer.x = screenWidth - mapsize;
  mapContainer.y = screenHeight - mapsize;
  stage.addChild(mapContainer);

  // add mini map asset to mini map container
  map = preload.getResult("minimap");
  map = new createjs.Bitmap(map);
  map.alpha = 0.4;
  mapContainer.addChild(map);

  // add sand map asset (for collision detection)
  map_sand = preload.getResult("map_sand");
  map_sand = new createjs.Bitmap(map_sand);

  // add wall map asset (for collision detection)
  map_walls = preload.getResult("map_walls");
  map_walls = new createjs.Bitmap(map_walls);

  // add kerbs map asset (for collision detection)
  map_kerbs = preload.getResult("map_kerbs");
  map_kerbs = new createjs.Bitmap(map_kerbs);

  // create virtual player instance
  mapplayer = new createjs.Shape();
  mapplayer.graphics.beginFill('#fff').drawRect(0, 0, 2, mapsize / 20).endFill();
  mapplayer.alpha = 0.4;
  mapplayer.graphics.endStroke();
  mapContainer.addChild(mapplayer);
  mapplayer.x        = startx;
  mapplayer.y        = starty;
  mapplayer.rotation = player.rotation;

  // register document key functions
  document.onkeydown = handleKeyDown;
  document.onkeyup   = handleKeyUp;

  // create sky
  sky = preload.getResult("sky");
  sky = new createjs.Bitmap(sky);
  mainContainer.addChild(sky);

  // create the 'scanlines'
  for(y = 0; y < linecount; y ++) {
    // create mask 'line'
    line = new createjs.Shape();
    line.y = y * h / linecount;
    line.graphics.clear().beginFill('#308c30').drawRect(0, 0, w, h / linecount).endFill(); // set new color
    projContainer.addChild(line);
    lineList.push(line);
    // create bitmap
    bmp = preload.getResult("world");
    bmp = new createjs.Bitmap(bmp);
    projContainer.addChild(bmp);
    bmp.mask  = line;
    bmp.liney = y;
    bmp.x = screenWidth / 2;
    bmp.y = screenHeight / 2;
    bmpList.push(bmp);
  }

  // create overlay distant fogging
  distant = preload.getResult("distantfogging");
  distant = new createjs.Bitmap(distant);
  distant.scaleX = 100;
  projContainer.addChild(distant);

  // create overlay mountains
  mountain = preload.getResult("mountain");
  mountain = new createjs.Bitmap(mountain);
  mountain.y = 190;
  mainContainer.addChild(mountain);

  // add objects (start with one. later just read all objects from a defined array)
  tree = preload.getResult("tree");
  tree = new createjs.Bitmap(tree);
  tree.world_x = 10; // the position of the object on the 2d map (should not change! (for now..))
  tree.world_y = 10;
  objList.push(tree);
  tree.regX = 64;
  tree.regY = 128;
  if(objects){objContainer.addChild(tree)} // uncomment to show objects

  // init spritesheet for player kart animations
  ss_kart = new createjs.SpriteSheet({
    "animations":
    {
      tile0: 0,
      tile1: 1,
      tile2: 2,
      tile3: 3,
      tile4: 4,
      tile5: 5,
      tile6: 6,
      tile7: 7,
      tile8: 8,
      tile9: 9,
      tile10: 10,
      tile11: 11
    },
    "images": [preload.getResult("kart")],
    "frames":
    {
      height: 150,
      width:  200,
      regX:   100,
      regY:   0
    }
  });

  // init spritesheet for smoke effect
  ss_smoke = new createjs.SpriteSheet({
    "animations":
    {
      "smoke": {
        frames: [0, 1, 2, 3],
        next: "gone",
        speed: 0.4
      },
      "gone": {
        frames: [4],
        next: "gone",
        speed: 0
      }
    },
    "images": [preload.getResult("smoke")],
    "frames":
    {
      height: 63,
      width:  63,
      regX:   32,
      regY:   32
    }
  });

  // add player shadow
  shade = new createjs.Shape();
  shade.graphics.beginFill("#000000").drawEllipse(0, 0, 150, 50);
  shade.alpha = 0.05;
  shade.x = screenWidth / 2 - 75;
  shade.y = 470;
  stage.addChild(shade);

  // add player sprite
  kartsprite = new createjs.Sprite(ss_kart, "tile0");
  kartsprite.x = screenWidth / 2;
  kartsprite.y = 350;
  spriteContainer.addChild(kartsprite);

  starttext = new createjs.Text("READY?", "80px VT323", "#fff");
  starttext.x = w / 2 - (starttext.getMeasuredWidth()  / 2);
  starttext.y = h / 2 - (starttext.getMeasuredHeight() / 2);
  stage.addChild(starttext);

  // create fps and debug counters
  fps = new createjs.Text("fps", "8px Arial", "#fff");
  fps.y = 3;
  fps.x = 10000;
  stage.addChild(fps);

  rmplc = new createjs.Text("rmpl", "28px Arial", "#fff");
  rmplc.y = 60;
  rmplc.x = 10000;
  stage.addChild(rmplc);
  lmplc = new createjs.Text("lmpl", "28px Arial", "#fff");
  lmplc.y = 90;
  lmplc.x = 10000;
  stage.addChild(lmplc);

  // create timer
  timer = new createjs.Text("00:00:00", "60px VT323", "#fff");
  timer.y = 3;
  timer.x = 580;
  stage.addChild(timer);

  // create fastest lap text
  fastlap = new createjs.Text("", "23px VT323", "#F0E500");
  fastlap.x = 585;
  fastlap.y = 60;
  stage.addChild(fastlap);

  // create speedo
  speedo = new createjs.Text("0", "60px VT323", "#fff");
  speedo.y = 3;
  speedo.x = 13;
  stage.addChild(speedo);

  stage.update();
  projContainer.cache(0, 0, w, h);

  // init sounds
  createjs.Sound.setVolume(0); // mute all while init

  // start race sample
  createjs.Sound.play("beginrace");

  accelerate = createjs.Sound.play("accelerate", {loop: -1, volume: 1});

  // driving in sand
  createjs.Sound.play("sand");
  sandsample = createjs.Sound.play("sand", {loop: -1, volume: 0});

  // skidding
  createjs.Sound.play("skid");
  skidsample = createjs.Sound.play("skid", {loop: -1, volume: 0});

  // kerbing
  createjs.Sound.play("kerb");
  kerbsample = createjs.Sound.play("kerb", {loop: -1, volume: 0});

  if(sound){createjs.Sound.setVolume(1)}

}

function handleKeyDown(e) {
  switch(e.keyCode) {
    case KEYCODE_LEFT:	leftHeld  = true; break;
    case KEYCODE_A:	    leftHeld  = true; break;
    case KEYCODE_RIGHT: rightHeld = true; break;
    case KEYCODE_D:     rightHeld = true; break;
    case KEYCODE_UP:	  upHeld    = true; break;
    case KEYCODE_W:	    upHeld    = true; break;
    case KEYCODE_DOWN:  downHeld  = true; break;
    case KEYCODE_S:     downHeld  = true; break;
  }
}

function handleKeyUp(e) {
  switch(e.keyCode) {
    case KEYCODE_LEFT:	leftHeld  = false; break;
    case KEYCODE_A:   	leftHeld  = false; break;
    case KEYCODE_RIGHT: rightHeld = false; break;
    case KEYCODE_D:     rightHeld = false; break;
    case KEYCODE_UP:	  upHeld    = false; break;
    case KEYCODE_W:	    upHeld    = false; break;
    case KEYCODE_DOWN:  downHeld  = false; break;
    case KEYCODE_S:     downHeld  = false; break;
    case KEYCODE_I:     if(!debug) {debug = true} else {debug = false; fps.x = 10000} break; // debug mode on/off
    case KEYCODE_M:     if(!sound) {sound = true; createjs.Sound.setVolume(1)} else {sound = false; createjs.Sound.setVolume(0)} break; // sound on/off
  }
}

function handleIntroZoom() {

  if(!gamestarted && z > maxzoom){
    mountain.x -= z / 100;
    if(   (z < (maxzoom + 10)) && mountain.y > 180){mountain.y -= 0.5}
    z -= ((z - maxzoom) / 8);
    if(z < (maxzoom + 16 )){starttext.text = "3"}
    if(z < (maxzoom + 3  )){starttext.text = "2"}
    if(z < (maxzoom + 0.5)){starttext.text = "1"}
    if(z - 0.1 < maxzoom){
      z = maxzoom; // stop zooming when almost done to prevent infinite waiting for zoom to finish
      starttext.text = "GO!"; // change text
      gamestarted = true; // activate controls
      starttime = createjs.Ticker.getTime();
      readytocountlap = false; // be ready to count the lap when player has reached halfway point (that is not here)
      createjs.Sound.play("level01", {loop: -1, volume: 0.5});
    }

    // center text
    starttext.x = w / 2 - (starttext.getMeasuredWidth()  / 2);
    starttext.y = h / 2 - (starttext.getMeasuredHeight() / 2);
  }

  if(starttext.alpha > 0 && (z == maxzoom || gamestarted && starttext.alpha > 0)){
    starttext.alpha -= 0.05;
    mapplayer.x = player.x / (texWidth   / mapsize);
    mapplayer.y = player.y / (texHeight  / mapsize);
  }

  if(!gamestarted && player.x != startx){
    player.x += (startx - player.x) / 10;
  }

  if(!gamestarted && player.y != starty){
    player.y += (starty - player.y) / 10;
  }

}

function handleDebug(){

  // debug: show pivot point (regX/Y) on mini map
  if(oldregx != bmp.regX){
    oldregx = bmp.regX;
    pivot = new createjs.Shape();
    pivot.graphics.beginFill('#0000ff').drawRect(bmp.regX / (texWidth  / mapsize), bmp.regY / (texHeight  / mapsize), 4, 4).endFill();
    pivot.graphics.endStroke();
    mapContainer.addChild(pivot);
  }

  // show fps
  if(fps.x == 10000){fps.x = 1;}
  fps.text = Math.round(createjs.Ticker.getMeasuredFPS())+" fps";

  if(rmplc.x == 10000){rmplc.x = 1; lmplc.x = 1}
  rmplc.text = parseInt(rmpl);
  lmplc.text = parseInt(lmpl);

}

function calcTrans(){

  // x
  a = 0 - (player.rotation - 180);
  b = a * (pi / -180);
  c = Math.sin(b);
  d = c * speed / (12 - ((rmpl + lmpl) / 50)  );
  if(
    ((player.x + d) <= texWidth) &&
      ((player.x + d) >= 0) &&
      (!map_walls.hitTest((player.x + d), player.y))
    ){
    player.x += d;
  }

  // y
  a = (player.rotation - 180);
  b = a * (pi / -180);
  c = Math.cos(b);
  d = c * speed / (12 - ((rmpl + lmpl) / 50)  );
  if(
    ((player.y - d) <= texHeight) &&
      ((player.y - d) >= 0) &&
      (!map_walls.hitTest(player.x, (player.y - d)))
    ){
    player.y -= d;
  }

  // update player on mini map
  mapplayer.x = player.x / (texWidth   / mapsize);
  mapplayer.y = player.y / (texHeight  / mapsize);

}

function handleSky() {
  if(leftHeld){
    sky.x += 10;
  } else {
    sky.x -= 10;
  }
  if(sky.x < -1765 || sky.x >= 0){sky.x = -894;}
}

function handleParallax() {
  mi = 15;
  if(rightHeld){mi = 0 - mi} // other way
  if(speed < 0){mi = 0 - mi} // when reversing, reverse the movement
  mountain.x += mi;
  if(mountain.x < -2079 || mountain.x >= 0){mountain.x = -1035;}
}

function msToTimer(ms){
  x = ms / 10;
  mseconds = parseInt(x % 100);
  if(mseconds < 10){mseconds = '0' + mseconds}
  x = ms / 1000;
  seconds = parseInt(x % 60);
  if(seconds < 10){seconds = '0' + seconds}
  x /= 60;
  minutes = parseInt(x % 60);
  if(minutes < 10){minutes = '0' + minutes}
  return minutes + ':' + seconds + ':' + mseconds;
}

// calculate difference between 2 values
function diff(a, b) {
  return Math.abs(a - b);
}

function lineDiff( point1_x, point1_y, point2_x, point2_y ) {
  var xs = 0;
  var ys = 0;

  xs = point2_x - point1_x;
  xs = xs * xs;

  ys = point2_y - point1_y;
  ys = ys * ys;

  return Math.sqrt( xs + ys );
}

function createParticles(t) {

  if(t == 1){
    // sand
    particle = new createjs.Shape();
    particle.graphics.beginFill("#794e0b").drawRect(0, 0, 5, 5);
    particle.type = 1;
    particle.rotation = 360 * Math.random();
    particle.x = screenWidth / 2 + 100 - (200 * Math.random());
    particle.y = 500 + 50 - (100 * Math.random());
    particle.yadd = (25 + (25 * Math.random())) / 10;
    // by creating 5 similar (?) shapes the effect looks much better when cornering
    for(pc = 0; pc < 5; pc ++){
      particleContainer.addChild(particle);
      particleList.push(particle);
    }
  }

  if(t == 2){
    // smoke
    particle = new createjs.Sprite(ss_smoke, "smoke");
    particle.alpha = 0.8;
    particle.type = 2;
    particle.x = screenWidth / 2 + 100 - (200 * Math.random());
    particle.y = 500 + 50 - (100 * Math.random());
    particle.yadd = (25 + (25 * Math.random())) / 10;
    // by creating 5 similar (?) shapes the effect looks much better when cornering
    for(pc = 0; pc < 5; pc ++){
      particleContainer.addChild(particle);
      particleList.push(particle);
    }
  }

  if(t == 3){
    // rubber
    for(rc = 0; rc <= 1; rc ++){
      particle = new createjs.Shape();
      particle.graphics.beginFill("#000000").drawRect(0, 0, 30, 50);
      particle.alpha = 0.3;
      particle.type = 3;
      particle.x = ((screenWidth / 2) + 38) - (rc * 108);
      particle.y = 488;
      particle.yadd = 0;
      particleContainer.addChild(particle);
      particleList.push(particle);
    }
  }

}


function handleParticles() {

  for(sl = 0; sl < particleList.length; sl ++){

    if( ((particleList[sl].y) <= screenHeight + 100) && particleList[sl].alpha > 0){

      if(particleList[sl].yadd > - 25){
        particleList[sl].yadd -= 2;
      }

      // sand
      if(particleList[sl].type == 1){
        particleList[sl].y -= particleList[sl].yadd / 2;
        if(particleList[sl].rotation > 180){
          particleList[sl].x += (1000 - particleList[sl].y) / 300;
          particleList[sl].rotation += (10 + particleList[sl].rotation) / 50;
        } else {
          particleList[sl].x -= (1000 - particleList[sl].y) / 300;
          particleList[sl].rotation -= (10 + particleList[sl].rotation) / 50;
        }
      }

      // smoke
      if(particleList[sl].type == 2){
        particleList[sl].y -= particleList[sl].yadd / 6;
        particleList[sl].scaleX = particleList[sl].scaleY += 0.01;
        particleList[sl].alpha -= 0.02;
      }

      // rubber
      if(particleList[sl].type == 3){
        particleList[sl].y -= particleList[sl].yadd * 2;
      }

      // cornering moves particles to either side
      if(particleList[sl].type != 3){
        if(leftHeld){particleList[sl].x += lmpl}
        if(rightHeld){particleList[sl].x -= rmpl}
      } else if(particleList[sl].type == 3){
        if(leftHeld){particleList[sl].x += lmpl / 2}
        if(rightHeld){particleList[sl].x -= rmpl / 2}
      }

    } else {
      particleContainer.removeChild(particleList[sl]);
      particleList.splice(sl, 1);
    }
  }

}

function handleObjects() {

  // note: this routine is currently not used / optimised

  // clear objContainer
  objContainer.removeAllChildren(); // clear all tiles of objContainer

  for(oi = 0; oi < objList.length; oi ++){
    objx = objList[oi].world_x;
    objy = objList[oi].world_y;
    // calculate direction from player towards object in case of full frontal approach
    var deltaX = player.x - objx;
    var deltaY = player.y - objy;
    var rad = Math.atan2(deltaY, deltaX); // In radians
    var deg = rad * (180 / Math.PI) - 270;

    // see if it fits within player orientation + fov
    // first we make them positive if needed

    // because of difference in negativism the calculated diff is way too big.therefore we make both values positive first

    //if(player.rotation < 0){prot = player.rotation + 360} else {prot = player.rotation} // refactored as:
    prot = player.rotation;
    if(player.rotation < 0){prot += 360}

    if(deg < 0){orot = deg + 360} else {orot = deg}
    // now its possible to correctly calculate the difference in player rotation and view rotation needed to approach the obj full frontal
    // when approached full frontal, de should therefore be 0. the more you veer off right or left, the higher de will be and the more the object will be projected towards the sides of the screen (and beyond)
    // and if beyond screen edges, we do not care about scaling and such
    de = diff(prot, orot);
    if(prot < orot){de = 0 - de} // we need negative values if rotation is lower than player rotation
    //console.log('prot = '+parseInt(prot)+', orot = '+parseInt(orot)+',de='+parseInt(de));

    // todo: below formula (value of ff) goes wrong when up close an object. that number 10 should be lower when nearing an object and increase when going away
    ff = 10;
    objList[oi].x = (screenWidth / 2) - (de*ff); // de multiplier should be smallest possible number to make object appear off screen when de is larger than half the fov. test using: if(de>(fov/2)){console.log('object should not be visible! adjust de multiplier until its off screen!!')};
    // .. and calculate distance from player (z)..
    objz = lineDiff(player.x,player.y,objx,objy);
    if(objz < h){
      objList[oi].y = (h-objz)/((objz)/25); // play around with that mulitiplier till the effect looks good
      ff = (10 - ((h-objz)/h)*10);
      objList[oi].x = (screenWidth / 2) - (de*ff);
    } else {
      objList[oi].y = 0;
    }
    // .. and scale object..
    sc = (1-(objz/1000));
    if(sc<0){sc=0}
    objList[oi].scaleX=objList[oi].scaleY=sc;
    // todo: to do z-sorting, you need to clear and rebuilt the obj layer (objContainer) of all visible instances on every frame. for this you need to built up a temparray that you can sort by z.
  }

}

function handleTick() {

  if(gamestarted){

    z = maxzoom - (speed / 18); // nice bumpy effect when accelerating

    if(leftHeld){
      lmpl += speed / 150;
      if(upHeld){lmpl += speed / 150} // accelerating into corners increases instability
      if(lmpl > 10){lmpl = 10} // handle multiplier that enforces steering and depletes its effect gradually after letting go
      if(speed >= 0){
        player.rotation -= (1 + ((lmpl / handling) * (speed / 25)));
        speed -= ((10 - lmpl) / 100); // loose some speed when cornering
      } else {
        player.rotation += (1 + (speed / 25));
      }
      if(player.rotation > 360) {player.rotation = player.rotation - 360}
      if(player.rotation <= 0)  {player.rotation = 360 - player.rotation}
      mapplayer.rotation = player.rotation;
      handleSky();
      handleParallax();
    }

    if(!leftHeld && lmpl > 0){
      lmpl -= 1;
      if(lmpl < 0){lmpl = 0}
    }

    if(rightHeld){
      rmpl += speed / 150;
      if(upHeld){rmpl += speed / 150} // accelerating into corners increases instability
      if(rmpl > 10){rmpl = 10} // handle multiplier that enforces steering and depletes its effect gradually after letting go
      if(speed >= 0){
        player.rotation += (1 + ((rmpl / handling) * (speed / 25)));
        speed -= ((10 - rmpl) / 100); // loose some speed when cornering
      } else {
        player.rotation -= (1 + (speed / 25));
      }
      if(player.rotation > 360) {player.rotation = player.rotation - 360}
      if(player.rotation <= 0)  {player.rotation = 360 - player.rotation}
      mapplayer.rotation = player.rotation;
      handleSky();
      handleParallax();
    }

    if(!rightHeld && rmpl > 0){
      rmpl -= 1;
      if(rmpl < 0){rmpl = 0}
    }

    if(upHeld){
      speed += speedinc * ((maxspeed - speed) / 20); // acceleration gradually becomes slower
      if(speed > maxspeed){speed = maxspeed}
    }

    if(!upHeld){
      if(speed > 0){
        speed -= speedinc;
        if(speed < 0){speed = 0} // backwards acceleration!
      }
    }

    if(downHeld){
      speed -= 5 * speedinc;
      if(speed > 40){
        createParticles(2);
        createParticles(3);
      }
      if(speed < -10){speed = -10} // reverse acceleration
    }

    if(!downHeld){
      if(speed < 0){
        speed += 2 * speedinc;
        if(speed > 0){speed = 0} // reverse slowdown
      }
    }

    // calculate translation
    calcTrans();

    // check for collisions and sound effects
    if(map_sand.hitTest(player.x, player.y)){
      if(speed > (slowdown_sand * 3)){speed -= slowdown_sand}
      skidsample.setVolume(0); // turn off other sound effects
      kerbsample.setVolume(0);
      sandsample.setVolume(0);
      if(speed > 5){
        createParticles(1);
        if(sound){sandsample.setVolume(0.5)}
      }
    } else {
      // no sand collisions, so check for skidding and kerbing effects
      sandsample.setVolume(0);
      if((rmpl > 7 || lmpl > 7) || (downHeld && speed > 40)){
        if(sound){skidsample.setVolume(0.5)}
        createParticles(2); // smoke
        if(rmpl > 9 || lmpl > 9){createParticles(3)} // rubber particles
        if(speed > 1){speed -= 1} // extra decrease in speed when cornering hard
      } else {
        skidsample.setVolume(0.0);
      }
      // check kerb sound
      kerbsample.setVolume(0);
      if(sound && map_kerbs.hitTest(player.x, player.y)){
        kerbsample.setVolume(1);
      }
    }

    // match sprite with rmpl / lmpl
    if(rmpl > lmpl){
      ntile = Math.floor(rmpl / 2);
      kartsprite.scaleX = 1;
    } else {
      ntile = Math.floor(lmpl / 2);
      kartsprite.scaleX = -1;
    }

    spriteContainer.removeAllChildren();
    kartsprite = new createjs.Sprite(ss_kart, "tile" + ntile);
    kartsprite.x = screenWidth / 2;
    kartsprite.y = 350;
    spriteContainer.addChild(kartsprite);

    kartsprite.scaleX = 1;
    if(rmpl < lmpl){
      kartsprite.scaleX = -1;
    }

    // update speedo
    if(speed >= 0){speedo.text = parseInt(speed)}

    // handle timer
    ms = createjs.Ticker.getTime() - starttime;
    timer.text = msToTimer(ms);

    // check if lap is halfway / get ready to increase lap counter
    if(player.x < 170 && player.y > 300 && player.y < 350){
      readytocountlap = true;
    }

    // advance lap counter
    if(readytocountlap && player.x > (startx - 150) && player.x < (startx + 100) && player.y > (starty - 150) && player.y < (starty - 50)) {
      // check for record laptime
      highscore = true;
      for(tl = 0; tl < laptimes.length; tl ++){
        if(laptimes[tl] < ms){
          highscore = false;
          break;
        }
      }
      // store laptime
      laptimes.push(parseInt(ms));
      if(highscore) {
        fastlap.text = 'FASTEST LAP ' + msToTimer(ms);
        if(sound){
          createjs.Sound.play("beep");
          beepsample = createjs.Sound.play("beep", {loop: 0, volume: 1});
        }
      }
      readytocountlap = false; // ready for next lap
      starttime = createjs.Ticker.getTime(); // subtract time
    }

  }

  // update 'scanlines'
  li = 0;
  while(li < bmpList.length){
    bmp = bmpList[li];
    bmp.regX = player.x;
    bmp.regY = player.y;
    bmp.scaleX = bmp.scaleY = 1 + bmp.liney / z;
    bmp.rotation = 0 - (player.rotation - 180); // inverted because map is projected upside-down
    li ++;
  }

  handleParticles();

  if(objects){
    handleObjects()
  }

  // tilt active? deplete timer
  if(tilt > 0){tilt -= 1}

  // update various other assets
  if(!gamestarted || starttext.alpha > 0){handleIntroZoom()}
  if(debug){handleDebug()}

  // play engine sound sample with starting point set to speed relative to max speed normalised with sample length (3000ms) with some added randomness
  startsample = ((speed / maxspeed) * 3000) + (200 * Math.random());
  accelerate.setPosition(startsample);

  stage.update();
  projContainer.updateCache();

}



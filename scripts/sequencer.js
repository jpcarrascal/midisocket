var code = "seq";
var tracks = [];
var trackList = document.getElementById("track-list");
var bgLoopLocation = "sounds/default/bg.mp3";
var bgPlaying = false;
//var audio = document.getElementById("audio-player");
//audio.pause();
//audio.setAttribute("src", bgLoopLocation);


// Am I a sequencer?
var isSeq = location.pathname.includes("sequencer");
var initials = "";
var session = findGetParameter("session") || DEFAULT_ROOM;

var socket = io("", {query:{code: code, session:session}});
var mySocketID;
socket.on("connect", () => {
  console.log("Connected, my socketid:" + socket.id);
  mySocketID = socket.id;
});
// TODO: take over existing tracks:
/*
socket.on('joined tracks', function(msg) {
  console.log("Joines tracks: ");
  console.log(msg);
});
*/
socket.on('track joined', function(msg) {
  //{ initials: initials, track:track, socketid: socket.id }
  console.log("Track joined: " + msg.socketid);
  tracks.push({socketID: msg.socketid, ready: false});
  updateTracks(tracks);
});

socket.on('sequencer exists', function(msg) {
  document.location.href = "/?exitreason=" + msg.reason;
});

socket.on('track ready', function(msg) {
  if(msg.ready) {
    tracks.find(function(value, index, arr){ return value.socketID == msg.socketID;}).ready = true;
    document.getElementById(msg.socketID).classList.add("track-ready");
    console.log("Track ready: " + msg.socketID);
  }
  else {
    tracks.find(function(value, index, arr){ return value.socketID == msg.socketID;}).ready = false;
    document.getElementById(msg.socketID).classList.remove("track-ready");
    console.log("Track not ready: " + msg.socketID);
  }
});

socket.on('track left', function(msg) {
  //{ initials: initials, track:track, socketid: socket.id }
  console.log("Track left: " + msg.socketid);
  console.log(tracks);
  tracks = tracks.filter(function(value, index, arr){ return value.socketID != msg.socketid;});
  console.log(tracks);
  updateTracks(tracks);
});

function updateTracks(tracks) {
  trackList.innerHTML = tracks.map(function(value, index, arr) {
    var itemClass = "track-item track-not-ready";
    if(value.ready) {
      itemClass = "track-item track-ready";
    }
    return "<li class='" + itemClass + "' id='" + value.socketID + "'>"+value.socketID+"</li>";
  }).join("");
}

var stepSequencer = new StepSequencer(NUM_TRACKS, NUM_STEPS, drumNotes);
initials = "SQ";
var hideInfo = findGetParameter("hideinfo");
document.getElementById("session-name").innerText = session;
var info = document.getElementById("session-info");
var urlTmp = document.location.origin;
//urlTmp = urlTmp.replace("localhost","jina-5.local");
console.log(urlTmp)
var trackURL = urlTmp + "/track?session="+session;
let qrcodeURL = "https://qrcode.azurewebsites.net/qr?width=300&margin=1&string=" + encodeURIComponent(trackURL);
//var qrcodeURL = 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data='+trackURL;
var qrcode = document.createElement("img");
qrcode.setAttribute("src",qrcodeURL);
qrcode.setAttribute("id","qrcode");
document.getElementById("qrcode-wrapper").appendChild(qrcode);
document.getElementById("track-url").setAttribute("href",trackURL);
document.getElementById("track-url").innerText = trackURL;
document.getElementById("url-copy").innerText = trackURL;
document.getElementById("copy").addEventListener("click", function(e) {
  copyURL("url-copy");
  this.innerText = "COPIED!";
  p=setTimeout( function() { document.getElementById("copy").innerText = "COPY TO CLIPBOARD" }, 2000);
  console.log(p)
});

if(hideInfo) {
  info.style.display = "none";
} else {
  info.style.display = "flex";
}

var playBackground = document.getElementById("play-bg");
var stopBackground = document.getElementById("stop-bg");
playBackground.setAttribute("disabled",true);
var playButton = document.getElementById("play-button");
var stopButton = document.getElementById("stop-button");
var veilOnButton = document.getElementById("veil-on-button");
var veilOffButton = document.getElementById("veil-off-button");
var switchSounds = document.getElementById("switch-sounds");

playBackground.addEventListener("click",function(event){
  if(!srcNode) {
    playLoop(audioData);
    console.log("Playing bg loop");
    this.style.backgroundColor = "lime";
  }
});

stopBackground.addEventListener("click",function(event){
  if (srcNode) {
    gainNode.gain.value = defaultGain;
    gainNode.gain.linearRampToValueAtTime(0, actx.currentTime+5);
    playBackground.style.backgroundColor = "white";
    playBackground.setAttribute("disabled",true);
    console.log("Fading out bg loop, stopping in 5 seconds...");
    setTimeout(function() {
      srcNode.stop();
      srcNode = null;   
      gainNode = null;
      console.log("BG loop stopped!");
      playBackground.removeAttribute("disabled");
    }, 5000);
  }
});

playButton.addEventListener("click",function(event){
  this.style.backgroundColor = "lime";
  console.log("Playing");
  socket.emit('play', { socketID: mySocketID });
  trackList.className = '';
  trackList.classList.add("transition-cyan");
});

stopButton.addEventListener("click",function(event){
  playButton.style.backgroundColor = "white";
  console.log("Stopping");
  socket.emit('stop', { socketID: mySocketID });
});

/*
veilOnButton.addEventListener("click",function(event){
  this.style.backgroundColor = "lime";
  console.log("Veil ON");
  socket.emit('veil-on', { socketID: mySocketID });
});

veilOffButton.addEventListener("click",function(event){
  veilOnButton.style.backgroundColor = "white";
  console.log("Veil OFF");
  socket.emit('veil-off', { socketID: mySocketID });
});
*/

switchSounds.addEventListener("click",function(event){
  console.log("Switching sounds");
  socket.emit('switch-sounds', { socketID: mySocketID });
});

document.querySelectorAll(".color-button").forEach(element => {
  element.addEventListener("click", function(event){
    color = element.getAttribute("color");
    console.log("Changing color to " + color);
    //trackList.style.backgroundColor = color;
    trackList.className = '';
    trackList.classList.add("transition-"+color);
    if(color == "black") {
      trackList.style.color = "#ffffff";
    } else {
      trackList.style.color = "#000000";
    }
    socket.emit('color-change', { socketID: mySocketID, color: color });
  });  
});


// ----------------- BG LOOP -----------------


var actx = new (AudioContext || webkitAudioContext)(),
    src = bgLoopLocation,
    audioData, srcNode, gainNode, defaultGain = 1;  // global so we can access them from handlers

// Load some audio (CORS need to be allowed or we won't be able to decode the data)
fetch(src, {mode: "cors"}).then(function(resp) {
  playBackground.removeAttribute("disabled");
  return resp.arrayBuffer();
}).then(decode);

// Decode the audio file, then start the show
function decode(buffer) {
  actx.decodeAudioData(buffer, function(abuffer) {if (!audioData) audioData = abuffer});
}

// Sets up a new source node as needed as stopping will render current invalid
function playLoop(abuffer) {
  if (!audioData) audioData = abuffer;  // create a reference for control buttons
  srcNode = actx.createBufferSource();  // create audio source
  srcNode.buffer = abuffer;             // use decoded buffer

  gainNode = actx.createGain();         // create gain node
  gainNode.gain.value = 0;            // set gain to half volume
  srcNode.connect(gainNode);            // connect source to gain

  gainNode.connect(actx.destination);    // create output
  srcNode.loop = true;                  // takes care of perfect looping
  srcNode.start();                      // play...
  // fades in over 2 seconds:
  gainNode.gain.linearRampToValueAtTime(defaultGain, actx.currentTime+5);
}

// Simple example control
/*
document.querySelector("button").onclick = function() {
  if (srcNode) {
    srcNode.stop();
    srcNode = null;   
    this.innerText = "Play";
  } else {
    playLoop(audioData);
    this.innerText = "Stop";
  }
};
*/
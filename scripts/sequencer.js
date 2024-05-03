var code = "seq";
var tracks = [];
var trackList = document.getElementById("track-list");
var bgLoopLocation = "sounds/default/bg.mp3";
var bgPlaying = false;


// Am I a sequencer?
var isSeq = location.pathname.includes("sequencer");
var initials = "";
var session = findGetParameter("session") || DEFAULT_SESSION;

var socket = io("", {query:{code: code, session:session}});
var mySocketID;
socket.on("connect", () => {
  console.log("Connected, my socketid:" + socket.id);
  mySocketID = socket.id;
});

socket.on('sequencer exists', function(msg) {
  document.location.href = "/?exitreason=" + msg.reason;
});

socket.on('track joined', function(msg) {
  //{ initials: initials, track:track, socketid: socket.id }
  console.log("Track joined: " + msg.socketid);
  tracks.push({socketID: msg.socketid, initials:msg.initials, ready: false});
  updateTracks(tracks);
});

socket.on('midi message', function(msg) {
  //{ initials: initials, track:track, socketid: socket.id }
  console.log(msg);
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
    var itemClass = "track-not-ready";
    if(value.ready) {
      itemClass = "track-ready";
    }
    return "<tr><td class='track-item " + itemClass + "' id='" + value.socketID + "'>"+value.initials+"</td><tr>";
  }).join("");
}

initials = "SQ";
var hideInfo = findGetParameter("hideinfo");
document.getElementById("session-name").innerText = session;
var info = document.getElementById("session-info");
var urlTmp = document.location.origin;
//urlTmp = urlTmp.replace("localhost","jina-5.local");
console.log(urlTmp)
var trackURL = urlTmp + "/track?session="+session;
let qrcodeURL = "https://qrcode.azurewebsites.net/qr?width=300&margin=1&string=" + encodeURIComponent(trackURL);
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

var veilOnButton = document.getElementById("veil-on-button");
var veilOffButton = document.getElementById("veil-off-button");
var switchSounds = document.getElementById("switch-sounds");




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

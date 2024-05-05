var code = "seq";
var tracks = [];
var trackList = document.getElementById("track-list");
var infoShown = false;

if(!infoShown) {
  document.getElementById("switch").innerText = "Info";
  document.getElementById("session-info").style.display = "none";
} else {
  document.getElementById("switch").innerText = "✕";
  document.getElementById("session-info").style.display = "flex";
}

document.getElementById("switch").addEventListener("click", function(event){
  if(infoShown) {
    this.innerText = "Info";
    document.getElementById("session-info").style.display = "none";
  } else {
    this.innerText = "✕";
    document.getElementById("session-info").style.display = "flex";
  }
  infoShown = !infoShown;
});


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
  //console.log("Track joined: " + msg.socketid);
  tracks.push({socketID: msg.socketid, initials:msg.initials, ready: false, midiOut: null, midiIn: null, channel: null});
  updateTracks(tracks);
});

socket.on('midi message', function(msg) {
  //{ initials: initials, track:track, socketid: socket.id }
  var out = tracks.find(function(value, index, arr){ return value.socketID == msg.socketID;}).midiOut;
  console.log("Sending to " + out);
  var channel = parseInt(tracks.find(function(value, index, arr){ return value.socketID == msg.socketID;}).channel);
  if(msg.type == "ui") {
    midiOuts[out].send([msg.message[0] + channel, msg.message[1], msg.message[2]]);
  }
});

socket.on('track ready', function(msg) {
  if(msg.ready) {
    tracks.find(function(value, index, arr){ return value.socketID == msg.socketID;}).ready = true;
    document.getElementById(msg.socketID).classList.add("track-ready");
    //console.log("Track ready: " + msg.socketID);
  }
  else {
    tracks.find(function(value, index, arr){ return value.socketID == msg.socketID;}).ready = false;
    document.getElementById(msg.socketID).classList.remove("track-ready");
    //console.log("Track not ready: " + msg.socketID);
  }
});

socket.on('track left', function(msg) {
  //{ initials: initials, track:track, socketid: socket.id }
  //console.log("Track left: " + msg.socketid);
  tracks = tracks.filter(function(value, index, arr){ return value.socketID != msg.socketid;});
  var item = document.getElementById(msg.socketid);
  if(item) item.remove();
  updateTracks(tracks);
});

function updateTracks(tracks) {
  /*
  trackList.innerHTML = tracks.map(function(value, index, arr) {
    var itemClass = "track-not-ready";
    if(value.ready) {
      itemClass = "track-ready";
    }
    return "<tr><td class='track-item " + itemClass + "' id='" + value.socketID + "'>"+value.initials+"</td><tr>";
  }).join("");
  */
  var i = 0;
  tracks.forEach(function(item, index, arr) {
    var trackItem = document.getElementById(item.socketID);
    if(!trackItem) {
      var midiOutSelector = document.getElementById("select-midi-out").cloneNode(true);
      midiOutSelector.setAttribute("id","select-midi-out-"+index);
      midiOutSelector.selectedIndex = 1;
      item.midiOut = midiOutSelector.value;
      midiOutSelector.addEventListener("change", function(event){
        tracks.find(function(value, index, arr){ return value.socketID == item.socketID;}).midiOut = this.value;
      });
      var channelSelector = document.getElementById("select-midi-channel").cloneNode(true);
      channelSelector.setAttribute("id","select-midi-channel-"+index);
      channelSelector.selectedIndex = index;
      item.channel = channelSelector.value;
      channelSelector.addEventListener("change", function(event){
        tracks.find(function(value, index, arr){ return value.socketID == item.socketID;}).channel = this.value;
        console.log(tracks);
      });
      var newRow = document.createElement("tr");
      var newCell = document.createElement("td");
      newRow.classList.add("track-item");
      newRow.setAttribute("id",item.socketID);
      newCell.innerText = item.initials;
      newRow.appendChild(newCell);
      newRow.appendChild(midiOutSelector);
      newRow.appendChild(channelSelector);
      trackList.appendChild(newRow);
    }
  });

}

initials = "SQ";
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
  this.innerText = "Copiado!";
  p=setTimeout( function() { document.getElementById("copy").innerText = "Copiar enlace" }, 2000);
  console.log(p)
});

var veilOnButton = document.getElementById("veil-on-button");
var veilOffButton = document.getElementById("veil-off-button");

veilOnButton.addEventListener("click",function(event){
  this.style.backgroundColor = "red";
  console.log("Veil ON");
  socket.emit('veil-on', { socketID: mySocketID });
});

veilOffButton.addEventListener("click",function(event){
  veilOnButton.style.backgroundColor = "#EEE";
  console.log("Veil OFF");
  socket.emit('veil-off', { socketID: mySocketID });
});


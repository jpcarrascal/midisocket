var code = "seq";
var tracks = [];
var synths = [];
var trackList = document.getElementById("track-list-body");
var infoShown = false;

var synth = new WebAudioTinySynth({quality:1, useReverb:0, debug:1});

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
  // This extracts the channel from the MIDI message
  tracks.push({socketID: msg.socketid, initials:msg.initials, ready: false, midiOut: null, midiIn: null, channel: null});
  updateTracks(tracks);
});

socket.on('midi message', function(msg) {
  //{ initials: initials, track:track, socketid: socket.id }
  var port = tracks.find(function(value, index, arr){ return value.socketID == msg.socketID;}).midiOut;
  if(port == -1) {
    //out = synths[msg.socketID];
    out = synth;
    //console.log("Sending to internal synth " + msg.socketID);
  } else {
    out = midiOuts[port];
    //console.log("Sending to " + port);
  }
  var channel = parseInt(tracks.find(function(value, index, arr){ return value.socketID == msg.socketID;}).channel);
  var initialsTd = document.getElementById("initials-"+msg.socketID);
  if(msg.type == "ui") {
    out.send([msg.message[0] + channel, msg.message[1], msg.message[2]]);
    if(msg.message[0] != NOTE_OFF) flashElement(initialsTd, "lime");
  } else if(msg.type == "midi") {
    out.send(msg.message);
    if( (msg.message[0] & 0x0F) != NOTE_OFF ) flashElement(initialsTd, "lime");
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
  tracks.forEach(function(track, index, arr) {
    var trackItem = document.getElementById(track.socketID);
    if(!trackItem) {

      var newRow = document.createElement("tr");
      var newCell = document.createElement("td");
      newCell.id = "initials-"+track.socketID;
      newRow.classList.add("track-item");
      newRow.setAttribute("id",track.socketID);
      newCell.innerText = track.initials;
      newRow.appendChild(newCell);

      // -------- MIDI Port selector:
      var midiOutSelector = document.getElementById("select-midi-out").cloneNode(true);
      midiOutSelector.setAttribute("id","select-midi-out-"+index);
      midiOutSelector.selectedIndex = 0;
      track.midiOut = midiOutSelector.value;

      var synthDropdown = document.createElement("select");
      synthDropdown.id = "prog-" + track.socketID;
      synthDropdown.setAttribute("synthId", track.socketID);
      synthDropdown.setAttribute("channel", index);

      midiOutSelector.addEventListener("change", function(event){
        // TODO: write synthSetup(track, this);
        track.midiOut = this.value;
        console.log(tracks)
        if(this.value == "-1") {
          /// ***
          //synths[track.socketID] = new WebAudioTinySynth({quality:1, useReverb:0, debug:1});
          function pg(event) { 
            prog(this.getAttribute("channel"), this.selectedIndex);
          }
          synthDropdown.addEventListener("change", pg);
          synthDropdown.style.visibility = "visible";
          updateProgramList(synth, synthDropdown)
        } else {
          synthDropdown.style.visibility = "hidden";
          synthDropdown.removeEventListener("change", pg);
          //synths[track.socketID] = null;
        }
        /// ***
      });

      if(midiOutSelector.value == "-1") {
        /// ***
        //synths[track.socketID] = new WebAudioTinySynth({quality:1, useReverb:0, debug:1});
        function pg(event) { 
          prog(this.getAttribute("channel"), this.selectedIndex);
        }
        synthDropdown.addEventListener("change", pg);
        synthDropdown.style.visibility = "visible";
        updateProgramList(synth, synthDropdown)
      } else {
        synthDropdown.style.visibility = "hidden";
        synthDropdown.removeEventListener("change", pg);
        //synths[track.socketID] = null;
      }
      /// ***
      newCell = document.createElement("td");
      newCell.appendChild(midiOutSelector);
      newCell.appendChild(synthDropdown);
      newRow.appendChild(newCell);

      // -------- MIDI Channel selector:
      newCell = document.createElement("td");
      var channelSelector = document.getElementById("select-midi-channel").cloneNode(true);
      channelSelector.setAttribute("id","select-midi-channel-"+index);
      // TODO: better track allocation
      channelSelector.selectedIndex = index;
      track.channel = channelSelector.value;
      channelSelector.addEventListener("change", function(event){
        tracks.find(function(value, index, arr){ return value.socketID == track.socketID;}).channel = this.value;
        console.log(tracks);
      });
      newCell.appendChild(channelSelector);
      newRow.appendChild(newCell);

      // -------- Panic button:
      newCell = document.createElement("td");
      var panicButton = document.createElement("button");
      panicButton.innerText = "Panic";
      panicButton.classList.add("panic-button");
      panicButton.addEventListener("click", function(event){
        var channel = parseInt(tracks.find(function(value, index, arr){ return value.socketID == track.socketID;}).channel);
        var port = tracks.find(function(value, index, arr){ return value.socketID == track.socketID;}).midiOut;
        if(port == -1) {
          console.log("Panic to synth " + track.socketID);
          synths[track.socketID].send([CC_CHANGE + channel, 123, 127]);
        } else {
          midiOuts[port].send([CC_CHANGE + channel, 123, 127]);
        }
        flashElement(this, "red");
      });
      newCell.appendChild(panicButton);
      newRow.appendChild(newCell);

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
var panicAll = document.getElementById("panic-all");

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

panicAll.addEventListener("click",function(event){
  console.log("Panic all");
  var panicButtons = document.querySelectorAll(".panic-button");
  panicButtons.forEach(function(button) {
    button.click();
  });
});

function flashElement(elem, color) {
  elem.style.backgroundColor = color;
  setTimeout(function() { elem.style.backgroundColor = "transparent"; }, 200);
}

function prog(ch, pg){
  if(ch == undefined) ch = 0;
  var msg = [0xc0 + parseInt(ch), pg];
  console.log(msg);
  console.log("Changing program on ch " + ch + " to:" + pg);
  synth.send(msg);
}

async function updateProgramList(synth, dropdownElem){
  await synth.ready();
  for(var i=0;i<128;++i){
    var o = document.createElement("option");
    o.innerHTML = (i+1)+" : "+synth.getTimbreName(0,i);
    dropdownElem.appendChild(o);
  }
}
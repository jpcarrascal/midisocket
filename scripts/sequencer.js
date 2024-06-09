var code = "seq";
var tracks = new Array(32).fill(null);
tracks.findBysocketId = function(sid) {
  var index = -1;
  this.forEach(function(v, i, a) {
    if(v == null) return;
    if(v.socketID == sid) index = i;
  });
  return index;
}
var trackList = document.getElementById("track-list-body");
var infoShown = false;

var synth = new WebAudioTinySynth({quality:1, useReverb:0, debug:0});
var synth2 = new WebAudioTinySynth({quality:1, useReverb:0, debug:0});

var pauseButton = document.getElementById("pause-button");
var playButton = document.getElementById("play-button");
var infoSwitch = document.getElementById("info-switch")
var panicAll = document.getElementById("panic-all");
var gridSwitch = document.getElementById("grid-switch");


if(!infoShown) {
  infoSwitch.innerText = "Info";
  document.getElementById("session-info").style.display = "none";
} else {
  infoSwitch.innerText = "✕";
  document.getElementById("session-info").style.display = "flex";
}

infoSwitch.addEventListener("click", function(event){
  if(infoShown) {
    this.innerText = "Info";
    document.getElementById("session-info").style.display = "none";
  } else {
    this.innerText = "✕";
    document.getElementById("session-info").style.display = "flex";
  }
  infoShown = !infoShown;
});


gridSwitch.addEventListener("click", function(event) {
  document.getElementById("grid-container").classList.toggle("display-flex");
  document.getElementById("grid-container").classList.toggle("display-none");
  document.getElementById("container").classList.toggle("display-flex");
  document.getElementById("container").classList.toggle("display-none");
});


// Am I a sequencer?
var isSeq = location.pathname.includes("sequencer");
var initials = "";
var session = findGetParameter("session") || DEFAULT_SESSION;

var socket = io("", {query:{code: code, session:session}});
var mySocketID;
socket.on("connect", () => {
  console.log("Connected, my socketID:" + socket.id);
  mySocketID = socket.id;
});

socket.on('sequencer exists', function(msg) {
  document.location.href = "/?exitreason=" + msg.reason;
});

socket.on('track joined', function(msg) {
  //{ initials: initials, track:track, socketID: socket.id }
  //console.log("Track joined: " + msg.socketID);
  // This extracts the channel from the MIDI message
  var trackIndex = allocateTrack({socketID: msg.socketID, initials:msg.initials,
                              ready: false, midiOut: null, midiIn: null, channel: null});
  var channel = trackIndex%16;
  console.log("Track index: " + trackIndex + " Channel: " + channel);
  updateTracks();
  var colors = addToGrid(msg.initials, msg.socketID);
  socket.emit('track data', { socketID: msg.socketID, channel: channel, colors: colors });
});

socket.on('midi message', function(msg) {
  var port = tracks[tracks.findBysocketId(msg.socketID)].midiOut;
  var channel = parseInt(tracks[tracks.findBysocketId(msg.socketID)].channel);
  if(channel != -1) {
    msg.message = replaceMidiChannel(msg.message, channel);
  }
  if(port == -1) {
    if(channel <= 15) {
      out = synth;
    } else {
      out = synth2;
      channel = channel - 16;
    }
  } else {
    out = midiOuts[port];
  }
  var initialsTd = document.getElementById("initials-"+msg.socketID);
  out.send(msg.message);
  debugMidiMessage(msg.message);
  if( (msg.message[0] & 0xF0) == P_CHANGE ) {
    var dropDown = document.getElementById("prog-"+msg.socketID);
    dropDown.selectedIndex = msg.message[1];
  };
  flashElement(initialsTd, "lime");
});

socket.on('track left', function(msg) {
  tracks[tracks.findBysocketId(msg.socketID)] = null;
  removeFromGrid(msg.socketID);
  updateTracks();
});

function updateTracks() {
  tracks.forEach(function(track, index, arr) {
    var trackItem = document.getElementById("track-" + index);
    if(track == null) {
      if(trackItem) trackItem.remove();
      return;
    }
    if(!trackItem) {
      var newRow = document.createElement("tr");
      var newCell = document.createElement("td");
      newCell.id = "initials-"+track.socketID;
      newCell.classList.add("initials-td");
      newRow.classList.add("track-item");
      newRow.id = "track-" + index;
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
        track.midiOut = this.value;
        if(this.value == "-1") {
          /// ***
          function pg(event) { 
            prog(this.getAttribute("channel"), this.selectedIndex);
          }
          synthDropdown.addEventListener("change", pg);
          synthDropdown.style.visibility = "visible";
          updateProgramList(synth, synthDropdown)
        } else {
          synthDropdown.style.visibility = "hidden";
          synthDropdown.removeEventListener("change", pg);
        }
        /// ***
      });

      if(midiOutSelector.value == "-1") {
        /// ***
        function pg(event) { 
          prog(this.getAttribute("channel"), this.selectedIndex);
        }
        synthDropdown.addEventListener("change", pg);
        synthDropdown.style.visibility = "visible";
        updateProgramList(synth, synthDropdown)
      } else {
        synthDropdown.style.visibility = "hidden";
        synthDropdown.removeEventListener("change", pg);
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
      channelSelector.value = -1;
      track.channel = -1;
      channelSelector.addEventListener("change", function(event){
        tracks[tracks.findBysocketId(track.socketID)].channel = this.value;
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
          synth.send([CC_CHANGE + channel, 123, 127]);
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
  p = setTimeout( function() { document.getElementById("copy").innerText = "Copiar enlace" }, 2000);
});

pauseButton.addEventListener("click",function(event){
  this.classList.add("paused");
  playButton.classList.remove("playing");
  console.log("Veil ON, paused");
  socket.emit('session pause', { socketID: mySocketID });
});

playButton.addEventListener("click",function(event){
  pauseButton.classList.remove("paused");
  this.classList.add("playing");
  console.log("Veil OFF, session started");
  socket.emit('session play', { socketID: mySocketID });
});

panicAll.addEventListener("click",function(event){
  console.log("Panic all");
  var panicButtons = document.querySelectorAll(".panic-button");
  panicButtons.forEach(function(button) {
    button.click();
  });
});

function flashElement(elem, color) {
  setTimeout(function() { elem.style.borderColor = color;
    setTimeout(function() { elem.style.borderColor = "black"; }, 200);
  }, 0);
}

function prog(ch, pg){
  if(ch == undefined) ch = 0;
  var msg = [0xc0 + parseInt(ch), pg];
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

function allocateTrack(trackInfo) {
  var trackIndex = tracks.indexOf(null);
  if(trackIndex == -1) {
    trackIndex = tracks.length;
    tracks.push(trackInfo);
  } else {
    tracks[trackIndex] = trackInfo;
  }
  tracks[trackIndex] = trackInfo;
  return trackIndex;
}
// --------------- Keyboard

document.addEventListener(
  "keydown",
  (event) => {
    const keyName = event.key;

    if (keyName === "i") {
      infoSwitch.click();
      return;
    }

    if (keyName === "g") {
      gridSwitch.click();
      return;
    }

    if (keyName === " ") {
      if(pauseButton.classList.contains("paused")) {
        playButton.click();
      } else {
        pauseButton.click();
      }
      return;
    }

  },
  false,
);

// --------------- Grid

function addToGrid(initials, socketID) {
  var newDiv = document.createElement('div');
  var numTiles = document.querySelectorAll('.grid-item').length;
  newDiv.className = 'grid-item';
  newDiv.innerText = initials;
  newDiv.id = "grid-item-" + socketID;
  var colors = getRandomColorAndOptimalTextColor();
  newDiv.style.backgroundColor = colors[0];
  newDiv.style.color = colors[1];
  document.getElementById('grid').appendChild(newDiv);
  resizeGrid();
  return colors;
}

function removeFromGrid(socketID) {
  var gridItem = document.getElementById("grid-item-" + socketID);
  if(gridItem) gridItem.remove();
  resizeGrid();
}

window.addEventListener('resize', function(event) {
  resizeGrid();
}, true);

function resizeGrid() {
  document.querySelectorAll('.grid-item').forEach(function(item, index) {
    //item.clientWidth = item.parentElement.clientWidth / numTiles + '%';
    var w = item.clientWidth;
    //item.style.flexBasis = 1/length + '%';
    item.style.height = w + 'px';
  });
}

function getRandomColorAndOptimalTextColor() {
  var colors = ['#e6194B', '#3cb44b', '#ffe119', '#4363d8',
              '#f58231', '#42d4f4', '#f032e6', '#fabed4',
              '#469990', '#dcbeff', '#9A6324', '#fffac8',
              '#800000', '#aaffc3', '#000075', '#a9a9a9']
              //'#ffffff', '#000000'];
  var backgroundColor = colors[Math.floor(Math.random() * colors.length)]; // Select a random color from the array
  // Convert the background color to RGB
  var rgb = backgroundColor.slice(1).match(/.{2}/g).map(x => parseInt(x, 16));
  // Calculate the luminance of the background color
  var luminance = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
  // If the luminance is greater than 0.5, the background color is light, so the text color should be black. Otherwise, it should be white.
  var textColor = luminance > 0.5 ? 'black' : 'white';
  return [backgroundColor, textColor];
}
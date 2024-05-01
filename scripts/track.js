var code = "xxx";
var session = findGetParameter("session") || DEFAULT_SESSION;
var socket = io("", {query:{code: code, session: session}});
var mySocketID;
var playing = false;
var remotePlaying = false;
var color = "cyan";
var sounds = [];
var audio = document.getElementById("audio-player");
var baseURL = "https://dbass.link/sounds/default/loops/";
var host = window.location.host;
if(host.includes("localhost")) baseURL = "http://localhost:3000/sounds/default/loops/";
var soundLocation = "";

socket.on("connect", () => {
  console.log("Connected, my socketid:" + socket.id);
  mySocketID = socket.id;
});
var body = document.querySelector("body");

var noSleep = new NoSleep();

socket.on('stop', function(msg) {
    console.log("Remote stop! " + msg.socketID);
    audio.pause();
    audio.currentTime = 0;
});

socket.on('veil-on', function(msg) {
    console.log("Veil ON " + msg.socketID);
    document.getElementById("veil").style.display = "flex";
});

socket.on('veil-off', function(msg) {
    console.log("Veil OFF " + msg.socketID);
    document.getElementById("veil").style.display = "none";
});

socket.on('color-change', function(msg) {
    console.log("Color changed to: " + msg.color);
    color = msg.color;
    if(playing) {
        //document.querySelector("body").style.backgroundColor = color;
        // TEST!
        document.querySelector("body").className = '';
        document.querySelector("body").classList.add("transition-"+color);
    }
});

socket.on('switch-sounds', function(msg) {
    console.log("(Maybe) Switch sound! " + msg.socketID);
    if(Math.random() > 0.4) {
        // Pause audio, change source, play...
        audio.pause();
        soundLocation = baseURL + sounds[Math.floor(Math.random() * sounds.length)];
        audio.setAttribute("src", soundLocation);
        audio.play();
        console.log("Sound CHANGED!!!");
    }
});

socket.on('sound-list', function(msg) {
    sounds = msg.list;
    soundLocation = baseURL + sounds[Math.floor(Math.random() * sounds.length)];
    console.log(soundLocation);
    audio.setAttribute("src", soundLocation);
    audio.pause();
    document.getElementById("sound-play").innerText = "Please turn the volume up and tap me.";
});



socket.on('play', function(msg) {
    remotePlaying = true;
    console.log("Remote play: " + soundLocation);
    audio.currentTime = 0;
    audio.play();
    if(!playing) {
        // TEST!
        //document.querySelector("body").style.backgroundColor = "black";
        document.querySelector("body").className = '';
        document.querySelector("body").classList.add("transition-black");
    }
    else {
        // TEST!
        //document.querySelector("body").style.backgroundColor = color;
        document.querySelector("body").className = '';
        document.querySelector("body").classList.add("transition-"+color);
    }
});

socket.on('session is playing', function(msg) {
    if(msg.playing) {
        remotePlaying = true;
        console.log("Session is already playing");
    } else {
        console.log("Session not yet playing");
        audio.pause();
        audio.currentTime = 0;
        playing = false;
        remotePlaying = false;
    }
});

document.querySelector("html").addEventListener("click", function(e){
    var adjustElem = document.getElementById("sound-play");
    if(!playing) {
        audio.play();
        audio.pause();
        audio.currentTime = 0;
        playing = true;
    }
    if(remotePlaying) {
        audio.currentTime = 0;
        audio.play();
        playing = true;
        // TEST!
        //document.querySelector("body").style.backgroundColor = color;
        document.querySelector("body").className = '';
        document.querySelector("body").classList.add("transition-"+color);
    }
    socket.emit('track ready', { socketID: mySocketID, ready: true });
    adjustElem.style.color = "white";
    adjustElem.innerText = "Now find a place in the session and place your phone there.";
    document.addEventListener('click', function enableNoSleep() {
        document.removeEventListener('click', enableNoSleep, false);
        noSleep.enable();
      }, false);
});


socket.on('exit session', function(msg) {
    setTimeout(() => {
        window.location.reload(true);
    }, 1000);
});

/*
audio.addEventListener("timeupdate", () => {
    if(audio.currentTime == 0) {
        console.log("Boom " + audio.currentTime);
        body.style.backgroundColor = color;
    } else if (audio.currentTime > 0.2) {
        body.style.backgroundColor = "black";
    }
//    var level = 255 - parseInt( (audio.currentTime/audio.duration) * 255);
//    var color = "rgb(" + level + "," + level + "," + level +")";
    //document.querySelector("body").style.backgroundColor = color;
});
*/


function findGetParameter(parameterName) {
    var result = null,
        tmp = [];
    location.search
        .substr(1)
        .split("&")
        .forEach(function (item) {
          tmp = item.split("=");
          if (tmp[0] === parameterName) result = decodeURIComponent(tmp[1]);
        });
    return result;
  }

  

/* -------------- AUDIOCONTEXT STARTS
var sound = {};
function unlockAudioContext(audioCtx) {
    if (audioCtx.state === 'suspended') {
        var events = ['touchstart', 'touchend', 'mousedown', 'keydown'];
        var unlock = function unlock() {
        events.forEach(function (event) {
            document.body.removeEventListener(event, unlock)
        });
        audioCtx.resume();
        };

        events.forEach(function (event) {
        document.body.addEventListener(event, unlock, false)
        });
    }
}

const ctx = new (window.AudioContext || window.webkitAudioContext)();
unlockAudioContext(ctx);

var mainVolume = ctx.createGain();
mainVolume.connect(ctx.destination);

console.log("debug...")
var audio = document.createElement('audio');
audio.id       = 'audio-player';
audio.src      = soundLocation;
audio.muted = false;
document.querySelector("body").appendChild(audio);


sound.source = ctx.createMediaElementSource(audio); //createBufferSource();
//sound.analyzer = ctx.createAnalyser();
sound.source.connect(mainVolume);
//sound.analyzer.connect(mainVolume);

setupSample(soundLocation)
    .then((sample) => {
      sound.buffer = sample;
      sound.source.buffer = sound.buffer;
});
//let soundAnalysis = analyze(sound.analyzer);
-------------- AUDIOCONTEXT END */
/*
document.getElementById("sound-play").addEventListener("mouseup", function(e){
    audio.pause();
});
*/
/*
document.getElementById("sound-play").addEventListener("touchstart", function(e){
    ctx.resume();
    audio.pause();
    sound.currentTime = 0;
    audio.play();
});

document.getElementById("sound-play").addEventListener("touchend", function(e){
    audio.pause();
    sound.currentTime = 0;
});
*/
async function getFile(audioContext, filepath) {
    const response = await fetch(filepath);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    return audioBuffer;
  }
  
async function setupSample(location) {
    const filePath = location;
    const sample = await getFile(ctx, filePath);
    return sample;
}

function analyze(analyzer)
{
    analyzer.fftSize = 64;
    const sampleBuffer = new Float32Array(analyzer.fftSize);
    analyzer.getFloatTimeDomainData(sampleBuffer);
    // Compute average power over the interval.
    let sumOfSquares = 0;
    for (let i = 0; i < sampleBuffer.length; i++) {
        sumOfSquares += sampleBuffer[i] ** 2;
    }
    const avgPowerDecibels = 10 * Math.log10(sumOfSquares / sampleBuffer.length);
    const avg = 10 * Math.log10(sumOfSquares / sampleBuffer.length);
    /*
    let peakInstantaneousPower = 0;
    for (let i = 0; i < sampleBuffer.length; i++) {
        const power = sampleBuffer[i] ** 2;
        peakInstantaneousPower = Math.max(power, peakInstantaneousPower);
    }
    const peakInstantaneousPowerDecibels = 10 * Math.log10(peakInstantaneousPower);
    */
    return(avgPowerDecibels);
}


//bassDrum.object3D.scale.y=1-(2/BDAnalysis);

/*
var counter = document.getElementById("counter");
var rounds = 0;
socket.on('step tick', function(msg) {
    if(msg.counter == 15 && counting) {
        rounds--;
        if(rounds >= 0)
            counter.innerText = rounds;
        else
            counter.innerText = ":o";
    }
});

socket.on('hide toggle track', function(msg) {
    if(msg.value > 63)
        document.getElementById("matrix").classList.toggle("invisible");
});

var restart = document.getElementById("restart");
restart.addEventListener("click", function(e){
  window.location.href = "/track?session="+session;
});


function removeTrack() {
    console.log("Lost my track :(");
    document.querySelectorAll(".track").forEach(track => {
        track.remove();
    });
}

socket.on('create track', function(msg) {
    removeTrack();
    console.log("Got my track: " + (msg.track));
    var track = msg.track;
    var icon = document.getElementById("big-instrument-icon");
    if(track>7) icon.setAttribute("src","images/8.png");
    else icon.setAttribute("src","images/"+track+".png");
    counter.innerText = msg.maxNumRounds;
    counter.style.color = colors[track];
    rounds = msg.maxNumRounds;
    var tr = createTrack(track);
    document.getElementById("track-header").style.backgroundColor = colors[track];
    if(track>7) {
        document.getElementById("track-header").style.color = "white";
        document.getElementById("big-instrument-icon").style.filter = "invert(1)";
    }
    var matrix = document.getElementById("matrix");
    matrix.appendChild(tr);
    tr.style.backgroundColor = colors[track];
    var trackName = document.getElementById("track"+msg.track+"-name");
    var bigInitials = document.getElementById("big-initials");
    trackName.innerText = initials;
    bigInitials.innerText = initials;
    var selector = ".fader";
    if(track>7) selector = ".keyboard"
    document.querySelectorAll(selector).forEach(element => {
        element.style.display = "block";
    });

});

socket.on('update track', function(msg) {
    var notes = msg.notes;
    var trackID = "track"+msg.track;
    for(var i=0; i<notes.length; i++) {
        if(notes[i].vel > 0) {
            var stepID = trackID+"-step"+i;
            var value = notes[i].vel;
            var stepElem = document.getElementById(stepID);
            var fader = document.getElementById(stepID+"fader");
            var kb = document.getElementById(stepID+"kb");
            var swColor = stepElem.firstChild.getAttribute("color");
            stepElem.setAttribute("value", value);
            stepElem.style.backgroundColor = valueToBGColor(value);
            stepElem.firstChild.style.backgroundColor = valueToSWColor(value, swColor);
            fader.value = value;
            kb.setNote(notes[i].note);
        }
    }
});

*/
var midiOuts = [];
var midiIns = [];

function listDevices(midi) {
    var outLists = document.querySelectorAll(".select-midi-out");
    var inLists  = document.querySelectorAll(".select-midi-in");
    var outputs = midi.outputs.values();
    var inputs  = midi.inputs.values();
    var numOuts = 0;
    var numIns  = 0;
    // outputs is an Iterator

    for (var output = outputs.next(); output && !output.done; output = outputs.next()) {
        midiOuts[output.value.id] = midi.outputs.get(output.value.id);
        outLists.forEach(function(elem) {
            var option = document.createElement("option");
            option.value = output.value.id;
            option.text = output.value.name;    
            if(!isElemInDropdown(elem, option)) {
                if(option.value == "-274818378") console.log("Adding to " + elem.id);
                elem.appendChild(option);
            }
        });
        numOuts++;
    }

    for (var input = inputs.next(); input && !input.done; input = inputs.next()) {
        midiIns[input.value.id] = midi.inputs.get(input.value.id);
        inLists.forEach(function(elem) {
            var option = document.createElement("option");
            option.value = input.value.id;
            option.text = input.value.name;    
            if(!isElemInDropdown(elem, option)) {
                elem.appendChild(option);
            }
        });
        numIns++;
    }
    
    if(numOuts == 0) {
        console.log("No MIDI OUT devices found...");
        setCookie("MIDIout",0,1000);
    }

    if(numIns == 0) {
        console.log("No MIDI IN devices found...");
        setCookie("MIDin",0,1000);
    }
}
 
if (navigator.requestMIDIAccess) {
    console.log('Browser supports MIDI. Yay!');
    navigator.requestMIDIAccess().then(success, failure);
}

function success(midi) {
    listDevices(midi);
    midi.onstatechange = (event) => {
        listDevices(midi);
    };
}

function processMIDIin(midiMsg) {
    //console.log(midiMsg);
    // altStartMessage: used to sync when playback has already started
    // in clock source device
    // 0xB0 & 0x07 = CC, channel 8.
    // Responding to altStartMessage regardless of channels
    if(midiMsg.data[0] == 191) { //CC, right channel
        console.log("CC\t" + midiMsg.data[1] + "\tvalue:" + midiMsg.data[2]);
    } else if (midiMsg.data[0] == 144) {
        console.log("Note ON\t" + midiMsg.data[1] + "\tvelocity: " + midiMsg.data[2]);
    } else if (midiMsg.data[0] == 128) {
        console.log("Note OFF\t" + midiMsg.data[1] + "\tvelocity: " + midiMsg.data[2]);
    } else {
        console.log(midiMsg.data[0])
    }
}

function failure(){ console.log("MIDI not supported :(")};

function MIDIplayNote (note, vel, out) {
    out.send([NOTE_ON, note, vel]);
    setTimeout(out.send([NOTE_OFF, note, 0x00]), NOTE_DURATION);
}


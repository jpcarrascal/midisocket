// Track Controller - Dynamic MIDI Interface
var initials = findGetParameter("initials");
var session = findGetParameter("session");
var midiChannel = -1;
var assignedDevice = null;
var currentControllers = {};
var socket;
var mySocketID;

if(session === "undefined") session = null;
if(initials === null || initials === "undefined" || initials === "") {
    if(getCookie("countmein-initials")) {
        initials = getCookie("countmein-initials");
        console.log("Initials from cookie: " + getCookie("countmein-initials"));
    } else {
        console.log("No cookie for you");
        initials = null;
    }
}

setCookie("retries", 0, 1000);
var retries = 0;
var maxRetries = 3;

// DOM Elements
const deviceNameElement = document.getElementById("device-name");
const trackInfoElement = document.getElementById("track-info");
const controllerContainer = document.getElementById("controller-container");
const connectionStatus = document.getElementById("connection-status");
const midiActivity = document.getElementById("midi-activity");

if(!initials && session) { // No initials == no socket connection
    document.getElementById("initials-form").style.display = "block";
    document.getElementById("veil").style.display = "none";
    document.getElementById("initials").addEventListener("input", function(e) {
        this.value = this.value.toUpperCase();
    });
    document.getElementById("initials-form").addEventListener("submit", function(e) {
        e.preventDefault();
        initials = document.getElementById("initials").value.toUpperCase();
        document.getElementById("initials-form").style.display = "none";
        document.location.href = "/track?session=" + session + "&initials=" + initials;
    });
} else if(initials && session) {
    setCookie("countmein-initials",initials,1000);
    /* ----------- Socket set up: ------------ */
    document.getElementById("controller").style.display = "block";
    controllerContainer.style.display = "flex"; // Show controller container
    socket = io("", {query:{initials: initials, session: session}});
    
    socket.on("connect", () => {
        setCookie("retries", 0, 1000); 
        retries = 0;
        console.log("Connected, my socketID:" + socket.id);
        mySocketID = socket.id;
        connectionStatus.textContent = "Connected";
        connectionStatus.style.color = "#4ade80";
        
        // Request device assignment information
        console.log("Requesting track assignment for socketID:", mySocketID);
        socket.emit("request-track-assignment", {socketID: mySocketID});
    });

    socket.on("disconnect", () => {
        connectionStatus.textContent = "Disconnected";
        connectionStatus.style.color = "#ef4444";
    });

    var body = document.querySelector("body");
    var noSleep = new NoSleep();

    /* ----------- Socket messages ------------ */

    socket.on('track data', function(msg) {
        if(msg.socketID == mySocketID) {
            console.log("My channel is: " + msg.channel);
            midiChannel = msg.channel;
            trackInfoElement.textContent = `Track ${msg.channel + 1}`;
            console.log("My color is: " + msg.colors[0]);
            document.querySelector("body").style.backgroundColor = msg.colors[0];
            document.querySelector("body").style.color = msg.colors[1];
        }
    });

    // New message for device assignment
    socket.on('track-assignment', function(msg) {
        console.log("Received track-assignment message:", msg);
        if(msg.socketID == mySocketID) {
            console.log("Device assignment matches my socketID:", msg);
            assignedDevice = msg.device;
            midiChannel = msg.channel;
            trackInfoElement.textContent = `Track ${msg.trackNumber}`;
            console.log("Updating device interface with:", msg.device);
            updateDeviceInterface(msg.device);
        } else {
            console.log("Assignment not for me. My socketID:", mySocketID, "Message socketID:", msg.socketID);
        }
    });

    socket.on('stop', function(msg) {
        console.log("Remote stop! " + msg.socketID);
        // Could add visual feedback here
    });

    socket.on('play', function(msg) {
        console.log("Remote play! " + msg.socketID);
        // Could add visual feedback here
    });

    socket.on('exit session', function(msg) {
        if(retries < maxRetries) {
            console.log("Retrying...");
            retries = parseInt(getCookie("retries")) + 1;
            console.log("Retries: " + retries);
            console.log(document.cookie);
            setCookie("retries", retries, 1000);
            setTimeout(() => {
                window.location.reload(true);
            }, 1000);
        } else {
            console.log("Max retries reached. Exiting.");
            document.location.href = "/track?exitreason=" + msg.reason;
        }
    });

    // Veil for preventing people from joining earlier than intended.
    socket.on('veil-on', function(msg) {
        console.log("Veil ON " + msg.socketID);
        document.getElementById("veil").style.display = "flex";
    });

    socket.on('veil-off', function(msg) {
        console.log("Veil OFF " + msg.socketID);
        document.getElementById("veil").style.display = "none";
    });

}

/* ----------- Controller Interface Functions ------------ */

function updateDeviceInterface(device) {
    if (!device) {
        deviceNameElement.textContent = "No Device Assigned";
        controllerContainer.innerHTML = '';
        return;
    }

    deviceNameElement.textContent = device.name || "Unknown Device";
    
    // Clear existing controllers
    controllerContainer.innerHTML = '';
    currentControllers = {};

    if (device.controls && device.controls.length > 0) {
        // Device has specific controller mappings
        console.log("Device has controls, generating device-specific interface");
        generateDeviceControllers(device);
    } else {
        // Generic MIDI interface - use standard controllers
        console.log("No device controls found, using generic interface");
        generateGenericControllers();
    }
}

function generateDeviceControllers(device) {
    // This would be implemented based on the device database structure
    // For now, we'll use a simplified approach
    console.log("Generating device-specific controllers for:", device.name);
    
    // Example: If device has specific controls defined
    if (device.controls) {
        device.controls.forEach(control => {
            createController(control);
        });
    } else {
        // Fallback to generic if no specific controls defined
        generateGenericControllers();
    }
}

function generateGenericControllers() {
    console.log("Generating generic MIDI controllers");
    
    // Create controller groups
    const expressionGroup = createControllerGroup("Expression Controls");
    const filterGroup = createControllerGroup("Filter Controls");
    const envelopeGroup = createControllerGroup("Envelope Controls");
    
    // Expression Controls
    createSlider(expressionGroup, "Volume", 7, 100);
    createSlider(expressionGroup, "Pan", 10, 64);
    createSlider(expressionGroup, "Modulation", 1, 0);
    createSlider(expressionGroup, "Expression", 11, 127);
    
    // Filter Controls  
    createSlider(filterGroup, "Filter Cutoff", 74, 64);
    createSlider(filterGroup, "Filter Resonance", 71, 64);
    
    // Envelope Controls
    createSlider(envelopeGroup, "Attack", 73, 64);
    createSlider(envelopeGroup, "Release", 72, 64);
    
    // Add some buttons for common functions
    const buttonGroup = createControllerGroup("Quick Controls");
    createButtonGrid(buttonGroup, [
        {name: "All Notes Off", cc: 123, value: 0},
        {name: "Reset Controllers", cc: 121, value: 0},
        {name: "Sustain On/Off", cc: 64, toggle: true},
        {name: "Portamento", cc: 65, toggle: true}
    ]);
}

function createController(control) {
    console.log("Creating controller for:", control.control_name, "CC:", control.cc_number);
    
    // Parse the value range to determine the max value
    let maxValue = 127; // Default MIDI range
    if (control.value_range) {
        const rangeMatch = control.value_range.match(/(\d+).*?(\d+)/);
        if (rangeMatch) {
            maxValue = parseInt(rangeMatch[2]);
        }
    }
    
    // Create a controller group for this control
    const group = createControllerGroup(control.control_name);
    
    // For now, create all controls as sliders
    // Could be enhanced to create different control types based on the value range
    const defaultValue = Math.floor(maxValue / 2); // Start at middle value
    createSlider(group, control.control_name, control.cc_number, defaultValue, maxValue);
    
    // Add description as tooltip or subtitle if available
    if (control.description) {
        const description = document.createElement('div');
        description.className = 'control-description';
        description.textContent = control.description;
        description.style.fontSize = '12px';
        description.style.color = '#888';
        description.style.marginTop = '4px';
        group.appendChild(description);
    }
}

function createControllerGroup(title) {
    const group = document.createElement('div');
    group.className = 'controller-group';
    
    const header = document.createElement('h3');
    header.textContent = title;
    group.appendChild(header);
    
    controllerContainer.appendChild(group);
    return group;
}

function createSlider(parent, name, ccNumber, defaultValue, maxValue = 127) {
    const container = document.createElement('div');
    container.className = 'slider-container';
    
    const label = document.createElement('div');
    label.className = 'slider-label';
    
    const nameSpan = document.createElement('span');
    nameSpan.textContent = name;
    
    const valueSpan = document.createElement('span');
    valueSpan.className = 'slider-value';
    valueSpan.textContent = defaultValue;
    
    label.appendChild(nameSpan);
    label.appendChild(valueSpan);
    
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'slider';
    slider.min = '0';
    slider.max = maxValue.toString();
    slider.value = defaultValue;
    slider.dataset.cc = ccNumber;
    
    slider.addEventListener('input', function() {
        const value = parseInt(this.value);
        valueSpan.textContent = value;
        sendControlChange(ccNumber, value);
        showMidiActivity(`CC${ccNumber}: ${value}`);
    });
    
    container.appendChild(label);
    container.appendChild(slider);
    parent.appendChild(container);
    
    currentControllers[ccNumber] = slider;
}

function createButtonGrid(parent, buttons) {
    const container = document.createElement('div');
    container.className = 'button-container';
    
    buttons.forEach(buttonConfig => {
        const button = document.createElement('button');
        button.className = 'midi-button';
        button.textContent = buttonConfig.name;
        button.dataset.cc = buttonConfig.cc;
        
        if (buttonConfig.toggle) {
            let isActive = false;
            button.addEventListener('click', function() {
                isActive = !isActive;
                this.classList.toggle('active', isActive);
                const value = isActive ? 127 : 0;
                sendControlChange(buttonConfig.cc, value);
                showMidiActivity(`CC${buttonConfig.cc}: ${value}`);
            });
        } else {
            button.addEventListener('mousedown', function() {
                this.classList.add('active');
                sendControlChange(buttonConfig.cc, buttonConfig.value || 127);
                showMidiActivity(`CC${buttonConfig.cc}: ${buttonConfig.value || 127}`);
            });
            
            button.addEventListener('mouseup', function() {
                this.classList.remove('active');
            });
            
            button.addEventListener('mouseleave', function() {
                this.classList.remove('active');
            });
        }
        
        container.appendChild(button);
    });
    
    parent.appendChild(container);
}

function sendControlChange(ccNumber, value) {
    if (socket && mySocketID && midiChannel !== -1) {
        const message = [0xB0 + midiChannel, ccNumber, value];
        socket.emit("track-midi-message", {
            source: "ui", 
            message: message, 
            socketID: mySocketID,
            timestamp: performance.now()
        });
    }
}

function showMidiActivity(text) {
    midiActivity.textContent = text;
    midiActivity.style.opacity = '1';
    setTimeout(() => {
        midiActivity.style.opacity = '0.5';
    }, 500);
}

function addListenerMulti(el, s, fn) {
    s.split(' ').forEach(e => el.addEventListener(e, fn, false));
}

/* ----------- MIDI Input Handler ------------ */

function midiInToSocket(msg) {
    var message = [msg.data[0], msg.data[1], msg.data[2]];
    var incomingChannel = parseInt(msg.data[0] & 0x0F);
    console.log("Incoming MIDI channel: " + incomingChannel);
    
    // Route to assigned channel
    if (midiChannel !== -1) {
        message = replaceMidiChannel(message, midiChannel);
    }
    
    socket.emit("track-midi-message", {
        source: "midi-input", 
        message: message, 
        socketID: mySocketID,
        timestamp: performance.now()
    });
    
    // Show activity
    const messageType = (msg.data[0] & 0xF0) >> 4;
    let activityText = `MIDI: Ch${incomingChannel + 1}`;
    if (messageType === 9) activityText += " Note On";
    else if (messageType === 8) activityText += " Note Off";
    else if (messageType === 11) activityText += " CC";
    
    showMidiActivity(activityText);
}
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

    // Device assignment message - handles all track data including device color
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
        // Reset to default background
        document.body.style.backgroundColor = '#1a1a1a';
        document.body.style.color = '#ffffff';
        return;
    }

    console.log("Track received device:", device.name, "with controllers:", device.controllers);
    console.log("Track received device color:", device.color);
    deviceNameElement.textContent = device.name || "Unknown Device";
    
    // Apply device color as background
    if (device.color) {
        document.body.style.backgroundColor = device.color;
        // Calculate contrast color for text
        const textColor = getContrastColor(device.color);
        document.body.style.color = textColor;
        console.log("Applied device color:", device.color, "with text color:", textColor);
    }
    
    // Clear existing controllers
    controllerContainer.innerHTML = '';
    currentControllers = {};


    
    if (device.controllers && Array.isArray(device.controllers) && device.controllers.length > 0) {
        // Device has specific controller mappings (custom format only)
        console.log("Device has controllers, generating device-specific interface");
        console.log("Will call generateDeviceControllers with:", device);
        generateDeviceControllers(device);
    } else {
        // Generic MIDI interface - use standard controllers
        console.log("No device controllers found, using generic interface");
        console.log("device.controllers:", device.controllers);
        generateGenericControllers();
    }
}

/**
 * Calculate contrast color (white or black) based on background color
 */
function getContrastColor(hexColor) {
    // Remove # if present
    const color = hexColor.replace('#', '');
    
    // Convert to RGB
    const r = parseInt(color.substr(0, 2), 16);
    const g = parseInt(color.substr(2, 2), 16);
    const b = parseInt(color.substr(4, 2), 16);
    
    // Calculate luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    
    // Return white for dark backgrounds, black for light backgrounds
    return luminance > 0.5 ? '#000000' : '#ffffff';
}

/**
 * Normalize controller data to handle both old database format and new custom format
 */
function normalizeControllerData(control) {
    // Handle new custom device format
    if (control.name && control.ccNumber !== undefined) {
        return {
            control_name: control.name,
            cc_number: control.ccNumber,
            type: control.type,
            value_range: control.type === 'continuous' ? '0-127' : control.range,
            description: `${control.name} (${control.type})`
        };
    }
    
    // Handle old database format (already normalized)
    if (control.control_name && control.cc_number !== undefined) {
        return control;
    }
    
    // Fallback for unknown format
    console.warn('Unknown controller format:', control);
    return {
        control_name: control.name || 'Unknown',
        cc_number: control.ccNumber || control.cc_number || 1,
        type: 'continuous',
        value_range: '0-127',
        description: 'Unknown controller'
    };
}

function generateDeviceControllers(device) {
    console.log("Generating device-specific controllers for:", device.name);
    
    // Only use custom device controllers
    const deviceControllers = device.controllers || [];
    if (deviceControllers.length > 0) {
        // Show all configured controllers (up to max limit)
        let controlsToShow = deviceControllers.slice(0, config.MAX_CONTROLLERS_PER_DEVICE); // Limit for UI
        console.log(`Showing ${controlsToShow.length} custom controllers for device: ${device.name}`);
        // Group controllers logically if we have many
        if (controlsToShow.length > config.MAX_CONTROLLERS_PER_DEVICE) {
            const midPoint = Math.ceil(controlsToShow.length / 2);
            const firstGroup = controlsToShow.slice(0, midPoint);
            const secondGroup = controlsToShow.slice(midPoint);
            const firstGroupEl = createControllerGroup("Primary Controls");
            firstGroup.forEach(control => {
                const normalizedControl = normalizeControllerData(control);
                createController(normalizedControl, firstGroupEl);
            });
            if (secondGroup.length > 0) {
                const secondGroupEl = createControllerGroup("Secondary Controls");
                secondGroup.forEach(control => {
                    const normalizedControl = normalizeControllerData(control);
                    createController(normalizedControl, secondGroupEl);
                });
            }
        } else {
            // Show all in one group
            const groupEl = createControllerGroup("Device Controls");
            controlsToShow.forEach(control => {
                // Normalize controller data for custom format
                const normalizedControl = normalizeControllerData(control);
                createController(normalizedControl, groupEl);
            });
        }
        // No informational messages shown in track interface
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

function createController(control, parentGroup = null) {
    console.log("Creating controller for:", control.control_name, "CC:", control.cc_number, "Type:", control.type);
    
    // Use provided parent group or create a new one
    const group = parentGroup || createControllerGroup(control.control_name);
    
    // Create different control types based on the controller type
    if (control.type === 'discrete') {
        console.log("Creating discrete controller with range:", control.value_range);
        createDiscreteController(group, control.control_name, control.cc_number, control.value_range);
    } else {
        // Continuous controller - create slider
        console.log("Creating continuous controller");
        // Parse the value range to determine the max value
        let maxValue = 127; // Default MIDI range
        if (control.value_range) {
            const rangeMatch = control.value_range.match(/(\d+).*?(\d+)/);
            if (rangeMatch) {
                maxValue = parseInt(rangeMatch[2]);
            }
        }
        const defaultValue = Math.floor(maxValue / 2); // Start at middle value
        createSlider(group, control.control_name, control.cc_number, defaultValue, maxValue);
    }
    
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

function createDiscreteController(group, name, ccNumber, valueRange) {
    console.log("Creating discrete controller:", name, "with range:", valueRange);
    
    // Parse the discrete range format: "Off: 0-31, On: 32-63, Auto: 64-127"
    const options = parseDiscreteRange(valueRange);
    console.log("Parsed discrete options:", options);
    
    if (options.length === 0) {
        console.warn("No valid options parsed from range:", valueRange);
        return;
    }
    
    // Create main container (similar to slider-container)
    const container = document.createElement('div');
    container.className = 'discrete-container';
    
    // Create label (similar to slider-label)
    const label = document.createElement('div');
    label.className = 'discrete-label';
    
    const nameSpan = document.createElement('span');
    nameSpan.textContent = name;
    
    const valueSpan = document.createElement('span');
    valueSpan.className = 'discrete-value';
    valueSpan.textContent = options[0].label; // Show first option as default
    
    label.appendChild(nameSpan);
    label.appendChild(valueSpan);
    
    // Create container for discrete buttons
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'discrete-buttons';
    
    let activeButton = null;
    
    // Create a button for each discrete option
    options.forEach((option, index) => {
        const button = document.createElement('button');
        button.className = 'discrete-option-btn';
        button.textContent = option.label;
        
        // Handle button click
        button.addEventListener('click', () => {
            // Update visual state
            if (activeButton) {
                activeButton.classList.remove('active');
            }
            
            button.classList.add('active');
            activeButton = button;
            
            // Update the value display
            valueSpan.textContent = option.label;
            
            // Send MIDI CC message with the option's value
            const midiValue = option.midValue;
            console.log(`Discrete controller ${name} (CC${ccNumber}): ${option.label} = ${midiValue}`);
            
            // Send MIDI CC message using the same function as sliders
            sendControlChange(ccNumber, midiValue);
            showMidiActivity(`CC${ccNumber}: ${option.label} (${midiValue})`);
        });
        
        buttonContainer.appendChild(button);
        
        // Set first option as default
        if (index === 0) {
            button.click();
        }
    });
    
    // Assemble the complete discrete controller
    container.appendChild(label);
    container.appendChild(buttonContainer);
    group.appendChild(container);
}

function parseDiscreteRange(rangeString) {
    // Parse format: "Off: 0-31, On: 32-63, Auto: 64-127"
    const options = [];
    
    if (!rangeString) return options;
    
    // Split by comma and parse each option
    const parts = rangeString.split(',');
    
    parts.forEach(part => {
        const trimmedPart = part.trim();
        // Match pattern: "Label: min-max" or "Label: value"
        const match = trimmedPart.match(/^([^:]+):\s*(\d+)(?:-(\d+))?/);
        
        if (match) {
            const label = match[1].trim();
            const minValue = parseInt(match[2]);
            const maxValue = match[3] ? parseInt(match[3]) : minValue;
            
            // Use the middle value of the range as the MIDI value to send
            const midValue = Math.floor((minValue + maxValue) / 2);
            
            options.push({
                label: label,
                minValue: minValue,
                maxValue: maxValue,
                midValue: midValue
            });
        }
    });
    
    return options;
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
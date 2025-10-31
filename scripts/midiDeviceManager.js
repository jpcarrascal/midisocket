/**
 * MIDI Interface Manager
 * Handles MIDI interface detection, management, and communication
 */

class MidiDeviceManager {
    constructor() {
        this.midiAccess = null;
        this.outputDevices = new Map();
        this.inputDevices = new Map();
        this.onDeviceChangeCallback = null;
        this.isInitialized = false;
    }

    /**
     * Initialize Web MIDI API
     * @returns {Promise<boolean>} Success status
     */
    async initialize() {
        if (!navigator.requestMIDIAccess) {
            console.warn('Web MIDI API not supported in this browser');
            return false;
        }

        try {
            this.midiAccess = await navigator.requestMIDIAccess({ sysex: false });
            console.log('MIDI Access acquired');
            
            // Set up device change listener
            this.midiAccess.onstatechange = (event) => {
                this.handleDeviceChange(event);
            };

            // Initial device enumeration
            this.enumerateDevices();
            this.isInitialized = true;
            return true;
        } catch (error) {
            console.error('Failed to get MIDI access:', error);
            return false;
        }
    }

        /**
     * Enumerate all available MIDI interfaces
     * @returns {Array} Array of MIDI interface objects
     */
    enumerateDevices() {
        // Clear existing device maps
        this.outputDevices.clear();
        this.inputDevices.clear();

        // Enumerate output devices
        for (let output of this.midiAccess.outputs.values()) {
            this.outputDevices.set(output.id, {
                id: output.id,
                name: output.name,
                manufacturer: output.manufacturer,
                state: output.state,
                connection: output.connection,
                device: output
            });
        }

        // Enumerate input devices
        for (let input of this.midiAccess.inputs.values()) {
            this.inputDevices.set(input.id, {
                id: input.id,
                name: input.name,
                manufacturer: input.manufacturer,
                state: input.state,
                connection: input.connection,
                device: input
            });
        }

        console.log(`Found ${this.outputDevices.size} output devices and ${this.inputDevices.size} input devices`);
    }

    /**
     * Handle device connection/disconnection events
     * @param {MIDIConnectionEvent} event
     */
    handleDeviceChange(event) {
        console.log(`MIDI interface ${event.port.state}: ${event.port.name}`);
        
        // Re-enumerate devices
        this.enumerateDevices();

        // Notify listeners of device changes
        if (this.onDeviceChangeCallback) {
            this.onDeviceChangeCallback({
                type: event.port.state,
                device: {
                    id: event.port.id,
                    name: event.port.name,
                    manufacturer: event.port.manufacturer,
                    type: event.port.type
                },
                outputDevices: this.getOutputDevicesList(),
                inputDevices: this.getInputDevicesList()
            });
        }
    }

    /**
     * Get list of available output devices for UI
     * @returns {Array} Array of device objects
     */
    getOutputDevicesList() {
        return Array.from(this.outputDevices.values()).map(device => ({
            id: device.id,
            name: device.name,
            manufacturer: device.manufacturer,
            state: device.state,
            displayName: `${device.manufacturer} ${device.name}`.trim()
        }));
    }

    /**
     * Get list of available input devices for UI
     * @returns {Array} Array of device objects
     */
    getInputDevicesList() {
        return Array.from(this.inputDevices.values()).map(device => ({
            id: device.id,
            name: device.name,
            manufacturer: device.manufacturer,
            state: device.state,
            displayName: `${device.manufacturer} ${device.name}`.trim()
        }));
    }

    /**
     * Get output device by ID
     * @param {string} deviceId 
     * @returns {MIDIOutput|null}
     */
    getOutputDevice(deviceId) {
        const device = this.outputDevices.get(deviceId);
        return device ? device.device : null;
    }

    /**
     * Get input device by ID
     * @param {string} deviceId 
     * @returns {MIDIInput|null}
     */
    getInputDevice(deviceId) {
        const device = this.inputDevices.get(deviceId);
        return device ? device.device : null;
    }

    /**
     * Send MIDI message to specific output device
     * @param {string} deviceId 
     * @param {Uint8Array} message 
     * @param {number} timestamp 
     * @returns {boolean} Success status
     */
    sendMidiMessage(deviceId, message, timestamp) {
        const device = this.getOutputDevice(deviceId);
        if (!device || device.state !== 'connected') {
            console.warn(`Cannot send MIDI message: device ${deviceId} not available`);
            return false;
        }

        try {
            device.send(message, timestamp);
            return true;
        } catch (error) {
            console.error(`Error sending MIDI message to ${deviceId}:`, error);
            return false;
        }
    }

    /**
     * Send MIDI message with channel modification
     * @param {string} deviceId 
     * @param {Uint8Array} originalMessage 
     * @param {number} targetChannel (0-15)
     * @param {number} timestamp 
     * @returns {boolean} Success status
     */
    sendMidiMessageToChannel(deviceId, originalMessage, targetChannel, timestamp) {
        if (originalMessage.length === 0) return false;

        // Create a copy of the message
        const message = new Uint8Array(originalMessage);
        
        // Modify channel for channel messages (status bytes 0x80-0xEF)
        const statusByte = message[0];
        if (statusByte >= 0x80 && statusByte <= 0xEF) {
            // Extract message type and set new channel
            const messageType = statusByte & 0xF0;
            message[0] = messageType | (targetChannel & 0x0F);
        }

        return this.sendMidiMessage(deviceId, message, timestamp);
    }

    /**
     * Send panic (all notes off) to all devices or specific device
     * @param {string} deviceId Optional specific device ID
     */
    sendPanic(deviceId = null) {
        const devices = deviceId ? [deviceId] : Array.from(this.outputDevices.keys());
        
        devices.forEach(id => {
            const device = this.getOutputDevice(id);
            if (device && device.state === 'connected') {
                // Send All Notes Off (CC 123) on all channels
                for (let channel = 0; channel < 16; channel++) {
                    const allNotesOff = new Uint8Array([0xB0 | channel, 123, 0]);
                    device.send(allNotesOff);
                    
                    // Also send All Sound Off (CC 120) for good measure
                    const allSoundOff = new Uint8Array([0xB0 | channel, 120, 0]);
                    device.send(allSoundOff);
                }
            }
        });
    }

    /**
     * Set callback for device change events
     * @param {Function} callback 
     */
    setDeviceChangeCallback(callback) {
        this.onDeviceChangeCallback = callback;
    }

    /**
     * Check if MIDI is supported and initialized
     * @returns {boolean}
     */
    isSupported() {
        return !!navigator.requestMIDIAccess && this.isInitialized;
    }

    /**
     * Get device status summary
     * @returns {Object} Status information
     */
    getStatus() {
        return {
            supported: this.isSupported(),
            initialized: this.isInitialized,
            outputCount: this.outputDevices.size,
            inputCount: this.inputDevices.size,
            connectedOutputs: Array.from(this.outputDevices.values())
                .filter(d => d.state === 'connected').length,
            connectedInputs: Array.from(this.inputDevices.values())
                .filter(d => d.state === 'connected').length
        };
    }
}

// Export for both Node.js and browser environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MidiDeviceManager;
} else {
    window.MidiDeviceManager = MidiDeviceManager;
}
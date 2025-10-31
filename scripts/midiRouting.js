/**
 * MIDI Routing Functions
 * Handles actual MIDI message routing between tracks and devices
 */

class MidiRouter {
    constructor(midiDeviceManager, routingMatrix) {
        this.deviceManager = midiDeviceManager;
        this.routingMatrix = routingMatrix;
        this.messageQueue = [];
        this.isProcessing = false;
        this.stats = {
            messagesRouted: 0,
            messagesDropped: 0,
            routingErrors: 0
        };
    }

    /**
     * Route a MIDI message from a track to its configured device
     * @param {string} trackId 
     * @param {Uint8Array} message 
     * @param {number} timestamp 
     * @returns {boolean} Success status
     */
    routeMessage(trackId, message, timestamp = performance.now()) {
        const routing = this.routingMatrix.getRouting(trackId);
        const track = this.routingMatrix.getTrack(trackId);

        // Check if track exists and is active
        if (!track || track.status !== 'connected') {
            console.warn(`Cannot route message: track ${trackId} not active`);
            this.stats.messagesDropped++;
            return false;
        }

        // Check if routing is configured and enabled
        if (!routing || !routing.enabled || !routing.deviceId) {
            console.log(`Message from track ${trackId} not routed: no destination configured`);
            this.stats.messagesDropped++;
            return false;
        }

        // Check if device is available
        if (!this.deviceManager.getOutputDevice(routing.deviceId)) {
            console.warn(`Cannot route message: device ${routing.deviceId} not available`);
            this.stats.routingErrors++;
            return false;
        }

        try {
            // Process the message with routing parameters
            const processedMessage = this.processMessage(message, routing);
            
            // Route to device
            const success = this.deviceManager.sendMidiMessageToChannel(
                routing.deviceId, 
                processedMessage, 
                routing.channel, 
                timestamp
            );

            if (success) {
                this.stats.messagesRouted++;
                console.log(`Message routed from track ${trackId} to device ${routing.deviceId}, channel ${routing.channel + 1}`);
            } else {
                this.stats.routingErrors++;
            }

            return success;
        } catch (error) {
            console.error(`Error routing message from track ${trackId}:`, error);
            this.stats.routingErrors++;
            return false;
        }
    }

    /**
     * Process MIDI message with routing parameters (volume, transpose, etc.)
     * @param {Uint8Array} originalMessage 
     * @param {Object} routing 
     * @returns {Uint8Array} Processed message
     */
    processMessage(originalMessage, routing) {
        if (originalMessage.length === 0) return originalMessage;

        const message = new Uint8Array(originalMessage);
        const statusByte = message[0];
        const messageType = statusByte & 0xF0;

        // Process Note On/Off messages
        if (messageType === 0x90 || messageType === 0x80) {
            if (message.length >= 3) {
                // Apply transposition
                if (routing.transpose !== 0) {
                    let note = message[1] + routing.transpose;
                    // Clamp to valid MIDI range (0-127)
                    note = Math.max(0, Math.min(127, note));
                    message[1] = note;
                }

                // Apply volume scaling for Note On messages
                if (messageType === 0x90 && routing.volume !== 127) {
                    let velocity = Math.round((message[2] * routing.volume) / 127);
                    velocity = Math.max(0, Math.min(127, velocity));
                    message[2] = velocity;
                }
            }
        }
        
        // Process Control Change messages
        else if (messageType === 0xB0) {
            // Apply volume scaling to volume CC (CC7)
            if (message.length >= 3 && message[1] === 7 && routing.volume !== 127) {
                let value = Math.round((message[2] * routing.volume) / 127);
                value = Math.max(0, Math.min(127, value));
                message[2] = value;
            }
        }

        return message;
    }

    /**
     * Route multiple messages from a track (batch processing)
     * @param {string} trackId 
     * @param {Array} messages Array of {message, timestamp} objects
     * @returns {number} Number of successfully routed messages
     */
    routeMessages(trackId, messages) {
        let successCount = 0;
        
        for (const {message, timestamp} of messages) {
            if (this.routeMessage(trackId, message, timestamp)) {
                successCount++;
            }
        }

        return successCount;
    }

    /**
     * Send test message to verify routing
     * @param {string} trackId 
     * @param {number} note MIDI note number (default: middle C)
     * @param {number} velocity Note velocity (default: 64)
     * @returns {boolean} Success status
     */
    sendTestMessage(trackId, note = 60, velocity = 64) {
        const routing = this.routingMatrix.getRouting(trackId);
        
        if (!routing || !routing.enabled || !routing.deviceId) {
            console.warn(`Cannot send test message: track ${trackId} not properly configured`);
            return false;
        }

        // Send Note On
        const noteOn = new Uint8Array([0x90, note, velocity]);
        const noteOnSuccess = this.routeMessage(trackId, noteOn);

        // Send Note Off after 500ms
        if (noteOnSuccess) {
            setTimeout(() => {
                const noteOff = new Uint8Array([0x80, note, 0]);
                this.routeMessage(trackId, noteOff);
            }, 500);
        }

        return noteOnSuccess;
    }

    /**
     * Send panic (all notes off) for a specific track
     * @param {string} trackId 
     * @returns {boolean} Success status
     */
    sendTrackPanic(trackId) {
        const routing = this.routingMatrix.getRouting(trackId);
        
        if (!routing || !routing.deviceId) {
            return false;
        }

        const device = this.deviceManager.getOutputDevice(routing.deviceId);
        if (!device || device.state !== 'connected') {
            return false;
        }

        try {
            // Send All Notes Off and All Sound Off on the track's channel
            const channel = routing.channel;
            const allNotesOff = new Uint8Array([0xB0 | channel, 123, 0]);
            const allSoundOff = new Uint8Array([0xB0 | channel, 120, 0]);
            
            device.send(allNotesOff);
            device.send(allSoundOff);
            
            console.log(`Panic sent for track ${trackId} on channel ${channel + 1}`);
            return true;
        } catch (error) {
            console.error(`Error sending panic for track ${trackId}:`, error);
            return false;
        }
    }

    /**
     * Send panic to all active tracks
     * @returns {number} Number of tracks that received panic
     */
    sendAllTracksPanic() {
        let panicCount = 0;
        
        for (const trackId of this.routingMatrix.getAllTracks().keys()) {
            if (this.sendTrackPanic(trackId)) {
                panicCount++;
            }
        }

        console.log(`Panic sent to ${panicCount} tracks`);
        return panicCount;
    }

    /**
     * Handle track disconnection - send note offs for safety
     * @param {string} trackId 
     */
    handleTrackDisconnect(trackId) {
        console.log(`Handling disconnect for track ${trackId}`);
        this.sendTrackPanic(trackId);
    }

    /**
     * Validate MIDI message format
     * @param {Uint8Array} message 
     * @returns {boolean} True if valid
     */
    validateMessage(message) {
        if (!message || message.length === 0) {
            return false;
        }

        const statusByte = message[0];
        
        // System messages (0xF0-0xFF)
        if (statusByte >= 0xF0) {
            return true; // Accept all system messages
        }

        // Channel messages (0x80-0xEF)
        if (statusByte >= 0x80) {
            const messageType = statusByte & 0xF0;
            
            switch (messageType) {
                case 0x80: // Note Off
                case 0x90: // Note On
                case 0xA0: // Aftertouch
                case 0xB0: // Control Change
                case 0xE0: // Pitch Bend
                    return message.length >= 3;
                case 0xC0: // Program Change
                case 0xD0: // Channel Pressure
                    return message.length >= 2;
                default:
                    return false;
            }
        }

        return false; // Invalid status byte
    }

    /**
     * Get routing statistics
     * @returns {Object} Statistics object
     */
    getStats() {
        return {
            ...this.stats,
            activeRoutes: Array.from(this.routingMatrix.getAllRoutings())
                .filter(([_, routing]) => routing.enabled && routing.deviceId).length,
            availableDevices: this.deviceManager.getOutputDevicesList().length,
            connectedDevices: this.deviceManager.getOutputDevicesList()
                .filter(device => device.state === 'connected').length
        };
    }

    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            messagesRouted: 0,
            messagesDropped: 0,
            routingErrors: 0
        };
    }

    /**
     * Get detailed routing info for debugging
     * @returns {Array} Array of routing details
     */
    getRoutingInfo() {
        const info = [];
        
        for (const [trackId, track] of this.routingMatrix.getAllTracks()) {
            const routing = this.routingMatrix.getRouting(trackId);
            const device = routing?.deviceId ? 
                this.deviceManager.getOutputDevice(routing.deviceId) : null;
            
            info.push({
                trackId,
                initials: track.initials,
                status: track.status,
                routing: routing || null,
                deviceAvailable: device ? device.state === 'connected' : false,
                deviceName: device ? 
                    this.deviceManager.getOutputDevicesList()
                        .find(d => d.id === routing.deviceId)?.displayName : null
            });
        }

        return info;
    }
}

// Export for both Node.js and browser environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MidiRouter;
} else {
    window.MidiRouter = MidiRouter;
}
/**
 * Routing Matrix Manager
 * Manages Track-to-MIDI interface routing configurations and state
 */

class RoutingMatrix {
    constructor() {
        this.routings = new Map(); // trackId -> {deviceId, channel, enabled}
        this.tracks = new Map();   // trackId -> {socketId, initials, status}
        this.maxTracks = 100;      // Default max tracks
        this.onRoutingChangeCallback = null;
        this.onTrackChangeCallback = null;
    }

    /**
     * Add or update a track in the routing matrix
     * @param {string} trackId 
     * @param {string} socketId 
     * @param {string} initials 
     * @param {string} status 
     */
    addTrack(trackId, socketId, initials, status = 'connected') {
        this.tracks.set(trackId, {
            socketId,
            initials,
            status,
            lastActivity: Date.now()
        });

        // Initialize routing if not exists
        if (!this.routings.has(trackId)) {
            this.routings.set(trackId, {
                deviceId: null,     // No device selected initially
                channel: 0,         // MIDI channel 1 (0-based)
                enabled: false,     // Disabled until device is selected
                channelLocked: false, // Channel can be edited
                volume: 127,        // Full volume
                transpose: 0        // No transposition
            });
        }

        // Notify listeners
        if (this.onTrackChangeCallback) {
            this.onTrackChangeCallback('added', trackId, this.tracks.get(trackId));
        }

        console.log(`Track ${trackId} (${initials}) added to routing matrix`);
    }

    /**
     * Remove a track from the routing matrix
     * @param {string} trackId 
     */
    removeTrack(trackId) {
        const track = this.tracks.get(trackId);
        if (track) {
            this.tracks.delete(trackId);
            // Keep routing config in case track reconnects
            
            // Notify listeners
            if (this.onTrackChangeCallback) {
                this.onTrackChangeCallback('removed', trackId, track);
            }

            console.log(`Track ${trackId} removed from routing matrix`);
        }
    }

    /**
     * Update track routing configuration
     * @param {string} trackId 
     * @param {Object} config - {deviceId?, channel?, enabled?, volume?, transpose?}
     * @returns {boolean} Success status
     */
    updateRouting(trackId, config) {
        const currentRouting = this.routings.get(trackId);
        if (!currentRouting) {
            console.warn(`Cannot update routing: track ${trackId} not found`);
            return false;
        }

        // Update routing configuration
        const newRouting = {
            ...currentRouting,
            ...config
        };

        // Validate channel (0-15)
        if (newRouting.channel < 0 || newRouting.channel > 15) {
            console.warn(`Invalid MIDI channel: ${newRouting.channel}`);
            return false;
        }

        // Validate volume (0-127)
        if (newRouting.volume < 0 || newRouting.volume > 127) {
            console.warn(`Invalid volume: ${newRouting.volume}`);
            return false;
        }

        // Validate transpose (-24 to +24 semitones)
        if (newRouting.transpose < -24 || newRouting.transpose > 24) {
            console.warn(`Invalid transpose: ${newRouting.transpose}`);
            return false;
        }

        this.routings.set(trackId, newRouting);

        // Notify listeners
        if (this.onRoutingChangeCallback) {
            this.onRoutingChangeCallback(trackId, newRouting);
        }

        console.log(`Routing updated for track ${trackId}:`, newRouting);
        return true;
    }

    /**
     * Get routing configuration for a specific track
     * @param {string} trackId 
     * @returns {Object|null} Routing config or null if not found
     */
    getRouting(trackId) {
        return this.routings.get(trackId) || null;
    }

    /**
     * Get all current routings
     * @returns {Map} All routing configurations
     */
    getAllRoutings() {
        return new Map(this.routings);
    }

    /**
     * Get track information
     * @param {string} trackId 
     * @returns {Object|null} Track info or null if not found
     */
    getTrack(trackId) {
        return this.tracks.get(trackId) || null;
    }

    /**
     * Get all tracks
     * @returns {Map} All track information
     */
    getAllTracks() {
        return new Map(this.tracks);
    }

    /**
     * Find track by socket ID
     * @param {string} socketId 
     * @returns {string|null} Track ID or null if not found
     */
    findTrackBySocketId(socketId) {
        for (const [trackId, track] of this.tracks) {
            if (track.socketId === socketId) {
                return trackId;
            }
        }
        return null;
    }

    /**
     * Get tracks routed to a specific device
     * @param {string} deviceId 
     * @returns {Array} Array of track IDs
     */
    getTracksForDevice(deviceId) {
        const tracks = [];
        for (const [trackId, routing] of this.routings) {
            if (routing.deviceId === deviceId && routing.enabled) {
                tracks.push(trackId);
            }
        }
        return tracks;
    }

    /**
     * Get tracks using a specific device/channel combination
     * @param {string} deviceId 
     * @param {number} channel 
     * @returns {Array} Array of track IDs
     */
    getTracksForDeviceChannel(deviceId, channel) {
        const tracks = [];
        for (const [trackId, routing] of this.routings) {
            if (routing.deviceId === deviceId && 
                routing.channel === channel && 
                routing.enabled) {
                tracks.push(trackId);
            }
        }
        return tracks;
    }

    /**
     * Check if a device/channel combination is available
     * @param {string} deviceId 
     * @param {number} channel 
     * @param {string} excludeTrackId Optional track to exclude from check
     * @returns {boolean} True if available
     */
    isDeviceChannelAvailable(deviceId, channel, excludeTrackId = null) {
        for (const [trackId, routing] of this.routings) {
            if (trackId === excludeTrackId) continue;
            if (routing.deviceId === deviceId && 
                routing.channel === channel && 
                routing.enabled) {
                return false;
            }
        }
        return true;
    }

    /**
     * Get next available channel for a device
     * @param {string} deviceId 
     * @returns {number} Next available channel (0-15) or -1 if all used
     */
    getNextAvailableChannel(deviceId) {
        for (let channel = 0; channel < 16; channel++) {
            if (this.isDeviceChannelAvailable(deviceId, channel)) {
                return channel;
            }
        }
        return -1; // All channels in use
    }

    /**
     * Enable/disable routing for a track
     * @param {string} trackId 
     * @param {boolean} enabled 
     * @returns {boolean} Success status
     */
    setTrackEnabled(trackId, enabled) {
        return this.updateRouting(trackId, { enabled });
    }

    /**
     * Update track status (connected/disconnected)
     * @param {string} trackId 
     * @param {string} status 
     */
    updateTrackStatus(trackId, status) {
        const track = this.tracks.get(trackId);
        if (track) {
            track.status = status;
            track.lastActivity = Date.now();

            // Notify listeners
            if (this.onTrackChangeCallback) {
                this.onTrackChangeCallback('updated', trackId, track);
            }
        }
    }

    /**
     * Get routing matrix data for UI display
     * @returns {Array} Array of track/routing objects for UI
     */
    getMatrixData() {
        const data = [];
        
        // Create entries for all existing tracks
        for (const [trackId, track] of this.tracks) {
            const routing = this.routings.get(trackId);
            data.push({
                trackId,
                trackNumber: parseInt(trackId) + 1, // Display as 1-based
                socketId: track.socketId,
                initials: track.initials,
                status: track.status,
                deviceId: routing?.deviceId || null,
                channel: routing?.channel || 0,
                channelLocked: routing?.channelLocked || false,
                enabled: routing?.enabled || false,
                volume: routing?.volume || 127,
                transpose: routing?.transpose || 0,
                lastActivity: track.lastActivity
            });
        }

        // Sort by track number
        data.sort((a, b) => a.trackNumber - b.trackNumber);
        
        return data;
    }

    /**
     * Export routing configuration for persistence
     * @returns {Object} Serializable routing configuration
     */
    exportConfig() {
        return {
            routings: Object.fromEntries(this.routings),
            tracks: Object.fromEntries(this.tracks),
            timestamp: Date.now()
        };
    }

    /**
     * Import routing configuration from persistence
     * @param {Object} config 
     * @returns {boolean} Success status
     */
    importConfig(config) {
        try {
            if (config.routings) {
                this.routings = new Map(Object.entries(config.routings));
            }
            if (config.tracks) {
                this.tracks = new Map(Object.entries(config.tracks));
            }
            console.log('Routing configuration imported successfully');
            return true;
        } catch (error) {
            console.error('Failed to import routing configuration:', error);
            return false;
        }
    }

    /**
     * Clear all routing configurations
     */
    clear() {
        this.routings.clear();
        this.tracks.clear();
        console.log('Routing matrix cleared');
    }

    /**
     * Set callback for routing changes
     * @param {Function} callback 
     */
    setRoutingChangeCallback(callback) {
        this.onRoutingChangeCallback = callback;
    }

    /**
     * Set callback for track changes
     * @param {Function} callback 
     */
    setTrackChangeCallback(callback) {
        this.onTrackChangeCallback = callback;
    }

    /**
     * Get statistics about the routing matrix
     * @returns {Object} Statistics
     */
    getStats() {
        const totalTracks = this.tracks.size;
        const activeTracks = Array.from(this.tracks.values())
            .filter(t => t.status === 'connected').length;
        const routedTracks = Array.from(this.routings.values())
            .filter(r => r.enabled && r.deviceId).length;
        
        const deviceUsage = new Map();
        for (const routing of this.routings.values()) {
            if (routing.enabled && routing.deviceId) {
                const count = deviceUsage.get(routing.deviceId) || 0;
                deviceUsage.set(routing.deviceId, count + 1);
            }
        }

        return {
            totalTracks,
            activeTracks,
            routedTracks,
            deviceUsage: Object.fromEntries(deviceUsage)
        };
    }
}

// Export for both Node.js and browser environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RoutingMatrix;
} else {
    window.RoutingMatrix = RoutingMatrix;
}
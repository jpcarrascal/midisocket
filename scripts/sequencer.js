/**
 * MIDI Routing Sequencer
 * Main application logic for the routing matrix interface
 */

// Global application state
let app = {
    // Core components
    midiDeviceManager: null,
    routingMatrix: null,
    midiRouter: null,
    socket: null,
    
    // Session info
    sessionName: null,
    isPlaying: false,
    
    // UI elements
    elements: {},
    
    // Statistics
    lastStatsUpdate: 0,
    statsUpdateInterval: 1000 // Update every second
};

// Global device configuration instance
let deviceConfig = null;

// Initialize application when page loads
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Initializing MIDI Routing Sequencer...');
    
    // Get DOM elements
    initializeElements();
    
    // Debug: Check initial panel states
    console.log('Device config panel hidden?', document.getElementById('device-config-panel')?.classList.contains('hidden'));
    console.log('Device panel hidden?', document.getElementById('device-panel')?.classList.contains('hidden'));
    console.log('Device selection modal hidden?', document.getElementById('device-selection-modal')?.classList.contains('hidden'));
    
    // Initialize core components
    await initializeMidi();
    
    // Initialize device configuration system
    await initializeDeviceConfiguration();
    
    // Initialize socket connection
    initializeSocket();
    
    // Set up event listeners
    setupEventListeners();
    
    // Update UI
    updateSessionInfo();
    updateTrackUrl();
    
    console.log('MIDI Routing Sequencer initialized successfully');
});

/**
 * Initialize DOM element references
 */
function initializeElements() {
    app.elements = {
        // Session info
        sessionName: document.getElementById('session-name'),
        sessionStatus: document.getElementById('session-status'),
        midiStatus: document.getElementById('midi-status'),
        
        // Controls
        playButton: document.getElementById('play-button'),
        pauseButton: document.getElementById('pause-button'),
        panicAllButton: document.getElementById('panic-all'),
        deviceConfigToggle: document.getElementById('device-config-toggle'),
        infoToggle: document.getElementById('info-toggle'),
        statsToggle: document.getElementById('stats-toggle'),
        
        // Panels
        devicePanel: document.getElementById('device-panel'),
        statsPanel: document.getElementById('stats-panel'),
        deviceStatus: document.getElementById('device-status'),
        deviceList: document.getElementById('device-list'),
        
        // Routing matrix
        routingTable: document.getElementById('routing-table'),
        routingTableBody: document.getElementById('routing-table-body'),
        noTracksMessage: document.getElementById('no-tracks-message'),
        trackUrl: document.getElementById('track-url'),
        copyUrlButton: document.getElementById('copy-url'),
        
        // Statistics
        statActiveTracks: document.getElementById('stat-active-tracks'),
        statRoutedTracks: document.getElementById('stat-routed-tracks'),
        statMessagesRouted: document.getElementById('stat-messages-routed'),
        statRoutingErrors: document.getElementById('stat-routing-errors'),
        
        // Messages
        errorMessage: document.getElementById('error-message'),
        infoMessage: document.getElementById('info-message')
    };
}

/**
 * Initialize MIDI system
 */
async function initializeMidi() {
    try {
        // Initialize MIDI Interface Manager
        app.midiDeviceManager = new MidiDeviceManager();
        const midiSupported = await app.midiDeviceManager.initialize();
        
        if (!midiSupported) {
            showError('Web MIDI API not supported in this browser');
            app.elements.midiStatus.innerHTML = '<strong>Not Supported</strong>';
            return;
        }
        
        // Initialize Routing Matrix
        app.routingMatrix = new RoutingMatrix();
        
        // Initialize MIDI Router
        app.midiRouter = new MidiRouter(app.midiDeviceManager, app.routingMatrix);
        
        // Set up callbacks
        app.midiDeviceManager.setDeviceChangeCallback(onDeviceChange);
        app.routingMatrix.setTrackChangeCallback(onTrackChange);
        app.routingMatrix.setRoutingChangeCallback(onRoutingChange);
        
        // Update UI
        app.elements.midiStatus.innerHTML = '<strong>Ready</strong>';
        updateDeviceList();
        
        console.log('MIDI system initialized successfully');
        
    } catch (error) {
        console.error('Failed to initialize MIDI system:', error);
        showError('Failed to initialize MIDI system: ' + error.message);
        app.elements.midiStatus.innerHTML = '<strong>Error</strong>';
    }
}

/**
 * Initialize device configuration system
 */
async function initializeDeviceConfiguration() {
    try {
        // Create and initialize device configuration
        deviceConfig = new DeviceConfiguration();
        await deviceConfig.initialize();
        
        // Update available interfaces when MIDI devices change
        deviceConfig.updateAvailableInterfaces(app.midiDeviceManager.getOutputDevicesList());
        
        console.log('Device configuration system initialized');
        
    } catch (error) {
        console.error('Failed to initialize device configuration:', error);
        showError('Failed to initialize device configuration: ' + error.message);
    }
}

/**
 * Initialize socket connection
 */
function initializeSocket() {
    // Get session name from URL
    const urlParams = new URLSearchParams(window.location.search);
    app.sessionName = urlParams.get('session') || 'default';
    
    // Initialize socket connection
    app.socket = io('', {
        query: { 
            session: app.sessionName,
            type: 'sequencer'
        }
    });
    
    // Socket event handlers
    app.socket.on('connect', onSocketConnect);
    app.socket.on('disconnect', onSocketDisconnect);
    app.socket.on('track joined', onTrackJoined);
    app.socket.on('track left', onTrackLeft);
    app.socket.on('track-midi-message', onTrackMidiMessage);
    app.socket.on('get-track-assignment', onGetTrackAssignment);
    app.socket.on('sequencer exists', onSequencerExists);
    app.socket.on('error', onSocketError);
}

/**
 * Set up event listeners for UI elements
 */
function setupEventListeners() {
    // Session controls
    app.elements.playButton.addEventListener('click', onPlaySession);
    app.elements.pauseButton.addEventListener('click', onPauseSession);
    app.elements.panicAllButton.addEventListener('click', onPanicAll);
    
    // Panel toggles
    app.elements.deviceConfigToggle.addEventListener('click', () => {
        deviceConfig.toggleVisibility();
    });
    
    app.elements.infoToggle.addEventListener('click', () => {
        app.elements.devicePanel.classList.toggle('hidden');
    });
    
    app.elements.statsToggle.addEventListener('click', () => {
        app.elements.statsPanel.classList.toggle('hidden');
    });
    
    // Copy URL button
    app.elements.copyUrlButton.addEventListener('click', onCopyUrl);
}

// ===== SOCKET EVENT HANDLERS =====

function onSocketConnect() {
    console.log('Socket connected:', app.socket.id);
    app.elements.sessionStatus.innerHTML = '<strong>Connected</strong>';
    showInfo('Connected to session: ' + app.sessionName);
}

function onSocketDisconnect() {
    console.log('Socket disconnected');
    app.elements.sessionStatus.innerHTML = '<strong>Disconnected</strong>';
    showError('Disconnected from server');
}

function onTrackJoined(data) {
    console.log('Track joined:', data);
    const trackId = data.track.toString();
    
    // Add track to routing matrix
    app.routingMatrix.addTrack(trackId, data.socketID, data.initials);
    
    // Update UI
    updateRoutingMatrix();
    updateStatistics();
}

function onTrackLeft(data) {
    console.log('Track left:', data);
    const trackId = data.track.toString();
    
    // Handle disconnect in MIDI router (sends note offs)
    if (app.midiRouter) {
        app.midiRouter.handleTrackDisconnect(trackId);
    }
    
    // Remove track from routing matrix
    app.routingMatrix.removeTrack(trackId);
    
    // Update UI
    updateRoutingMatrix();
    updateStatistics();
}

function onTrackMidiMessage(data) {
    if (!app.midiRouter) return;
    
    // Find track by socket ID
    const trackId = app.routingMatrix.findTrackBySocketId(data.socketID);
    if (!trackId) {
        console.warn('Received MIDI message from unknown track:', data.socketID);
        return;
    }
    
    // Route the MIDI message
    const success = app.midiRouter.routeMessage(
        trackId, 
        new Uint8Array(data.message), 
        data.timestamp || performance.now()
    );
    
    if (success) {
        // Flash visual feedback for the track
        flashTrackActivity(trackId);
    }
    
    // Update statistics periodically
    if (Date.now() - app.lastStatsUpdate > app.statsUpdateInterval) {
        updateStatistics();
        app.lastStatsUpdate = Date.now();
    }
}

function onGetTrackAssignment(data) {
    console.log('Track assignment request:', data);
    
    try {
        // Find track information
        const trackId = data.track.toString();
        const routing = app.routingMatrix ? app.routingMatrix.getRouting(trackId) : null;
        const track = app.routingMatrix ? app.routingMatrix.getTrack(trackId) : null;
        
        if (!track) {
            console.warn('Track assignment request for unknown track:', trackId);
            // Still send a response with no device
            app.socket.emit('track-assignment', {
                socketID: data.socketID,
                device: null,
                channel: 0,
                trackId: trackId,
                trackNumber: parseInt(trackId) + 1
            });
            return;
        }
        
        // Send basic assignment data (without device info for now)
        const assignmentData = {
            socketID: data.socketID,
            device: null, // Simplified - no device lookup for now
            channel: routing ? routing.channel : 0,
            trackId: trackId,
            trackNumber: parseInt(trackId) + 1
        };
        
        console.log('Sending track assignment:', assignmentData);
        app.socket.emit('track-assignment', assignmentData);
        
        // Also send track data for compatibility
        const colors = ['#667eea', '#ffffff'];
        app.socket.emit('track data', {
            socketID: data.socketID,
            channel: routing ? routing.channel : 0,
            colors: colors
        });
        
    } catch (error) {
        console.error('Error in onGetTrackAssignment:', error);
    }
}

function onSequencerExists(data) {
    showError('Session already has a sequencer: ' + data.reason);
    setTimeout(() => {
        window.location.href = '/';
    }, 3000);
}

function onSocketError(error) {
    console.error('Socket error:', error);
    showError('Socket error: ' + error.message);
}

// ===== MIDI EVENT HANDLERS =====

function onDeviceChange(data) {
    console.log('MIDI interface change:', data);
    updateDeviceList();
    
    if (data.type === 'connected') {
        showInfo('MIDI interface connected: ' + data.device.name);
    } else if (data.type === 'disconnected') {
        showInfo('MIDI interface disconnected: ' + data.device.name);
    }
}

function onTrackChange(action, trackId, track) {
    console.log('Track change:', action, trackId, track);
    updateRoutingMatrix();
}

function onRoutingChange(trackId, routing) {
    console.log('Routing change:', trackId, routing);
    
    // Send updated assignment to the track when routing changes
    const track = app.routingMatrix.getTrack(trackId);
    console.log('Track info for routing change:', track);
    
    if (track && track.socketId) {
        // Get device information if assigned
        let deviceInfo = null;
        if (routing && routing.deviceId && routing.enabled) {
            console.log('Routing change - device assigned:', routing.deviceId, 'enabled:', routing.enabled);
            
            // Handle different device ID formats
            let actualDeviceId = routing.deviceId;
            if (routing.deviceId.startsWith('device:')) {
                actualDeviceId = parseInt(routing.deviceId.replace('device:', ''));
                console.log('Parsed device ID from device: format:', actualDeviceId);
            }
            
            if (deviceConfig) {
                const device = deviceConfig.getDeviceConfig(actualDeviceId);
                console.log('Device from config:', device);
                if (device) {
                    deviceInfo = {
                        id: routing.deviceId,
                        name: device.name || 'Unknown Device',
                        interface: device.assignedInterface,
                        controls: device.controls || null
                    };
                    console.log('Created device info:', deviceInfo);
                }
            } else {
                console.warn('deviceConfig not available');
            }
        } else {
            console.log('No device assigned or not enabled. DeviceId:', routing?.deviceId, 'Enabled:', routing?.enabled);
        }
        
        // Send updated assignment to track
        const assignmentData = {
            socketID: track.socketId,
            device: deviceInfo,
            channel: routing ? routing.channel : 0,
            trackId: trackId,
            trackNumber: parseInt(trackId) + 1
        };
        
        console.log('Sending routing change assignment update:', assignmentData);
        app.socket.emit('track-assignment', assignmentData);
    }
}

// ===== UI EVENT HANDLERS =====

function onPlaySession() {
    app.isPlaying = true;
    app.elements.playButton.disabled = true;
    app.elements.pauseButton.disabled = false;
    
    // Emit session play event
    app.socket.emit('session play', { socketID: app.socket.id });
    
    showInfo('Session started - tracks can now play');
}

function onPauseSession() {
    app.isPlaying = false;
    app.elements.playButton.disabled = false;
    app.elements.pauseButton.disabled = true;
    
    // Emit session pause event
    app.socket.emit('session pause', { socketID: app.socket.id });
    
    showInfo('Session paused - tracks are now muted');
}

function onPanicAll() {
    if (app.midiRouter) {
        const panicCount = app.midiRouter.sendAllTracksPanic();
        showInfo(`Panic sent to ${panicCount} tracks`);
    }
}

function onCopyUrl() {
    const url = app.elements.trackUrl.textContent;
    navigator.clipboard.writeText(url).then(() => {
        showInfo('URL copied to clipboard!');
        app.elements.copyUrlButton.textContent = '✓';
        setTimeout(() => {
            app.elements.copyUrlButton.textContent = '📋';
        }, 2000);
    }).catch(() => {
        showError('Failed to copy URL to clipboard');
    });
}

// ===== UI UPDATE FUNCTIONS =====

function updateSessionInfo() {
    if (app.elements.sessionName) {
        app.elements.sessionName.textContent = app.sessionName || '-';
    }
}

function updateTrackUrl() {
    const baseUrl = window.location.origin;
    const trackUrl = `${baseUrl}/track?session=${app.sessionName}`;
    
    if (app.elements.trackUrl) {
        app.elements.trackUrl.textContent = trackUrl;
    }
}

function updateDeviceList() {
    if (!app.midiDeviceManager || !app.elements.deviceList) return;
    
    const devices = app.midiDeviceManager.getOutputDevicesList();
    const status = app.midiDeviceManager.getStatus();
    
    // Update device status
    if (app.elements.deviceStatus) {
        if (status.supported) {
            app.elements.deviceStatus.innerHTML = `
                <div>✅ Web MIDI supported - ${status.connectedOutputs} of ${status.outputCount} devices connected</div>
            `;
        } else {
            app.elements.deviceStatus.innerHTML = `
                <div>❌ Web MIDI not supported in this browser</div>
            `;
        }
    }
    
    // Update device list
    app.elements.deviceList.innerHTML = '';
    
    if (devices.length === 0) {
        app.elements.deviceList.innerHTML = `
            <div class="device-item">
                <div class="device-status-indicator disconnected"></div>
                <div class="device-info">
                    <div class="device-name">No MIDI interfaces detected</div>
                    <div class="device-manufacturer">Connect a MIDI interface or synthesizer</div>
                </div>
            </div>
        `;
    } else {
        devices.forEach(device => {
            const deviceElement = document.createElement('div');
            deviceElement.className = 'device-item';
            deviceElement.innerHTML = `
                <div class="device-status-indicator ${device.state === 'connected' ? '' : 'disconnected'}"></div>
                <div class="device-info">
                    <div class="device-name">${device.name}</div>
                    <div class="device-manufacturer">${device.manufacturer}</div>
                </div>
            `;
            app.elements.deviceList.appendChild(deviceElement);
        });
    }
    
    // Update device configuration with available interfaces
    if (deviceConfig) {
        const interfaces = devices.map(device => ({
            id: device.id,
            name: device.name,
            manufacturer: device.manufacturer,
            state: device.state
        }));
        deviceConfig.updateAvailableInterfaces(interfaces);
    }
}

function updateRoutingMatrix() {
    if (!app.routingMatrix || !app.elements.routingTableBody) return;
    
    const matrixData = app.routingMatrix.getMatrixData();
    const devices = app.midiDeviceManager ? app.midiDeviceManager.getOutputDevicesList() : [];
    
    // Clear existing rows
    app.elements.routingTableBody.innerHTML = '';
    
    if (matrixData.length === 0) {
        // Show empty state
        app.elements.noTracksMessage.style.display = 'block';
        return;
    }
    
    // Hide empty state
    app.elements.noTracksMessage.style.display = 'none';
    
    // Create rows for each track
    matrixData.forEach(track => {
        const row = createTrackRow(track, devices);
        app.elements.routingTableBody.appendChild(row);
    });
}

function createTrackRow(track, devices) {
    const row = document.createElement('tr');
    row.setAttribute('data-track-id', track.trackId);
    
    // Track number
    const trackNumCell = document.createElement('td');
    trackNumCell.innerHTML = `<span class="track-number">${track.trackNumber}</span>`;
    row.appendChild(trackNumCell);
    
    // User initials
    const initialsCell = document.createElement('td');
    initialsCell.innerHTML = `<span class="user-initials">${track.initials}</span>`;
    row.appendChild(initialsCell);
    
    // Status
    const statusCell = document.createElement('td');
    statusCell.innerHTML = `<span class="track-status ${track.status}">${track.status}</span>`;
    row.appendChild(statusCell);
    
    // Device selector
    const deviceCell = document.createElement('td');
    const deviceSelect = createDeviceSelect(track, devices);
    deviceCell.appendChild(deviceSelect);
    row.appendChild(deviceCell);
    
    // Channel selector
    const channelCell = document.createElement('td');
    const channelSelect = createChannelSelect(track);
    channelCell.appendChild(channelSelect);
    row.appendChild(channelCell);
    
    // Actions
    const actionsCell = document.createElement('td');
    const actionButtons = createActionButtons(track);
    actionsCell.appendChild(actionButtons);
    row.appendChild(actionsCell);
    
    return row;
}

function createDeviceSelect(track, devices) {
    const select = document.createElement('select');
    select.className = 'routing-select';
    select.disabled = track.status !== 'connected';
    
    // Add default option
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Select Output...';
    select.appendChild(defaultOption);
    
    // Add configured devices first (if any)
    if (deviceConfig) {
        const configuredDevices = deviceConfig.getConfiguredDevices();
        if (configuredDevices.length > 0) {
            // Add separator
            const separator = document.createElement('option');
            separator.disabled = true;
            separator.textContent = '── Configured Devices ──';
            select.appendChild(separator);
            
            configuredDevices.forEach(device => {
                const option = document.createElement('option');
                option.value = `device:${device.deviceId}`;
                option.textContent = `${device.name} (Ch ${device.assignedChannel})`;
                
                // Check if assigned interface is valid and connected
                const hasValidInterface = device.assignedInterface && 
                    devices.some(d => d.id === device.assignedInterface && d.state === 'connected');
                
                option.disabled = !hasValidInterface;
                
                if (track.deviceId === `device:${device.deviceId}`) {
                    option.selected = true;
                }
                
                select.appendChild(option);
            });
        }
    }
    
    // Add raw MIDI interfaces
    if (devices.length > 0) {
        // Add separator
        const separator = document.createElement('option');
        separator.disabled = true;
        separator.textContent = '── MIDI Interfaces ──';
        select.appendChild(separator);
        
        devices.forEach(device => {
            const option = document.createElement('option');
            option.value = `interface:${device.id}`;
            option.textContent = device.displayName;
            option.disabled = device.state !== 'connected';
            
            if (track.deviceId === `interface:${device.id}`) {
                option.selected = true;
            }
            
            select.appendChild(option);
        });
    }
    
    // Event handler
    select.addEventListener('change', (e) => {
        const deviceId = e.target.value || null;
        const enabled = deviceId !== null;
        
        let channel = track.channel || 1;
        let channelLocked = false;
        
        // Handle different device types
        if (enabled && deviceId) {
            if (deviceId.startsWith('device:')) {
                // Configured device - use assigned channel
                const configDeviceId = parseInt(deviceId.replace('device:', ''));
                const configuredDevice = deviceConfig?.getDeviceConfig(configDeviceId);
                if (configuredDevice) {
                    // Convert from 1-based (device config) to 0-based (routing matrix)
                    channel = configuredDevice.assignedChannel - 1;
                    channelLocked = true;
                }
            } else if (deviceId.startsWith('interface:')) {
                // Raw interface - auto-assign available channel
                const interfaceId = deviceId.replace('interface:', '');
                const availableChannel = app.routingMatrix.getNextAvailableChannel(interfaceId);
                if (availableChannel >= 0) {
                    channel = availableChannel;
                }
            }
        }
        
        console.log('Device selection changed for track', track.trackId, 'to deviceId:', deviceId, 'enabled:', enabled);
        
        app.routingMatrix.updateRouting(track.trackId, {
            deviceId: deviceId,
            channel: channel,
            channelLocked: channelLocked,
            enabled: enabled
        });
        
        updateRoutingMatrix();
    });
    
    return select;
}

function createChannelSelect(track) {
    const select = document.createElement('select');
    select.className = 'routing-select';
    
    // Check if channel is locked (configured device)
    const isChannelLocked = track.channelLocked || false;
    
    select.disabled = !track.enabled || track.status !== 'connected' || isChannelLocked;
    
    // Add locked indicator if needed
    if (isChannelLocked) {
        select.classList.add('channel-locked');
        select.title = 'Channel locked by device configuration';
    }
    
    // Add channel options (1-16)
    for (let i = 0; i < 16; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = (i + 1).toString();
        
        if (track.channel === i) {
            option.selected = true;
        }
        
        select.appendChild(option);
    }
    
    // Event handler (only if not locked)
    if (!isChannelLocked) {
        select.addEventListener('change', (e) => {
            const channel = parseInt(e.target.value);
            app.routingMatrix.updateRouting(track.trackId, { channel: channel });
        });
    }
    
    return select;
}

function createActionButtons(track) {
    const container = document.createElement('div');
    container.className = 'action-buttons';
    
    // Test button
    const testBtn = document.createElement('button');
    testBtn.className = 'action-btn test-btn';
    testBtn.innerHTML = 'Test';
    testBtn.title = 'Send test note';
    testBtn.disabled = !track.enabled || track.status !== 'connected';
    
    testBtn.addEventListener('click', () => {
        if (app.midiRouter) {
            app.midiRouter.sendTestMessage(track.trackId);
            flashTrackActivity(track.trackId);
        }
    });
    
    container.appendChild(testBtn);
    
    // Panic button
    const panicBtn = document.createElement('button');
    panicBtn.className = 'action-btn panic-btn';
    panicBtn.innerHTML = 'Panic';
    panicBtn.title = 'Send panic (all notes off)';
    panicBtn.disabled = !track.enabled || track.status !== 'connected';
    
    panicBtn.addEventListener('click', () => {
        if (app.midiRouter) {
            app.midiRouter.sendTrackPanic(track.trackId);
        }
    });
    
    container.appendChild(panicBtn);
    
    return container;
}

function updateStatistics() {
    if (!app.midiRouter || !app.routingMatrix) return;
    
    const stats = app.midiRouter.getStats();
    const matrixStats = app.routingMatrix.getStats();
    
    // Update statistics display
    if (app.elements.statActiveTracks) {
        app.elements.statActiveTracks.textContent = matrixStats.activeTracks;
    }
    if (app.elements.statRoutedTracks) {
        app.elements.statRoutedTracks.textContent = matrixStats.routedTracks;
    }
    if (app.elements.statMessagesRouted) {
        app.elements.statMessagesRouted.textContent = stats.messagesRouted;
    }
    if (app.elements.statRoutingErrors) {
        app.elements.statRoutingErrors.textContent = stats.routingErrors;
    }
}

function flashTrackActivity(trackId) {
    const row = document.querySelector(`tr[data-track-id="${trackId}"]`);
    if (row) {
        row.classList.add('status-change');
        setTimeout(() => {
            row.classList.remove('status-change');
        }, 600);
    }
}

// ===== UTILITY FUNCTIONS =====

function showError(message) {
    console.error(message);
    if (app.elements.errorMessage) {
        app.elements.errorMessage.textContent = message;
        app.elements.errorMessage.classList.remove('hidden');
        
        setTimeout(() => {
            app.elements.errorMessage.classList.add('hidden');
        }, 5000);
    }
}

function showInfo(message) {
    console.info(message);
    if (app.elements.infoMessage) {
        app.elements.infoMessage.textContent = message;
        app.elements.infoMessage.classList.remove('hidden');
        
        setTimeout(() => {
            app.elements.infoMessage.classList.add('hidden');
        }, 3000);
    }
}

// Expose functions globally for inter-module communication
window.updateRoutingMatrix = updateRoutingMatrix;
window.deviceConfig = () => deviceConfig;
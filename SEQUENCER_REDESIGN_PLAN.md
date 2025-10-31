# MIDI Sequencer Redesign Plan

## Project Overview
Redesign the Sequencer interface to act as a MIDI routing bridge between remote Track app instances and local MIDI devices connected to the computer running the Sequencer.

## Current State Analysis
- Current sequencer manages collaborative step sequencing with built-in synthesizers
- Uses Socket.io for real-time communication between sequencer and track instances
- Has basic MIDI support but limited routing capabilities
- Mobile-optimized track interface for remote users

## New Requirements
1. **MIDI Bridge Functionality**: Route messages from Track apps to local MIDI devices
2. **Per-Channel Routing**: Map each Track to specific MIDI device + channel combinations
3. **Dynamic Device Detection**: Detect and list available MIDI interfaces
4. **Routing Matrix UI**: Table/matrix interface for configuring Track-to-MIDI mappings
5. **Real-time Updates**: Add new tracks to routing table as users join

## Technical Architecture

### Core Components to Modify/Create

#### 1. MIDI Device Management (`scripts/midiDeviceManager.js`)
```javascript
// New module responsibilities:
- Detect available MIDI output devices using Web MIDI API
- Maintain list of devices and their status
- Handle device connection/disconnection events
- Provide device enumeration for UI dropdowns
```

#### 2. Routing Matrix Manager (`scripts/routingMatrix.js`)
```javascript
// New module responsibilities:
- Store Track-to-MIDI device/channel mappings
- Handle routing logic for incoming Track messages
- Validate routing configurations
- Persist routing settings (localStorage/session)
```

#### 3. Updated Sequencer UI (`html/sequencer.html` + `css/sequencer.css`)
```html
<!-- Main UI elements: -->
- Routing Matrix Table (Track rows × Device/Channel columns)
- Device/Channel dropdown pairs for each track
- MIDI device status indicators
- Session management controls
- Real-time track connection status
```

#### 4. Enhanced Sequencer Logic (`scripts/sequencer.js`)
```javascript
// Updated responsibilities:
- Initialize MIDI device detection
- Manage routing matrix state
- Handle Track app connections/disconnections
- Route MIDI messages based on matrix configuration
- Update UI when tracks join/leave
```

#### 5. Socket Event Handlers (in `index.js`)
```javascript
// New/modified socket events:
- 'track-midi-message': Route incoming MIDI from tracks to devices
- 'request-routing-config': Send current routing to newly connected tracks
- 'update-routing': Handle routing changes from sequencer UI
```

## Implementation Plan

### Phase 1: MIDI Infrastructure
1. **Create MIDI Device Manager**
   - Implement Web MIDI API device detection
   - Create device enumeration functions
   - Handle device connection events
   - Test with various MIDI interfaces

2. **Create Routing Matrix Core**
   - Design routing data structure
   - Implement routing logic functions
   - Create validation methods
   - Add persistence layer

### Phase 2: UI Development
1. **Design Routing Matrix Interface**
   - Create responsive table layout
   - Implement device/channel dropdown components
   - Add visual indicators for device status
   - Style for desktop use (sequencer is local)

2. **Update Sequencer HTML/CSS**
   - Replace current sequencer interface with routing matrix
   - Maintain session controls (play/pause/info)
   - Add MIDI device status section
   - Ensure accessibility and usability

### Phase 3: Integration
1. **Update Socket Communication**
   - Modify server-side event handlers for MIDI routing
   - Update Track app to send MIDI messages via socket
   - Implement routing configuration synchronization
   - Add error handling for routing failures

2. **Update Sequencer JavaScript**
   - Initialize MIDI systems on page load
   - Handle track connection/disconnection UI updates
   - Implement routing configuration UI logic
   - Add real-time MIDI message routing

### Phase 4: Testing & Refinement
1. **Test MIDI Device Integration**
   - Test with hardware synthesizers
   - Test with software MIDI devices
   - Verify multi-device routing
   - Test device hot-plugging

2. **Test Multi-Track Scenarios**
   - Connect multiple Track app instances
   - Verify routing independence
   - Test session management
   - Validate performance with many tracks

## File Structure Changes

### New Files
```
scripts/
  ├── midiDeviceManager.js      # MIDI device detection & management
  ├── routingMatrix.js          # Routing logic and state management
  └── midiRouting.js           # MIDI message routing functions

css/
  └── routingMatrix.css        # Styling for the new routing interface
```

### Modified Files
```
html/sequencer.html             # Complete UI redesign
scripts/sequencer.js            # Updated for routing functionality  
css/sequencer.css              # Updated styles for new interface
index.js                       # New socket events for MIDI routing
```

## UI Mockup Structure

### Main Routing Matrix Table
```
| Track | User    | Device          | Channel | Status | Actions |
|-------|---------|-----------------|---------|--------|---------|
| 1     | ALICE   | [Device ▼]     | [Ch ▼] | 🟢     | [Test]  |
| 2     | BOB     | [Device ▼]     | [Ch ▼] | 🟢     | [Test]  |
| 3     | -       | [Device ▼]     | [Ch ▼] | ⚪     | [Test]  |
```

### Device Status Panel
```
📱 Connected Devices:
🟢 Korg Minilogue (16 channels)
🟢 Roland TR-8S (16 channels) 
🔴 Arturia MicroBrute (Disconnected)
```

### Session Controls
```
[Session: MYSESSION] [▶️ Play] [⏸️ Pause] [🛑 Panic All] [ℹ️ Info]
```

## Socket Event Protocol Updates

### New Events (Sequencer → Track)
- `routing-config`: Send current routing configuration to track
- `midi-routing-updated`: Notify track of routing changes

### New Events (Track → Sequencer)  
- `track-midi-out`: Send MIDI message to be routed by sequencer
- `request-routing-info`: Request current routing configuration

### Modified Events
- `track joined`: Include MIDI routing capabilities info
- `track left`: Update routing matrix UI

## Development Priorities
1. **High Priority**: Core MIDI routing functionality
2. **Medium Priority**: Dynamic device detection and UI updates
3. **Low Priority**: Routing presets and advanced configuration

## Success Criteria
- [ ] Sequencer detects local MIDI devices automatically
- [ ] Each connected Track can be routed to any Device+Channel combination
- [ ] MIDI messages from Track apps reach correct MIDI destinations
- [ ] UI updates in real-time as tracks connect/disconnect
- [ ] Multiple tracks can use same device on different channels
- [ ] Device disconnection is handled gracefully
- [ ] Performance remains smooth with 10+ concurrent tracks

## Risk Mitigation
- **Browser MIDI Support**: Ensure Web MIDI API availability and fallbacks
- **Device Compatibility**: Test with common MIDI interfaces and DAWs
- **Latency Concerns**: Optimize routing performance for real-time use
- **User Experience**: Provide clear visual feedback for all routing states

## Timeline Estimate
- **Phase 1**: 2-3 days (MIDI infrastructure)
- **Phase 2**: 2-3 days (UI development)  
- **Phase 3**: 2-3 days (Integration)
- **Phase 4**: 1-2 days (Testing)
- **Total**: ~8-11 days

This plan transforms the collaborative step sequencer into a powerful MIDI routing hub while maintaining the real-time collaborative features that make the original application unique.
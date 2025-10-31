# Actions Column Explanation

## What are the "Actions" in the routing matrix?

The **Actions** column contains two buttons for each connected track:

### 🎵 **Test Button**
- **Purpose**: Sends a test MIDI note to verify the routing is working correctly
- **What it does**: Plays a middle C (note 60) for 500ms on the track's assigned MIDI device and channel
- **When to use**: After configuring device/channel routing to test the connection
- **Status**: Only enabled when track has a device assigned and is connected

### 🛑 **Panic Button** 
- **Purpose**: Emergency "all notes off" for that specific track
- **What it does**: Sends MIDI CC 123 (All Notes Off) and CC 120 (All Sound Off) messages
- **When to use**: When notes are stuck playing or you need to quickly silence a track
- **Status**: Only enabled when track has a device assigned and is connected

## How to Use

1. **First**: Select a MIDI device and channel for the track
2. **Test**: Click the 🎵 button to verify MIDI is reaching your hardware
3. **Emergency**: Use 🛑 if you need to stop all notes from that track immediately

These actions work per-track, giving you precise control over each participant's MIDI routing and allowing you to troubleshoot connections easily.
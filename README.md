# MIDI Socket - Professional MIDI Routing Bridge

🎹 **Transform any device into a custom MIDI controller with professional routing capabilities**

MIDI Socket is a modern web-based MIDI routing system that bridges remote mobile/web interfaces with local MIDI hardware. Create custom device profiles with personalized controllers, route multiple tracks to different MIDI destinations, and enjoy a seamless collaborative music experience.

## ✨ Key Features

### 🎨 **Custom Device Configuration**
- **Visual Device Designer**: Create custom MIDI devices with names, colors, and controller layouts
- **Flexible Controller Types**: 
  - **Continuous Controllers**: Traditional sliders for smooth parameter control  
  - **Discrete Controllers**: Button sets for switching between predefined states
- **Device Color Theming**: Custom colors automatically applied to Track interfaces
- **Configuration Management**: Export/import device setups for backup and sharing

### 🔀 **Professional MIDI Routing**
- **Real-time Bridge**: Connect remote Track apps to local MIDI hardware instantly
- **Multi-Channel Support**: Route tracks to any MIDI device + channel combination
- **Dynamic Track Management**: Automatic track assignment as users join/leave
- **Advanced Processing**: Per-track volume control and pitch transposition

### 📱 **Responsive Track Interface**
- **Device-Specific UI**: Each track shows only the controllers you've defined
- **Mobile Optimized**: Perfect touch interfaces for phones and tablets
- **Smart Layouts**: Automatic portrait/landscape orientation handling
- **Real-time Feedback**: Live controller values and MIDI activity indicators

### 🎵 **Session Management**
- **Easy Sharing**: Simple URL sharing for participant invitation
- **Real-time Updates**: Live connection status and participant monitoring
- **Panic Functions**: Emergency "all notes off" per track or globally
- **Session Controls**: Coordinated play/pause across all participants

## 🚀 Quick Start

### **1. Start the Server**
```bash
npm install
node index.js
```

### **2. Open the Sequencer (Host)**
Navigate to: `http://localhost:3000/sequencer?session=yoursession`

### **3. Create Custom Devices**
- Click "Device Configuration" 
- Design devices with custom controllers
- Set colors and controller types
- Export configurations for backup

### **4. Share Track URLs**
Share: `http://localhost:3000/track?session=yoursession`

### **5. Configure Routing**
- Assign tracks to your custom devices
- Set MIDI channels and hardware destinations
- Start the session and begin playing!

## 🎹 Device Configuration Guide

### **Creating a Custom Device:**

1. **Basic Information**:
   ```
   Device Name: "My Synthesizer"
   Device Color: #ff6b35 (orange)
   ```

2. **Controller Examples**:
   ```
   Continuous Controller:
   - Name: "Filter Cutoff"
   - CC Number: 74
   - Type: Continuous
   - Range: 0-127
   
   Discrete Controller:
   - Name: "Waveform"
   - CC Number: 12  
   - Type: Discrete
   - Range: "Sine: 0-31, Square: 32-63, Saw: 64-95, Noise: 96-127"
   ```

3. **Result**: Track interfaces will show:
   - Orange background theme
   - "Filter Cutoff" as a slider (0-127)
   - "Waveform" as 4 buttons: [Sine] [Square] [Saw] [Noise]

## 🛠 Technical Requirements

- **Node.js** (v14+)
- **Modern Web Browser** with Web MIDI API support:
  - Chrome/Chromium (recommended)
  - Edge
  - Opera
- **MIDI Hardware** connected to the host computer

## 📖 Documentation

- **[IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)** - Complete technical overview
- **[TESTING_GUIDE.md](TESTING_GUIDE.md)** - Testing procedures and validation
- **[DOCS_INDEX.md](DOCS_INDEX.md)** - Full documentation index

## 🎯 Use Cases

### **Live Performance**
- Multiple performers with mobile devices
- Each performer gets custom interface for their part
- Host controls overall routing and MIDI hardware

### **Studio Collaboration**  
- Remote musicians join from different locations
- Custom device profiles for different hardware setups
- Easy configuration sharing between sessions

### **Music Education**
- Teacher creates simplified interfaces for students
- Color-coded devices for different instrument sections
- Easy setup and session management

### **Sound Design**
- Custom controller layouts for complex synthesizers
- Discrete controllers for preset switching
- Professional routing for multi-timbral setups

## 🏗 Architecture

```
Remote Track Apps (Mobile/Web)
           ↓
    MIDI Socket Server
           ↓
   Custom Device System
           ↓
    MIDI Hardware/DAW
```

## 🤝 Contributing

This project represents a complete transformation from a step sequencer to a professional MIDI routing system. The codebase includes comprehensive documentation of the development process and architectural decisions.

## 📄 License

MIT License - see LICENSE file for details.

---

**Ready to create your custom MIDI control experience?** 🎵

Start your server and visit the sequencer interface to begin designing your custom devices!
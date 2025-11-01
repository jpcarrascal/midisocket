/**
 * Device Configuration Manager
 * Handles MIDI device configuration, mapping devices to interfaces and channels
 */

class DeviceConfiguration {
    constructor() {
        this.configuredDevices = []; // User-configured custom devices
        this.availableInterfaces = []; // From MIDI system
        this.nextDeviceId = 1; // Auto-increment ID for new devices
        
        this.elements = {
            configPanel: null,
            configTable: null,
            configTableBody: null,
            noDevicesMessage: null,
            addDeviceBtn: null,
            saveConfigBtn: null,
            loadConfigBtn: null,
            modal: null,
            addDeviceForm: null,
            closeModal: null,
            // Form elements
            deviceName: null,
            deviceColor: null,
            colorPreview: null,
            controllersContainer: null,
            addControllerBtn: null
        };
        
        this.isVisible = false;
        this.currentControllerCount = 0;
    }

    /**
     * Initialize the device configuration system
     */
    async initialize() {
        console.log('Initializing device configuration system...');
        this.initializeElements();
        this.attachEventListeners();
        this.loadConfiguration();
        this.updateConfigurationTable();
        
        // Debug: Log loaded devices
        console.log('=== Device Configuration Loaded ===');
        console.log('Number of devices:', this.configuredDevices.length);
        this.configuredDevices.forEach(device => {
            console.log(`Device "${device.name}" (ID: ${device.id}):`, {
                controllers: device.controllers,
                controllerCount: device.controllers?.length
            });
        });
        
        console.log('Device configuration system initialized');
    }

    /**
     * Initialize DOM element references
     */
    initializeElements() {
        this.elements.configPanel = document.getElementById('device-config-panel');
        this.elements.configTable = document.getElementById('device-config-table');
        this.elements.configTableBody = document.getElementById('device-config-table-body');
        this.elements.noDevicesMessage = document.getElementById('no-configured-devices');
        this.elements.addDeviceBtn = document.getElementById('add-device-btn');
        this.elements.saveConfigBtn = document.getElementById('save-config-btn');
        this.elements.loadConfigBtn = document.getElementById('load-config-btn');
        this.elements.modal = document.getElementById('device-selection-modal');
        this.elements.closeModal = document.getElementById('close-modal');
        
        // New form elements
        this.elements.addDeviceForm = document.getElementById('add-device-form');
        this.elements.deviceName = document.getElementById('device-name');
        this.elements.deviceColor = document.getElementById('device-color');
        this.elements.colorPreview = document.getElementById('color-preview');
        this.elements.controllersContainer = document.getElementById('controllers-container');
        this.elements.addControllerBtn = document.getElementById('add-controller-btn');
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // Configuration controls
        this.elements.addDeviceBtn?.addEventListener('click', () => this.showAddDeviceModal());
        this.elements.saveConfigBtn?.addEventListener('click', () => this.saveConfiguration());
        this.elements.loadConfigBtn?.addEventListener('click', () => this.loadConfigurationFile());
        
        // Modal controls
        this.elements.closeModal?.addEventListener('click', (e) => {
            e.preventDefault();
            this.hideAddDeviceModal();
        });
        
        this.elements.modal?.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-overlay') || e.target === this.elements.modal) {
                this.hideAddDeviceModal();
            }
        });
        
        // Form controls
        this.elements.addDeviceForm?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleCreateDevice();
        });
        
        this.elements.deviceColor?.addEventListener('input', (e) => {
            if (this.elements.colorPreview) {
                this.elements.colorPreview.style.backgroundColor = e.target.value;
            }
        });
        
        this.elements.addControllerBtn?.addEventListener('click', () => this.addControllerForm());
        
        // Keyboard support
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !this.elements.modal?.classList.contains('hidden')) {
                this.hideAddDeviceModal();
            }
        });
    }

    /**
     * Show add device modal
     */
    showAddDeviceModal() {
        console.log('Showing add device modal');
        this.resetAddDeviceForm();
        this.elements.modal?.classList.remove('hidden');
    }

    /**
     * Hide add device modal
     */
    hideAddDeviceModal() {
        console.log('Hiding add device modal');
        this.elements.modal?.classList.add('hidden');
        this.resetAddDeviceForm();
    }

    /**
     * Reset the add device form
     */
    resetAddDeviceForm() {
        if (this.elements.addDeviceForm) {
            this.elements.addDeviceForm.reset();
        }
        
        // Reset color preview
        if (this.elements.colorPreview && this.elements.deviceColor) {
            this.elements.colorPreview.style.backgroundColor = this.elements.deviceColor.value;
        }
        
        // Clear controllers
        if (this.elements.controllersContainer) {
            this.elements.controllersContainer.innerHTML = '';
        }
        
        this.currentControllerCount = 0;
        this.updateAddControllerButton();
        
        // Reset modal state for creating new devices
        const modal = document.getElementById('device-selection-modal');
        if (modal) {
            const modalTitle = modal.querySelector('.modal-header h3');
            const submitButton = modal.querySelector('button[type="submit"]');
            
            if (modalTitle) modalTitle.textContent = 'Add New Device';
            if (submitButton) submitButton.textContent = 'Create Device';
        }
        
        // Clear editing state
        this.editingDevice = null;
    }

    /**
     * Add a controller form to the modal
     */
    addControllerForm(controllerData = null) {
        if (this.currentControllerCount >= 4) return;
        
        const controllerIndex = this.currentControllerCount;
        const controllerForm = document.createElement('div');
        controllerForm.className = 'controller-form';
        controllerForm.dataset.index = controllerIndex;
        
        controllerForm.innerHTML = `
            <div class="controller-form-header">
                <h5 class="controller-form-title">Controller ${controllerIndex + 1}</h5>
                <button type="button" class="remove-controller-btn" onclick="deviceConfig.removeControllerForm(${controllerIndex})">Remove</button>
            </div>
            <div class="controller-form-row">
                <div class="form-group">
                    <label>Controller Name *</label>
                    <input type="text" name="controllerName_${controllerIndex}" required placeholder="e.g., Volume, Filter Cutoff" value="${controllerData?.name || ''}">
                </div>
                <div class="form-group">
                    <label>CC Number *</label>
                    <input type="number" name="ccNumber_${controllerIndex}" min="0" max="127" required placeholder="0-127" value="${controllerData?.ccNumber || ''}">
                </div>
                <div class="form-group">
                    <label>Type *</label>
                    <select name="ccType_${controllerIndex}" required onchange="deviceConfig.handleControllerTypeChange(${controllerIndex}, this.value)">
                        <option value="">Select type...</option>
                        <option value="continuous" ${controllerData?.type === 'continuous' ? 'selected' : ''}>Continuous</option>
                        <option value="discrete" ${controllerData?.type === 'discrete' ? 'selected' : ''}>Discrete</option>
                    </select>
                </div>
            </div>
            <div class="range-input-container" id="range-container-${controllerIndex}" style="display: ${controllerData?.type === 'discrete' ? 'block' : 'none'};">
                <div class="form-group">
                    <label>Range Definition</label>
                    <textarea name="ccRange_${controllerIndex}" placeholder="e.g., Off: 0-31, On: 32-63, Auto: 64-127">${controllerData?.type === 'discrete' && controllerData?.range ? controllerData.range : ''}</textarea>
                    <div class="range-example">Example: "Bypass: 0-31, Reverb: 32-95, Shimmer: 96-127"</div>
                </div>
            </div>
        `;
        
        this.elements.controllersContainer.appendChild(controllerForm);
        this.currentControllerCount++;
        this.updateAddControllerButton();
    }

    /**
     * Remove a controller form
     */
    removeControllerForm(index) {
        const controllerForm = this.elements.controllersContainer.querySelector(`[data-index="${index}"]`);
        if (controllerForm) {
            controllerForm.remove();
            this.currentControllerCount--;
            this.updateAddControllerButton();
        }
    }

    /**
     * Handle controller type change
     */
    handleControllerTypeChange(index, type) {
        const rangeContainer = document.getElementById(`range-container-${index}`);
        if (rangeContainer) {
            if (type === 'discrete') {
                rangeContainer.style.display = 'block';
                rangeContainer.querySelector('textarea').required = true;
            } else {
                rangeContainer.style.display = 'none';
                rangeContainer.querySelector('textarea').required = false;
                rangeContainer.querySelector('textarea').value = type === 'continuous' ? '0-127' : '';
            }
        }
    }

    /**
     * Update add controller button state
     */
    updateAddControllerButton() {
        if (this.elements.addControllerBtn) {
            this.elements.addControllerBtn.disabled = this.currentControllerCount >= 4;
            this.elements.addControllerBtn.textContent = 
                this.currentControllerCount >= 4 ? '✓ Maximum Controllers Added' : '➕ Add Controller';
        }
    }

    /**
     * Handle form submission to create new device
     */
    handleCreateDevice() {
        try {
            // Collect form data
            const formData = new FormData(this.elements.addDeviceForm);
            const deviceName = formData.get('deviceName')?.trim();
            const deviceColor = formData.get('deviceColor');
            
            // Validate basic fields
            if (!deviceName) {
                this.showFormError('Device name is required');
                return;
            }
            
            // Check for duplicate device name (skip if editing the same device)
            const existingDevice = this.configuredDevices.find(d => d.name.toLowerCase() === deviceName.toLowerCase());
            if (existingDevice && (!this.editingDevice || existingDevice.id !== this.editingDevice.id)) {
                this.showFormError('A device with this name already exists');
                return;
            }
            
            // Collect controllers
            const controllers = [];
            const usedCCNumbers = new Set();
            
            for (let i = 0; i < this.currentControllerCount; i++) {
                const controllerName = formData.get(`controllerName_${i}`)?.trim();
                const ccNumber = parseInt(formData.get(`ccNumber_${i}`));
                const ccType = formData.get(`ccType_${i}`);
                const ccRange = formData.get(`ccRange_${i}`)?.trim();
                
                // Skip empty controller forms
                if (!controllerName && !ccNumber && !ccType) continue;
                
                // Validate controller data
                if (!controllerName) {
                    this.showFormError(`Controller ${i + 1}: Name is required`);
                    return;
                }
                
                if (isNaN(ccNumber) || ccNumber < 0 || ccNumber > 127) {
                    this.showFormError(`Controller ${i + 1}: CC number must be between 0-127`);
                    return;
                }
                
                if (usedCCNumbers.has(ccNumber)) {
                    this.showFormError(`Controller ${i + 1}: CC number ${ccNumber} is already used`);
                    return;
                }
                
                if (!ccType) {
                    this.showFormError(`Controller ${i + 1}: Type is required`);
                    return;
                }
                
                if (ccType === 'discrete' && !ccRange) {
                    this.showFormError(`Controller ${i + 1}: Range definition is required for discrete controllers`);
                    return;
                }
                
                usedCCNumbers.add(ccNumber);
                
                controllers.push({
                    name: controllerName,
                    ccNumber: ccNumber,
                    type: ccType,
                    range: ccType === 'continuous' ? '0-127' : ccRange
                });
            }
            
            if (this.editingDevice) {
                // Update existing device
                this.editingDevice.name = deviceName;
                this.editingDevice.color = deviceColor;
                this.editingDevice.controllers = controllers;
                this.editingDevice.updatedAt = new Date().toISOString();
                
                console.log('Device updated successfully:', this.editingDevice);
                this.editingDevice = null; // Clear editing state
            } else {
                // Create new device
                const newDevice = {
                    id: this.nextDeviceId++,
                    name: deviceName,
                    color: deviceColor,
                    controllers: controllers,
                    assignedInterface: '',
                    assignedChannel: 1,
                    status: 'not_configured',
                    createdAt: new Date().toISOString()
                };
                
                // Add to configured devices
                this.configuredDevices.push(newDevice);
                console.log('Device created successfully:', newDevice);
                console.log('Device controllers array:', newDevice.controllers);
            }
            
            this.autoSaveConfiguration();
            this.updateConfigurationTable();
            
            // Hide modal
            this.hideAddDeviceModal();
            
            // Refresh routing matrix
            if (window.updateRoutingMatrix) {
                window.updateRoutingMatrix();
            }
            
        } catch (error) {
            console.error('Error creating device:', error);
            this.showFormError('Failed to create device. Please try again.');
        }
    }

    /**
     * Show form error message
     */
    showFormError(message) {
        // Remove any existing error
        const existingError = this.elements.modal.querySelector('.error-message');
        if (existingError) {
            existingError.remove();
        }
        
        // Create and show new error
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        
        const modalBody = this.elements.modal.querySelector('.modal-body');
        modalBody.insertBefore(errorDiv, modalBody.firstChild);
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.remove();
            }
        }, 5000);
    }



    /**
     * Show confirmation dialog before removing device
     */
    confirmRemoveDevice(deviceId) {
        // Convert to number to ensure proper comparison
        const numericDeviceId = parseInt(deviceId);
        const device = this.configuredDevices.find(d => d.id === numericDeviceId);
        
        if (!device) {
            console.error('Device not found for removal:', numericDeviceId);
            return;
        }

        const message = `Are you sure you want to remove "${device.name}" from the configuration?\n\nThis will disconnect any tracks currently using this device.`;
        
        if (confirm(message)) {
            this.removeDevice(numericDeviceId);
        }
    }

    /**
     * Remove device from configuration
     */
    removeDevice(deviceId) {
        this.configuredDevices = this.configuredDevices.filter(d => d.id !== deviceId);
        this.autoSaveConfiguration(); // Auto-save after removing device
        this.updateConfigurationTable();
        
        // Refresh routing matrix to update device options
        if (window.updateRoutingMatrix) {
            window.updateRoutingMatrix();
        }
    }

    /**
     * Update the configuration table
     */
    updateConfigurationTable() {
        if (!this.elements.configTableBody || !this.elements.noDevicesMessage) return;

        if (this.configuredDevices.length === 0) {
            this.elements.configTable?.classList.add('hidden');
            this.elements.noDevicesMessage?.classList.remove('hidden');
            return;
        }

        this.elements.configTable?.classList.remove('hidden');
        this.elements.noDevicesMessage?.classList.add('hidden');

        this.elements.configTableBody.innerHTML = this.configuredDevices.map(device => `
            <tr data-device-id="${device.id}" style="background-color: ${device.color}15;">
                <td class="device-name-cell">
                    <div class="device-color-indicator" style="background-color: ${device.color};"></div>
                    <div class="device-info">
                        <strong>${device.name}</strong>
                        <div class="device-details">${(device.controllers || []).length} controller${(device.controllers || []).length !== 1 ? 's' : ''}</div>
                    </div>
                </td>
                <td>
                    <select class="interface-select" onchange="deviceConfig.updateDeviceInterface(${device.id}, this.value)">
                        <option value="">Select Interface...</option>
                        ${this.availableInterfaces.map(iface => `
                            <option value="${iface.id}" ${device.assignedInterface === iface.id ? 'selected' : ''}>
                                ${iface.name}
                            </option>
                        `).join('')}
                    </select>
                </td>
                <td>
                    <select class="channel-select" onchange="deviceConfig.updateDeviceChannel(${device.id}, this.value)">
                        ${Array.from({length: 16}, (_, i) => `
                            <option value="${i + 1}" ${device.assignedChannel === i + 1 ? 'selected' : ''}>
                                ${i + 1}
                            </option>
                        `).join('')}
                    </select>
                </td>
                <td>
                    <span class="status-badge status-${device.status}">${this.getStatusLabel(device.status)}</span>
                </td>
                <td>
                    <button class="control-btn small" onclick="deviceConfig.showControllerSetup(${device.id})" title="Edit MIDI controllers">
                        ⚙️ Edit
                    </button>
                    <button class="control-btn small danger" onclick="deviceConfig.confirmRemoveDevice(${device.id})" title="Remove device">
                        🗑️ Remove
                    </button>
                </td>
            </tr>
        `).join('');
    }

    /**
     * Update device interface assignment
     */
    updateDeviceInterface(deviceId, interfaceId) {
        const device = this.configuredDevices.find(d => d.id === deviceId);
        if (device) {
            device.assignedInterface = interfaceId;
            device.status = interfaceId ? 'configured' : 'not_configured';
            this.autoSaveConfiguration(); // Auto-save after updating interface
            this.updateConfigurationTable();
            
            // Refresh routing matrix to update device availability
            if (window.updateRoutingMatrix) {
                window.updateRoutingMatrix();
            }
            
            // Notify tracks using this device about the interface change
            this.notifyTracksOfDeviceChange(deviceId);
        }
    }

    /**
     * Update device MIDI channel
     */
    updateDeviceChannel(deviceId, channel) {
        const device = this.configuredDevices.find(d => d.id === deviceId);
        if (device) {
            device.assignedChannel = parseInt(channel);
            this.autoSaveConfiguration(); // Auto-save after updating channel
            this.updateConfigurationTable();
            
            // Notify tracks using this device about the channel change
            this.notifyTracksOfDeviceChange(deviceId);
        }
    }

    /**
     * Notify tracks that are using a specific device about configuration changes
     */
    notifyTracksOfDeviceChange(deviceId) {
        // Check if sequencer routing system is available
        if (!window.app || !window.app.routingMatrix) {
            console.log('Routing matrix not available for device change notification, will retry...');
            // Retry after a short delay in case the sequencer is still initializing
            setTimeout(() => {
                this.notifyTracksOfDeviceChange(deviceId);
            }, 100);
            return;
        }

        const deviceIdString = `device:${deviceId}`;
        const updatedDevice = this.getDeviceConfig(deviceId);
        
        if (!updatedDevice) {
            console.log(`Device ${deviceId} not found in configuration`);
            return;
        }

        console.log(`Notifying tracks of device ${deviceId} configuration change, new channel: ${updatedDevice.assignedChannel}`);

        // Find all tracks using this device and update their routing
        const allRoutings = window.app.routingMatrix.getAllRoutings();
        let tracksUpdated = 0;
        
        for (const [trackId, routing] of allRoutings) {
            if (routing.deviceId === deviceIdString && routing.enabled) {
                console.log(`Updating routing for track ${trackId} with new device ${deviceId} configuration`);
                
                // Update the routing matrix with the new channel from device config
                // Convert from 1-based (device config) to 0-based (routing matrix)
                const newChannel = updatedDevice.assignedChannel - 1;
                
                window.app.routingMatrix.updateRouting(trackId, {
                    channel: newChannel,
                    channelLocked: true  // Configured devices have locked channels
                });
                
                tracksUpdated++;
                // Note: The updateRouting call will automatically trigger the routing change callback
            }
        }
        
        console.log(`Updated ${tracksUpdated} tracks with new device ${deviceId} configuration`);
        
        // Refresh the routing matrix UI to show the updated channels
        if (window.updateRoutingMatrix) {
            window.updateRoutingMatrix();
        }
    }

    /**
     * Get status label for display
     */
    getStatusLabel(status) {
        const labels = {
            'not_configured': 'Not Configured',
            'configured': 'Ready',
            'active': 'Active'
        };
        return labels[status] || status;
    }

    /**
     * Update available interfaces
     */
    updateAvailableInterfaces(interfaces) {
        this.availableInterfaces = interfaces;
        this.updateConfigurationTable();
    }

    /**
     * Get configured devices for routing
     */
    getConfiguredDevices() {
        return this.configuredDevices;
    }

    /**
     * Get device configuration by ID
     */
    getDeviceConfig(deviceId) {
        return this.configuredDevices.find(d => d.id === deviceId);
    }

    /**
     * Get device information (handles both numeric IDs and "device:X" format)
     */
    getDeviceInfo(deviceId) {
        let actualDeviceId = deviceId;
        
        // Handle "device:X" format
        if (typeof deviceId === 'string' && deviceId.startsWith('device:')) {
            actualDeviceId = parseInt(deviceId.replace('device:', ''));
        }
        
        const device = this.getDeviceConfig(actualDeviceId);
        console.log('getDeviceInfo returning device:', device?.name, 'controllers:', device?.controllers?.length);
        
        return device;
    }

    /**
     * Auto-save configuration to localStorage (silent)
     */
    autoSaveConfiguration() {
        try {
            const config = {
                version: 1,
                devices: this.configuredDevices,
                timestamp: new Date().toISOString()
            };
            localStorage.setItem('midiDeviceConfiguration', JSON.stringify(config));
            console.log('Device configuration auto-saved');
        } catch (error) {
            console.error('Failed to auto-save configuration:', error);
        }
    }

    /**
     * Download configuration as JSON file
     */
    saveConfiguration() {
        try {
            const config = {
                version: 2, // Updated version for new custom device format
                devices: this.configuredDevices,
                timestamp: new Date().toISOString(),
                exportedBy: 'MidiSocket Device Configuration',
                deviceCount: this.configuredDevices.length
            };
            
            // Create JSON blob
            const jsonString = JSON.stringify(config, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            
            // Create download link
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            
            // Generate filename with timestamp
            const now = new Date();
            const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
            a.download = `midisocket-config-${timestamp}.json`;
            
            // Trigger download
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            // Clean up
            URL.revokeObjectURL(url);
            
            console.log('Configuration exported successfully:', a.download);
        } catch (error) {
            console.error('Failed to export configuration:', error);
            alert('Failed to download configuration file.');
        }
    }

    /**
     * Load configuration from localStorage
     */
    loadConfiguration() {
        try {
            const configStr = localStorage.getItem('midiDeviceConfiguration');
            if (configStr) {
                const config = JSON.parse(configStr);
                this.configuredDevices = (config.devices || []).map((device, index) => {
                    // Migration: ensure all devices have required properties
                    const deviceId = device.id || device.deviceId || (this.nextDeviceId + index);
                    return {
                        id: parseInt(deviceId), // Ensure it's a number
                        name: device.name || 'Unknown Device',
                        color: device.color || '#4a90e2',
                        controllers: device.controllers || [], // Ensure controllers array exists
                        assignedInterface: device.assignedInterface || '',
                        assignedChannel: device.assignedChannel || 1,
                        status: device.status || 'not_configured'
                    };
                });
                
                // Update nextDeviceId to avoid conflicts with existing devices
                if (this.configuredDevices.length > 0) {
                    const maxId = Math.max(...this.configuredDevices.map(d => d.id));
                    this.nextDeviceId = maxId + 1;
                }
                
                console.log('Loaded device configuration:', this.configuredDevices);
                console.log('Next device ID set to:', this.nextDeviceId);
            }
        } catch (error) {
            console.error('Failed to load configuration:', error);
            this.configuredDevices = [];
        }
    }

    /**
     * Load configuration from file (future enhancement)
     */
    loadConfigurationFile() {
        // TODO: Implement file loading
        alert('File loading not yet implemented. Use browser storage for now.');
    }

    /**
     * Show/hide configuration panel
     */
    toggleVisibility() {
        // Check current actual visibility state
        const isCurrentlyVisible = !this.elements.configPanel?.classList.contains('hidden');
        this.isVisible = !isCurrentlyVisible;
        
        if (this.isVisible) {
            this.elements.configPanel?.classList.remove('hidden');
        } else {
            this.elements.configPanel?.classList.add('hidden');
        }
        return this.isVisible;
    }

    /**
     * Check if panel is visible
     */
    getVisibility() {
        return this.isVisible;
    }

    /**
     * Show device edit modal (for custom devices, this shows the device creation form pre-filled)
     */
    showControllerSetup(deviceId) {
        const device = this.configuredDevices.find(d => d.id === deviceId);
        
        if (!device) {
            alert('Device not found.');
            return;
        }

        // For custom devices, show the device creation form with pre-filled data
        this.showEditDeviceModal(device);
    }

    /**
     * Show edit device modal with pre-filled data
     */
    showEditDeviceModal(device) {
        // Pre-fill the form with existing device data
        document.getElementById('device-name').value = device.name;
        document.getElementById('device-color').value = device.color;
        
        // Clear existing controllers and reset counter
        const container = document.getElementById('controllers-container');
        container.innerHTML = '';
        this.currentControllerCount = 0;
        
        // Add existing controllers
        (device.controllers || []).forEach(controller => {
            this.addControllerForm(controller);
        });
        
        // Update modal for editing mode
        const modal = document.getElementById('device-selection-modal');
        const modalTitle = modal.querySelector('.modal-header h3');
        const submitButton = modal.querySelector('button[type="submit"]');
        
        modalTitle.textContent = 'Edit Device';
        submitButton.textContent = 'Update Device';
        
        // Store device being edited
        this.editingDevice = device;
        
        // Show modal
        modal.classList.remove('hidden');
    }

    /**
     * Populate the controller list with checkboxes
     */
    populateControllerList(controls, selectedControllers) {
        if (!controls || controls.length === 0) {
            this.elements.controllerList.innerHTML = `
                <div class="empty-state">
                    <h4>No controllers available</h4>
                    <p>This device doesn't have any MIDI continuous controllers defined.</p>
                </div>
            `;
            return;
        }

        // Always show all controllers in the device configuration modal
        const selectedCount = selectedControllers.length;
        this.updateSelectedCount(selectedCount);

        this.elements.controllerList.innerHTML = controls.map((controller, index) => {
            const isSelected = selectedControllers.includes(controller.cc_number);
            const isDisabled = !isSelected && selectedCount >= 4;
            
            return `
                <div class="controller-item ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}" 
                     data-cc="${controller.cc_number}">
                    <input type="checkbox" 
                           class="controller-checkbox" 
                           id="controller-${controller.cc_number}"
                           value="${controller.cc_number}"
                           ${isSelected ? 'checked' : ''}
                           ${isDisabled ? 'disabled' : ''}
                           onchange="deviceConfig.handleControllerSelection(this)">
                    <div class="controller-info">
                        <div class="controller-name">${controller.control_name}</div>
                        <div class="controller-details">
                            <span class="controller-cc">CC ${controller.cc_number}</span>
                            <span class="controller-range">${controller.value_range}</span>
                        </div>
                        ${controller.description ? `<div class="controller-description">${controller.description}</div>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Handle controller checkbox selection
     */
    handleControllerSelection(checkbox) {
        const ccNumber = parseInt(checkbox.value);
        const isChecked = checkbox.checked;
        const device = this.currentControllerSetupDevice;
        
        if (!device) return;

        // Initialize selectedControllers if it doesn't exist
        if (!device.selectedControllers) {
            device.selectedControllers = [];
        }

        if (isChecked) {
            // Add controller if not already selected and under limit
            if (!device.selectedControllers.includes(ccNumber) && device.selectedControllers.length < 4) {
                device.selectedControllers.push(ccNumber);
            }
        } else {
            // Remove controller
            device.selectedControllers = device.selectedControllers.filter(cc => cc !== ccNumber);
        }

        // Update UI
        this.updateSelectedCount(device.selectedControllers.length);
        this.updateControllerItemStates();
        
        // Auto-save configuration
        this.autoSaveConfiguration();
        
        // Notify tracks using this device about the controller change
        this.notifyTracksOfDeviceChange(device.id);
    }

    /**
     * Update selected count display
     */
    updateSelectedCount(count) {
        if (this.elements.selectedCount) {
            this.elements.selectedCount.textContent = count;
        }
    }

    /**
     * Update controller item states (enable/disable based on selection limit)
     */
    updateControllerItemStates() {
        const device = this.currentControllerSetupDevice;
        if (!device) return;

        const selectedCount = device.selectedControllers.length;
        const controllerItems = this.elements.controllerList.querySelectorAll('.controller-item');
        
        controllerItems.forEach(item => {
            const checkbox = item.querySelector('.controller-checkbox');
            const ccNumber = parseInt(checkbox.value);
            const isSelected = device.selectedControllers.includes(ccNumber);
            
            // Update item classes
            item.classList.toggle('selected', isSelected);
            item.classList.toggle('disabled', !isSelected && selectedCount >= 8);
            
            // Update checkbox state
            checkbox.checked = isSelected;
            checkbox.disabled = !isSelected && selectedCount >= 4;
        });
    }
}
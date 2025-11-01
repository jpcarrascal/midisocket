/**
 * Device Configuration Manager
 * Handles MIDI device configuration, mapping devices to interfaces and channels
 */

class DeviceConfiguration {
    constructor() {
        this.deviceDatabase = []; // Loaded from JSON
        this.configuredDevices = []; // User-configured devices
        this.availableInterfaces = []; // From MIDI system
        this.currentControllerSetupDevice = null; // Currently editing device controllers
        
        this.elements = {
            configPanel: null,
            configTable: null,
            configTableBody: null,
            noDevicesMessage: null,
            addDeviceBtn: null,
            saveConfigBtn: null,
            loadConfigBtn: null,
            modal: null,
            deviceSearch: null,
            deviceListModal: null,
            closeModal: null
        };
        
        this.isVisible = false;
    }

    /**
     * Initialize the device configuration system
     */
    async initialize() {
        console.log('Initializing device configuration system...');
        this.initializeElements();
        this.attachEventListeners();
        await this.loadDeviceDatabase();
        this.loadConfiguration();
        this.updateConfigurationTable();
        console.log('Device configuration system initialized');
        
        // Debug: Check if modal is somehow visible
        console.log('Modal element found:', !!this.elements.modal);
        console.log('Modal hidden class:', this.elements.modal?.classList.contains('hidden'));
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
        this.elements.deviceSearch = document.getElementById('device-search');
        this.elements.deviceListModal = document.getElementById('device-list-modal');
        this.elements.closeModal = document.getElementById('close-modal');
        
        // Controller setup modal elements
        this.elements.controllerModal = document.getElementById('controller-setup-modal');
        this.elements.controllerTitle = document.getElementById('controller-setup-title');
        this.elements.controllerList = document.getElementById('controller-list');
        this.elements.selectedCount = document.getElementById('selected-count');
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // Configuration controls
        this.elements.addDeviceBtn?.addEventListener('click', () => this.showDeviceSelectionModal());
        this.elements.saveConfigBtn?.addEventListener('click', () => this.saveConfiguration());
        this.elements.loadConfigBtn?.addEventListener('click', () => this.loadConfigurationFile());
        
        // Modal controls
        this.elements.closeModal?.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Close button clicked');
            this.hideDeviceSelectionModal();
        });
        
        this.elements.modal?.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-overlay') || e.target === this.elements.modal) {
                console.log('Modal overlay clicked');
                this.hideDeviceSelectionModal();
            }
        });
        
        // Search functionality
        this.elements.deviceSearch?.addEventListener('input', (e) => this.filterDevices(e.target.value));
        
        // Keyboard support
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !this.elements.modal?.classList.contains('hidden')) {
                this.hideDeviceSelectionModal();
            }
        });
    }

    /**
     * Load device database from JSON
     */
    async loadDeviceDatabase() {
        try {
            const response = await fetch('scripts/midi_devices.json');
            this.deviceDatabase = await response.json();
            console.log(`Loaded ${this.deviceDatabase.length} devices from database`);
        } catch (error) {
            console.error('Failed to load device database:', error);
            this.deviceDatabase = [];
        }
    }

    /**
     * Show device selection modal
     */
    showDeviceSelectionModal() {
        console.log('Showing device selection modal');
        this.populateDeviceModal();
        this.elements.modal?.classList.remove('hidden');
    }

    /**
     * Hide device selection modal
     */
    hideDeviceSelectionModal() {
        console.log('Hiding device selection modal');
        this.elements.modal?.classList.add('hidden');
        if (this.elements.deviceSearch) {
            this.elements.deviceSearch.value = '';
        }
    }

    /**
     * Populate device selection modal
     */
    populateDeviceModal(filter = '') {
        if (!this.elements.deviceListModal) return;

        const filteredDevices = this.deviceDatabase.filter(device => {
            const searchText = filter.toLowerCase();
            return device.name.toLowerCase().includes(searchText) ||
                   device.manufacturer.toLowerCase().includes(searchText) ||
                   device.type.toLowerCase().includes(searchText);
        });

        this.elements.deviceListModal.innerHTML = filteredDevices.map(device => {
            const deviceIndex = this.deviceDatabase.indexOf(device);
            const isConfigured = this.configuredDevices.find(d => d.deviceId === deviceIndex);
            
            return `
                <div class="device-item-modal ${isConfigured ? 'device-configured' : ''}" data-device-id="${deviceIndex}">
                    <div class="device-checkbox">
                        <input type="checkbox" ${isConfigured ? 'checked' : ''} 
                               onchange="deviceConfig.toggleDevice(${deviceIndex}, this.checked)">
                    </div>
                    <div class="device-info-modal">
                        <div class="device-name-modal">${device.name}</div>
                        <div class="device-details-modal">
                            <span class="manufacturer">${device.manufacturer}</span>
                            <span class="type">${device.type}</span>
                            <span class="default-channel">Default Ch: ${device.midi_channel?.default_channel || 'N/A'}</span>
                        </div>
                    </div>
                    <div class="device-status-indicator">
                        ${isConfigured ? '<span class="device-configured-label">✓ Configured</span>' : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Filter devices in modal
     */
    filterDevices(filter) {
        this.populateDeviceModal(filter);
    }

    /**
     * Toggle device selection via checkbox
     */
    toggleDevice(deviceIndex, checked) {
        if (checked) {
            this.addDevice(deviceIndex);
        } else {
            this.removeDevice(deviceIndex);
        }
        
        // Refresh the modal to update the visual state
        if (!this.elements.modal?.classList.contains('hidden')) {
            this.populateDeviceModal(this.elements.deviceSearch?.value || '');
        }
    }

    /**
     * Add device to configuration
     */
    addDevice(deviceIndex) {
        const device = this.deviceDatabase[deviceIndex];
        if (!device) return;

        // Check if device is already configured
        const existingDevice = this.configuredDevices.find(d => d.deviceId === deviceIndex);
        if (existingDevice) {
            alert('This device is already configured.');
            return;
        }

        const configuredDevice = {
            deviceId: deviceIndex,
            name: device.name,
            manufacturer: device.manufacturer,
            type: device.type,
            defaultChannel: device.midi_channel?.default_channel || 1,
            assignedInterface: '',
            assignedChannel: device.midi_channel?.default_channel || 1,
            status: 'not_configured',
            selectedControllers: [] // Array of selected controller CC numbers
        };

        this.configuredDevices.push(configuredDevice);
        this.autoSaveConfiguration(); // Auto-save after adding device
        this.updateConfigurationTable();
        this.populateDeviceModal(this.elements.deviceSearch?.value || ''); // Refresh modal to show updated state
        
        // Refresh routing matrix to show new device option
        if (window.updateRoutingMatrix) {
            window.updateRoutingMatrix();
        }
    }

    /**
     * Remove device from configuration
     */
    removeDevice(deviceId) {
        this.configuredDevices = this.configuredDevices.filter(d => d.deviceId !== deviceId);
        this.autoSaveConfiguration(); // Auto-save after removing device
        this.updateConfigurationTable();
        
        // Refresh modal if it's open
        if (!this.elements.modal?.classList.contains('hidden')) {
            this.populateDeviceModal(this.elements.deviceSearch?.value || '');
        }
        
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
            <tr data-device-id="${device.deviceId}">
                <td class="device-name-cell">
                    <strong>${device.name}</strong>
                    <div class="device-manufacturer">${device.manufacturer}</div>
                </td>
                <td>
                    <select class="interface-select" onchange="deviceConfig.updateDeviceInterface(${device.deviceId}, this.value)">
                        <option value="">Select Interface...</option>
                        ${this.availableInterfaces.map(iface => `
                            <option value="${iface.id}" ${device.assignedInterface === iface.id ? 'selected' : ''}>
                                ${iface.name}
                            </option>
                        `).join('')}
                    </select>
                </td>
                <td>
                    <select class="channel-select" onchange="deviceConfig.updateDeviceChannel(${device.deviceId}, this.value)">
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
                    <button class="control-btn small" onclick="deviceConfig.showControllerSetup(${device.deviceId})" title="Setup MIDI controllers">
                        ⚙️ Setup
                    </button>
                    <button class="control-btn small danger" onclick="deviceConfig.removeDevice(${device.deviceId})" title="Remove device">
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
        const device = this.configuredDevices.find(d => d.deviceId === deviceId);
        if (device) {
            device.assignedInterface = interfaceId;
            device.status = interfaceId ? 'configured' : 'not_configured';
            this.autoSaveConfiguration(); // Auto-save after updating interface
            this.updateConfigurationTable();
            
            // Refresh routing matrix to update device availability
            if (window.updateRoutingMatrix) {
                window.updateRoutingMatrix();
            }
        }
    }

    /**
     * Update device channel assignment
     */
    updateDeviceChannel(deviceId, channel) {
        const device = this.configuredDevices.find(d => d.deviceId === deviceId);
        if (device) {
            device.assignedChannel = parseInt(channel);
            this.autoSaveConfiguration(); // Auto-save after updating channel
            this.updateConfigurationTable();
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
        return this.configuredDevices.find(d => d.deviceId === deviceId);
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
     * Save configuration to localStorage (with user feedback)
     */
    saveConfiguration() {
        try {
            const config = {
                version: 1,
                devices: this.configuredDevices,
                timestamp: new Date().toISOString()
            };
            localStorage.setItem('midiDeviceConfiguration', JSON.stringify(config));
            alert('Configuration saved successfully!');
        } catch (error) {
            console.error('Failed to save configuration:', error);
            alert('Failed to save configuration.');
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
                this.configuredDevices = config.devices || [];
                console.log('Loaded device configuration:', this.configuredDevices);
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
     * Show controller setup modal for a device
     */
    showControllerSetup(deviceId) {
        const device = this.configuredDevices.find(d => d.deviceId === deviceId);
        const deviceData = this.deviceDatabase[deviceId];
        
        if (!device || !deviceData) {
            alert('Device not found.');
            return;
        }

        this.currentControllerSetupDevice = device;
        
        // Update modal title
        this.elements.controllerTitle.textContent = `Setup Controllers - ${device.name}`;
        
        // Populate controller list
        this.populateControllerList(deviceData.controls || [], device.selectedControllers || []);
        
        // Show modal
        this.elements.controllerModal?.classList.remove('hidden');
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
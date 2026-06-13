const publicApp = {
    sessionName: null,
    socket: null,
    currentStream: null,
    devices: [],
    assignments: {},
    queue: [],
    elements: {}
};

document.addEventListener('DOMContentLoaded', () => {
    initializePublicDashboard();
});

function initializePublicDashboard() {
    const params = new URLSearchParams(window.location.search);
    publicApp.sessionName = params.get('session') || '';

    cacheElements();
    publicApp.elements.sessionLabel.textContent = `Session: ${publicApp.sessionName || '--'}`;
    updateJoinQr();
    initializeSocket();
    setupEventListeners();
    loadAvailableCameras();
}

function cacheElements() {
    publicApp.elements = {
        sessionLabel: document.getElementById('session-label'),
        connectionStatus: document.getElementById('connection-status'),
        queueSummary: document.getElementById('queue-summary'),
        slotSummary: document.getElementById('slot-summary'),
        deviceTableBody: document.getElementById('device-table-body'),
        queueList: document.getElementById('queue-list'),
        qrImage: document.getElementById('qr-image'),
        joinUrl: document.getElementById('join-url'),
        cameraSelect: document.getElementById('camera-select'),
        startCameraButton: document.getElementById('start-camera'),
        stopCameraButton: document.getElementById('stop-camera'),
        cameraFeed: document.getElementById('camera-feed'),
        cameraMessage: document.getElementById('camera-message')
    };
}

function initializeSocket() {
    publicApp.socket = io('', {
        query: {
            session: publicApp.sessionName,
            type: 'public'
        }
    });

    publicApp.socket.on('connect', onSocketConnect);
    publicApp.socket.on('disconnect', onSocketDisconnect);
    publicApp.socket.on('exit session', onExitSession);
    publicApp.socket.on('public-session-snapshot', onPublicSessionSnapshot);
    publicApp.socket.on('public-device-assignments-updated', onDeviceAssignmentsUpdated);
    publicApp.socket.on('public-queue-updated', onQueueUpdated);
}

function setupEventListeners() {
    publicApp.elements.startCameraButton.addEventListener('click', startCamera);
    publicApp.elements.stopCameraButton.addEventListener('click', stopCamera);
}

function onSocketConnect() {
    if (publicApp.elements.connectionStatus) {
        publicApp.elements.connectionStatus.textContent = 'Connected';
    }
    publicApp.socket.emit('request-public-session-snapshot');
}

function onSocketDisconnect() {
    if (publicApp.elements.connectionStatus) {
        publicApp.elements.connectionStatus.textContent = 'Disconnected';
    }
}

function onExitSession(data) {
    if (publicApp.elements.connectionStatus) {
        publicApp.elements.connectionStatus.textContent = 'Unavailable';
    }
    const reason = data && data.reason ? data.reason : 'Session unavailable.';
    publicApp.elements.joinUrl.textContent = reason;
}

function onPublicSessionSnapshot(data) {
    publicApp.devices = data.configuredDevices || [];
    publicApp.assignments = data.assignments || {};
    publicApp.queue = data.queue || [];

    renderDevices();
    renderQueue();
    updateSummaries(data.length, data.activeSlots);
}

function onDeviceAssignmentsUpdated(data) {
    publicApp.devices = data.configuredDevices || publicApp.devices;
    publicApp.assignments = data.assignments || {};
    renderDevices();
}

function onQueueUpdated(data) {
    publicApp.queue = data.queue || [];
    renderQueue();
    updateSummaries(data.length, data.activeSlots);
}

function updateSummaries(queueLength, activeSlots) {
    const totalQueue = Number.isFinite(parseInt(queueLength, 10))
        ? parseInt(queueLength, 10)
        : publicApp.queue.length;
    const totalSlots = Number.isFinite(parseInt(activeSlots, 10)) ? parseInt(activeSlots, 10) : 0;

    publicApp.elements.queueSummary.textContent = `Queue: ${totalQueue}`;
    publicApp.elements.slotSummary.textContent = `Active Slots: ${totalSlots}`;
}

function renderDevices() {
    const body = publicApp.elements.deviceTableBody;
    if (!body) {
        return;
    }

    if (!publicApp.devices.length) {
        body.innerHTML = '<tr><td colspan="2" class="empty-state-cell">No devices configured yet.</td></tr>';
        return;
    }

    const assignmentsByDeviceId = new Map();
    Object.values(publicApp.assignments || {}).forEach((assignment) => {
        if (assignment && assignment.deviceId !== undefined && assignment.deviceId !== null) {
            assignmentsByDeviceId.set(assignment.deviceId, assignment);
        }
    });

    body.innerHTML = publicApp.devices.map((device) => {
        const assignment = assignmentsByDeviceId.get(device.id) || null;
        const userLabel = assignment && assignment.userInitials ? escapeHtml(assignment.userInitials) : '---';
        const photoCell = device.image
            ? `<img class="device-photo" src="${escapeAttribute(device.image)}" alt="${escapeAttribute(device.name || 'Device')} photo">`
            : '<div class="photo-placeholder">No image</div>';

        return `
            <tr>
                            <td class="device-cell">
                                ${photoCell}
                                <span class="device-name">${escapeHtml(device.name || 'Unnamed Device')}</span>
                            </td>
              <td>${userLabel}</td>
            </tr>
        `;
    }).join('');
}

function renderQueue() {
    const list = publicApp.elements.queueList;
    if (!list) {
        return;
    }

    if (!publicApp.queue.length) {
        list.innerHTML = '<li class="empty-state-item">Nobody is waiting.</li>';
        return;
    }

    list.innerHTML = publicApp.queue.map((entry, index) => {
        const label = entry && entry.initials ? entry.initials : 'Guest';
        return `<li>${escapeHtml(label)}</li>`;
    }).join('');
}

function updateJoinQr() {
    const joinUrl = buildJoinUrl();
    publicApp.elements.joinUrl.textContent = joinUrl;

    const encodedUrl = encodeURIComponent(joinUrl);
    publicApp.elements.qrImage.src = `https://qrcode.azurewebsites.net/qr?string=${encodedUrl}`;
}

function buildJoinUrl() {
    const baseUrl = `${window.location.origin}/track`;
    if (!publicApp.sessionName) {
        return baseUrl;
    }

    return `${baseUrl}?session=${encodeURIComponent(publicApp.sessionName)}`;
}

async function loadAvailableCameras() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        publicApp.elements.cameraMessage.textContent = 'Camera selection is not supported in this browser.';
        publicApp.elements.startCameraButton.disabled = true;
        return;
    }

    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter((device) => device.kind === 'videoinput');

        publicApp.elements.cameraSelect.innerHTML = '<option value="">Default camera</option>';
        cameras.forEach((camera, index) => {
            const option = document.createElement('option');
            option.value = camera.deviceId;
            option.textContent = camera.label || `Camera ${index + 1}`;
            publicApp.elements.cameraSelect.appendChild(option);
        });
    } catch (error) {
        publicApp.elements.cameraMessage.textContent = 'Could not list cameras.';
    }
}

async function startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        publicApp.elements.cameraMessage.textContent = 'Camera is not supported in this browser.';
        return;
    }

    stopCamera();

    try {
        const selectedDeviceId = publicApp.elements.cameraSelect.value;
        const constraints = selectedDeviceId
            ? { video: { deviceId: { exact: selectedDeviceId } }, audio: false }
            : { video: true, audio: false };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        publicApp.currentStream = stream;
        publicApp.elements.cameraFeed.srcObject = stream;
        publicApp.elements.cameraMessage.textContent = 'Camera is live.';
        publicApp.elements.startCameraButton.disabled = true;
        publicApp.elements.stopCameraButton.disabled = false;

        await loadAvailableCameras();
    } catch (error) {
        publicApp.elements.cameraMessage.textContent = `Could not start camera: ${error.message}`;
    }
}

function stopCamera() {
    if (publicApp.currentStream) {
        publicApp.currentStream.getTracks().forEach((track) => track.stop());
        publicApp.currentStream = null;
    }

    publicApp.elements.cameraFeed.srcObject = null;
    publicApp.elements.cameraMessage.textContent = 'Camera is off.';
    publicApp.elements.startCameraButton.disabled = false;
    publicApp.elements.stopCameraButton.disabled = true;
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeAttribute(value) {
    return escapeHtml(value);
}
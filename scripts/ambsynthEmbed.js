(function (global) {
  const DEFAULT_OPTIONS = {
    className: 'ambsynth-inline-root',
    minHeight: '100%',
    background: '#1f2937',
    borderRadius: '8px',
    showHud: false,
    style: null
  };

  const CONFIG = {
    envelope: { attack: 500, release: 2000 },
    touch: {
      thresholdMs: 180,
      shortReleaseMs: 2000,
      shortFrequencyMultiplier: 1.5,
      shortQMultiplier: 2
    },
    filter: { minFreq: 30, maxFreq: 300, minQ: 0.7, maxQ: 24 },
    mapping: { xAxisTarget: 'filterQ' },
    lfo: { touchControlsEnabled: false, staticFreq: 0, staticAmount: 0 },
    noise: { gain: 0.9 },
    output: {
      gain: 2.2,
      limiterThreshold: -10,
      limiterKnee: 20,
      limiterRatio: 8,
      limiterAttack: 0.003,
      limiterRelease: 0.2
    }
  };

  function isElement(value) {
    return value && typeof value === 'object' && value.nodeType === 1;
  }

  function resolveContainer(container) {
    if (typeof container === 'string') {
      const element = document.querySelector(container);
      if (!element) {
        throw new Error('AmbSynthEmbed: container selector not found: ' + container);
      }
      return element;
    }

    if (isElement(container)) {
      return container;
    }

    if (!container) {
      return document.body;
    }

    throw new Error('AmbSynthEmbed: container must be a DOM element or selector');
  }

  function mount(container, options = {}) {
    const target = resolveContainer(container);
    const config = { ...DEFAULT_OPTIONS, ...options };

    const root = document.createElement('div');
    root.className = config.className;
    root.style.position = 'relative';
    root.style.width = '100%';
    root.style.height = '100%';
    root.style.minHeight = config.minHeight;
    root.style.overflow = 'hidden';
    root.style.background = config.background;
    root.style.borderRadius = config.borderRadius;
    root.style.touchAction = 'none';

    if (config.style && typeof config.style === 'object') {
      Object.assign(root.style, config.style);
    }

    const canvas = document.createElement('canvas');
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.touchAction = 'none';
    canvas.style.cursor = 'crosshair';

    const status = document.createElement('div');
    status.style.position = 'absolute';
    status.style.left = '10px';
    status.style.top = '10px';
    status.style.zIndex = '2';
    status.style.minWidth = '200px';
    status.style.maxWidth = 'calc(100% - 20px)';
    status.style.padding = '8px 10px';
    status.style.borderRadius = '8px';
    status.style.background = 'rgba(15, 23, 42, 0.78)';
    status.style.border = '1px solid rgba(103, 232, 249, 0.45)';
    status.style.color = '#e5e7eb';
    status.style.font = "11px/1.35 Menlo, Monaco, Consolas, 'Liberation Mono', monospace";
    status.style.pointerEvents = 'none';
    status.style.whiteSpace = 'pre-line';
    status.textContent = 'initializing...';
    if (!config.showHud) {
      status.style.display = 'none';
    }

    const unlock = document.createElement('div');
    unlock.style.position = 'absolute';
    unlock.style.inset = '0';
    unlock.style.zIndex = '3';
    unlock.style.display = 'flex';
    unlock.style.alignItems = 'center';
    unlock.style.justifyContent = 'center';
    unlock.style.background = 'rgba(2, 6, 23, 0.72)';

    const unlockButton = document.createElement('button');
    unlockButton.type = 'button';
    unlockButton.style.border = '1px solid rgba(103, 232, 249, 0.7)';
    unlockButton.style.background = 'rgba(15, 23, 42, 0.95)';
    unlockButton.style.color = '#e5e7eb';
    unlockButton.style.padding = '14px 18px';
    unlockButton.style.borderRadius = '12px';
    unlockButton.style.font = "16px/1.35 Menlo, Monaco, Consolas, 'Liberation Mono', monospace";
    unlockButton.style.whiteSpace = 'pre-line';
    unlockButton.style.textAlign = 'left';
    unlockButton.style.touchAction = 'manipulation';
    unlockButton.textContent = '1. Turn up the volume\n2. Turn off silent mode\n3. Tap here to enable audio';

    unlock.appendChild(unlockButton);
    root.appendChild(canvas);
    root.appendChild(status);
    root.appendChild(unlock);
    target.appendChild(root);

    let audioContext = null;
    let masterGain = null;
    let limiter = null;
    let filter = null;
    let noiseGain = null;
    let noiseSource = null;
    let lfoOscillator = null;
    let lfoGain = null;
    let isPlaying = false;
    let isPointerDown = false;
    let unlocked = false;
    let unlockInProgress = false;
    let lastUnlockAt = 0;
    let touchStartAt = 0;
    let touchMode = null;
    let touchVoiceStarted = false;
    let touchThresholdTimer = null;
    let lastX = 0.5;
    let lastY = 0.5;
    let lastFreq = 0;
    let lastQ = 0;
    let frameId = null;
    let resizeObserver = null;

    function createNoiseBuffer(context) {
      const bufferSize = context.sampleRate * 2;
      const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
      const channel = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i += 1) {
        channel[i] = (Math.random() * 2 - 1) * 0.7;
      }
      return buffer;
    }

    function initAudioContext() {
      if (audioContext) {
        return;
      }

      const AudioContextCtor = global.AudioContext || global.webkitAudioContext;
      if (!AudioContextCtor) {
        throw new Error('Web Audio API is not supported in this browser');
      }

      audioContext = new AudioContextCtor();

      masterGain = audioContext.createGain();
      masterGain.gain.value = 0.0001;

      limiter = audioContext.createDynamicsCompressor();
      limiter.threshold.value = CONFIG.output.limiterThreshold;
      limiter.knee.value = CONFIG.output.limiterKnee;
      limiter.ratio.value = CONFIG.output.limiterRatio;
      limiter.attack.value = CONFIG.output.limiterAttack;
      limiter.release.value = CONFIG.output.limiterRelease;

      filter = audioContext.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = CONFIG.filter.minFreq;
      filter.Q.value = CONFIG.filter.minQ;

      noiseGain = audioContext.createGain();
      noiseGain.gain.value = CONFIG.noise.gain;

      lfoOscillator = audioContext.createOscillator();
      lfoOscillator.type = 'sine';
      lfoOscillator.frequency.value = CONFIG.lfo.staticFreq;
      lfoGain = audioContext.createGain();
      lfoGain.gain.value = CONFIG.lfo.staticAmount;
      lfoOscillator.connect(lfoGain);
      lfoGain.connect(filter.frequency);
      lfoOscillator.start();

      noiseSource = audioContext.createBufferSource();
      noiseSource.buffer = createNoiseBuffer(audioContext);
      noiseSource.loop = true;

      noiseSource.connect(noiseGain);
      noiseGain.connect(filter);
      filter.connect(masterGain);
      masterGain.connect(limiter);
      limiter.connect(audioContext.destination);

      noiseSource.start();
    }

    async function ensureAudioRunning() {
      if (!audioContext) {
        initAudioContext();
      }

      if (audioContext.state === 'running') {
        return true;
      }

      await audioContext.resume();

      if (audioContext.state !== 'running') {
        return false;
      }

      // Tiny warm-up pulse to satisfy mobile gesture path.
      const warm = audioContext.createOscillator();
      const warmGain = audioContext.createGain();
      warm.frequency.value = 220;
      warmGain.gain.value = 0.00001;
      warm.connect(warmGain);
      warmGain.connect(audioContext.destination);
      warm.start();
      warm.stop(audioContext.currentTime + 0.02);
      return true;
    }

    function setUnlockVisible(visible) {
      unlock.style.display = visible ? 'flex' : 'none';
    }

    function norm(v) {
      return Math.min(1, Math.max(0, v));
    }

    function lerp(a, b, t) {
      return a + (b - a) * t;
    }

    function updateStatus(note) {
      if (!config.showHud) {
        return;
      }

      const state = audioContext ? audioContext.state : 'none';
      status.textContent = [
        'ambsynth wait mode',
        'audio: ' + state + (unlocked ? ' (unlocked)' : ' (locked)'),
        'freq: ' + Math.round(lastFreq) + ' Hz',
        'q: ' + lastQ.toFixed(2),
        note ? 'note: ' + note : ''
      ].filter(Boolean).join('\n');
    }

    function resizeCanvas() {
      const rect = root.getBoundingClientRect();
      const dpr = global.devicePixelRatio || 1;
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function updateSynthParameters(nx, ny) {
      if (!filter || !audioContext) {
        return;
      }

      const qMultiplier = touchMode === 'short' ? CONFIG.touch.shortQMultiplier : 1;
      const freqMultiplier = touchMode === 'short' ? CONFIG.touch.shortFrequencyMultiplier : 1;

      const qValue = lerp(CONFIG.filter.minQ, CONFIG.filter.maxQ, nx) * qMultiplier;
      const freqValue = lerp(CONFIG.filter.minFreq, CONFIG.filter.maxFreq, 1 - ny) * freqMultiplier;
      const now = audioContext.currentTime;

      filter.Q.cancelScheduledValues(now);
      filter.Q.linearRampToValueAtTime(qValue, now + 0.03);
      filter.frequency.cancelScheduledValues(now);
      filter.frequency.linearRampToValueAtTime(freqValue, now + 0.03);

      lastFreq = freqValue;
      lastQ = qValue;
      updateStatus(isPlaying ? 'touch active' : 'ready');
    }

    function draw() {
      const rect = root.getBoundingClientRect();
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);
      const ctx = canvas.getContext('2d');

      ctx.clearRect(0, 0, width, height);

      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, '#1f2937');
      gradient.addColorStop(1, '#0b1220');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      const x = lastX * width;
      const y = lastY * height;

      ctx.beginPath();
      ctx.arc(x, y, isPointerDown ? 26 : 18, 0, Math.PI * 2);
      ctx.fillStyle = isPointerDown ? 'rgba(103, 232, 249, 0.55)' : 'rgba(103, 232, 249, 0.25)';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(103, 232, 249, 0.9)';
      ctx.stroke();

      frameId = global.requestAnimationFrame(draw);
    }

    function startSynth(attackMs) {
      if (!audioContext || !masterGain) {
        return;
      }

      const now = audioContext.currentTime;
      const target = CONFIG.output.gain;
      masterGain.gain.cancelScheduledValues(now);
      masterGain.gain.setValueAtTime(masterGain.gain.value, now);
      masterGain.gain.linearRampToValueAtTime(target, now + attackMs / 1000);
      isPlaying = true;
      updateStatus('synth on');
    }

    function stopSynth(releaseMs) {
      if (!audioContext || !masterGain) {
        return;
      }

      const now = audioContext.currentTime;
      masterGain.gain.cancelScheduledValues(now);
      masterGain.gain.setValueAtTime(masterGain.gain.value, now);
      masterGain.gain.linearRampToValueAtTime(0.0001, now + releaseMs / 1000);
      isPlaying = false;
      updateStatus('synth off');
    }

    function clearTouchThreshold() {
      if (touchThresholdTimer) {
        global.clearTimeout(touchThresholdTimer);
        touchThresholdTimer = null;
      }
    }

    function beginInteraction() {
      touchStartAt = Date.now();
      touchMode = null;
      touchVoiceStarted = false;

      clearTouchThreshold();
      touchThresholdTimer = global.setTimeout(() => {
        touchMode = 'long';
        touchVoiceStarted = true;
        startSynth(CONFIG.envelope.attack);
        updateSynthParameters(lastX, lastY);
      }, CONFIG.touch.thresholdMs);
    }

    function endInteraction() {
      const duration = Date.now() - touchStartAt;
      clearTouchThreshold();

      if (duration < CONFIG.touch.thresholdMs) {
        touchMode = 'short';
        updateSynthParameters(lastX, lastY);
        startSynth(0);
        stopSynth(CONFIG.touch.shortReleaseMs);
      } else if (touchVoiceStarted) {
        stopSynth(CONFIG.envelope.release);
      }

      touchVoiceStarted = false;
      global.setTimeout(() => {
        touchMode = null;
      }, 0);
    }

    async function unlockAudioFromButton() {
      const now = Date.now();
      if (unlockInProgress || now - lastUnlockAt < 300) {
        return;
      }

      unlockInProgress = true;
      lastUnlockAt = now;
      unlockButton.disabled = true;
      unlockButton.textContent = 'Enabling audio...';

      try {
        const ok = await ensureAudioRunning();
        unlocked = ok;
      } catch (error) {
        console.error('AmbSynth unlock failed:', error);
        unlocked = false;
      }

      setUnlockVisible(!unlocked);

      if (!unlocked) {
        unlockButton.disabled = false;
        unlockButton.textContent = 'Audio still locked. Tap to retry';
      }

      unlockInProgress = false;
      updateStatus(unlocked ? 'audio unlocked' : 'audio still locked');
    }

    function updateFromPointer(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) {
        return;
      }

      const nx = norm((clientX - rect.left) / rect.width);
      const ny = norm((clientY - rect.top) / rect.height);
      lastX = nx;
      lastY = ny;
      updateSynthParameters(nx, ny);
    }

    function onPointerDown(e) {
      if (!unlocked) {
        return;
      }
      isPointerDown = true;
      beginInteraction();
      updateFromPointer(e.clientX, e.clientY);
      canvas.setPointerCapture(e.pointerId);
    }

    function onPointerMove(e) {
      if (!isPointerDown || !unlocked) {
        return;
      }
      updateFromPointer(e.clientX, e.clientY);
    }

    function onPointerUp(e) {
      if (!isPointerDown) {
        return;
      }
      isPointerDown = false;
      endInteraction();
      if (canvas.hasPointerCapture(e.pointerId)) {
        canvas.releasePointerCapture(e.pointerId);
      }
    }

    function onPointerCancel(e) {
      if (!isPointerDown) {
        return;
      }
      isPointerDown = false;
      clearTouchThreshold();
      stopSynth(CONFIG.envelope.release);
      if (canvas.hasPointerCapture(e.pointerId)) {
        canvas.releasePointerCapture(e.pointerId);
      }
    }

    function onWindowBlur() {
      isPointerDown = false;
      clearTouchThreshold();
      stopSynth(80);
    }

    unlockButton.addEventListener('pointerup', unlockAudioFromButton);
    unlockButton.addEventListener('click', unlockAudioFromButton);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerCancel);
    global.addEventListener('blur', onWindowBlur);
    global.addEventListener('resize', resizeCanvas);

    if (global.ResizeObserver) {
      resizeObserver = new global.ResizeObserver(resizeCanvas);
      resizeObserver.observe(root);
    }

    resizeCanvas();
    draw();
    updateStatus('ready');

    return {
      root,
      show() {
        root.style.display = 'block';
        resizeCanvas();
      },
      hide() {
        root.style.display = 'none';
        isPointerDown = false;
        clearTouchThreshold();
        stopSynth(80);
      },
      destroy() {
        global.cancelAnimationFrame(frameId);
        canvas.removeEventListener('pointerdown', onPointerDown);
        canvas.removeEventListener('pointermove', onPointerMove);
        canvas.removeEventListener('pointerup', onPointerUp);
        canvas.removeEventListener('pointercancel', onPointerCancel);
        unlockButton.removeEventListener('pointerup', unlockAudioFromButton);
        unlockButton.removeEventListener('click', unlockAudioFromButton);
        global.removeEventListener('blur', onWindowBlur);
        global.removeEventListener('resize', resizeCanvas);
        if (resizeObserver) {
          resizeObserver.disconnect();
        }
        if (root.parentNode) {
          root.parentNode.removeChild(root);
        }
      },
      getConfig() {
        return { ...config };
      }
    };
  }

  global.AmbSynthEmbed = {
    mount,
    create: mount,
    version: '0.2.0-inline'
  };
})(typeof window !== 'undefined' ? window : this);

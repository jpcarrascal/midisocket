(function (global) {
  const DEFAULT_OPTIONS = {
    src: '/html/ambsynth.html',
    title: 'AmbSynth',
    className: 'ambsynth-embed',
    allow: 'autoplay; fullscreen; clipboard-read; clipboard-write',
    sandbox: 'allow-scripts allow-same-origin allow-forms allow-pointer-lock allow-popups',
    query: null,
    style: null
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

  function toQueryString(query) {
    if (!query || typeof query !== 'object') {
      return '';
    }

    const params = new URLSearchParams();
    Object.keys(query).forEach((key) => {
      const value = query[key];
      if (value === undefined || value === null) {
        return;
      }
      params.set(key, String(value));
    });

    const value = params.toString();
    return value ? '?' + value : '';
  }

  function buildSrc(src, query) {
    return src + toQueryString(query);
  }

  function mount(container, options = {}) {
    const target = resolveContainer(container);
    const config = { ...DEFAULT_OPTIONS, ...options };

    const root = document.createElement('div');
    root.className = config.className;
    root.style.position = 'relative';
    root.style.width = '100%';
    root.style.height = '100%';
    root.style.minHeight = config.minHeight || '480px';
    root.style.overflow = 'hidden';
    root.style.background = config.background || '#111827';
    root.style.borderRadius = config.borderRadius || '0';

    if (config.style && typeof config.style === 'object') {
      Object.assign(root.style, config.style);
    }

    const iframe = document.createElement('iframe');
    iframe.src = buildSrc(config.src, config.query);
    iframe.title = config.title;
    iframe.allow = config.allow;
    iframe.setAttribute('sandbox', config.sandbox);
    iframe.setAttribute('loading', 'eager');
    iframe.setAttribute('referrerpolicy', 'no-referrer');
    iframe.style.display = 'block';
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = '0';
    iframe.style.background = 'transparent';

    root.appendChild(iframe);
    target.appendChild(root);

    return {
      root,
      iframe,
      destroy() {
        if (root.parentNode) {
          root.parentNode.removeChild(root);
        }
      },
      reload() {
        iframe.src = buildSrc(config.src, config.query);
      },
      setSrc(nextSrc, nextQuery = config.query) {
        config.src = nextSrc;
        config.query = nextQuery;
        iframe.src = buildSrc(config.src, config.query);
      },
      getConfig() {
        return { ...config };
      }
    };
  }

  global.AmbSynthEmbed = {
    mount,
    create: mount,
    version: '0.1.0'
  };
})(typeof window !== 'undefined' ? window : this);

/**
 * MediaManager - Módulo para gestión robusta de medios (cámara y micrófono)
 * 
 * PROBLEMAS SOLUCIONADOS:
 * 1. ✅ GUEST no puede acceder a cámara (permisos y configuración)
 * 2. ✅ Mejor detección de errores específicos
 * 3. ✅ Fallbacks más robustos para diferentes navegadores
 * 4. ✅ Manejo específico de contextos seguros (HTTPS)
 * 5. ✅ Verificación de permisos antes de solicitar medios
 * 
 * @author SecureCall Team
 * @version 2.0.0 - GUEST CAMERA FIXED
 */

class MediaManager {
  constructor() {
    this.currentStream = null;
    this.isInitialized = false;
    this.supportedConstraints = null;
    this.availableDevices = [];
    this.lastError = null;
    this.debugMode = true;
    
    // 🔧 ADDED: Estados específicos para guests
    this.permissionState = 'unknown';
    this.securityContext = 'unknown';
    this.browserSupport = 'unknown';
    
    // Configuraciones de constraints con diferentes niveles de calidad
    this.constraintProfiles = {
      high: {
        video: {
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          frameRate: { ideal: 30, max: 60 },
          facingMode: 'user'
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000
        }
      },
      medium: {
        video: {
          width: { ideal: 640, max: 1280 },
          height: { ideal: 480, max: 720 },
          frameRate: { ideal: 15, max: 30 },
          facingMode: 'user'
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      },
      low: {
        video: {
          width: { ideal: 320, max: 640 },
          height: { ideal: 240, max: 480 },
          frameRate: { ideal: 10, max: 15 }
        },
        audio: {
          echoCancellation: true
        }
      },
      // 🔧 ADDED: Perfil específico para guests con problemas
      guest_safe: {
        video: {
          width: { ideal: 320, min: 160 },
          height: { ideal: 240, min: 120 },
          frameRate: { ideal: 10, min: 5, max: 15 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: false,
          autoGainControl: false
        }
      },
      minimal: {
        video: true,
        audio: true
      },
      videoOnly: {
        video: true,
        audio: false
      },
      audioOnly: {
        video: false,
        audio: true
      }
    };
  }

  /**
   * Habilita el modo debug para logging detallado
   * @param {boolean} enabled - Si habilitar debug
   */
  setDebugMode(enabled) {
    this.debugMode = enabled;
  }

  /**
   * Log interno para debug
   * @param {string} message - Mensaje a loggear
   * @param {string} level - Nivel del log (info, warn, error)
   */
  _log(message, level = 'info') {
    if (this.debugMode) {
      const timestamp = new Date().toISOString();
      console[level](`[MediaManager ${timestamp}] ${message}`);
    }
  }

  /**
   * 🔧 FIXED: Verificar si el navegador soporta getUserMedia
   * @returns {boolean} - True si es compatible
   */
  isSupported() {
    const supported = !!(
      navigator.mediaDevices && 
      navigator.mediaDevices.getUserMedia &&
      window.MediaStream &&
      window.RTCPeerConnection
    );
    
    this.browserSupport = supported ? 'full' : 'partial';
    
    // 🔧 ADDED: Verificaciones adicionales para guests
    if (!supported) {
      if (!navigator.mediaDevices) {
        this.browserSupport = 'no_mediadevices';
      } else if (!navigator.mediaDevices.getUserMedia) {
        this.browserSupport = 'no_getusermedia';
      } else if (!window.MediaStream) {
        this.browserSupport = 'no_mediastream';
      } else if (!window.RTCPeerConnection) {
        this.browserSupport = 'no_rtc';
      }
    }
    
    this._log(`Browser support check: ${this.browserSupport}`);
    return supported;
  }

  /**
   * 🔧 FIXED: Verificar si estamos en un contexto seguro (HTTPS)
   * @returns {boolean} - True si es contexto seguro
   */
  isSecureContext() {
    const secure = window.isSecureContext || 
                   window.location.protocol === 'https:' || 
                   window.location.hostname === 'localhost' || 
                   window.location.hostname === '127.0.0.1' ||
                   window.location.hostname.endsWith('.local');
    
    this.securityContext = secure ? 'secure' : 'insecure';
    
    this._log(`Security context check: ${this.securityContext} (${window.location.protocol}//${window.location.hostname})`);
    return secure;
  }

  /**
   * 🔧 ADDED: Verificar permisos de cámara específicamente
   * @returns {Promise<string>} - Estado de permisos
   */
  async checkCameraPermissions() {
    try {
      this._log('GUEST FIXED: Checking camera permissions...');
      
      const permissions = await navigator.permissions.query({ name: 'camera' });
      this.permissionState = permissions.state;
      
      this._log(`GUEST FIXED: Camera permission state: ${this.permissionState}`);
      
      // 🔧 ADDED: Escuchar cambios en permisos
      permissions.onchange = () => {
        this.permissionState = permissions.state;
        this._log(`GUEST FIXED: Camera permission changed to: ${this.permissionState}`);
      };
      
      return this.permissionState;
      
    } catch (error) {
      this._log(`GUEST FIXED: Cannot check camera permissions: ${error.message}`, 'warn');
      this.permissionState = 'unknown';
      return 'unknown';
    }
  }

  /**
   * Inicializa el MediaManager y verifica capacidades del navegador
   * @returns {Promise<Object>} - Información sobre capacidades
   */
  async initialize() {
    try {
      this._log('GUEST FIXED: Initializing MediaManager with enhanced checks...');
      
      if (!this.isSupported()) {
        throw new Error(`Browser does not support required WebRTC APIs. Support level: ${this.browserSupport}`);
      }

      if (!this.isSecureContext()) {
        throw new Error(`Secure context (HTTPS) required for media access. Current: ${this.securityContext}`);
      }

      // 🔧 ADDED: Verificar permisos de cámara
      await this.checkCameraPermissions();

      // Obtener constraints soportadas
      this.supportedConstraints = navigator.mediaDevices.getSupportedConstraints();
      this._log(`Supported constraints: ${Object.keys(this.supportedConstraints).join(', ')}`);

      // Enumerar dispositivos disponibles
      await this._enumerateDevices();

      this.isInitialized = true;
      this._log('GUEST FIXED: MediaManager initialized successfully');

      return {
        supported: true,
        secureContext: this.securityContext === 'secure',
        permissionState: this.permissionState,
        browserSupport: this.browserSupport,
        videoDevices: this.availableDevices.filter(d => d.kind === 'videoinput').length,
        audioDevices: this.availableDevices.filter(d => d.kind === 'audioinput').length,
        constraints: this.supportedConstraints
      };

    } catch (error) {
      this.lastError = error;
      this._log(`GUEST FIXED: Initialization failed: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Enumera dispositivos de media disponibles
   * @private
   */
  async _enumerateDevices() {
    try {
      this.availableDevices = await navigator.mediaDevices.enumerateDevices();
      
      const videoDevices = this.availableDevices.filter(d => d.kind === 'videoinput');
      const audioDevices = this.availableDevices.filter(d => d.kind === 'audioinput');
      
      this._log(`Found ${videoDevices.length} video devices, ${audioDevices.length} audio devices`);
      
      return {
        video: videoDevices,
        audio: audioDevices
      };
    } catch (error) {
      this._log(`Device enumeration failed: ${error.message}`, 'warn');
      return { video: [], audio: [] };
    }
  }

  /**
   * Detiene y limpia el stream actual
   * @param {MediaStream} stream - Stream a limpiar (opcional, usa el actual si no se especifica)
   */
  stopStream(stream = null) {
    const targetStream = stream || this.currentStream;
    
    if (targetStream) {
      this._log('Stopping media stream...');
      
      targetStream.getTracks().forEach(track => {
        this._log(`Stopping ${track.kind} track (${track.label})`);
        track.stop();
      });

      if (targetStream === this.currentStream) {
        this.currentStream = null;
      }
      
      this._log('Media stream stopped successfully');
    }
  }

  /**
   * 🔧 FIXED: Obtiene un stream de media con fallbacks automáticos MEJORADOS PARA GUESTS
   * @param {Object} options - Opciones de configuración
   * @param {string} options.quality - Calidad deseada ('high', 'medium', 'low', 'guest_safe', 'minimal')
   * @param {boolean} options.video - Si incluir video (default: true)
   * @param {boolean} options.audio - Si incluir audio (default: true)
   * @param {string} options.videoDeviceId - ID específico de dispositivo de video
   * @param {string} options.audioDeviceId - ID específico de dispositivo de audio
   * @param {boolean} options.fallbackToAudioOnly - Si fallar a solo audio en caso de error de video
   * @param {boolean} options.allowPartialSuccess - Si permitir éxito parcial (ej: solo video o solo audio)
   * @param {boolean} options.guestMode - Si usar configuraciones específicas para guests
   * @returns {Promise<Object>} - Resultado con stream y metadatos
   */
  async getUserMedia(options = {}) {
    const {
      quality = 'medium',
      video = true,
      audio = true,
      videoDeviceId = null,
      audioDeviceId = null,
      fallbackToAudioOnly = true,
      allowPartialSuccess = true,
      guestMode = false
    } = options;

    this._log(`GUEST FIXED: Getting user media with options: ${JSON.stringify(options)}`);

    if (!this.isInitialized) {
      await this.initialize();
    }

    // 🔧 ADDED: Verificar permisos antes de solicitar medios
    if (this.permissionState === 'denied') {
      throw this._createDetailedError(
        new Error('Camera access denied'),
        video,
        audio,
        'Permission denied by user. Please enable camera permissions in browser settings.'
      );
    }

    // Limpiar stream anterior si existe
    this.stopStream();

    // 🔧 FIXED: Construir intentos con configuraciones específicas para guests
    const attempts = this._buildConstraintAttempts(
      quality, 
      video, 
      audio, 
      videoDeviceId, 
      audioDeviceId, 
      fallbackToAudioOnly,
      guestMode
    );
    
    let lastError = null;
    let partialSuccess = null;

    for (let i = 0; i < attempts.length; i++) {
      const attempt = attempts[i];
      this._log(`GUEST FIXED: Attempt ${i + 1}/${attempts.length}: ${attempt.description}`);

      try {
        const stream = await navigator.mediaDevices.getUserMedia(attempt.constraints);
        
        const result = this._analyzeStream(stream, attempt);
        this.currentStream = stream;
        this.lastError = null;
        
        this._log(`GUEST FIXED: Success! ${result.description}`);
        
        // Si es éxito parcial y no lo permitimos, continuar intentando
        if (result.isPartial && !allowPartialSuccess && i < attempts.length - 1) {
          this._log('Partial success not allowed, continuing...');
          partialSuccess = result;
          this.stopStream(stream);
          continue;
        }
        
        return result;

      } catch (error) {
        lastError = error;
        this._log(`GUEST FIXED: Attempt ${i + 1} failed: ${error.name} - ${error.message}`, 'warn');
        
        // 🔧 ADDED: Actualizar estado de permisos si es error de permisos
        if (error.name === 'NotAllowedError') {
          this.permissionState = 'denied';
          break; // No intentar más si se deniegan permisos
        }
      }
    }

    // Si llegamos aquí, todos los intentos fallaron
    this.lastError = lastError;
    
    // Si tenemos un éxito parcial y lo permitimos, usarlo
    if (partialSuccess && allowPartialSuccess) {
      this._log('Using partial success as fallback');
      return partialSuccess;
    }

    // Lanzar error con información detallada
    const errorInfo = this._createDetailedError(lastError, video, audio);
    this._log(`GUEST FIXED: All attempts failed: ${errorInfo.message}`, 'error');
    throw errorInfo;
  }

  /**
   * 🔧 FIXED: Construye una lista de intentos de constraints con fallbacks MEJORADOS PARA GUESTS
   * @private
   */
  _buildConstraintAttempts(quality, video, audio, videoDeviceId, audioDeviceId, fallbackToAudioOnly, guestMode) {
    const attempts = [];
    
    // 🔧 ADDED: Si es guest mode, empezar con configuraciones más seguras
    if (guestMode) {
      // Intento con configuración específica para guests
      if (video && audio) {
        const constraints = this._buildConstraints('guest_safe', true, true, videoDeviceId, audioDeviceId);
        attempts.push({
          constraints,
          description: `guest-safe quality video + audio`,
          expectedVideo: true,
          expectedAudio: true
        });
      }
    }
    
    // Intento principal con calidad especificada
    if (video && audio) {
      const constraints = this._buildConstraints(quality, true, true, videoDeviceId, audioDeviceId);
      attempts.push({
        constraints,
        description: `${quality} quality video + audio`,
        expectedVideo: true,
        expectedAudio: true
      });
    }

    // Intentos con calidades menores si la principal falla
    if (video && audio && quality !== 'minimal') {
      const fallbackQualities = guestMode ? 
        ['guest_safe', 'low', 'minimal'] : 
        ['medium', 'low', 'guest_safe', 'minimal'];
      
      // Filtrar la calidad ya intentada
      const filteredQualities = fallbackQualities.filter(q => q !== quality);
      
      filteredQualities.forEach(q => {
        const constraints = this._buildConstraints(q, true, true, videoDeviceId, audioDeviceId);
        attempts.push({
          constraints,
          description: `${q} quality video + audio (fallback)`,
          expectedVideo: true,
          expectedAudio: true
        });
      });
    }

    // Solo video si audio falla
    if (video) {
      const videoQuality = guestMode ? 'guest_safe' : quality;
      const constraints = this._buildConstraints(videoQuality, true, false, videoDeviceId, null);
      attempts.push({
        constraints,
        description: `${videoQuality} quality video only`,
        expectedVideo: true,
        expectedAudio: false
      });
    }

    // Solo audio si video falla y está habilitado el fallback
    if (audio && fallbackToAudioOnly) {
      const constraints = this._buildConstraints(quality, false, true, null, audioDeviceId);
      attempts.push({
        constraints,
        description: `audio only (fallback)`,
        expectedVideo: false,
        expectedAudio: true
      });
    }

    // 🔧 ADDED: Último recurso - constraints mínimas
    if (video || audio) {
      attempts.push({
        constraints: { video: video, audio: audio },
        description: `minimal constraints (last resort)`,
        expectedVideo: video,
        expectedAudio: audio
      });
    }

    return attempts;
  }

  /**
   * Construye constraints específicas
   * @private
   */
  _buildConstraints(quality, includeVideo, includeAudio, videoDeviceId, audioDeviceId) {
    const profile = this.constraintProfiles[quality] || this.constraintProfiles.minimal;
    const constraints = {};

    if (includeVideo && profile.video) {
      constraints.video = { ...profile.video };
      if (videoDeviceId) {
        constraints.video.deviceId = { exact: videoDeviceId };
      }
    } else {
      constraints.video = false;
    }

    if (includeAudio && profile.audio) {
      constraints.audio = { ...profile.audio };
      if (audioDeviceId) {
        constraints.audio.deviceId = { exact: audioDeviceId };
      }
    } else {
      constraints.audio = false;
    }

    return constraints;
  }

  /**
   * Analiza un stream obtenido y retorna metadatos
   * @private
   */
  _analyzeStream(stream, attempt) {
    const videoTracks = stream.getVideoTracks();
    const audioTracks = stream.getAudioTracks();
    
    const hasVideo = videoTracks.length > 0;
    const hasAudio = audioTracks.length > 0;
    const isPartial = (attempt.expectedVideo && !hasVideo) || (attempt.expectedAudio && !hasAudio);
    
    let description = `Stream obtained: `;
    if (hasVideo && hasAudio) {
      description += 'video + audio';
    } else if (hasVideo) {
      description += 'video only';
    } else if (hasAudio) {
      description += 'audio only';
    } else {
      description += 'no tracks';
    }

    // Obtener configuraciones de video si está disponible
    let videoSettings = null;
    if (hasVideo) {
      videoSettings = videoTracks[0].getSettings();
      description += ` (${videoSettings.width}x${videoSettings.height}@${videoSettings.frameRate}fps)`;
    }

    return {
      stream,
      hasVideo,
      hasAudio,
      isPartial,
      videoTracks: videoTracks.length,
      audioTracks: audioTracks.length,
      videoSettings,
      description,
      quality: this._assessQuality(videoSettings),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Evalúa la calidad del video obtenido
   * @private
   */
  _assessQuality(videoSettings) {
    if (!videoSettings) return 'no-video';
    
    const { width, height, frameRate } = videoSettings;
    const pixels = width * height;
    
    if (pixels >= 1280 * 720 && frameRate >= 25) return 'high';
    if (pixels >= 640 * 480 && frameRate >= 15) return 'medium';
    if (pixels >= 320 * 240) return 'low';
    return 'minimal';
  }

  /**
   * 🔧 FIXED: Crea un error detallado con información útil para el usuario MEJORADO PARA GUESTS
   * @private
   */
  _createDetailedError(originalError, requestedVideo, requestedAudio, customMessage = null) {
    const error = new Error();
    error.name = originalError?.name || 'MediaError';
    error.originalError = originalError;
    error.requestedVideo = requestedVideo;
    error.requestedAudio = requestedAudio;
    error.permissionState = this.permissionState;
    error.securityContext = this.securityContext;
    error.browserSupport = this.browserSupport;
    
    if (customMessage) {
      error.message = customMessage;
      error.userAction = 'Please check browser settings and try again.';
      error.recoverable = true;
      return error;
    }
    
    switch (originalError?.name) {
      case 'NotAllowedError':
        error.message = 'Camera and microphone access denied. Please grant permissions to continue.';
        error.userAction = 'Click the camera icon in your browser\'s address bar and select "Allow", then refresh the page.';
        error.recoverable = true;
        break;
        
      case 'NotFoundError':
        error.message = 'No camera or microphone found on this device.';
        error.userAction = 'Please connect a camera and microphone to your device, then try again.';
        error.recoverable = true;
        break;
        
      case 'NotReadableError':
        error.message = 'Camera or microphone is being used by another application.';
        error.userAction = 'Please close other video calling applications (Zoom, Teams, etc.) and try again.';
        error.recoverable = true;
        break;
        
      case 'OverconstrainedError':
        error.message = 'Camera settings are not supported by your device.';
        error.userAction = 'Try using a different camera if available, or update your browser.';
        error.recoverable = true;
        break;
        
      case 'SecurityError':
        error.message = 'Security error: HTTPS connection required for camera access.';
        error.userAction = 'Please ensure you are using a secure (HTTPS) connection.';
        error.recoverable = false;
        break;
        
      case 'AbortError':
        error.message = 'Media request was aborted.';
        error.userAction = 'Please try again.';
        error.recoverable = true;
        break;
        
      default:
        if (this.securityContext === 'insecure') {
          error.message = 'Secure connection (HTTPS) required for camera access.';
          error.userAction = 'Please use HTTPS or localhost for camera access.';
          error.recoverable = false;
        } else if (this.browserSupport !== 'full') {
          error.message = `Browser does not fully support WebRTC. Support level: ${this.browserSupport}`;
          error.userAction = 'Please use a modern browser like Chrome, Firefox, or Safari.';
          error.recoverable = false;
        } else {
          error.message = `Failed to access camera/microphone: ${originalError?.message || 'Unknown error'}`;
          error.userAction = 'Please check your camera and microphone connections, grant permissions, and try again.';
          error.recoverable = true;
        }
    }
    
    return error;
  }

  /**
   * Obtiene información sobre dispositivos disponibles
   * @returns {Promise<Object>} - Lista de dispositivos
   */
  async getAvailableDevices() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    await this._enumerateDevices();
    
    return {
      video: this.availableDevices.filter(d => d.kind === 'videoinput'),
      audio: this.availableDevices.filter(d => d.kind === 'audioinput'),
      total: this.availableDevices.length
    };
  }

  /**
   * Cambia el dispositivo de video en el stream actual
   * @param {string} deviceId - ID del nuevo dispositivo
   * @returns {Promise<MediaStream>} - Nuevo stream
   */
  async switchVideoDevice(deviceId) {
    if (!this.currentStream) {
      throw new Error('No active stream to switch device');
    }

    const audioTracks = this.currentStream.getAudioTracks();
    const hasAudio = audioTracks.length > 0;
    
    this._log(`Switching to video device: ${deviceId}`);
    
    const result = await this.getUserMedia({
      video: true,
      audio: hasAudio,
      videoDeviceId: deviceId,
      audioDeviceId: hasAudio ? audioTracks[0].getSettings().deviceId : null
    });

    return result.stream;
  }

  /**
   * Cambia el dispositivo de audio en el stream actual
   * @param {string} deviceId - ID del nuevo dispositivo
   * @returns {Promise<MediaStream>} - Nuevo stream
   */
  async switchAudioDevice(deviceId) {
    if (!this.currentStream) {
      throw new Error('No active stream to switch device');
    }

    const videoTracks = this.currentStream.getVideoTracks();
    const hasVideo = videoTracks.length > 0;
    
    this._log(`Switching to audio device: ${deviceId}`);
    
    const result = await this.getUserMedia({
      video: hasVideo,
      audio: true,
      videoDeviceId: hasVideo ? videoTracks[0].getSettings().deviceId : null,
      audioDeviceId: deviceId
    });

    return result.stream;
  }

  /**
   * Obtiene el stream actual
   * @returns {MediaStream|null} - Stream actual o null
   */
  getCurrentStream() {
    return this.currentStream;
  }

  /**
   * Obtiene el último error ocurrido
   * @returns {Error|null} - Último error o null
   */
  getLastError() {
    return this.lastError;
  }

  /**
   * Verifica si hay un stream activo
   * @returns {boolean} - True si hay stream activo
   */
  hasActiveStream() {
    return !!(this.currentStream && this.currentStream.active);
  }

  /**
   * 🔧 ADDED: Obtiene información de diagnóstico completa
   * @returns {Object} - Información de diagnóstico
   */
  getDiagnosticInfo() {
    return {
      isInitialized: this.isInitialized,
      permissionState: this.permissionState,
      securityContext: this.securityContext,
      browserSupport: this.browserSupport,
      hasActiveStream: this.hasActiveStream(),
      availableDevices: {
        video: this.availableDevices.filter(d => d.kind === 'videoinput').length,
        audio: this.availableDevices.filter(d => d.kind === 'audioinput').length
      },
      supportedConstraints: this.supportedConstraints ? Object.keys(this.supportedConstraints) : [],
      lastError: this.lastError ? {
        name: this.lastError.name,
        message: this.lastError.message
      } : null,
      currentLocation: {
        protocol: window.location.protocol,
        hostname: window.location.hostname,
        port: window.location.port
      }
    };
  }

  /**
   * Limpia todos los recursos y resetea el manager
   */
  cleanup() {
    this._log('GUEST FIXED: Cleaning up MediaManager...');
    
    this.stopStream();
    this.isInitialized = false;
    this.supportedConstraints = null;
    this.availableDevices = [];
    this.lastError = null;
    this.permissionState = 'unknown';
    this.securityContext = 'unknown';
    this.browserSupport = 'unknown';
    
    this._log('GUEST FIXED: MediaManager cleaned up');
  }
}

// Crear instancia singleton
const mediaManager = new MediaManager();

// Funciones de conveniencia para importar
export const initializeMedia = (options) => mediaManager.initialize(options);
export const getUserMedia = (options) => mediaManager.getUserMedia(options);
export const stopStream = (stream) => mediaManager.stopStream(stream);
export const getAvailableDevices = () => mediaManager.getAvailableDevices();
export const switchVideoDevice = (deviceId) => mediaManager.switchVideoDevice(deviceId);
export const switchAudioDevice = (deviceId) => mediaManager.switchAudioDevice(deviceId);
export const getCurrentStream = () => mediaManager.getCurrentStream();
export const getLastError = () => mediaManager.getLastError();
export const hasActiveStream = () => mediaManager.hasActiveStream();
export const cleanup = () => mediaManager.cleanup();
export const setDebugMode = (enabled) => mediaManager.setDebugMode(enabled);
export const isSupported = () => mediaManager.isSupported();
export const isSecureContext = () => mediaManager.isSecureContext();
export const checkCameraPermissions = () => mediaManager.checkCameraPermissions();
export const getDiagnosticInfo = () => mediaManager.getDiagnosticInfo();

// Exportar la instancia completa para uso avanzado
export default mediaManager;
/**
 * CanvasRenderer - Módulo dedicado para renderización de canvas
 * 
 * Este módulo se encarga específicamente de:
 * - Crear y gestionar elementos canvas visibles
 * - Renderizar frames base64 en canvas
 * - Verificar que los elementos estén correctamente en el DOM
 * - Proporcionar debugging visual
 * 
 * @author SecureCall Team
 * @version 1.0.0
 */

class CanvasRenderer {
  constructor() {
    this.localCanvas = null;
    this.remoteCanvas = null;
    this.localVideo = null;
    this.remoteVideo = null;
    this.debugMode = true;
    this.frameCount = 0;
    this.lastRenderTime = 0;
  }

  _log(message, level = 'info') {
    if (this.debugMode) {
      const timestamp = new Date().toISOString();
      console[level](`[CanvasRenderer ${timestamp}] ${message}`);
    }
  }

  /**
   * Inicializa el canvas local para captura de frames
   * @param {MediaStream} stream - Stream local de video
   * @param {HTMLElement} container - Contenedor donde montar el canvas
   * @returns {Promise<Object>} - Información del canvas creado
   */
  async initializeLocalCanvas(stream, container) {
    try {
      this._log('🎨 Initializing local canvas for frame capture...');

      // Limpiar elementos anteriores
      this._cleanupLocalElements();

      // Crear video element para el stream
      this.localVideo = document.createElement('video');
      this.localVideo.srcObject = stream;
      this.localVideo.autoplay = true;
      this.localVideo.playsInline = true;
      this.localVideo.muted = true;
      this.localVideo.style.display = 'none'; // Oculto, solo para captura

      // Crear canvas para capturar frames
      this.localCanvas = document.createElement('canvas');
      this.localCanvas.style.display = 'none'; // Oculto, solo para captura
      
      // Agregar al DOM para que funcionen correctamente
      if (container) {
        container.appendChild(this.localVideo);
        container.appendChild(this.localCanvas);
      } else {
        document.body.appendChild(this.localVideo);
        document.body.appendChild(this.localCanvas);
      }

      // Esperar a que el video esté listo
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Video metadata load timeout'));
        }, 10000);

        this.localVideo.onloadedmetadata = () => {
          clearTimeout(timeout);
          
          // Configurar tamaño del canvas
          const videoWidth = this.localVideo.videoWidth || 320;
          const videoHeight = this.localVideo.videoHeight || 240;
          
          // Tamaño optimizado para streaming
          const maxWidth = 320;
          const maxHeight = 240;
          const aspectRatio = videoWidth / videoHeight;
          
          if (aspectRatio > maxWidth / maxHeight) {
            this.localCanvas.width = maxWidth;
            this.localCanvas.height = maxWidth / aspectRatio;
          } else {
            this.localCanvas.width = maxHeight * aspectRatio;
            this.localCanvas.height = maxHeight;
          }

          this._log(`✅ Local canvas initialized: ${this.localCanvas.width}x${this.localCanvas.height}`);
          this._log(`   Video source: ${videoWidth}x${videoHeight}`);
          
          resolve();
        };

        this.localVideo.onerror = (error) => {
          clearTimeout(timeout);
          reject(new Error(`Video load error: ${error.message}`));
        };
      });

      return {
        canvas: this.localCanvas,
        video: this.localVideo,
        width: this.localCanvas.width,
        height: this.localCanvas.height
      };

    } catch (error) {
      this._log(`❌ Error initializing local canvas: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Inicializa el canvas remoto para mostrar frames recibidos
   * @param {HTMLVideoElement} videoElement - Elemento video donde mostrar el resultado
   * @returns {Object} - Información del canvas remoto
   */
  initializeRemoteCanvas(videoElement) {
    try {
      this._log('🖼️ Initializing remote canvas for frame display...');

      // Limpiar elementos anteriores
      this._cleanupRemoteElements();

      // Crear canvas para renderizar frames remotos
      this.remoteCanvas = document.createElement('canvas');
      this.remoteCanvas.width = 320;
      this.remoteCanvas.height = 240;
      
      // Agregar al DOM (oculto)
      this.remoteCanvas.style.display = 'none';
      document.body.appendChild(this.remoteCanvas);

      // Crear stream desde canvas
      const stream = this.remoteCanvas.captureStream(2); // 2 FPS
      
      // Asignar stream al video element
      if (videoElement) {
        videoElement.srcObject = stream;
        videoElement.play().catch(error => {
          this._log(`❌ Error playing remote video: ${error.message}`, 'error');
        });
      }

      this._log(`✅ Remote canvas initialized: ${this.remoteCanvas.width}x${this.remoteCanvas.height}`);

      return {
        canvas: this.remoteCanvas,
        stream: stream,
        width: this.remoteCanvas.width,
        height: this.remoteCanvas.height
      };

    } catch (error) {
      this._log(`❌ Error initializing remote canvas: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Captura un frame del video local y lo convierte a base64
   * @returns {string|null} - Frame en formato base64 o null si falla
   */
  captureLocalFrame() {
    try {
      if (!this.localVideo || !this.localCanvas) {
        this._log('⚠️ Local elements not ready for frame capture');
        return null;
      }

      if (this.localVideo.readyState < 2) { // HAVE_CURRENT_DATA
        this._log('⚠️ Video not ready for frame capture');
        return null;
      }

      const ctx = this.localCanvas.getContext('2d');
      if (!ctx) {
        this._log('❌ Cannot get canvas context');
        return null;
      }

      // Limpiar canvas
      ctx.clearRect(0, 0, this.localCanvas.width, this.localCanvas.height);

      // Dibujar frame actual
      ctx.drawImage(this.localVideo, 0, 0, this.localCanvas.width, this.localCanvas.height);

      // Convertir a base64
      const frameData = this.localCanvas.toDataURL('image/jpeg', 0.6);
      
      this.frameCount++;
      this.lastRenderTime = Date.now();

      // Log cada 10 frames
      if (this.frameCount % 10 === 0) {
        this._log(`📸 Captured frame #${this.frameCount} (${frameData.length} bytes)`);
      }

      return frameData;

    } catch (error) {
      this._log(`❌ Error capturing frame: ${error.message}`, 'error');
      return null;
    }
  }

  /**
   * Renderiza un frame base64 en el canvas remoto
   * @param {string} frameData - Frame en formato base64
   * @returns {Promise<boolean>} - True si se renderizó correctamente
   */
  renderRemoteFrame(frameData) {
    return new Promise((resolve) => {
      try {
        if (!this.remoteCanvas) {
          this._log('⚠️ Remote canvas not initialized');
          resolve(false);
          return;
        }

        if (!frameData || !frameData.startsWith('data:image/')) {
          this._log('⚠️ Invalid frame data received');
          resolve(false);
          return;
        }

        const ctx = this.remoteCanvas.getContext('2d');
        if (!ctx) {
          this._log('❌ Cannot get remote canvas context');
          resolve(false);
          return;
        }

        const img = new Image();
        
        img.onload = () => {
          try {
            // Limpiar canvas
            ctx.clearRect(0, 0, this.remoteCanvas.width, this.remoteCanvas.height);
            
            // Dibujar nueva imagen
            ctx.drawImage(img, 0, 0, this.remoteCanvas.width, this.remoteCanvas.height);
            
            this.frameCount++;
            this.lastRenderTime = Date.now();

            // Log cada 10 frames
            if (this.frameCount % 10 === 0) {
              this._log(`🖼️ Rendered remote frame #${this.frameCount}`);
            }

            resolve(true);
          } catch (drawError) {
            this._log(`❌ Error drawing frame: ${drawError.message}`, 'error');
            resolve(false);
          }
        };

        img.onerror = () => {
          this._log(`❌ Error loading frame image`, 'error');
          resolve(false);
        };

        // Cargar imagen
        img.src = frameData;

      } catch (error) {
        this._log(`❌ Error rendering remote frame: ${error.message}`, 'error');
        resolve(false);
      }
    });
  }

  /**
   * Verifica que los elementos estén correctamente en el DOM
   * @returns {Object} - Estado de los elementos
   */
  verifyDOMElements() {
    const status = {
      localVideo: {
        exists: !!this.localVideo,
        inDOM: this.localVideo ? document.contains(this.localVideo) : false,
        ready: this.localVideo ? this.localVideo.readyState >= 2 : false
      },
      localCanvas: {
        exists: !!this.localCanvas,
        inDOM: this.localCanvas ? document.contains(this.localCanvas) : false,
        hasContext: this.localCanvas ? !!this.localCanvas.getContext('2d') : false
      },
      remoteCanvas: {
        exists: !!this.remoteCanvas,
        inDOM: this.remoteCanvas ? document.contains(this.remoteCanvas) : false,
        hasContext: this.remoteCanvas ? !!this.remoteCanvas.getContext('2d') : false
      }
    };

    this._log('🔍 DOM Elements Status:');
    this._log(`   Local Video: exists=${status.localVideo.exists}, inDOM=${status.localVideo.inDOM}, ready=${status.localVideo.ready}`);
    this._log(`   Local Canvas: exists=${status.localCanvas.exists}, inDOM=${status.localCanvas.inDOM}, hasContext=${status.localCanvas.hasContext}`);
    this._log(`   Remote Canvas: exists=${status.remoteCanvas.exists}, inDOM=${status.remoteCanvas.inDOM}, hasContext=${status.remoteCanvas.hasContext}`);

    return status;
  }

  /**
   * Crea un canvas de prueba visible para debugging
   * @param {HTMLElement} container - Contenedor donde mostrar el canvas
   * @returns {HTMLCanvasElement} - Canvas de prueba
   */
  createDebugCanvas(container) {
    const debugCanvas = document.createElement('canvas');
    debugCanvas.width = 320;
    debugCanvas.height = 240;
    debugCanvas.style.border = '2px solid red';
    debugCanvas.style.backgroundColor = 'black';
    debugCanvas.id = 'debug-canvas';

    const ctx = debugCanvas.getContext('2d');
    
    // Dibujar patrón de prueba
    ctx.fillStyle = 'red';
    ctx.fillRect(0, 0, 160, 120);
    ctx.fillStyle = 'green';
    ctx.fillRect(160, 0, 160, 120);
    ctx.fillStyle = 'blue';
    ctx.fillRect(0, 120, 160, 120);
    ctx.fillStyle = 'yellow';
    ctx.fillRect(160, 120, 160, 120);

    // Agregar texto
    ctx.fillStyle = 'white';
    ctx.font = '20px Arial';
    ctx.fillText('DEBUG CANVAS', 80, 130);

    if (container) {
      container.appendChild(debugCanvas);
    } else {
      document.body.appendChild(debugCanvas);
    }

    this._log('🎨 Debug canvas created and added to DOM');
    return debugCanvas;
  }

  /**
   * Prueba de renderización directa de base64 en un canvas visible
   * @param {string} frameData - Frame en base64
   * @param {HTMLElement} container - Contenedor donde mostrar
   * @returns {Promise<HTMLCanvasElement>} - Canvas con la imagen renderizada
   */
  testDirectRender(frameData, container) {
    return new Promise((resolve, reject) => {
      const testCanvas = document.createElement('canvas');
      testCanvas.width = 320;
      testCanvas.height = 240;
      testCanvas.style.border = '2px solid green';
      testCanvas.id = 'test-render-canvas';

      const ctx = testCanvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        ctx.clearRect(0, 0, testCanvas.width, testCanvas.height);
        ctx.drawImage(img, 0, 0, testCanvas.width, testCanvas.height);
        
        if (container) {
          container.appendChild(testCanvas);
        } else {
          document.body.appendChild(testCanvas);
        }

        this._log('✅ Direct render test successful');
        resolve(testCanvas);
      };

      img.onerror = () => {
        this._log('❌ Direct render test failed');
        reject(new Error('Failed to load test image'));
      };

      img.src = frameData;
    });
  }

  /**
   * Obtiene estadísticas de renderización
   * @returns {Object} - Estadísticas
   */
  getStats() {
    return {
      frameCount: this.frameCount,
      lastRenderTime: this.lastRenderTime,
      timeSinceLastRender: Date.now() - this.lastRenderTime,
      elementsStatus: this.verifyDOMElements()
    };
  }

  _cleanupLocalElements() {
    if (this.localVideo) {
      this.localVideo.pause();
      this.localVideo.srcObject = null;
      if (this.localVideo.parentNode) {
        this.localVideo.parentNode.removeChild(this.localVideo);
      }
      this.localVideo = null;
    }

    if (this.localCanvas) {
      if (this.localCanvas.parentNode) {
        this.localCanvas.parentNode.removeChild(this.localCanvas);
      }
      this.localCanvas = null;
    }
  }

  _cleanupRemoteElements() {
    if (this.remoteCanvas) {
      if (this.remoteCanvas.parentNode) {
        this.remoteCanvas.parentNode.removeChild(this.remoteCanvas);
      }
      this.remoteCanvas = null;
    }
  }

  cleanup() {
    this._log('🧹 Cleaning up CanvasRenderer...');
    
    this._cleanupLocalElements();
    this._cleanupRemoteElements();
    
    this.frameCount = 0;
    this.lastRenderTime = 0;
    
    this._log('✅ CanvasRenderer cleanup completed');
  }
}

export default CanvasRenderer;
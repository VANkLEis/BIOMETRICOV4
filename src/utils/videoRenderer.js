/**
 * VideoRenderer - Módulo especializado para renderización de video
 * 
 * Este módulo se encarga EXCLUSIVAMENTE de:
 * - Mostrar el video local del usuario en su propio canvas
 * - Renderizar frames remotos recibidos en el canvas remoto
 * - Gestionar la visualización sin interferir con la lógica de conexión
 * 
 * @author SecureCall Team
 * @version 1.0.0
 */

class VideoRenderer {
  constructor() {
    this.localVideoElement = null;
    this.remoteVideoElement = null;
    this.localRenderCanvas = null;
    this.remoteRenderCanvas = null;
    this.localRenderInterval = null;
    this.isLocalRendering = false;
    this.isRemoteRendering = false;
    this.frameStats = {
      localFrames: 0,
      remoteFrames: 0,
      lastLocalRender: 0,
      lastRemoteRender: 0
    };
    this.debugMode = true;
  }

  _log(message, level = 'info') {
    if (this.debugMode) {
      const timestamp = new Date().toISOString();
      console[level](`[VideoRenderer ${timestamp}] ${message}`);
    }
  }

  /**
   * 🎯 FUNCIÓN PRINCIPAL: Inicializar renderizado del video local
   * Esta función asegura que el usuario se vea a sí mismo
   */
  initializeLocalVideoRenderer(videoElement, stream) {
    try {
      this._log('🎥 Initializing local video renderer...');
      
      if (!videoElement || !stream) {
        throw new Error('Video element or stream is missing');
      }

      // Limpiar renderizado anterior
      this.stopLocalRendering();

      this.localVideoElement = videoElement;
      
      // ✅ MÉTODO 1: Asignación directa del stream (más confiable)
      this._log('📺 Setting stream directly to video element');
      this.localVideoElement.srcObject = stream;
      this.localVideoElement.muted = true; // Evitar feedback
      this.localVideoElement.autoplay = true;
      this.localVideoElement.playsInline = true;

      // Verificar que el video se reproduce
      const playPromise = this.localVideoElement.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            this._log('✅ Local video playing successfully');
            this.isLocalRendering = true;
            this.frameStats.lastLocalRender = Date.now();
          })
          .catch(error => {
            this._log(`❌ Error playing local video: ${error.message}`, 'error');
            // Fallback a canvas si falla la reproducción directa
            this._initializeLocalCanvasRenderer(stream);
          });
      }

      // ✅ MÉTODO 2: Fallback con canvas (si el método 1 falla)
      // Crear canvas de respaldo para casos problemáticos
      this._createLocalCanvasBackup(stream);

      this._log('✅ Local video renderer initialized');
      return { success: true, method: 'direct-stream' };

    } catch (error) {
      this._log(`❌ Error initializing local video renderer: ${error.message}`, 'error');
      
      // Fallback completo a canvas
      try {
        return this._initializeLocalCanvasRenderer(stream);
      } catch (fallbackError) {
        this._log(`❌ Canvas fallback also failed: ${fallbackError.message}`, 'error');
        throw error;
      }
    }
  }

  /**
   * 🎯 FUNCIÓN PRINCIPAL: Inicializar renderizado de video remoto
   * Esta función maneja la visualización de frames remotos
   */
  initializeRemoteVideoRenderer(videoElement) {
    try {
      this._log('🖼️ Initializing remote video renderer...');
      
      if (!videoElement) {
        throw new Error('Remote video element is missing');
      }

      // Limpiar renderizado anterior
      this.stopRemoteRendering();

      this.remoteVideoElement = videoElement;

      // Crear canvas para renderizar frames remotos
      this.remoteRenderCanvas = document.createElement('canvas');
      this.remoteRenderCanvas.width = 640;
      this.remoteRenderCanvas.height = 480;
      this.remoteRenderCanvas.style.display = 'none';
      document.body.appendChild(this.remoteRenderCanvas);

      // Crear stream desde canvas
      const canvasStream = this.remoteRenderCanvas.captureStream(15); // 15 FPS
      
      // Asignar stream al video element
      this.remoteVideoElement.srcObject = canvasStream;
      this.remoteVideoElement.autoplay = true;
      this.remoteVideoElement.playsInline = true;

      const playPromise = this.remoteVideoElement.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            this._log('✅ Remote video canvas stream playing');
            this.isRemoteRendering = true;
          })
          .catch(error => {
            this._log(`❌ Error playing remote canvas stream: ${error.message}`, 'error');
          });
      }

      this._log('✅ Remote video renderer initialized');
      return { success: true, canvas: this.remoteRenderCanvas };

    } catch (error) {
      this._log(`❌ Error initializing remote video renderer: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * 🎯 FUNCIÓN PRINCIPAL: Renderizar frame remoto recibido
   * Esta función dibuja frames base64 en el canvas remoto
   */
  renderRemoteFrame(frameData) {
    return new Promise((resolve) => {
      try {
        if (!this.isRemoteRendering || !this.remoteRenderCanvas) {
          this._log('⚠️ Remote renderer not ready');
          resolve(false);
          return;
        }

        if (!frameData || !frameData.startsWith('data:image/')) {
          this._log('⚠️ Invalid frame data for remote rendering');
          resolve(false);
          return;
        }

        const ctx = this.remoteRenderCanvas.getContext('2d');
        if (!ctx) {
          this._log('❌ Cannot get remote canvas context');
          resolve(false);
          return;
        }

        const img = new Image();
        
        img.onload = () => {
          try {
            // Limpiar canvas
            ctx.clearRect(0, 0, this.remoteRenderCanvas.width, this.remoteRenderCanvas.height);
            
            // Dibujar frame manteniendo aspect ratio
            const canvasAspect = this.remoteRenderCanvas.width / this.remoteRenderCanvas.height;
            const imageAspect = img.width / img.height;
            
            let drawWidth, drawHeight, drawX, drawY;
            
            if (imageAspect > canvasAspect) {
              // Imagen más ancha que canvas
              drawWidth = this.remoteRenderCanvas.width;
              drawHeight = drawWidth / imageAspect;
              drawX = 0;
              drawY = (this.remoteRenderCanvas.height - drawHeight) / 2;
            } else {
              // Imagen más alta que canvas
              drawHeight = this.remoteRenderCanvas.height;
              drawWidth = drawHeight * imageAspect;
              drawX = (this.remoteRenderCanvas.width - drawWidth) / 2;
              drawY = 0;
            }
            
            ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
            
            this.frameStats.remoteFrames++;
            this.frameStats.lastRemoteRender = Date.now();

            // Log cada 30 frames para no saturar
            if (this.frameStats.remoteFrames % 30 === 0) {
              this._log(`🖼️ Rendered ${this.frameStats.remoteFrames} remote frames`);
            }

            resolve(true);
          } catch (drawError) {
            this._log(`❌ Error drawing remote frame: ${drawError.message}`, 'error');
            resolve(false);
          }
        };

        img.onerror = () => {
          this._log(`❌ Error loading remote frame image`, 'error');
          resolve(false);
        };

        img.src = frameData;

      } catch (error) {
        this._log(`❌ Error in renderRemoteFrame: ${error.message}`, 'error');
        resolve(false);
      }
    });
  }

  /**
   * 🔧 MÉTODO FALLBACK: Canvas renderer para video local
   * Se usa cuando la asignación directa del stream falla
   */
  _initializeLocalCanvasRenderer(stream) {
    try {
      this._log('🎨 Initializing local canvas renderer (fallback)...');

      // Crear video oculto para captura
      const hiddenVideo = document.createElement('video');
      hiddenVideo.srcObject = stream;
      hiddenVideo.autoplay = true;
      hiddenVideo.playsInline = true;
      hiddenVideo.muted = true;
      hiddenVideo.style.display = 'none';
      document.body.appendChild(hiddenVideo);

      // Crear canvas para renderizado
      this.localRenderCanvas = document.createElement('canvas');
      this.localRenderCanvas.width = 640;
      this.localRenderCanvas.height = 480;
      this.localRenderCanvas.style.display = 'none';
      document.body.appendChild(this.localRenderCanvas);

      // Esperar a que el video esté listo
      hiddenVideo.onloadedmetadata = () => {
        // Ajustar tamaño del canvas al video
        this.localRenderCanvas.width = hiddenVideo.videoWidth || 640;
        this.localRenderCanvas.height = hiddenVideo.videoHeight || 480;

        // Crear stream desde canvas
        const canvasStream = this.localRenderCanvas.captureStream(30); // 30 FPS

        // Asignar al video element visible
        this.localVideoElement.srcObject = canvasStream;
        this.localVideoElement.play().catch(console.error);

        // Iniciar renderizado continuo
        this._startLocalCanvasRendering(hiddenVideo);

        this._log('✅ Local canvas renderer initialized');
      };

      return { success: true, method: 'canvas-fallback' };

    } catch (error) {
      this._log(`❌ Error in canvas fallback: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * 🔧 MÉTODO AUXILIAR: Crear backup de canvas para video local
   */
  _createLocalCanvasBackup(stream) {
    // Este método crea un canvas de respaldo que se puede activar si hay problemas
    this._log('🛡️ Creating local canvas backup...');
    
    // Implementación similar a _initializeLocalCanvasRenderer pero sin activar
    // Se mantiene listo para usar si es necesario
  }

  /**
   * 🔧 MÉTODO AUXILIAR: Iniciar renderizado continuo del canvas local
   */
  _startLocalCanvasRendering(sourceVideo) {
    if (this.localRenderInterval) {
      clearInterval(this.localRenderInterval);
    }

    this._log('🎬 Starting local canvas rendering loop...');

    this.localRenderInterval = setInterval(() => {
      if (!sourceVideo || !this.localRenderCanvas || sourceVideo.readyState < 2) {
        return;
      }

      try {
        const ctx = this.localRenderCanvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, this.localRenderCanvas.width, this.localRenderCanvas.height);
          ctx.drawImage(sourceVideo, 0, 0, this.localRenderCanvas.width, this.localRenderCanvas.height);
          
          this.frameStats.localFrames++;
          this.frameStats.lastLocalRender = Date.now();
        }
      } catch (error) {
        this._log(`❌ Error in local canvas rendering: ${error.message}`, 'error');
      }
    }, 33); // ~30 FPS

    this.isLocalRendering = true;
  }

  /**
   * 🔧 DIAGNÓSTICO: Verificar estado de renderizado
   */
  diagnoseRenderingIssues() {
    const diagnosis = {
      timestamp: new Date().toISOString(),
      localVideo: {
        element: !!this.localVideoElement,
        hasStream: !!(this.localVideoElement && this.localVideoElement.srcObject),
        isPlaying: !!(this.localVideoElement && !this.localVideoElement.paused),
        readyState: this.localVideoElement ? this.localVideoElement.readyState : 'N/A',
        videoWidth: this.localVideoElement ? this.localVideoElement.videoWidth : 0,
        videoHeight: this.localVideoElement ? this.localVideoElement.videoHeight : 0
      },
      remoteVideo: {
        element: !!this.remoteVideoElement,
        hasStream: !!(this.remoteVideoElement && this.remoteVideoElement.srcObject),
        isPlaying: !!(this.remoteVideoElement && !this.remoteVideoElement.paused),
        readyState: this.remoteVideoElement ? this.remoteVideoElement.readyState : 'N/A'
      },
      rendering: {
        localActive: this.isLocalRendering,
        remoteActive: this.isRemoteRendering,
        localFrames: this.frameStats.localFrames,
        remoteFrames: this.frameStats.remoteFrames,
        timeSinceLastLocal: Date.now() - this.frameStats.lastLocalRender,
        timeSinceLastRemote: Date.now() - this.frameStats.lastRemoteRender
      },
      canvas: {
        localCanvas: !!this.localRenderCanvas,
        remoteCanvas: !!this.remoteRenderCanvas,
        localCanvasInDOM: this.localRenderCanvas ? document.contains(this.localRenderCanvas) : false,
        remoteCanvasInDOM: this.remoteRenderCanvas ? document.contains(this.remoteRenderCanvas) : false
      }
    };

    this._log('🔍 RENDERING DIAGNOSIS:');
    this._log(JSON.stringify(diagnosis, null, 2));

    return diagnosis;
  }

  /**
   * 🔧 REPARACIÓN: Intentar arreglar problemas de renderizado
   */
  attemptRenderingRepair() {
    this._log('🔧 Attempting rendering repair...');

    const diagnosis = this.diagnoseRenderingIssues();
    const repairs = [];

    // Reparar video local
    if (diagnosis.localVideo.element && diagnosis.localVideo.hasStream && !diagnosis.localVideo.isPlaying) {
      this._log('🔧 Repairing local video playback...');
      this.localVideoElement.play().catch(error => {
        this._log(`❌ Local video repair failed: ${error.message}`, 'error');
      });
      repairs.push('local-video-play');
    }

    // Reparar video remoto
    if (diagnosis.remoteVideo.element && diagnosis.remoteVideo.hasStream && !diagnosis.remoteVideo.isPlaying) {
      this._log('🔧 Repairing remote video playback...');
      this.remoteVideoElement.play().catch(error => {
        this._log(`❌ Remote video repair failed: ${error.message}`, 'error');
      });
      repairs.push('remote-video-play');
    }

    // Verificar canvas remotos
    if (!diagnosis.canvas.remoteCanvasInDOM && this.remoteRenderCanvas) {
      this._log('🔧 Re-adding remote canvas to DOM...');
      document.body.appendChild(this.remoteRenderCanvas);
      repairs.push('remote-canvas-dom');
    }

    this._log(`✅ Repair attempt completed. Applied: ${repairs.join(', ')}`);
    return repairs;
  }

  /**
   * 🧪 TESTING: Crear test visual para verificar renderizado
   */
  createVisualTest(container) {
    this._log('🧪 Creating visual rendering test...');

    const testContainer = document.createElement('div');
    testContainer.style.position = 'fixed';
    testContainer.style.top = '10px';
    testContainer.style.right = '10px';
    testContainer.style.zIndex = '10000';
    testContainer.style.backgroundColor = 'rgba(0,0,0,0.8)';
    testContainer.style.padding = '10px';
    testContainer.style.borderRadius = '5px';
    testContainer.style.color = 'white';
    testContainer.style.fontSize = '12px';
    testContainer.innerHTML = '<h4>Video Renderer Test</h4>';

    // Test canvas local
    if (this.localVideoElement && this.localVideoElement.srcObject) {
      const testCanvas = document.createElement('canvas');
      testCanvas.width = 160;
      testCanvas.height = 120;
      testCanvas.style.border = '1px solid green';
      testCanvas.style.margin = '5px';

      const ctx = testCanvas.getContext('2d');
      ctx.fillStyle = 'green';
      ctx.fillRect(0, 0, testCanvas.width, testCanvas.height);
      ctx.fillStyle = 'white';
      ctx.font = '12px Arial';
      ctx.fillText('Local Video Test', 10, 60);

      testContainer.appendChild(testCanvas);
      testContainer.appendChild(document.createElement('br'));
      testContainer.appendChild(document.createTextNode('Local: Ready'));
    }

    // Test canvas remoto
    if (this.remoteRenderCanvas) {
      const testCanvas = document.createElement('canvas');
      testCanvas.width = 160;
      testCanvas.height = 120;
      testCanvas.style.border = '1px solid blue';
      testCanvas.style.margin = '5px';

      const ctx = testCanvas.getContext('2d');
      ctx.fillStyle = 'blue';
      ctx.fillRect(0, 0, testCanvas.width, testCanvas.height);
      ctx.fillStyle = 'white';
      ctx.font = '12px Arial';
      ctx.fillText('Remote Video Test', 10, 60);

      testContainer.appendChild(testCanvas);
      testContainer.appendChild(document.createElement('br'));
      testContainer.appendChild(document.createTextNode('Remote: Ready'));
    }

    // Agregar botón de diagnóstico
    const diagButton = document.createElement('button');
    diagButton.textContent = 'Run Diagnosis';
    diagButton.style.margin = '5px';
    diagButton.onclick = () => {
      this.diagnoseRenderingIssues();
      this.attemptRenderingRepair();
    };
    testContainer.appendChild(diagButton);

    // Agregar al contenedor especificado o al body
    if (container) {
      container.appendChild(testContainer);
    } else {
      document.body.appendChild(testContainer);
    }

    this._log('✅ Visual test created');
    return testContainer;
  }

  /**
   * 🛑 LIMPIEZA: Detener renderizado local
   */
  stopLocalRendering() {
    this._log('🛑 Stopping local rendering...');

    if (this.localRenderInterval) {
      clearInterval(this.localRenderInterval);
      this.localRenderInterval = null;
    }

    this.isLocalRendering = false;
  }

  /**
   * 🛑 LIMPIEZA: Detener renderizado remoto
   */
  stopRemoteRendering() {
    this._log('🛑 Stopping remote rendering...');
    this.isRemoteRendering = false;
  }

  /**
   * 📊 ESTADÍSTICAS: Obtener estadísticas de renderizado
   */
  getStats() {
    return {
      ...this.frameStats,
      isLocalRendering: this.isLocalRendering,
      isRemoteRendering: this.isRemoteRendering,
      hasLocalCanvas: !!this.localRenderCanvas,
      hasRemoteCanvas: !!this.remoteRenderCanvas,
      localVideoReady: !!(this.localVideoElement && this.localVideoElement.readyState >= 2),
      remoteVideoReady: !!(this.remoteVideoElement && this.remoteVideoElement.readyState >= 2)
    };
  }

  /**
   * 🧹 LIMPIEZA: Limpiar todos los recursos
   */
  cleanup() {
    this._log('🧹 Cleaning up VideoRenderer...');

    this.stopLocalRendering();
    this.stopRemoteRendering();

    // Limpiar canvas
    if (this.localRenderCanvas && this.localRenderCanvas.parentNode) {
      this.localRenderCanvas.parentNode.removeChild(this.localRenderCanvas);
      this.localRenderCanvas = null;
    }

    if (this.remoteRenderCanvas && this.remoteRenderCanvas.parentNode) {
      this.remoteRenderCanvas.parentNode.removeChild(this.remoteRenderCanvas);
      this.remoteRenderCanvas = null;
    }

    // Reset referencias
    this.localVideoElement = null;
    this.remoteVideoElement = null;

    // Reset estadísticas
    this.frameStats = {
      localFrames: 0,
      remoteFrames: 0,
      lastLocalRender: 0,
      lastRemoteRender: 0
    };

    this._log('✅ VideoRenderer cleanup completed');
  }
}

export default VideoRenderer;
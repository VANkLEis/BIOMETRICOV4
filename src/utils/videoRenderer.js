/**
 * VideoRenderer - SOLUCIONADO para visualización de video
 * 
 * PROBLEMA IDENTIFICADO: Los elementos de video no se estaban configurando correctamente
 * SOLUCIÓN: Simplificar y asegurar que los streams se asignen directamente a los elementos video
 * 
 * @author SecureCall Team
 * @version 2.0.0 - FIXED
 */

class VideoRenderer {
  constructor() {
    this.localVideoElement = null;
    this.remoteVideoElement = null;
    this.isLocalRendering = false;
    this.isRemoteRendering = false;
    this.frameStats = {
      localFrames: 0,
      remoteFrames: 0,
      lastLocalRender: 0,
      lastRemoteRender: 0
    };
    this.debugMode = true;
    
    // 🔧 FIXED: Canvas para Socket.IO streaming
    this.remoteCanvas = null;
    this.remoteCanvasStream = null;
  }

  _log(message, level = 'info') {
    if (this.debugMode) {
      const timestamp = new Date().toISOString();
      console[level](`[VideoRenderer ${timestamp}] ${message}`);
    }
  }

  /**
   * 🎯 SOLUCIONADO: Inicializar video local (usuario se ve a sí mismo)
   * PROBLEMA: El stream no se asignaba correctamente al elemento video
   * SOLUCIÓN: Asignación directa y verificación de reproducción
   */
  initializeLocalVideoRenderer(videoElement, stream) {
    try {
      this._log('🎥 FIXED: Initializing local video renderer...');
      
      if (!videoElement) {
        throw new Error('Local video element is required');
      }
      
      if (!stream) {
        throw new Error('Local stream is required');
      }

      this.localVideoElement = videoElement;
      
      // 🔧 FIXED: Asignación directa y simple del stream
      this._log('📺 FIXED: Assigning stream directly to local video element');
      this.localVideoElement.srcObject = stream;
      this.localVideoElement.muted = true; // CRÍTICO: evitar feedback
      this.localVideoElement.autoplay = true;
      this.localVideoElement.playsInline = true;
      
      // 🔧 FIXED: Forzar reproducción inmediata
      const playPromise = this.localVideoElement.play();
      
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            this._log('✅ FIXED: Local video is now playing and visible');
            this.isLocalRendering = true;
            this.frameStats.lastLocalRender = Date.now();
            this.frameStats.localFrames++;
          })
          .catch(error => {
            this._log(`❌ FIXED: Local video play failed: ${error.message}`, 'error');
            // Intentar reproducir de nuevo después de un momento
            setTimeout(() => {
              this.localVideoElement.play().catch(console.error);
            }, 1000);
          });
      }

      // 🔧 FIXED: Verificar que el video tiene dimensiones
      this.localVideoElement.onloadedmetadata = () => {
        this._log(`✅ FIXED: Local video metadata loaded - ${this.localVideoElement.videoWidth}x${this.localVideoElement.videoHeight}`);
        
        // Asegurar que el video se está reproduciendo
        if (this.localVideoElement.paused) {
          this.localVideoElement.play().catch(console.error);
        }
      };

      this._log('✅ FIXED: Local video renderer initialized successfully');
      return { success: true, method: 'direct-stream-assignment' };

    } catch (error) {
      this._log(`❌ FIXED: Error in local video renderer: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * 🎯 SOLUCIONADO: Inicializar video remoto para Socket.IO streaming
   * PROBLEMA: El canvas no se configuraba correctamente para mostrar frames
   * SOLUCIÓN: Canvas stream directo al elemento video
   */
  initializeRemoteVideoRenderer(videoElement) {
    try {
      this._log('🖼️ FIXED: Initializing remote video renderer...');
      
      if (!videoElement) {
        throw new Error('Remote video element is required');
      }

      this.remoteVideoElement = videoElement;

      // 🔧 FIXED: Crear canvas para renderizar frames de Socket.IO
      this.remoteCanvas = document.createElement('canvas');
      this.remoteCanvas.width = 640;
      this.remoteCanvas.height = 480;
      this.remoteCanvas.style.display = 'none'; // Oculto, solo para captura
      document.body.appendChild(this.remoteCanvas);

      // 🔧 FIXED: Crear stream desde canvas con FPS adecuado
      this.remoteCanvasStream = this.remoteCanvas.captureStream(15); // 15 FPS
      
      // 🔧 FIXED: Asignar stream del canvas al video element
      this.remoteVideoElement.srcObject = this.remoteCanvasStream;
      this.remoteVideoElement.autoplay = true;
      this.remoteVideoElement.playsInline = true;

      // 🔧 FIXED: Asegurar reproducción
      const playPromise = this.remoteVideoElement.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            this._log('✅ FIXED: Remote video canvas stream is playing');
            this.isRemoteRendering = true;
          })
          .catch(error => {
            this._log(`❌ FIXED: Remote video play failed: ${error.message}`, 'error');
          });
      }

      // 🔧 FIXED: Dibujar frame inicial para activar el stream
      const ctx = this.remoteCanvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, this.remoteCanvas.width, this.remoteCanvas.height);
        ctx.fillStyle = '#ffffff';
        ctx.font = '24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Waiting for remote video...', this.remoteCanvas.width / 2, this.remoteCanvas.height / 2);
      }

      this._log('✅ FIXED: Remote video renderer initialized successfully');
      return { success: true, canvas: this.remoteCanvas };

    } catch (error) {
      this._log(`❌ FIXED: Error in remote video renderer: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * 🎯 SOLUCIONADO: Renderizar frame remoto
   * PROBLEMA: Los frames no se dibujaban correctamente en el canvas
   * SOLUCIÓN: Renderizado directo con manejo de aspect ratio
   */
  async renderRemoteFrame(frameData) {
    try {
      if (!this.isRemoteRendering || !this.remoteCanvas) {
        this._log('⚠️ FIXED: Remote renderer not ready, initializing...');
        return false;
      }

      if (!frameData || !frameData.startsWith('data:image/')) {
        this._log('⚠️ FIXED: Invalid frame data received');
        return false;
      }

      const ctx = this.remoteCanvas.getContext('2d');
      if (!ctx) {
        this._log('❌ FIXED: Cannot get canvas context');
        return false;
      }

      return new Promise((resolve) => {
        const img = new Image();
        
        img.onload = () => {
          try {
            // 🔧 FIXED: Limpiar canvas completamente
            ctx.clearRect(0, 0, this.remoteCanvas.width, this.remoteCanvas.height);
            
            // 🔧 FIXED: Dibujar imagen manteniendo aspect ratio
            const canvasAspect = this.remoteCanvas.width / this.remoteCanvas.height;
            const imageAspect = img.width / img.height;
            
            let drawWidth, drawHeight, drawX, drawY;
            
            if (imageAspect > canvasAspect) {
              // Imagen más ancha - ajustar por ancho
              drawWidth = this.remoteCanvas.width;
              drawHeight = drawWidth / imageAspect;
              drawX = 0;
              drawY = (this.remoteCanvas.height - drawHeight) / 2;
            } else {
              // Imagen más alta - ajustar por altura
              drawHeight = this.remoteCanvas.height;
              drawWidth = drawHeight * imageAspect;
              drawX = (this.remoteCanvas.width - drawWidth) / 2;
              drawY = 0;
            }
            
            // 🔧 FIXED: Dibujar con fondo negro para áreas no cubiertas
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, this.remoteCanvas.width, this.remoteCanvas.height);
            
            // 🔧 FIXED: Dibujar imagen
            ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
            
            // 🔧 FIXED: Actualizar estadísticas
            this.frameStats.remoteFrames++;
            this.frameStats.lastRemoteRender = Date.now();

            // Log cada 30 frames para no saturar consola
            if (this.frameStats.remoteFrames % 30 === 0) {
              this._log(`✅ FIXED: Rendered ${this.frameStats.remoteFrames} remote frames`);
            }

            resolve(true);
          } catch (drawError) {
            this._log(`❌ FIXED: Error drawing frame: ${drawError.message}`, 'error');
            resolve(false);
          }
        };

        img.onerror = () => {
          this._log(`❌ FIXED: Error loading frame image`, 'error');
          resolve(false);
        };

        // 🔧 FIXED: Cargar imagen
        img.src = frameData;
      });

    } catch (error) {
      this._log(`❌ FIXED: Error in renderRemoteFrame: ${error.message}`, 'error');
      return false;
    }
  }

  /**
   * 🔧 DIAGNÓSTICO MEJORADO: Verificar estado completo
   */
  diagnoseRenderingIssues() {
    const diagnosis = {
      timestamp: new Date().toISOString(),
      localVideo: {
        element: !!this.localVideoElement,
        inDOM: this.localVideoElement ? document.contains(this.localVideoElement) : false,
        hasStream: !!(this.localVideoElement && this.localVideoElement.srcObject),
        isPlaying: !!(this.localVideoElement && !this.localVideoElement.paused),
        readyState: this.localVideoElement ? this.localVideoElement.readyState : 'N/A',
        videoWidth: this.localVideoElement ? this.localVideoElement.videoWidth : 0,
        videoHeight: this.localVideoElement ? this.localVideoElement.videoHeight : 0,
        currentTime: this.localVideoElement ? this.localVideoElement.currentTime : 0,
        muted: this.localVideoElement ? this.localVideoElement.muted : false
      },
      remoteVideo: {
        element: !!this.remoteVideoElement,
        inDOM: this.remoteVideoElement ? document.contains(this.remoteVideoElement) : false,
        hasStream: !!(this.remoteVideoElement && this.remoteVideoElement.srcObject),
        isPlaying: !!(this.remoteVideoElement && !this.remoteVideoElement.paused),
        readyState: this.remoteVideoElement ? this.remoteVideoElement.readyState : 'N/A',
        videoWidth: this.remoteVideoElement ? this.remoteVideoElement.videoWidth : 0,
        videoHeight: this.remoteVideoElement ? this.remoteVideoElement.videoHeight : 0
      },
      canvas: {
        remoteCanvas: !!this.remoteCanvas,
        remoteCanvasInDOM: this.remoteCanvas ? document.contains(this.remoteCanvas) : false,
        remoteCanvasSize: this.remoteCanvas ? `${this.remoteCanvas.width}x${this.remoteCanvas.height}` : 'N/A',
        hasCanvasStream: !!this.remoteCanvasStream
      },
      rendering: {
        isLocalRendering: this.isLocalRendering,
        isRemoteRendering: this.isRemoteRendering,
        localFrames: this.frameStats.localFrames,
        remoteFrames: this.frameStats.remoteFrames,
        timeSinceLastLocal: this.frameStats.lastLocalRender ? Date.now() - this.frameStats.lastLocalRender : 'Never',
        timeSinceLastRemote: this.frameStats.lastRemoteRender ? Date.now() - this.frameStats.lastRemoteRender : 'Never'
      }
    };

    this._log('🔍 FIXED: COMPLETE RENDERING DIAGNOSIS:');
    this._log(JSON.stringify(diagnosis, null, 2));

    return diagnosis;
  }

  /**
   * 🔧 REPARACIÓN MEJORADA: Arreglar problemas específicos
   */
  attemptRenderingRepair() {
    this._log('🔧 FIXED: Attempting comprehensive rendering repair...');

    const diagnosis = this.diagnoseRenderingIssues();
    const repairs = [];

    // 🔧 FIXED: Reparar video local
    if (diagnosis.localVideo.element && diagnosis.localVideo.hasStream) {
      if (!diagnosis.localVideo.isPlaying) {
        this._log('🔧 FIXED: Repairing local video playback...');
        this.localVideoElement.play()
          .then(() => {
            this._log('✅ FIXED: Local video playback repaired');
            this.isLocalRendering = true;
          })
          .catch(error => {
            this._log(`❌ FIXED: Local video repair failed: ${error.message}`, 'error');
          });
        repairs.push('local-video-play');
      }

      if (diagnosis.localVideo.readyState < 2) {
        this._log('🔧 FIXED: Local video not ready, forcing reload...');
        const currentStream = this.localVideoElement.srcObject;
        this.localVideoElement.srcObject = null;
        setTimeout(() => {
          this.localVideoElement.srcObject = currentStream;
          this.localVideoElement.play().catch(console.error);
        }, 100);
        repairs.push('local-video-reload');
      }
    }

    // 🔧 FIXED: Reparar video remoto
    if (diagnosis.remoteVideo.element) {
      if (!diagnosis.remoteVideo.isPlaying && diagnosis.remoteVideo.hasStream) {
        this._log('🔧 FIXED: Repairing remote video playback...');
        this.remoteVideoElement.play()
          .then(() => {
            this._log('✅ FIXED: Remote video playback repaired');
          })
          .catch(error => {
            this._log(`❌ FIXED: Remote video repair failed: ${error.message}`, 'error');
          });
        repairs.push('remote-video-play');
      }

      // 🔧 FIXED: Recrear canvas stream si es necesario
      if (!diagnosis.canvas.hasCanvasStream && this.remoteCanvas) {
        this._log('🔧 FIXED: Recreating remote canvas stream...');
        this.remoteCanvasStream = this.remoteCanvas.captureStream(15);
        this.remoteVideoElement.srcObject = this.remoteCanvasStream;
        this.remoteVideoElement.play().catch(console.error);
        repairs.push('remote-canvas-stream');
      }
    }

    // 🔧 FIXED: Reparar canvas remoto
    if (!diagnosis.canvas.remoteCanvasInDOM && this.remoteCanvas) {
      this._log('🔧 FIXED: Re-adding remote canvas to DOM...');
      document.body.appendChild(this.remoteCanvas);
      repairs.push('remote-canvas-dom');
    }

    this._log(`✅ FIXED: Repair completed. Applied repairs: ${repairs.join(', ')}`);
    return repairs;
  }

  /**
   * 🧪 TEST VISUAL MEJORADO: Crear test completo
   */
  createVisualTest(container) {
    this._log('🧪 FIXED: Creating comprehensive visual test...');

    const testContainer = document.createElement('div');
    testContainer.style.cssText = `
      position: fixed;
      top: 10px;
      left: 10px;
      z-index: 10000;
      background: rgba(0,0,0,0.9);
      padding: 15px;
      border-radius: 8px;
      color: white;
      font-family: monospace;
      font-size: 12px;
      max-width: 400px;
      border: 2px solid #00ff00;
    `;

    testContainer.innerHTML = '<h3 style="margin:0 0 10px 0; color:#00ff00;">🧪 VideoRenderer Test Panel</h3>';

    // 🔧 FIXED: Test de video local
    const localTest = document.createElement('div');
    localTest.style.marginBottom = '10px';
    localTest.innerHTML = `
      <strong>📹 Local Video:</strong><br>
      Element: ${!!this.localVideoElement ? '✅' : '❌'}<br>
      Stream: ${this.localVideoElement && this.localVideoElement.srcObject ? '✅' : '❌'}<br>
      Playing: ${this.localVideoElement && !this.localVideoElement.paused ? '✅' : '❌'}<br>
      Rendering: ${this.isLocalRendering ? '✅' : '❌'}
    `;
    testContainer.appendChild(localTest);

    // 🔧 FIXED: Test de video remoto
    const remoteTest = document.createElement('div');
    remoteTest.style.marginBottom = '10px';
    remoteTest.innerHTML = `
      <strong>📺 Remote Video:</strong><br>
      Element: ${!!this.remoteVideoElement ? '✅' : '❌'}<br>
      Canvas: ${!!this.remoteCanvas ? '✅' : '❌'}<br>
      Stream: ${!!this.remoteCanvasStream ? '✅' : '❌'}<br>
      Rendering: ${this.isRemoteRendering ? '✅' : '❌'}<br>
      Frames: ${this.frameStats.remoteFrames}
    `;
    testContainer.appendChild(remoteTest);

    // 🔧 FIXED: Botones de acción
    const buttonContainer = document.createElement('div');
    buttonContainer.style.marginTop = '10px';

    const diagButton = document.createElement('button');
    diagButton.textContent = '🔍 Diagnose';
    diagButton.style.cssText = 'margin: 2px; padding: 5px; background: #333; color: white; border: 1px solid #666; border-radius: 3px; cursor: pointer;';
    diagButton.onclick = () => {
      const diagnosis = this.diagnoseRenderingIssues();
      alert('Diagnosis completed! Check console for details.');
    };

    const repairButton = document.createElement('button');
    repairButton.textContent = '🔧 Repair';
    repairButton.style.cssText = 'margin: 2px; padding: 5px; background: #333; color: white; border: 1px solid #666; border-radius: 3px; cursor: pointer;';
    repairButton.onclick = () => {
      const repairs = this.attemptRenderingRepair();
      alert(`Repairs applied: ${repairs.join(', ')}`);
      // Actualizar display
      setTimeout(() => {
        testContainer.remove();
        this.createVisualTest(container);
      }, 1000);
    };

    const closeButton = document.createElement('button');
    closeButton.textContent = '❌ Close';
    closeButton.style.cssText = 'margin: 2px; padding: 5px; background: #333; color: white; border: 1px solid #666; border-radius: 3px; cursor: pointer;';
    closeButton.onclick = () => testContainer.remove();

    buttonContainer.appendChild(diagButton);
    buttonContainer.appendChild(repairButton);
    buttonContainer.appendChild(closeButton);
    testContainer.appendChild(buttonContainer);

    // 🔧 FIXED: Agregar al contenedor
    if (container) {
      container.appendChild(testContainer);
    } else {
      document.body.appendChild(testContainer);
    }

    this._log('✅ FIXED: Visual test panel created');
    return testContainer;
  }

  /**
   * 📊 ESTADÍSTICAS MEJORADAS
   */
  getStats() {
    return {
      ...this.frameStats,
      isLocalRendering: this.isLocalRendering,
      isRemoteRendering: this.isRemoteRendering,
      hasLocalCanvas: false, // No usamos canvas para local
      hasRemoteCanvas: !!this.remoteCanvas,
      localVideoReady: !!(this.localVideoElement && this.localVideoElement.readyState >= 2),
      remoteVideoReady: !!(this.remoteVideoElement && this.remoteVideoElement.readyState >= 2),
      localVideoPlaying: !!(this.localVideoElement && !this.localVideoElement.paused),
      remoteVideoPlaying: !!(this.remoteVideoElement && !this.remoteVideoElement.paused)
    };
  }

  /**
   * 🧹 LIMPIEZA COMPLETA
   */
  cleanup() {
    this._log('🧹 FIXED: Cleaning up VideoRenderer...');

    // Detener renderizado
    this.isLocalRendering = false;
    this.isRemoteRendering = false;

    // Limpiar canvas remoto
    if (this.remoteCanvas && this.remoteCanvas.parentNode) {
      this.remoteCanvas.parentNode.removeChild(this.remoteCanvas);
    }
    this.remoteCanvas = null;
    this.remoteCanvasStream = null;

    // Reset referencias (sin limpiar los elementos, solo las referencias)
    this.localVideoElement = null;
    this.remoteVideoElement = null;

    // Reset estadísticas
    this.frameStats = {
      localFrames: 0,
      remoteFrames: 0,
      lastLocalRender: 0,
      lastRemoteRender: 0
    };

    this._log('✅ FIXED: VideoRenderer cleanup completed');
  }
}

export default VideoRenderer;
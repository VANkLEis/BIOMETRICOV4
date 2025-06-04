import { JitsiMeetExternalAPI } from '@jitsi/react-sdk';

class JitsiService {
  private static instance: JitsiService;
  private api: JitsiMeetExternalAPI | null = null;
  private domain = 'meet.jit.si';

  private constructor() {}

  static getInstance(): JitsiService {
    if (!JitsiService.instance) {
      JitsiService.instance = new JitsiService();
    }
    return JitsiService.instance;
  }

  async initializeCall(roomId: string, displayName: string, container: HTMLElement): Promise<void> {
    try {
      // Clean up any existing instance
      if (this.api) {
        this.api.dispose();
        this.api = null;
      }

      // Wait for the container to be properly mounted
      await new Promise(resolve => setTimeout(resolve, 100));

      const options = {
        roomName: `securecall-${roomId}`, // Add prefix to avoid conflicts
        width: container.offsetWidth,
        height: container.offsetHeight,
        parentNode: container,
        lang: 'es',
        userInfo: {
          displayName
        },
        configOverwrite: {
          startWithAudioMuted: false,
          startWithVideoMuted: false,
          prejoinPageEnabled: false,
          disableDeepLinking: true
        },
        interfaceConfigOverwrite: {
          TOOLBAR_BUTTONS: [
            'microphone', 'camera', 'closedcaptions', 'desktop', 'fullscreen',
            'fodeviceselection', 'hangup', 'profile', 'recording',
            'livestreaming', 'etherpad', 'sharedvideo', 'settings', 'raisehand',
            'videoquality', 'filmstrip', 'feedback', 'stats', 'shortcuts',
            'tileview', 'select-background', 'download', 'help', 'mute-everyone'
          ],
          SHOW_JITSI_WATERMARK: false,
          SHOW_WATERMARK_FOR_GUESTS: false,
          DEFAULT_BACKGROUND: '#111827' // Match the app's dark theme
        }
      };

      return new Promise((resolve, reject) => {
        try {
          this.api = new JitsiMeetExternalAPI(this.domain, options);

          this.api.addEventListener('videoConferenceJoined', () => {
            console.log('Local user joined');
            resolve();
          });

          this.api.addEventListener('error', (error) => {
            console.error('Jitsi error:', error);
            reject(error);
          });

        } catch (error) {
          console.error('Error creating Jitsi instance:', error);
          reject(error);
        }
      });

    } catch (error) {
      console.error('Error initializing Jitsi:', error);
      throw error;
    }
  }

  disconnect(): void {
    if (this.api) {
      this.api.dispose();
      this.api = null;
    }
  }

  toggleAudio(): void {
    if (this.api) {
      this.api.executeCommand('toggleAudio');
    }
  }

  toggleVideo(): void {
    if (this.api) {
      this.api.executeCommand('toggleVideo');
    }
  }

  isConnected(): boolean {
    return this.api !== null;
  }
}

export default JitsiService.getInstance();
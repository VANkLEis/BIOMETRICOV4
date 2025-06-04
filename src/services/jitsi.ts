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

  initializeCall(roomId: string, displayName: string, container: HTMLElement): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const options = {
          roomName: roomId,
          width: '100%',
          height: '100%',
          parentNode: container,
          userInfo: {
            displayName
          },
          configOverwrite: {
            startWithAudioMuted: false,
            startWithVideoMuted: false,
            prejoinPageEnabled: false
          },
          interfaceConfigOverwrite: {
            TOOLBAR_BUTTONS: [
              'microphone', 'camera', 'closedcaptions', 'desktop', 'fullscreen',
              'fodeviceselection', 'hangup', 'profile', 'recording',
              'livestreaming', 'etherpad', 'sharedvideo', 'settings', 'raisehand',
              'videoquality', 'filmstrip', 'feedback', 'stats', 'shortcuts',
              'tileview', 'select-background', 'download', 'help', 'mute-everyone'
            ]
          }
        };

        this.api = new JitsiMeetExternalAPI(this.domain, options);

        this.api.addEventListener('videoConferenceJoined', () => {
          console.log('Local user joined');
          resolve();
        });

        this.api.addEventListener('participantJoined', () => {
          console.log('A participant joined');
        });

        this.api.addEventListener('participantLeft', () => {
          console.log('A participant left');
        });

        this.api.addEventListener('videoConferenceLeft', () => {
          this.disconnect();
        });

      } catch (error) {
        console.error('Error initializing Jitsi:', error);
        reject(error);
      }
    });
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
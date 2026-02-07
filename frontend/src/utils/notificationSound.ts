// Notification sound utility
class NotificationSound {
  private audio: HTMLAudioElement | null = null;
  private isEnabled = true;
  private volume = 0.5;

  constructor() {
    // Initialize audio context on first user interaction
    this.initAudio();
  }

  private initAudio() {
    try {
      // Create audio element with a default notification sound
      this.audio = new Audio();
      this.audio.volume = this.volume;
      
      // Use a data URI for a simple notification sound (bell/chime)
      // This is a base64 encoded simple beep sound
      this.audio.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT' +
        'A0LTKXh8bllHgg2jdXzzn0vBSF1xe/glEILElyx6OyrWBUIQ5zd8sFuIAUuhM/y2Yk2CB9qvfDmnE4MDlCq5O25ZRoFO5PZ9bpxIgQud8jv3osyCBl1vvDjlkwNC0yl4fG5ZR4INo3V8c59LwUhdMXv4JRCCxJcsejsq1gVCEOc3fLBbiAFLoTP8tmJNggfar3w5pxO' +
        'A5QquTtu2WaBTuT2fW6cSIELnPI96LMggZdb7w45ZMDQtMpeHxuWUeCDaN1fHOfS8FIXTF7+CUQgsSXHr7KtYFQhDnN3ywW4gBS6Ez/LZiTYIH2q98OacTgMOUKrk7blmGgU7k9n1unEiBC53yO/eizEIHWq+8+OWTA0LTKXh8bllHgg2jdXzzn0vBSF1xe/glEILElyx6OyrWBUIQ5zd8sFuIAUuhM/y2Yk2CB9qvfDmnE4MDlCq5O25ZRoF' +
        'O5PZ9bpxIgQud8jv3osyCBl1vvDjlkwNC0yl4fG5ZR4INo3V8c59LwUhdMXv4JRCCxJcsejsq1gVCEKc3fLBbiAFLoTP8tmJNggfaj3w5pxOAw5QquTtu2WaBTuT2fW6cSIELnPI96LMggZdb7w45ZMDQtMpeHxuWUeCDaN1fHOfS8FIXTF7+CUQgsSXHr7KtYFQhDnN3ywW4gBS6Ez/LZiTYIH2q98OacTgMOUKr' +
        'k7blmGgU7k9n1unEiBC53yO/eizEIHWq+8+OWTA0LTKXh8bllHgg2jdXzzn0vBSF1xe/glEILElyx6OyrWBUIQ5zd8sFuIAUuhM/y2Yk2CB9qvfDmnE4MDlCq5O25ZRoFO5PZ9bpxIgQud8jv3osyCBl1vvDjlkwNC0yl4fG5ZR4INo3V8c59LwUhdMXv4JRCCxJcsejsq1gVCEKc3fLBbiAFLoTP8tmJNggfaj3w5pxOAw5QquTtu2WaBTuT2fW6cSIELnPI96LMggZdb7w45ZMDQtMpeHxuWUeCDaN1fHOfS8FIXTF7+CUQgsSXHr7KtYFQhDnN3ywW4gBS6Ez/LZiTYIH2q98OacTgMOUKr';
      
      // Load settings from localStorage
      this.loadSettings();
    } catch (error) {
      console.warn('Failed to initialize notification sound:', error);
    }
  }

  private loadSettings() {
    try {
      const savedVolume = localStorage.getItem('notification-sound-volume');
      const savedEnabled = localStorage.getItem('notification-sound-enabled');
      
      if (savedVolume !== null) {
        this.volume = parseFloat(savedVolume);
        if (this.audio) this.audio.volume = this.volume;
      }
      
      if (savedEnabled !== null) {
        this.isEnabled = savedEnabled === 'true';
      }
    } catch (error) {
      console.warn('Failed to load notification sound settings:', error);
    }
  }

  play() {
    if (!this.isEnabled || !this.audio) return;

    try {
      // Reset audio to start and play
      this.audio.currentTime = 0;
      this.audio.play().catch(error => {
        // Handle autoplay policy restrictions
        console.warn('Failed to play notification sound:', error);
      });
    } catch (error) {
      console.warn('Error playing notification sound:', error);
    }
  }

  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.audio) {
      this.audio.volume = this.volume;
    }
    try {
      localStorage.setItem('notification-sound-volume', this.volume.toString());
    } catch (error) {
      console.warn('Failed to save volume setting:', error);
    }
  }

  setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
    try {
      localStorage.setItem('notification-sound-enabled', enabled.toString());
    } catch (error) {
      console.warn('Failed to save enabled setting:', error);
    }
  }

  getVolume() {
    return this.volume;
  }

  isSoundEnabled() {
    return this.isEnabled;
  }

  // Test the sound
  test() {
    this.play();
  }
}

// Create singleton instance
export const notificationSound = new NotificationSound();

// Export types for TypeScript
export type { NotificationSound };

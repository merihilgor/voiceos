#!/usr/bin/env python3
"""
Wake Word Listener - Listens for "Holo" wake word using OpenWakeWord.
Runs as a background thread and notifies the MessageBus when detected.
"""

import logging
import threading
import queue
import time
from typing import Callable, Optional

logger = logging.getLogger(__name__)

# Try to import openwakeword
try:
    import openwakeword
    from openwakeword.model import Model as OWWModel
    OPENWAKEWORD_AVAILABLE = True
except ImportError:
    OPENWAKEWORD_AVAILABLE = False
    logger.warning("openwakeword not installed. Run: pip install openwakeword")

# Try to import pyaudio
try:
    import pyaudio
    PYAUDIO_AVAILABLE = True
except ImportError:
    PYAUDIO_AVAILABLE = False
    logger.warning("pyaudio not installed. Run: brew install portaudio && pip install pyaudio")


class WakeWordListener:
    """
    Listens for the "Holo" wake word using OpenWakeWord.
    When detected, calls the provided callback function.
    """
    
    # Audio settings for OpenWakeWord
    SAMPLE_RATE = 16000
    CHUNK_SIZE = 1280  # ~80ms chunks at 16kHz
    
    def __init__(self, callback: Optional[Callable] = None, wake_word: str = "holo"):
        """
        Initialize the wake word listener.
        
        Args:
            callback: Function to call when wake word is detected
            wake_word: The wake word to listen for (default: "holo")
        """
        self.callback = callback
        self.wake_word = wake_word.lower()
        self.is_running = False
        self.thread: Optional[threading.Thread] = None
        self.detection_queue: queue.Queue = queue.Queue()
        
        # Model will be loaded on start
        self.model = None
        self.audio = None
        self.stream = None
        
    def start(self):
        """Start listening for the wake word in a background thread."""
        if not OPENWAKEWORD_AVAILABLE or not PYAUDIO_AVAILABLE:
            logger.error("Cannot start wake word listener: missing dependencies")
            logger.error("Run: brew install portaudio && pip install openwakeword pyaudio")
            return False
        
        if self.is_running:
            logger.warning("Wake word listener already running")
            return True
        
        try:
            # Download default models if needed
            logger.info("Loading OpenWakeWord models...")
            openwakeword.utils.download_models()
            
            # Create model - uses pre-trained models
            # For custom "Holo" word, we'd need to train a custom model
            # For now, use "hey_jarvis" as a placeholder (similar pattern)
            self.model = OWWModel(
                wakeword_models=["hey_jarvis"],  # Pre-trained model
                inference_framework="onnx"
            )
            
            # Initialize PyAudio
            self.audio = pyaudio.PyAudio()
            self.stream = self.audio.open(
                format=pyaudio.paInt16,
                channels=1,
                rate=self.SAMPLE_RATE,
                input=True,
                frames_per_buffer=self.CHUNK_SIZE
            )
            
            self.is_running = True
            self.thread = threading.Thread(target=self._listen_loop, daemon=True)
            self.thread.start()
            
            logger.info(f"Wake word listener started (listening for '{self.wake_word}')")
            return True
            
        except Exception as e:
            logger.error(f"Failed to start wake word listener: {e}")
            self.stop()
            return False
    
    def stop(self):
        """Stop the wake word listener."""
        self.is_running = False
        
        if self.stream:
            try:
                self.stream.stop_stream()
                self.stream.close()
            except:
                pass
            self.stream = None
        
        if self.audio:
            try:
                self.audio.terminate()
            except:
                pass
            self.audio = None
        
        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=2.0)
        
        logger.info("Wake word listener stopped")
    
    def _listen_loop(self):
        """Main listening loop (runs in background thread)."""
        logger.info("Wake word listener loop started")
        
        # Detection threshold
        threshold = 0.5
        cooldown_time = 2.0  # Seconds between detections
        last_detection = 0
        
        while self.is_running:
            try:
                # Read audio chunk
                audio_data = self.stream.read(self.CHUNK_SIZE, exception_on_overflow=False)
                
                # Convert to numpy array for model
                import numpy as np
                audio_array = np.frombuffer(audio_data, dtype=np.int16)
                
                # Run detection
                predictions = self.model.predict(audio_array)
                
                # Check for wake word detection
                for model_name, score in predictions.items():
                    if score > threshold:
                        current_time = time.time()
                        if current_time - last_detection > cooldown_time:
                            last_detection = current_time
                            logger.info(f"Wake word detected! (model: {model_name}, score: {score:.2f})")
                            
                            # Trigger callback
                            if self.callback:
                                try:
                                    self.callback()
                                except Exception as e:
                                    logger.error(f"Callback error: {e}")
                            
                            # Also put in queue for external consumers
                            self.detection_queue.put({
                                "wake_word": self.wake_word,
                                "model": model_name,
                                "score": float(score),
                                "timestamp": current_time
                            })
                
            except Exception as e:
                if self.is_running:
                    logger.error(f"Error in wake word listener: {e}")
                    time.sleep(0.1)
    
    def get_detection(self, timeout: float = None):
        """
        Get the next wake word detection from the queue.
        
        Args:
            timeout: How long to wait for detection (None = forever)
            
        Returns:
            Detection dict or None if timeout
        """
        try:
            return self.detection_queue.get(timeout=timeout)
        except queue.Empty:
            return None


# Singleton instance
_listener: Optional[WakeWordListener] = None

def get_listener(callback: Optional[Callable] = None) -> WakeWordListener:
    """Get or create the singleton wake word listener."""
    global _listener
    if _listener is None:
        _listener = WakeWordListener(callback=callback)
    elif callback and _listener.callback is None:
        _listener.callback = callback
    return _listener


async def start_listener_async(callback: Optional[Callable] = None) -> bool:
    """Start the wake word listener (async wrapper)."""
    listener = get_listener(callback)
    return listener.start()


def stop_listener():
    """Stop the wake word listener."""
    global _listener
    if _listener:
        _listener.stop()
        _listener = None


# Simple test
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    
    def on_wake_word():
        print("\n🎤 HOLO DETECTED! Listening for command...\n")
    
    print("Starting wake word listener...")
    print("Say 'Hey Jarvis' (placeholder for 'Holo') to trigger detection.")
    print("Press Ctrl+C to stop.\n")
    
    listener = WakeWordListener(callback=on_wake_word)
    
    if listener.start():
        try:
            while True:
                time.sleep(0.1)
        except KeyboardInterrupt:
            print("\nStopping...")
    
    listener.stop()
    print("Done.")

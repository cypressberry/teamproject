document.addEventListener('DOMContentLoaded', () => {
  let sound = null;
  let fileUrl = null;

  const fileInput = document.getElementById('fileInput');
  const tempoSlider = document.getElementById('tempo');
  const uploadImg = document.getElementById('upload_img');
  const fileNameDisplay = document.getElementById('fileName');
  const applyEditsButton = document.getElementById('applyEdits');
  const downloadImg = document.getElementById('download_img');

  // Click handler for upload image
  uploadImg.addEventListener('click', () => {
      fileInput.click();
  });

  // Load audio file when selected
  fileInput.addEventListener('change', async (event) => {
      const file = event.target.files[0];
      if (file) {
          fileUrl = URL.createObjectURL(file);
          try {
              loadAndPlayAudio(fileUrl, file.name);
              fileNameDisplay.textContent = `Selected file: ${file.name}`;
              fileNameDisplay.style.display = 'block';
              console.log("Audio loaded successfully.");
          } catch (error) {
              console.error("Error loading audio file:", error);
              alert("Failed to load audio. Please try again.");
          }
      } else {
          fileNameDisplay.textContent = 'No file selected';
          fileNameDisplay.style.display = 'none';
      }
  });

  // Apply tempo adjustments and play the audio using Howler
  applyEditsButton.addEventListener('click', () => {
      if (!sound) {
          alert('Please upload an audio file first.');
          return;
      }
      const tempo = parseFloat(tempoSlider.value);
      applyTempoAdjustment(tempo);
  });

  // Download the processed audio when clicking the download image
  downloadImg.addEventListener('click', async () => {
      if (!sound) {
          alert('Please upload an audio file first.');
          return;
      }
      try {
          const tempo = parseFloat(tempoSlider.value);
          const processedBlob = await processAudio(fileUrl, tempo);
          downloadBlob(processedBlob, 'processed_audio.wav');
      } catch (error) {
          console.error("Error processing audio for download:", error);
          alert("Failed to process audio. Please try again.");
      }
  });

  // Load and Play Audio using Howler.js
  function loadAndPlayAudio(url, fileName) {
    const fileExtension = fileName.split('.').pop().toLowerCase();
    const supportedFormats = ['mp3', 'ogg', 'wav'];

    if (!supportedFormats.includes(fileExtension)) {
        alert('Unsupported file format. Please upload an MP3, OGG, or WAV file.');
        return;
    }

    // Stop current sound if it exists
    if (sound) {
        sound.stop();
    }

    // Create a new Howl instance for the uploaded audio
    sound = new Howl({
        src: [url],
        format: [fileExtension],
        onload: function () {
            console.log('Audio loaded successfully.');
            sound.play();
        },
        onend: function() {
            sound.play(); // Restart the audio when it ends (loop)
            console.log('Audio playback ended.');
        }
    });
}


  // Apply tempo adjustment using Howler
  function applyTempoAdjustment(tempo) {
      if (sound) {
          sound.rate(tempo); // Adjust playback speed
          console.log(`Applied tempo adjustment: ${tempo}`);
      }
  }

  // Process audio offline and return as Blob (customize for Howler.js usage)
  async function processAudio(url, tempo) {
      // Placeholder for audio processing logic (this can be customized to use Howler.js or Web Audio API)
      // In Howler.js, tempo can be adjusted live using the rate method, but offline rendering is not supported directly.
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      // Adjust the tempo using the audio context and create a new buffer
      const offlineContext = new OfflineAudioContext(
          audioBuffer.numberOfChannels,
          audioBuffer.duration * audioBuffer.sampleRate / tempo,
          audioBuffer.sampleRate
      );
      const source = offlineContext.createBufferSource();
      source.buffer = audioBuffer;
      source.playbackRate.value = tempo;
      source.connect(offlineContext.destination);
      source.start();

      const renderedBuffer = await offlineContext.startRendering();
      return audioBufferToBlob(renderedBuffer);
  }

  // Convert AudioBuffer to Blob
  function audioBufferToBlob(buffer) {
      const numOfChannels = buffer.numberOfChannels;
      const length = buffer.length * numOfChannels * 2 + 44;
      const wavBuffer = new ArrayBuffer(length);
      const view = new DataView(wavBuffer);

      const writeString = (view, offset, string) => {
          for (let i = 0; i < string.length; i++) {
              view.setUint8(offset + i, string.charCodeAt(i));
          }
      };

      // Write WAV header
      writeString(view, 0, 'RIFF');
      view.setUint32(4, 36 + buffer.length * numOfChannels * 2, true);
      writeString(view, 8, 'WAVE');
      writeString(view, 12, 'fmt ' );
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, numOfChannels, true);
      view.setUint32(24, buffer.sampleRate, true);
      view.setUint32(28, buffer.sampleRate * numOfChannels * 2, true);
      view.setUint16(32, numOfChannels * 2, true);
      view.setUint16(34, 16, true);
      writeString(view, 36, 'data');
      view.setUint32(40, buffer.length * numOfChannels * 2, true);

      // Write interleaved PCM data
      let offset = 44;
      for (let i = 0; i < buffer.length; i++) {
          for (let channel = 0; channel < numOfChannels; channel++) {
              let sample = buffer.getChannelData(channel)[i];
              sample = Math.max(-1, Math.min(1, sample)); // Clamp between -1 and 1
              sample = sample < 0 ? sample * 32768 : sample * 32767; // Scale to PCM range
              view.setInt16(offset, sample, true);
              offset += 2;
          }
      }

      return new Blob([view], { type: 'audio/wav' });
  }

  // Trigger download of Blob
  function downloadBlob(blob, fileName) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      console.log("Processed audio downloaded.");
  }
});
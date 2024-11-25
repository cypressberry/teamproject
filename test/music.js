document.addEventListener('DOMContentLoaded', () => {
  let audioBuffer = null;
  let audioContext = null;
  let audioSource = null;

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
          const url = URL.createObjectURL(file);
          try {
              audioBuffer = await loadAudioBuffer(url);
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

  // Apply tempo adjustments and play the audio
  applyEditsButton.addEventListener('click', () => {
      if (!audioBuffer) {
          alert('Please upload an audio file first.');
          return;
      }
      const tempo = parseFloat(tempoSlider.value);
      playAudio(audioBuffer, tempo);
  });

  // Download the processed audio when clicking the download image
  downloadImg.addEventListener('click', async () => {
      if (!audioBuffer) {
          alert('Please upload an audio file first.');
          return;
      }
      try {
          const tempo = parseFloat(tempoSlider.value);
          const processedBlob = await processAudio(audioBuffer, tempo);
          downloadBlob(processedBlob, 'processed_audio.wav');
      } catch (error) {
          console.error("Error processing audio for download:", error);
          alert("Failed to process audio. Please try again.");
      }
  });

  // Load audio into an AudioBuffer
  async function loadAudioBuffer(url) {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
      return await audioContext.decodeAudioData(arrayBuffer);
  }

  // Play audio with tempo adjustment
  function playAudio(buffer, tempo) {
      if (audioSource) {
          audioSource.stop(); // Stop previous audio if playing
      }
      audioSource = audioContext.createBufferSource();
      audioSource.buffer = buffer;
      audioSource.playbackRate.value = tempo;
      audioSource.connect(audioContext.destination);
      audioSource.start();
      console.log("Audio started playing at tempo:", tempo);
  }

  // Process audio offline and return as Blob
  async function processAudio(buffer, tempo) {
      const offlineContext = new OfflineAudioContext(
          buffer.numberOfChannels,
          buffer.duration * buffer.sampleRate / tempo,
          buffer.sampleRate
      );

      const source = offlineContext.createBufferSource();
      source.buffer = buffer;
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
    writeString(view, 12, 'fmt ');
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

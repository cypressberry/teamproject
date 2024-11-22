document.addEventListener("DOMContentLoaded", function () {
  let sound;

  const processBtn = document.getElementById('processBtn');
  const fileInput = document.getElementById('fileInput');
  const editor = document.getElementById('editor');

  // Enable file processing when a file is selected
  fileInput.addEventListener('change', handleFileSelect);

  function handleFileSelect(event) {
      const file = event.target.files[0];
      if (file) {
          const url = URL.createObjectURL(file);
          loadAndPlayAudio(url);
      }
  }

  function loadAndPlayAudio(url) {
      // Stop any currently playing sound
      if (sound) {
          sound.stop();
          sound.unload(); // Unload the previous sound to free resources
      }

      // Create a new Howl instance with the audio URL
      sound = new Howl({
          src: [url],
          format: ['mp3', 'wav'], // Support MP3 and WAV formats
          onload: function () {
              processBtn.disabled = false;
              editor.style.display = 'block';
              sound.play();
          }
      });
  }

  // Function to apply pitch and tempo changes
  function applyEdits() {
      const pitch = parseFloat(document.getElementById('pitch').value);  // Pitch in semitones
      const tempo = parseFloat(document.getElementById('tempo').value);  // Tempo as a multiplier

      if (sound) {
          sound.stop(); // Stop the sound before applying edits
      }

      sound.rate(tempo); // Adjust playback speed (tempo)
      console.log(`Pitch: ${pitch} semitones, Tempo: ${tempo}`);
      sound.play(); // Replay with the new settings
  }

  // Event listener to apply the edits when button is clicked
  processBtn.addEventListener('click', applyEdits);
});

document.addEventListener('DOMContentLoaded', function () {
  let sound;

  // Function to handle file selection and play audio
  document.getElementById('fileInput').addEventListener('change', handleFileSelect);
  document.getElementById('applyEdits').addEventListener('click', applyEdits);

  function handleFileSelect(event) {
      const file = event.target.files[0];
      if (file) {
          const url = URL.createObjectURL(file);
          loadAndPlayAudio(url, file.name);
      }
  }

  function loadAndPlayAudio(url, fileName) {
      // Determine the file extension and format
      const fileExtension = fileName.split('.').pop().toLowerCase();
      const formats = ['mp3', 'ogg', 'wav'];

      if (!formats.includes(fileExtension)) {
          alert('Unsupported file format. Please upload an MP3, OGG, or WAV file.');
          return;
      }

      // Create a new Howl instance with the audio URL and format property
      sound = new Howl({
          src: [url],
          format: [fileExtension],  // Explicitly define the format based on the file extension
          onload: function () {
              // Enable the button once the audio is loaded
              document.getElementById('processBtn').disabled = false;
              document.getElementById('editor').style.display = 'block';
          }
      });

      // Play the audio
      sound.play();
  }

  // Apply pitch and tempo adjustments
  function applyEdits() {
      const pitch = parseFloat(document.getElementById('pitch').value);  // Pitch in semitones
      const tempo = parseFloat(document.getElementById('tempo').value);  // Tempo as a multiplier

      // Adjust pitch and tempo (rate affects both)
      sound.rate(tempo);  // Change playback speed (tempo)
      
      // Howler.js doesn't directly support pitch shifting, but you can modify the rate
      // Rate of 1 is normal, higher than 1 speeds it up, lower than 1 slows it down
      // Pitch shift can be simulated by changing the rate
      console.log(`Pitch: ${pitch} semitones, Tempo: ${tempo}`);

      // Replay the audio with the new rate (which simulates both tempo and pitch changes)
      sound.play();
  }
});

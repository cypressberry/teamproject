// Import FFmpeg.js functions
import { createFFmpeg, fetchFile } from 'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@latest';


// Initialize FFmpeg instance
const ffmpeg = createFFmpeg({ log: true });

// Wait for FFmpeg.js to load before proceeding
(async () => {
  await ffmpeg.load();
  console.log('FFmpeg is ready!');
})();

// File Input Event Listener
document.getElementById('fileInput').addEventListener('change', async (event) => {
  const file = event.target.files[0];

  if (file && file.type === 'audio/mp3') {
    console.log('Processing MP3 file...');

    // Display audio player container
    const audioPlayerContainer = document.getElementById('audioPlayerContainer');
    audioPlayerContainer.style.display = 'block';

    // Write the file to FFmpeg's virtual filesystem
    try {
      await ffmpeg.FS('writeFile', file.name, await fetchFile(file));

      // Run FFmpeg to ensure the file is readable or process if needed
      await ffmpeg.run('-i', file.name, 'output.mp3');

      // Read the processed output file
      const data = ffmpeg.FS('readFile', 'output.mp3');

      // Create a Blob URL for the processed audio file
      const blob = new Blob([data.buffer], { type: 'audio/mp3' });
      const url = URL.createObjectURL(blob);

      // Set the audio player source to the Blob URL
      const audioPlayer = document.getElementById('audioPlayer');
      audioPlayer.src = url;

      console.log('MP3 file is ready for playback!');
    } catch (error) {
      console.error('Error processing the MP3 file:', error);
      alert('There was an error processing the MP3 file. Please try again.');
    }
  } else {
    alert('Please upload a valid MP3 file.');
  }
});

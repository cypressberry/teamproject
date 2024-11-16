// Wait for FFmpeg to load and create an instance
const { createFFmpeg, fetchFile } = FFmpeg; // Make sure FFmpeg is available
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

    // Optionally, add additional logic for displaying the file name or status
    console.log('MP3 file is ready for playback!');
  } else {
    alert('Please upload a valid MP3 file.');
  }
});

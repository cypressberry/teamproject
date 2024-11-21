document.addEventListener('DOMContentLoaded', () => {
  const { createFFmpeg, fetchFile } = FFmpeg;
  const ffmpeg = createFFmpeg({ log: true });

  document.getElementById('fileInput').addEventListener('change', async (event) => {
      const file = event.target.files[0];
      if (!file) return;

      const editorDiv = document.getElementById('editor');
      editorDiv.style.display = 'block';

      document.getElementById('applyEdits').onclick = async () => {
          try {
              // Load FFmpeg if not loaded
              if (!ffmpeg.isLoaded()) {
                  console.log("Loading FFmpeg...");
                  await ffmpeg.load();
                  console.log("FFmpeg loaded successfully.");
              }

              // Write input file to FFmpeg's virtual filesystem
              const fileName = file.name;
              console.log(`Writing file ${fileName} to virtual filesystem...`);
              ffmpeg.FS('writeFile', fileName, await fetchFile(file));

              // Get user input for pitch and tempo
              const pitch = document.getElementById('pitch').value || '0';
              const tempo = document.getElementById('tempo').value || '1';

              console.log(`Running FFmpeg command with pitch: ${pitch}, tempo: ${tempo}`);

              const outputFileName = 'edited.mp3';

              // Run the FFmpeg command
              await ffmpeg.run(
                  '-i', fileName,
                  '-af', `rubberband=pitch=${pitch}:tempo=${tempo}`,
                  outputFileName
              );

              console.log("FFmpeg command executed successfully.");

              // Retrieve processed file from the virtual filesystem
              const data = ffmpeg.FS('readFile', outputFileName);
              console.log(`File processed. Size: ${data.length} bytes`);

              // Create a Blob from the processed data
              const blob = new Blob([data.buffer], { type: 'audio/mpeg' });

              // Set up the download link
              const downloadLink = document.getElementById('downloadLink');
              downloadLink.href = URL.createObjectURL(blob);
              downloadLink.style.display = 'block';
              downloadLink.download = 'edited.mp3';
              downloadLink.textContent = 'Download Edited File';

          } catch (error) {
              console.error("Error during file processing:", error);
              alert('Failed to process the file. Check the console for details.');
          }
      };
  });
});

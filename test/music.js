document.addEventListener('DOMContentLoaded', () => {
    const jsmediatags = window.jsmediatags; // Reference jsmediatags
    const ID3Writer = window.ID3Writer; // Reference ID3Writer for editing tags

    let sound = null;
    let fileUrl = null;
    let progressInterval = null;
    let originalFileName = '';
    let selectedFile = null;

    const fileInput = document.getElementById('fileInput');
    const tempoSlider = document.getElementById('tempo');
    const uploadImg = document.getElementById('upload_img');
    const fileNameDisplay = document.getElementById('fileName');
    const applyEditsButton = document.getElementById('applyEdits');
    const downloadImg = document.getElementById('download_img');
    const progressSlider = document.getElementById('progressSlider');
    const playPauseButton = document.getElementById('playPauseButton');
    const saveTagsButton = document.getElementById('saveTagsButton'); // New button for saving tags

    progressSlider.value = 0;

    const tagsFields = {
        title: document.getElementById('title'),
        artist: document.getElementById('artist'),
        album: document.getElementById('album'),
        year: document.getElementById('year'),
        genre: document.getElementById('genre')
    };
    
    // Apply tempo adjustment using Howler
    function applyTempoAdjustment(tempo) {
        if (sound) {
             sound.rate(tempo); // Adjust playback speed
            console.log(`Applied tempo adjustment: ${tempo}`);
        }
    }

    async function processAudio(url, tempo) {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

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



    // Click handler for upload image
    uploadImg.addEventListener('click', () => {
        fileInput.click();
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
            const newFileName = generateNewFileName(originalFileName);
            downloadBlob(processedBlob, newFileName);
        } catch (error) {
            console.error("Error processing audio for download:", error);
            alert("Failed to process audio. Please try again.");
        }
    });

    // Function to update the progress bar based on the current playback position
    function updateProgressBar() {
        if (sound && sound.playing()) {
            const currentTime = sound.seek(); // Get the current playback position
            const duration = sound.duration(); // Get the total duration
            progressSlider.max = duration; // Set slider max to the audio duration
            progressSlider.value = currentTime; // Update slider to the current time
        }
    }

    // Continuously update the progress bar while audio is playing
    function startProgressInterval() {
        if (progressInterval) clearInterval(progressInterval); // Clear any existing intervals
        progressInterval = setInterval(updateProgressBar, 100); // Update every 100ms
    }

    // Stop updating the progress bar
    function stopProgressInterval() {
        if (progressInterval) {
            clearInterval(progressInterval);
            progressInterval = null;
        }
    }

    // Add play and pause event listener
    playPauseButton.addEventListener('click', () => {
        if (sound) {
            if (sound.playing()) {
                sound.pause();
                playPauseButton.textContent = 'Play';
                stopProgressInterval(); // Stop progress updates when paused
            } else {
                sound.play();
                playPauseButton.textContent = 'Pause';
                startProgressInterval(); // Start updating the progress bar
            }
        } else {
            alert('Please upload an audio file first.');
        }
    });

    // Update the slider's `input` listener to allow seeking
    progressSlider.addEventListener('input', () => {
        if (sound) {
            sound.seek(progressSlider.value); // Seek to the slider's value
        }
    });


    // Load audio file when selected
    fileInput.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (file) {
            selectedFile = file;
            fileUrl = URL.createObjectURL(file);
            originalFileName = file.name;
            try {
                loadAndPlayAudio(fileUrl, file.name);
                fileNameDisplay.textContent = `Selected file: ${file.name}`;
                fileNameDisplay.style.display = 'block';
                console.log("Audio loaded successfully.");
                // Read and display the tags
                readTags(file);
            } catch (error) {
                console.error("Error loading audio file:", error);
                alert("Failed to load audio. Please try again.");
            }
        } else {
            fileNameDisplay.textContent = 'No file selected';
            fileNameDisplay.style.display = 'none';
        }
    });

    // Save updated tags
    saveTagsButton.addEventListener('click', () => {
        if (!selectedFile) {
            alert("Please upload an audio file first.");
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            const arrayBuffer = reader.result;

            // Create a new ID3Writer instance and set the tags
            const writer = new ID3Writer(arrayBuffer);
            writer.setFrame('TIT2', tagsFields.title.value || '')
                .setFrame('TPE1', [tagsFields.artist.value || ''])
                .setFrame('TALB', tagsFields.album.value || '')
                .setFrame('TYER', tagsFields.year.value || '')
                .setFrame('TCON', [tagsFields.genre.value || '']);
            writer.addTag();

            // Generate a new Blob with the updated tags
            const taggedBlob = writer.getBlob();
            const newFileName = generateNewFileName(originalFileName);
            downloadBlob(taggedBlob, newFileName);
        };

        reader.readAsArrayBuffer(selectedFile);
    });

    // Read the tags from the selected file
    function readTags(file) {
        jsmediatags.read(file, {
            onSuccess: (tag) => {
                const { title, artist, album, year, genre } = tag.tags;

                // Update form fields with tag values or placeholders
                tagsFields.title.value = title || '';
                tagsFields.artist.value = artist || '';
                tagsFields.album.value = album || '';
                tagsFields.year.value = year || '';
                tagsFields.genre.value = genre || '';

                console.log('Tags extracted:', { title, artist, album, year, genre });
            },
            onError: (error) => {
                console.error('Error reading tags:', error);
                alert('Could not read tags. You can add them manually.');

                // Clear fields for manual entry
                tagsFields.title.value = '';
                tagsFields.artist.value = '';
                tagsFields.album.value = '';
                tagsFields.year.value = '';
                tagsFields.genre.value = '';
            }
        });
    }

    // Download the updated audio file
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
        console.log("File with updated tags downloaded.");
    }

    // Generate new file name for the edited audio
    function generateNewFileName(originalName) {
        const dotIndex = originalName.lastIndexOf('.');
        const baseName = dotIndex !== -1 ? originalName.substring(0, dotIndex) : originalName;
        const extension = dotIndex !== -1 ? originalName.substring(dotIndex) : '';

        return `${baseName}_with_tags${extension}`;
    }

    // Load and Play Audio using Howler.js
    function loadAndPlayAudio(url, fileName) {
        const fileExtension = fileName.split('.').pop().toLowerCase();
        const supportedFormats = ['mp3', 'ogg', 'wav'];

        if (!supportedFormats.includes(fileExtension)) {
            alert('Unsupported file format. Please upload an MP3, OGG, or WAV file.');
            return;
        }

        // Stop the current sound if it exists
        if (sound) {
            sound.stop();
        }

        // Create a new Howler instance for the uploaded audio
        sound = new Howl({
            src: [url],
            format: [fileExtension],
            onload: function () {
                console.log('Audio loaded successfully.');
                playPauseButton.textContent = 'Pause'; // Set button text to "Pause"
                sound.play(); // Attempt to play immediately
        
                // Set slider max value to audio duration
                progressSlider.max = sound.duration();
            },
            onplay: function () {
                console.log('Playback started.');
                playPauseButton.textContent = 'Pause'; // Update button text
                startProgressInterval(); // Start updating the progress bar
            },
            onend: function () {
                console.log('Playback ended.');
                progressSlider.value = 0; // Reset progress bar
                playPauseButton.textContent = 'Play'; // Update button text to "Play"
                stopProgressInterval(); // Stop updating the progress bar
            },
            onloaderror: function (id, error) {
                console.error('Error loading audio:', error);
                alert('Failed to load audio. Please try again.');
            },
            onplayerror: function (id, error) {
                console.error('Error starting playback:', error);
                alert('Playback failed. Please click Play to start audio.');
            }
        });
    }
});
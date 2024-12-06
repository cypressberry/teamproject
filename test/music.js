document.addEventListener('DOMContentLoaded', () => {
    const jsmediatags = window.jsmediatags; // Reference jsmediatags
    const ID3Writer = window.ID3Writer; // Reference ID3Writer for editing tags

    let sound = null;
    let fileURL = null;
    let progressInterval = null;
    let originalFileName = '';
    let selectedFile = null;
    
    const fileInput = document.getElementById('fileInput');
    const tempoSlider = document.getElementById('tempo');
    const uploadImg = document.getElementById('upload_img');
    const fileNameDisplay = document.getElementById('fileName');
    const applyEditsButton = document.getElementById('applyEdits');
    const downloadImg = document.getElementById('download_img');
    const playPauseButton = document.getElementById('playPauseButton');
    const saveTagsButton = document.getElementById('saveTagsButton'); // New button for saving tags
    const cdImg = document.getElementById("cd_img");
    const progressSlider = document.getElementById('progressSlider');
    const body = document.body;

    const tagsFields = {
        title: document.getElementById('title'),
        artist: document.getElementById('artist'),
        album: document.getElementById('album'),
        year: document.getElementById('year'),
        genre: document.getElementById('genre')
    };

    const sliderMiddle = 1.5; // Middle value of the slider corresponds to normal speed
    tempoSlider.value = sliderMiddle;

    progressSlider.value = 0;

    uploadImg.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (file) {
            selectedFile = file;
            fileUrl = URL.createObjectURL(file);
            originalFileName = file.name;

            const uploadText = document.getElementById('upload_text');
            uploadText.style.transform = 'translate(1px, 5px)';

            tempoSlider.value = sliderMiddle; // Reset slider to normal speed

            try {
                loadAndPlayAudio(fileUrl, file.name);

                // Reset progress bar
                progressSlider.max = 100;
                progressSlider.value = 0;

                fileNameDisplay.textContent = `Selected file: ${file.name}`;
                fileNameDisplay.style.display = 'block';
            } catch (error) {
                console.error("Error loading audio file:", error);
                alert("Failed to load audio. Please try again.");
            }
        } else {
            fileNameDisplay.textContent = 'No file selected';
            fileNameDisplay.style.display = 'none';
        }
    });

    function loadAndPlayAudio(url, fileName) {
        const fileExtension = fileName.split('.').pop().toLowerCase();
        const supportedFormats = ['mp3', 'ogg', 'wav'];

        if (!supportedFormats.includes(fileExtension)) {
            alert('Unsupported file format. Please upload an MP3, OGG, or WAV file.');
            return;
        }

        if (sound) {
            sound.stop();
            clearInterval(progressInterval);
        }

        sound = new Howl({
            src: [url],
            format: [fileExtension],
            onload: () => {
                playPauseButton.textContent = 'Pause';
                sound.play();
                startProgressInterval();
                cdImg.style.animation = "rotate 2s linear infinite";
            },
            onend: () => {
                playPauseButton.textContent = 'Play';
                stopProgressInterval();
                cdImg.style.animation = "none";
            }
        });
    }

    function mapTempoToPlaybackRate(tempo) {
        const minTempo = parseFloat(tempoSlider.min);
        const maxTempo = parseFloat(tempoSlider.max);
        const normalSpeed = sliderMiddle;

        // Map slider value to playback rate where 2.5 equals 1 (normal speed)
        if (tempo === normalSpeed) return 1;
        if (tempo > normalSpeed) return 1 + (tempo - normalSpeed) / (maxTempo - normalSpeed);
        return 1 - (normalSpeed - tempo) / (normalSpeed - minTempo);
    }

    playPauseButton.addEventListener('click', () => {
        if (sound) {
            if (sound.playing()) {
                sound.pause();
                playPauseButton.textContent = 'Play';
                stopProgressInterval();
                cdImg.style.animation = "none"; 
            } else {
                sound.play();
                playPauseButton.textContent = 'Pause';
                startProgressInterval();
                cdImg.style.animation = "rotate 2s linear infinite";
            }
        } else {
            alert('Please upload an audio file first.');
        }
    });

    progressSlider.addEventListener('input', () => {
        if (sound) {
            sound.seek(progressSlider.value);
        }
    });

    applyEditsButton.addEventListener('click', () => {
        if (sound) {
            const tempo = parseFloat(tempoSlider.value);
            const playbackRate = mapTempoToPlaybackRate(tempo);
            sound.rate(playbackRate);
            console.log(`Applied playback rate: ${playbackRate}`);

            updateBackgroundFilter(tempo);
        } else {
            alert('Please upload an audio file first.');
        }
    });

    function updateBackgroundFilter(tempo) {
        const midpoint = sliderMiddle;
        let brightness, contrast;

        if (tempo <= midpoint) {
            brightness = 1 - (midpoint - tempo) * 0.1;
            contrast = 1 - (midpoint - tempo) * 0.05;
        } else {
            brightness = 1 + (tempo - midpoint) * 0.1;
            contrast = 1 + (tempo - midpoint) * 0.05;
        }

        body.style.filter = `brightness(${Math.max(0.5, brightness)}) contrast(${Math.max(0.5, contrast)})`;
    }

    function startProgressInterval() {
        if (progressInterval) clearInterval(progressInterval);

        const duration = sound.duration();
        progressSlider.max = duration;

        progressInterval = setInterval(() => {
            if (sound && sound.playing()) {
                progressSlider.value = sound.seek();
            }
        }, 500);
    }

    function stopProgressInterval() {
        if (progressInterval) {
            clearInterval(progressInterval);
            progressInterval = null;
        }
    }

    downloadImg.addEventListener('click', async () => {
        if (!selectedFile) {
            alert('Please upload a file before downloading.');
            return;
        }
    
        try {
            const tempo = parseFloat(tempoSlider.value);
            const playbackRate = mapTempoToPlaybackRate(tempo);
    
            // Process the audio file with the applied tempo
            const processedBlob = await processAudioForDownload(fileUrl, playbackRate);
    
            // Generate a downloadable file
            const downloadFileName = `edited_${originalFileName}`;
            downloadBlob(processedBlob, downloadFileName);
        } catch (error) {
            console.error('Error downloading file:', error);
            alert('Failed to download the file. Please try again.');
        }
    });
    
    async function processAudioForDownload(url, playbackRate) {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
    
        const audioContext = new AudioContext();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
        const offlineContext = new OfflineAudioContext(
            audioBuffer.numberOfChannels,
            audioBuffer.duration * audioBuffer.sampleRate / playbackRate,
            audioBuffer.sampleRate
        );
    
        const source = offlineContext.createBufferSource();
        source.buffer = audioBuffer;
        source.playbackRate.value = playbackRate;
        source.connect(offlineContext.destination);
        source.start();
    
        const renderedBuffer = await offlineContext.startRendering();
        return audioBufferToBlob(renderedBuffer);
    }
    
    function audioBufferToBlob(buffer) {
        const numOfChannels = buffer.numberOfChannels;
        const length = buffer.length * numOfChannels * 2 + 44;
        const wavBuffer = new ArrayBuffer(length);
        const view = new DataView(wavBuffer);
    
        function writeString(view, offset, string) {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        }
    
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
                sample = Math.max(-1, Math.min(1, sample));
                sample = sample < 0 ? sample * 32768 : sample * 32767;
                view.setInt16(offset, sample, true);
                offset += 2;
            }
        }
    
        return new Blob([view], { type: 'audio/wav' });
    }
    
    function downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
});

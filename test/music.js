document.addEventListener('DOMContentLoaded', () => {
   
    let sound = null;
    let selectedFile = null;
    let fileURL = null;
    let lowPassFilter = null;
    let analyserNode = null;
    let progressInterval = null;

    //docugets
    const fileInput = document.getElementById('fileInput');
    const uploadImg = document.getElementById('upload_img');
    const playPauseButton = document.getElementById('playPauseButton');
    const downloadImg = document.getElementById('download_img');
    const applyEditsButton = document.getElementById('applyEdits');
    const progressSlider = document.getElementById('progressSlider');
    const filterSlider = document.getElementById('filterSlider');
    const reverbMixSlider = document.getElementById('reverbMixSlider');
    const fileNameDisplay = document.getElementById('fileName');
    const tempoSlider = document.getElementById('tempo');
    const cdImg = document.getElementById('cd_img');
    const volumeSlider = document.getElementById('volumeSlider');
    const sliderMiddle = 1.5;

     // Set initial values
     tempoSlider.value = sliderMiddle;
     progressSlider.value = 0;

    // Trigger file input
    uploadImg.addEventListener('click', () => fileInput.click());
    
    // canvases adjust size on window resize
    window.addEventListener('resize', setupCanvases);

    // resizeCanvas on page load
    window.addEventListener('load', setupCanvases);

     //File Download
     downloadImg.addEventListener('click', () => {
        if (!selectedFile) {
            alert('Please upload a file before downloading.');
            return;
        }

        const a = document.createElement('a');
        a.href = URL.createObjectURL(selectedFile);
        a.download = `edited_${selectedFile.name}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    });

     // Handle file selection and load into Howler.js 
     fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            selectedFile = file;
            fileURL = URL.createObjectURL(file);
            fileNameDisplay.textContent = `Selected file: ${file.name}`;
            fileNameDisplay.style.display = 'block';

            // Load file into both Howler.js 
            loadAndPlayAudio(fileURL, file.name);
        } else {
            fileNameDisplay.textContent = 'No file selected';
            fileNameDisplay.style.display = 'none';
        }
    });

    // Play/Pause Button control
    playPauseButton.addEventListener('click', () => {
       
        console.log('Howler playing:', sound.playing());
    
        if (!sound) {
            alert('Please upload an audio file first.');
            return;
        }
    
        if (sound.playing()) {
            
            sound.pause();
            playPauseButton.textContent = 'Play';
            cdImg.classList.remove('spin');
            
        } else {
            if (!sound.playing()) {
                sound.play();
                playPauseButton.textContent = 'Pause';
                cdImg.classList.add('spin');
            }
        }
    });

     // Progress slider control
     progressSlider.addEventListener('input', () => {
        if (sound) 
        sound.seek(progressSlider.value);
    });

    // Apply edits (change playback rate)
    applyEditsButton.addEventListener('click', () => {
        if (sound) {
            const tempo = parseFloat(tempoSlider.value);
            const playbackRate = mapTempoToPlaybackRate(tempo);
            sound.rate(playbackRate);
            console.log(`Playback rate set to: ${playbackRate}`);
        } else {
            alert('Please upload an audio file first.');
        }
    });

    // Lowpass Filter slider logic
    filterSlider.addEventListener('input', () => {
        if (lowPassFilter) {
            const frequency = parseFloat(filterSlider.value);
            lowPassFilter.frequency.value = frequency;
            console.log(`Low-pass filter frequency set to: ${frequency} Hz`);
        }
    });

    // Adjust reverb mix based on slider
    reverbMixSlider.addEventListener('input', () => {
        const mix = parseFloat(reverbMixSlider.value);
        dryGainNode.gain.value = 1 - mix;  // Dry path volume
        wetGainNode.gain.value = mix;      // Wet path volume (reverb)
        console.log(`Reverb mix set to: ${mix}`);
    });

    // Set up both canvases
    function setupCanvases() {
        const visualizerCanvas = document.getElementById('visualizerCanvas');
        const mirroredCanvas = document.getElementById('mirroredCanvas');
        const visualizerContext = visualizerCanvas.getContext('2d');
        const mirroredContext = mirroredCanvas.getContext('2d');

        // Resize canvases to occupy 50% of the screen each
        const canvasWidth = window.innerWidth / 2;
        const canvasHeight = window.innerHeight;

        visualizerCanvas.width = canvasWidth;
        visualizerCanvas.height = canvasHeight;
        mirroredCanvas.width = canvasWidth;
        mirroredCanvas.height = canvasHeight;
        visualizerCanvas.style.opacity = 0.4;
        mirroredCanvas.style.opacity = 0.4;

        return { visualizerCanvas, mirroredCanvas, visualizerContext, mirroredContext };
    }

    //Vizualisation
    function visualizeAudio() {
        const { visualizerCanvas, mirroredCanvas, visualizerContext, mirroredContext } = setupCanvases();
    
        const bufferLength = analyserNode.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
    
        // Reduce the number of bars rendered (e.g., half the buffer length)
        const visibleBars = Math.floor(bufferLength / 1.5); // Adjust this number for fewer/wider bars
        const barWidth = visualizerCanvas.width / visibleBars; // Calculate wider bars
    
        function draw() {
            requestAnimationFrame(draw);
    
            analyserNode.getByteFrequencyData(dataArray);
    
            // Clear both canvases
            visualizerContext.clearRect(0, 0, visualizerCanvas.width, visualizerCanvas.height);
            mirroredContext.clearRect(0, 0, mirroredCanvas.width, mirroredCanvas.height);
    
            // Draw bars on visualizerCanvas (left)
            let x = 0;
            for (let i = 0; i < visibleBars; i++) {
                const barHeight = dataArray[i] * (visualizerCanvas.height / 255); // Scale height
                visualizerContext.fillStyle = `rgb(50,${barHeight}, 150)`;
                visualizerContext.fillRect(x, visualizerCanvas.height - barHeight, barWidth, barHeight);
                x += barWidth;
            }
    
            // Draw mirrored bars on mirroredCanvas (right)
            x = mirroredCanvas.width; // Start from the right
            for (let i = 0; i < visibleBars; i++) {
                const barHeight = dataArray[i] * (mirroredCanvas.height / 255); // Scale height
                mirroredContext.fillStyle = `rgb(50,${barHeight}, 150)`;
                mirroredContext.fillRect(x - barWidth, mirroredCanvas.height - barHeight, barWidth, barHeight);
                x -= barWidth; // Move leftward for the mirrored effect
            }
        }
    
        draw(); // Start visualization
    }
    

    // Load and play audio with Howler.js
    function loadAndPlayAudio(url, fileName) {
        if (sound) sound.stop(); // Stop previous sound

        sound = new Howl({
            src: [url],
            format: [fileName.split('.').pop().toLowerCase()],
            onload: () => {
                setupAudioEffects();
                startProgressInterval();
            },
            onend: () => {
                playPauseButton.textContent = 'Play';
                stopProgressInterval();
            }
        });

        sound.play();
        playPauseButton.textContent = 'Pause';
        cdImg.classList.add('spin');
    }

    // Map tempo slider value to playback rate
    function mapTempoToPlaybackRate(tempo) {
        const minTempo = 0.5;
        const maxTempo = 2.0;
        return Math.max(minTempo, Math.min(maxTempo, tempo / sliderMiddle));
    }

    // Web Audio Api AudioEffects
    function setupAudioEffects() {
        const audioContext = Howler.ctx;
    
        // Create low-pass filter
        lowPassFilter = audioContext.createBiquadFilter();
        lowPassFilter.type = 'lowpass';
        lowPassFilter.frequency.value = filterSlider.value;  // Set frequency based on slider value
    
        // Create analyser node for visualization
        analyserNode = audioContext.createAnalyser();
        analyserNode.fftSize = 256;
    
        // Create a ConvolverNode for reverb
        convolverNode = audioContext.createConvolver();
    
        // Create GainNode to control volume
        gainNode = audioContext.createGain();
        gainNode.gain.value = volumeSlider.value; // Set initial volume based on slider value
    
        // Update gain value based on volume slider
        volumeSlider.addEventListener('input', () => {
            gainNode.gain.value = volumeSlider.value;
            console.log(`Volume set to: ${gainNode.gain.value}`);
        });
    
        // Load reverb IR and set up effects chain
        loadReverbIR('audio/ir.wav').then((irBuffer) => {
            convolverNode.buffer = irBuffer;
            convolverNode.normalize = true;
    
            // Create dry and wet gain nodes for reverb signal
            dryGainNode = audioContext.createGain();
            dryGainNode.gain.value = 1;  // Dry signal at full volume
    
            wetGainNode = audioContext.createGain();
            wetGainNode.gain.value = 0.5;  // Wet signal (reverb) at 50%
    
            const sourceNode = sound._sounds[0]._node;
            sourceNode.connect(gainNode);
            gainNode.connect(lowPassFilter);
    
            // Connect nodes in audio effects chain
            lowPassFilter.connect(analyserNode);
            analyserNode.connect(audioContext.destination);
    
            lowPassFilter.connect(dryGainNode).connect(audioContext.destination);
            lowPassFilter.connect(convolverNode).connect(wetGainNode).connect(audioContext.destination);
    
            visualizeAudio();
        }).catch((error) => {
            console.error('Error loading the reverb IR:', error);
        });
    }

    // Load Reverb File
    async function loadReverbIR(url) {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const audioContext = Howler.ctx;
        return audioContext.decodeAudioData(arrayBuffer);
    }
    
    // Update progress slider during playback
    function startProgressInterval() {
        if (progressInterval) clearInterval(progressInterval); // Clear any existing interval

        // Set the max value of the slider to the duration of the audio
        const duration = sound.duration();
        progressSlider.max = duration;

        // Update the progress slider every 500ms based on the current time of the sound
        progressInterval = setInterval(() => {
            if (sound && sound.playing()) {
                // Sync the slider value with the current position of the audio
                progressSlider.value = sound.seek();
            }
        }, 500);
    }

    // Stop updating progress when audio ends
    function stopProgressInterval() {
        if (progressInterval) {
            clearInterval(progressInterval); // Stop the interval
            progressInterval = null;
        }
    }
    // Listen for changes on the filter slider to adjust the cutoff frequency live
   
});
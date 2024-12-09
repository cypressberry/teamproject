document.addEventListener('DOMContentLoaded', () => {
    let sound = null;
    let selectedFile = null;
    let fileURL = null;
    let lowPassFilter = null;
    let analyserNode = null;
   
    let progressInterval = null;
    const distortionSlider = document.getElementById('distortionSlider');
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
    const sliderMiddle = 1.5;

    // Set initial slider values
    tempoSlider.value = sliderMiddle;
    progressSlider.value = 0;

    const visualizerCanvas = document.getElementById('visualizerCanvas');
    const canvasContext = visualizerCanvas.getContext('2d');

    // Set the canvas dimensions
    visualizerCanvas.width = 500; // Set width as needed
    visualizerCanvas.height = 200; // Set height as needed

    // Position the canvas below the CD image
    const cdDiv = document.getElementById('cd_div');
    cdDiv.appendChild(visualizerCanvas); // Ensure the canvas appears just below the CD image

    // Optional: Apply some styles to position the canvas
    visualizerCanvas.style.display = 'block';
    visualizerCanvas.style.margin = '20px auto';
    visualizerCanvas.style.zIndex = '1';

    // Trigger file input
    uploadImg.addEventListener('click', () => fileInput.click());


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
 // Lowpass Filter slider logic
 filterSlider.addEventListener('input', () => {
    if (lowPassFilter) {
        const frequency = parseFloat(filterSlider.value);
        lowPassFilter.frequency.value = frequency;
        console.log(`Low-pass filter frequency set to: ${frequency} Hz`);
    }
});
    
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

    // Apply edits (e.g., change playback rate)
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

    // Adjust reverb mix based on slider
    reverbMixSlider.addEventListener('input', () => {
        const mix = parseFloat(reverbMixSlider.value);
        dryGainNode.gain.value = 1 - mix;  // Dry path volume
        wetGainNode.gain.value = mix;      // Wet path volume (reverb)
        console.log(`Reverb mix set to: ${mix}`);
    });

    // Progress slider control
    progressSlider.addEventListener('input', () => {
        if (sound) 
        sound.seek(progressSlider.value);
    });

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
// Visualize the audio based on volume


 function visualizeAudio() {
        const bufferLength = analyserNode.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        function draw() {
            requestAnimationFrame(draw);

            analyserNode.getByteFrequencyData(dataArray);

            // Clear canvas
            canvasContext.clearRect(0, 0, visualizerCanvas.width, visualizerCanvas.height);

            // Draw waveform based on canvas size
            const barWidth = visualizerCanvas.width / bufferLength; // Scale to canvas width
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                const barHeight = dataArray[i] * (visualizerCanvas.height / 255); // Scale to canvas height
                canvasContext.fillStyle = `rgb(${barHeight}, 100, 150)`;
                canvasContext.fillRect(x, visualizerCanvas.height - barHeight, barWidth, barHeight);
                x += barWidth;
            }
        }

        draw(); // Start visualizing
    }


function resizeCanvas() {
    const wrapper = document.getElementById('cd_wrapper');
    const canvas = document.getElementById('visualizerCanvas');

    // Match canvas size to wrapper size
    canvas.width = wrapper.offsetWidth;
    canvas.height = wrapper.offsetHeight;
}

// Call resizeCanvas on page load
window.addEventListener('load', resizeCanvas);

// Update canvas size on window resize
window.addEventListener('resize', resizeCanvas);


    // Map tempo slider value to playback rate
    function mapTempoToPlaybackRate(tempo) {
        const minTempo = 0.5;
        const maxTempo = 2.0;
        return Math.max(minTempo, Math.min(maxTempo, tempo / sliderMiddle));
    }
    
    function setupAudioEffects() {
        const audioContext = Howler.ctx;
    
        // Create a low-pass filter
        lowPassFilter = audioContext.createBiquadFilter();
        lowPassFilter.type = 'lowpass';
        lowPassFilter.frequency.value = 1000;
    
        // Create analyser node for audio visualization
        analyserNode = audioContext.createAnalyser();
        analyserNode.fftSize = 256; // Defines the resolution of frequency data
    
        // Create a ConvolverNode for the reverb effect
        convolverNode = audioContext.createConvolver();
    
        // Create a WaveShaperNode for distortion
        const distortionNode = audioContext.createWaveShaper();
        distortionNode.curve = makeDistortionCurve(0);  // Amount of distortion
        distortionNode.oversample = '1x';
    
        distortionSlider.addEventListener('input', () => {
            const distortionAmount = parseInt(distortionSlider.value, 10);
            distortionNode.curve = makeDistortionCurve(distortionAmount);  // Update distortion curve
            console.log(`Distortion amount set to: ${distortionAmount}`);
        });
    
        // Load and set the impulse response (IR) for the reverb effect
        loadReverbIR('audio/ir.wav').then((irBuffer) => {
            convolverNode.buffer = irBuffer;
            convolverNode.normalize = true;  // Normalize the impulse response
    
            // Create gain nodes for dry and wet signals
            dryGainNode = audioContext.createGain();
            dryGainNode.gain.value = 1;  // Dry signal at full volume
    
            wetGainNode = audioContext.createGain();
            wetGainNode.gain.value = 0.5;  // Wet signal (reverb) at 50%
    
            // Connect the source node (Howler's internal sound node) to the low-pass filter
            const sourceNode = sound._sounds[0]._node;
            sourceNode.connect(lowPassFilter);
            lowPassFilter.connect(analyserNode);  // Connect to analyserNode for visualization
            analyserNode.connect(audioContext.destination);
    
            // Connect the dry signal path (original audio without any effects)
            lowPassFilter.connect(dryGainNode).connect(audioContext.destination);
    
            // Connect the reverb (wet) signal path
            lowPassFilter.connect(convolverNode).connect(wetGainNode).connect(audioContext.destination);
    
            // Connect the distortion effect path
            lowPassFilter.connect(distortionNode).connect(wetGainNode).connect(audioContext.destination);
    
            // No PannerNode, just keep the effects chain intact
    
            // Start the visualizer
            visualizeAudio();
        }).catch((error) => {
            console.error('Error loading the reverb IR:', error);
        });
    }
    
    
    // Helper function to create the distortion curve
    function makeDistortionCurve(amount) {
        const curve = new Float32Array(44100);
        const deg = Math.PI / 2;
        for (let i = 0; i < 44100; i++) {
            curve[i] = Math.sin(deg * amount * i / 44100);
        }
        return curve;
    }
    
    // Load the impulse response (IR) for reverb from a URL
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
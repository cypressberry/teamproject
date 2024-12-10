document.addEventListener('DOMContentLoaded', () => {
    const jsmediatags = window.jsmediatags; // Reference jsmediatags for reading media file tags
    const ID3Writer = window.ID3Writer; // Reference ID3Writer for editing tags

    let sound = null; //Initialize sound object for howler
    let fileURL = null; //Initialize fileURL for selected audio file
    let progressInterval = null; //Initialize progressInterval for updating progress (for progress bar)
    let originalFileName = ''; //Initialize uploaded file's name
    let selectedFile = null; //Initialize the selectedFile reference
    let lowPassFilter = null; // Global reference to the low-pass filter

    let convolverNode = null; //Webaudio Api stuff, this is for reverb
    let reverbGainNode = null; //This is for the reverb gain
    let dryGainNode = null; //This is for the unedited signal gain

    const fileInput = document.getElementById('fileInput'); //Populates file input
    const tempoSlider = document.getElementById('tempo'); //Reference for controlling playback speed
    const uploadImg = document.getElementById('upload_img'); //Reference to the upload button image
    const fileNameDisplay = document.getElementById('fileName'); //Reference to the file name display
    const applyEditsButton = document.getElementById('applyEdits'); //Reference to the apply edits button
    const downloadImg = document.getElementById('download_img'); //Reference for the download button image
    const playPauseButton = document.getElementById('playPauseButton'); //Reference to the play pause button

    const cdImg = document.getElementById("cd_img"); //Reference to the rotating cd
    const progressSlider = document.getElementById('progressSlider'); //Reference to the progress slider
    const body = document.body; //Reference to the HTML body element
    const filterSlider = document.getElementById('filterSlider'); // Slider for controlling filter frequency

    // Set up the canvas and get the context for drawing
    const canvas = document.getElementById('visualizerCanvas'); //This got removed because it broke everything
    const canvasContext = canvas.getContext('2d'); //Reference for the 2d rendering context for the canvas
    let analyserNode = null;  // Global reference to the analyser node


    // Reverb mix slider
    const reverbMixSlider = document.getElementById('reverbMixSlider'); //Reference to the slider for controlling the reverb mix level

    const lowPassMiddle = (parseFloat(filterSlider.min) + parseFloat(filterSlider.max)) / 2; // Middle for filterSlider
    const reverbMiddle = (parseFloat(reverbMixSlider.min) + parseFloat(reverbMixSlider.max)) / 2; // Middle for reverbMixSlider


    const sliderMiddle = 1.5; // Middle value of the slider corresponds to normal speed
    tempoSlider.value = sliderMiddle; // Set the initial value of the tempo slider to the middle (normal speed)
    progressSlider.value = 0; // Initialize slider position to zero

    filterSlider.value = lowPassMiddle; //Filter slider intial position
    reverbMixSlider.value = reverbMiddle; //Reverb slider initial position

    uploadImg.addEventListener('click', () => fileInput.click()); // Event listener for clicking the upload image to trigger the file input

    fileInput.addEventListener('change', async (event) => { // Event listener for when a file is selected from the file input
        const file = event.target.files[0]; //Get first selected file
        if (file) { //if file exists
            selectedFile = file; //
            fileURL = URL.createObjectURL(file);
            originalFileName = file.name;

            const uploadText = document.getElementById('upload_text');
            uploadText.style.transform = 'translate(1px, 5px)';

            tempoSlider.value = sliderMiddle; // Reset slider to normal speed

            try {
                loadAndPlayAudio(fileURL, file.name);

                // Reset progress bar
                progressSlider.max = 100;
                progressSlider.value = 0;

                fileNameDisplay.textContent = `Selected file: ${file.name}`;
                fileNameDisplay.style.display = 'block';
            }
            catch (error) {
                console.error("Error loading audio file:", error);
                alert("Failed to load audio. Please try again.");
            }
        }
        else {
            fileNameDisplay.textContent = 'No file selected';
            fileNameDisplay.style.display = 'none';
        }
    });

    async function loadReverbIR(url) {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        return audioContext.decodeAudioData(arrayBuffer);
    }

    function createLowPassFilter(audioContext) {
        const filter = audioContext.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 1000; // Initial cutoff frequency in Hz
        return filter;
    }

    function setupAudioContext(audioContext) {
        lowPassFilter = audioContext.createBiquadFilter();
        lowPassFilter.type = 'lowpass';
        lowPassFilter.frequency.value = parseFloat(filterSlider.min); // Start at min (normal state)

        dryGainNode = audioContext.createGain();
        dryGainNode.gain.value = 1; // Start fully dry

        reverbGainNode = audioContext.createGain();
        reverbGainNode.gain.value = 0; // Start no reverb (fully dry)
    }
    function setupVisualizer() {
        // Create an AudioContext (if not already created)
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Create an analyser node
        analyserNode = audioContext.createAnalyser();
        analyserNode.fftSize = 256;  // Sets the number of frequency bins (controls the resolution)
    
        // Connect the Howler sound node to the analyser
        const soundNode = sound._sounds[0]._node;
        soundNode.connect(analyserNode);
        analyserNode.connect(audioContext.destination);
    
        // Create an array to hold the frequency data
        const bufferLength = analyserNode.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
    
        // Function to draw the visualizer
        function drawVisualizer() {
            analyserNode.getByteFrequencyData(dataArray);  // Get the frequency data
    
            // Clear the canvas for the next frame
            canvasContext.clearRect(0, 0, canvas.width, canvas.height);
    
            const barWidth = (canvas.width / bufferLength) * 2.5;
            let barHeight;
            let x = 0;
    
            // Loop through the frequency data and draw bars on the canvas
            for (let i = 0; i < bufferLength; i++) {
                barHeight = dataArray[i];
                canvasContext.fillStyle = `rgb(${barHeight + 100}, 50, 150)`;  // Set color based on bar height
                canvasContext.fillRect(x, canvas.height - barHeight / 2, barWidth, barHeight / 2);  // Draw bar
                x += barWidth + 1;  // Increment the x position for the next bar
            }
    
            // Keep drawing the visualizer while the sound is playing
            if (sound && sound.playing()) {
                requestAnimationFrame(drawVisualizer);  // Keep updating the visualizer
            }
        }
    
        // Start drawing the visualizer
        drawVisualizer();
    }
    

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
            onload: async () => {
                const audioContext = Howler.ctx;

                // Create and connect the low-pass filter
                lowPassFilter = createLowPassFilter(audioContext);

                // Prepare source node
                const sourceNode = sound._sounds[0]._node;
                sourceNode.disconnect();

                // Create and load the reverb IR
                const irBuffer = await loadReverbIR('audio/ir.wav'); // Adjust path if needed
                convolverNode = audioContext.createConvolver();
                convolverNode.buffer = irBuffer;
                convolverNode.normalize = true;

                // Create gain nodes for wet/dry mix
                dryGainNode = audioContext.createGain();
                dryGainNode.gain.value = 0.5;   // 50% dry
                reverbGainNode = audioContext.createGain();
                reverbGainNode.gain.value = 0.5; // 50% wet

                // Connect the chain:
                // Source -> LowPassFilter -> (Dry path) DryGainNode -> Destination
                //                        \-> (Wet path) Convolver -> ReverbGainNode -> Destination
                sourceNode.connect(lowPassFilter);

                lowPassFilter.connect(dryGainNode).connect(audioContext.destination);
                lowPassFilter.connect(convolverNode);
                convolverNode.connect(reverbGainNode).connect(audioContext.destination);

                // Add event listener for the reverb slider now that nodes are created
                if (reverbMixSlider) {
                    reverbMixSlider.addEventListener('input', () => {
                        const mix = parseFloat(reverbMixSlider.value);
                        dryGainNode.gain.value = 1 - mix;
                        reverbGainNode.gain.value = mix;
                        console.log(`Reverb mix set to: ${mix}`);
                    });
                }

                setupVisualizer();
                
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

    function mapTempoToPlaybackRate(tempo) { // convert tempo slider value to playback rate
        const minTempo = parseFloat(tempoSlider.min); // get the minimum tempo value
        const maxTempo = parseFloat(tempoSlider.max); // get the maximum tempo value
        const normalSpeed = sliderMiddle; // normal speed is the middle of the slider
    
        if (tempo === normalSpeed) { // If tempo is at normal speed
            return 1; // playback rate is 1x speed
        }
        if (tempo > normalSpeed) { // If tempo is >1
            return 1 + (tempo - normalSpeed) / (maxTempo - normalSpeed); // calculate playback rate proportionally
        }   //otherwise tempo is < 1
        return 1 - (normalSpeed - tempo) / (normalSpeed - minTempo); // calculate playback rate for  < 1
    }
    
    playPauseButton.addEventListener('click', () => { // toggle play/pause on button click
        if (sound) { // If a sound is loaded
            if (sound.playing()) { // If the sound is currently playing:
                sound.pause(); // pause the sound.
                playPauseButton.textContent = 'Play'; // update button to say play
                stopProgressInterval(); // stop updating the progress bar
                cdImg.style.animation = "none"; // stop CD rotation animation
            } else { // If the sound is not playing
                sound.play(); // play the sound
                playPauseButton.textContent = 'Pause'; // update button to say pause
                startProgressInterval(); // start updating the progress bar
                cdImg.style.animation = "rotate 2s linear infinite"; // start CD rotation animation
            }
        } else { // If no sound is loaded:
            alert('Please upload an audio file first.'); // show an alert to upload the file
        }
    });
    
    progressSlider.addEventListener('input', () => { // update playback position when the progress slider is adjusted
        if (sound) { // if a sound is loaded
            sound.seek(progressSlider.value); // seek to the position
        }
    });
    
    function mapTempoToPlaybackRate(tempo) { // convert tempo slider value to playback rate
        const minTempo = parseFloat(tempoSlider.min); // get the minimum tempo value
        const maxTempo = parseFloat(tempoSlider.max); // get the maximum tempo value
        const normalSpeed = sliderMiddle; // normal speed is the middle of the slider
    
        if (tempo === normalSpeed) { // If tempo is at normal speed
            return 1; // playback rate is 1x speed
        }
        if (tempo > normalSpeed) { // If tempo is >1
            return 1 + (tempo - normalSpeed) / (maxTempo - normalSpeed); // calculate playback rate proportionally
        }   //otherwise tempo is < 1
        return 1 - (normalSpeed - tempo) / (normalSpeed - minTempo); // calculate playback rate for  < 1
    }
    
    // Dynamically update playback speed
    tempoSlider.addEventListener('input', () => { // update playback speed when tempo slider changes
        if (sound) { // if a sound is loaded
            const tempo = parseFloat(tempoSlider.value); // get the current speed value
            const playbackRate = mapTempoToPlaybackRate(tempo); // map speed to playback rate
            sound.rate(playbackRate); // update playback rate
            console.log(`Playback rate updated: ${playbackRate}`); // log the new playback rate
            updateBackgroundFilter(tempo); // update the background effect based on tempo
        }
    });
    
    function updateBackgroundFilter(tempo) { // Adjust background filter based on tempo.
        const midpoint = sliderMiddle; // get the middle point of the slider
        let brightness, contrast; //brightness and contrast variables
    
        if (tempo <= midpoint) { // for tempo below or equal to midpoint
            brightness = 1 - (midpoint - tempo) * 0.1; // decrease brightness
            contrast = 1 - (midpoint - tempo) * 0.05; // decrease contrast
        } else { // For tempo above midpoint
            brightness = 1 + (tempo - midpoint) * 0.1; // increase brightness
            contrast = 1 + (tempo - midpoint) * 0.05; // increase contrast
        }
    
        // Clamp values to avoid invalid filter properties
        brightness = Math.max(0.5, Math.min(1.5, brightness)); // limit brightness between 0.5 and 1.5
        contrast = Math.max(0.5, Math.min(1.5, contrast)); // limit contrast between 0.5 and 1.5
    
        // Apply filter to the body pseudo-element
        document.body.style.setProperty('--brightness', brightness); // update CSS variable for brightness
        document.body.style.setProperty('--contrast', contrast); // update CSS variable for contrast
    
        console.log(`Brightness: ${brightness}, Contrast: ${contrast}`); // log the new filter values
    }
    
    function startProgressInterval() { // start the interval for updating the progress slider
        if (progressInterval) clearInterval(progressInterval); // clear any existing interval
    
        const duration = sound.duration(); // get the sound duration
        progressSlider.max = duration; // set the slider's max value to the duration
    
        progressInterval = setInterval(() => { // update progress slider every 500ms
            if (sound && sound.playing()) { // check if the sound is playing
                progressSlider.value = sound.seek(); // update the slider's value to the current position
            }
        }, 500); //(500ms)
    }
    
    function stopProgressInterval() { // stop the progress interval
        if (progressInterval) { // If an interval exists
            clearInterval(progressInterval); // clear the interval
            progressInterval = null; // reset the interval variable
        }
    }
    
    downloadImg.addEventListener('click', async () => { // Handle the download button click event
        if (!selectedFile) { // If no file is selected
            alert('Please upload a file before downloading.'); // Show error if it didnt work
            return;
        }
    
        try {
            const tempo = parseFloat(tempoSlider.value); // Get the current tempo value
            const playbackRate = mapTempoToPlaybackRate(tempo); // Map tempo to playback rate and store it in playbackRate
    
            // Process the audio file with the applied tempo and effects
            const processedBlob = await processAudioForDownload(fileURL, playbackRate); // Process audio for download
    
            // Generate a downloadable file
            const downloadFileName = `edited_${originalFileName}`; // Create a new file name for download
            downloadBlob(processedBlob, downloadFileName); // Trigger file download.
        } catch (error) { // Handle errors
            console.error('Error downloading file:', error); // Log the error.
            alert('Failed to download the file. Please try again.'); // Show an alert.
        }
    });
    
    async function processAudioForDownload(url, playbackRate) { // function to processaudio into download file
        // Fetch original file
    
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();

        // Get current slider values
        const tempo = parseFloat(tempoSlider.value);
        const playbackRateAdjusted = mapTempoToPlaybackRate(tempo);

        const reverbMix = reverbMixSlider ? parseFloat(reverbMixSlider.value) : 0.5;
        const filterFreq = filterSlider ? parseFloat(filterSlider.value) : 1000;

        const audioContext = new AudioContext();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        // Create an OfflineAudioContext to render the processed audio
        const offlineContext = new OfflineAudioContext(
            audioBuffer.numberOfChannels,
            audioBuffer.duration * audioBuffer.sampleRate / playbackRateAdjusted,
            audioBuffer.sampleRate
        );

        // Set up the source
        const source = offlineContext.createBufferSource();
        source.buffer = audioBuffer;
        source.playbackRate.value = playbackRateAdjusted;

        // Load IR again for offline rendering
        const irArrayBuffer = await (await fetch('audio/ir.wav')).arrayBuffer();
        const irBuffer = await offlineContext.decodeAudioData(irArrayBuffer);

        // Create nodes in the offline context
        const offlineLowPass = offlineContext.createBiquadFilter();
        offlineLowPass.type = 'lowpass';
        offlineLowPass.frequency.value = filterFreq;

        const offlineConvolver = offlineContext.createConvolver();
        offlineConvolver.buffer = irBuffer;
        offlineConvolver.normalize = true;

        const offlineDryGain = offlineContext.createGain();
        offlineDryGain.gain.value = 1 - reverbMix;

        const offlineReverbGain = offlineContext.createGain();
        offlineReverbGain.gain.value = reverbMix;

        // Connect nodes: source -> lowPass -> dryGain + (convolver->reverbGain)
        source.connect(offlineLowPass);
        offlineLowPass.connect(offlineDryGain).connect(offlineContext.destination);

        offlineLowPass.connect(offlineConvolver);
        offlineConvolver.connect(offlineReverbGain).connect(offlineContext.destination);

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

    // Listen for changes on the filter slider to adjust the cutoff frequency live
    filterSlider.addEventListener('input', () => {
        if (lowPassFilter) {
            const frequency = parseFloat(filterSlider.value);
            lowPassFilter.frequency.value = frequency;
            console.log('Low-pass filter frequency set to: ' + frequency + ' Hz');
        }
    });
});

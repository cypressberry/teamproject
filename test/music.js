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
            selectedFile = file; //populate selected file reference
            fileURL = URL.createObjectURL(file); //create url for the file
            originalFileName = file.name; //store the og file name

            const uploadText = document.getElementById('upload_text');  //Update upload text element
            uploadText.style.transform = 'translate(1px, 5px)'; //Move upload text element to make room

            tempoSlider.value = sliderMiddle; // Reset slider to normal speed

            try {
                loadAndPlayAudio(fileURL, file.name);   //Try to load and play the audio for the file url and name

                // Reset progress bar
                progressSlider.max = 100; //reset top bound
                progressSlider.value = 0; //reset low bound

                fileNameDisplay.textContent = `Selected file: ${file.name}`; //Display file name
                fileNameDisplay.style.display = 'block'; //Display style should be set to block
            }
            catch (error) { //In case of error
                console.error("Error loading audio file:", error); //Push error to console log
                alert("Failed to load audio. Please try again."); //Alert user of error
            }
        }
        else {
            fileNameDisplay.textContent = 'No file selected'; //No file exists case
            fileNameDisplay.style.display = 'none'; //Don't display the name
        }
    });

    async function loadReverbIR(url) { //load our IR file aynchronously
        const response = await fetch(url); //Fetch the IR file
        const arrayBuffer = await response.arrayBuffer();　//Convert to array buffer
        const audioContext = new (window.AudioContext || window.webkitAudioContext)(); //Check if window.audioContext exists, fallback to webkit audio context
        return audioContext.decodeAudioData(arrayBuffer);   //Decode audio data
    }

    function createLowPassFilter(audioContext) { //Create and configure low pass filter node
        const filter = audioContext.createBiquadFilter(); //create biquad filter
        filter.type = 'lowpass'; //Set filter type
        filter.frequency.value = 1000; // Initial cutoff frequency in Hz
        return filter; //return the configured filter object
    }

    function setupAudioContext(audioContext) {  //Setup the audio context and nodes for processing audio effects
        lowPassFilter = audioContext.createBiquadFilter(); //Create another biquad filter
        lowPassFilter.type = 'lowpass'; //set to lowpass again
        lowPassFilter.frequency.value = parseFloat(filterSlider.min); // Start at min (normal state)

        dryGainNode = audioContext.createGain(); //initalize the dry gain node (unedited gain)
        dryGainNode.gain.value = 1; // Start fully dry

        reverbGainNode = audioContext.createGain(); //Create the full gain node (max gain)
        reverbGainNode.gain.value = 0; // Start no reverb (fully dry)
    }
    function setupVisualizer() {    //We didn't end up keeping this, it broke everything, not enough time to remove it without breaking stuff either
        // Create another AudioContext
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();  //Same check for existence of audiocontext and fallback
        
        // Create an analyser node
        analyserNode = audioContext.createAnalyser();  //Initialize analyzer node frm webaudio api
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
    
    //create new function to start progress
    function startProgressInterval() {
        //if statement to check if there is a current interval
        if (progressInterval) clearInterval(progressInterval);
        //create new variable to store how long a file is 
        const duration = sound.duration();
        //set the progress slider's max duration to the new duration 
        progressSlider.max = duration;
        // start a new interval to update the progress slider every 500 milliseconds
        progressInterval = setInterval(() => {
            // check if the file exists and is currently playing
            if (sound && sound.playing()) {
                // update the slider's current value to match the current playback position of the audio file
                progressSlider.value = sound.seek();
            }
            //repeat this every 0.5 seconds
        }, 500);
    }
    //new function to stop the audio file
    function stopProgressInterval() {
        // check if there is an valid file playing
        if (progressInterval) {
            // if the audio file is currently playing, stop it
            clearInterval(progressInterval);
            //set to null to indicate that it has stopped
            progressInterval = null;
        }
    }
    //click handler to download the audio file
    downloadImg.addEventListener('click', async () => {
        //check if the file is valid and has been uploaded
        if (!selectedFile) {
            //notify user that they have not uploaded a file
            alert('Please upload a file before downloading.');
            //return
            return;
        }
        //handle errors
        try {
            //create new variable to change the speed
            const tempo = parseFloat(tempoSlider.value);
            //use helper function to map tempo value to playback rate
            const playbackRate = mapTempoToPlaybackRate(tempo);

            // process the audio file with the applied tempo and effects
            const processedBlob = await processAudioForDownload(fileURL, playbackRate);

            // create new variable to store file name of audio file
            const downloadFileName = `edited_${originalFileName}`;
            //trigger download of the processed audio Blob using a helper function
            downloadBlob(processedBlob, downloadFileName);
        } catch (error) {
            //log the error to the console for debugging purposes
            console.error('Error downloading file:', error);
            //alert user that the downloadd did not work
            alert('Failed to download the file. Please try again.');
        }
    });
    //new asynchronous function to process audio for downloading
    async function processAudioForDownload(url, playbackRate) {
        // get original audio file from url
        const response = await fetch(url);
        //create arraybuffer to retrieve audio data
        const arrayBuffer = await response.arrayBuffer();

        // get current slider value for tempo and calculate playback rate from that slider value
        const tempo = parseFloat(tempoSlider.value);
        //map tempo to playback rate using helper function
        const playbackRateAdjusted = mapTempoToPlaybackRate(tempo);
        // get reverb mix and filter frequency values from sliders or set default values
        //get reverb mix or default to 0.5
        const reverbMix = reverbMixSlider ? parseFloat(reverbMixSlider.value) : 0.5;
        //get filter frequency or default to 1000 Hz
        const filterFreq = filterSlider ? parseFloat(filterSlider.value) : 1000;

        // create an AudioContext for audio processing
        const audioContext = new AudioContext();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        // create an offlineContext variable for offline rendering of the audio
        const offlineContext = new OfflineAudioContext(
            //number of audio channels
            audioBuffer.numberOfChannels,
            //adjust the duration based on playback rate
            audioBuffer.duration * audioBuffer.sampleRate / playbackRateAdjusted,
            //original sample rate of the audio
            audioBuffer.sampleRate
        );

        // set up the audio source for the offline context
        const source = offlineContext.createBufferSource();
        //create a buffer source node
        source.buffer = audioBuffer;
        //assign the decoded audio buffer to the source
        source.playbackRate.value = playbackRateAdjusted;

        // fetch and decode the impulse response (IR) file for reverb
        const irArrayBuffer = await (await fetch('audio/ir.wav')).arrayBuffer();
        //decode the IR file into an AudioBuffer
        const irBuffer = await offlineContext.decodeAudioData(irArrayBuffer);

        // create a low-pass filter node for the offline context
        //create a biquad filter for low-pass filtering
        const offlineLowPass = offlineContext.createBiquadFilter();
        //set the filter type to low-pass
        offlineLowPass.type = 'lowpass';
        // Set the cutoff frequency based on the slider value
        offlineLowPass.frequency.value = filterFreq;
        // Create a convolver node for reverb
        const offlineConvolver = offlineContext.createConvolver(); // Create a convolver node
    offlineConvolver.buffer = irBuffer; // Assign the impulse response buffer to the convolver
    offlineConvolver.normalize = true; // Enable normalization for the IR

    // Create gain nodes for dry and wet signals
    const offlineDryGain = offlineContext.createGain(); // Create a gain node for the dry signal
    offlineDryGain.gain.value = 1 - reverbMix; // Set the gain based on the reverb mix

    const offlineReverbGain = offlineContext.createGain(); // Create a gain node for the wet signal
    offlineReverbGain.gain.value = reverbMix; // Set the gain based on the reverb mix

    // Connect nodes: source -> lowPass -> dryGain + (convolver -> reverbGain)
    source.connect(offlineLowPass); // Connect the source to the low-pass filter
    offlineLowPass.connect(offlineDryGain).connect(offlineContext.destination); // Connect low-pass -> dryGain -> destination

    offlineLowPass.connect(offlineConvolver); // Connect low-pass to the convolver
    offlineConvolver.connect(offlineReverbGain).connect(offlineContext.destination); // Convolver -> reverbGain -> destination

    source.start(); // Start the source node to render audio

    // Render the processed audio buffer using the offline context
    const renderedBuffer = await offlineContext.startRendering(); // Begin the rendering process
    return audioBufferToBlob(renderedBuffer); // Convert the rendered buffer to a Blob and return it
}

// Helper function to convert an AudioBuffer to a Blob
function audioBufferToBlob(buffer) {
    const numOfChannels = buffer.numberOfChannels; // Get the number of audio channels
    const length = buffer.length * numOfChannels * 2 + 44; // Calculate the total WAV file size (PCM data + header)
    const wavBuffer = new ArrayBuffer(length); // Create a buffer for the WAV file
    const view = new DataView(wavBuffer); // Create a DataView to manipulate the buffer

    // Function to write strings into the DataView
    function writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i)); // Write each character as an 8-bit unsigned integer
        }
    }

    // Write WAV header
    writeString(view, 0, 'RIFF'); // RIFF chunk descriptor
    view.setUint32(4, 36 + buffer.length * numOfChannels * 2, true); // File size
    writeString(view, 8, 'WAVE'); // WAVE file format
    writeString(view, 12, 'fmt '); // Format chunk
    view.setUint32(16, 16, true); // Subchunk size
    view.setUint16(20, 1, true); // Audio format (1 for PCM)
    view.setUint16(22, numOfChannels, true); // Number of channels
    view.setUint32(24, buffer.sampleRate, true); // Sample rate
    view.setUint32(28, buffer.sampleRate * numOfChannels * 2, true); // Byte rate
    view.setUint16(32, numOfChannels * 2, true); // Block align
    view.setUint16(34, 16, true); // Bits per sample
    writeString(view, 36, 'data'); // Data chunk
    view.setUint32(40, buffer.length * numOfChannels * 2, true); // Data size

    // Write interleaved PCM data
    let offset = 44; // Start after the header
    for (let i = 0; i < buffer.length; i++) {
        for (let channel = 0; channel < numOfChannels; channel++) {
            let sample = buffer.getChannelData(channel)[i]; // Get the sample for the channel
            sample = Math.max(-1, Math.min(1, sample)); // Clamp the sample value to [-1, 1]
            sample = sample < 0 ? sample * 32768 : sample * 32767; // Scale to 16-bit range
            view.setInt16(offset, sample, true); // Write the sample as a 16-bit integer
            offset += 2; // Move to the next sample position
        }
    }

    return new Blob([view], { type: 'audio/wav' }); // Create and return a Blob for the WAV file
}

// Helper function to download a Blob as a file
function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob); // Create a temporary URL for the Blob
    const a = document.createElement('a'); // Create a hidden anchor element
    a.style.display = 'none'; // Hide the anchor element
    a.href = url; // Set the href to the Blob's URL
    a.download = filename; // Set the download filename
    document.body.appendChild(a); // Append the anchor to the document
    a.click(); // Simulate a click to trigger the download
    document.body.removeChild(a); // Remove the anchor after the click
    URL.revokeObjectURL(url); // Revoke the Blob URL to free resources
}

// Listen for slider changes to adjust the filter frequency in real time
filterSlider.addEventListener('input', () => {
    if (lowPassFilter) { // Check if the low-pass filter exists
        const frequency = parseFloat(filterSlider.value); // Get the slider value as a number
        lowPassFilter.frequency.value = frequency; // Update the filter's cutoff frequency
        console.log('Low-pass filter frequency set to: ' + frequency + ' Hz'); // Log the new frequency
    }
});
});


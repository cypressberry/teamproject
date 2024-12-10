document.addEventListener('DOMContentLoaded', function()
{
    var analyserNode = null;
    var sound = null;
    var fileURL = null;
    var progressInterval = null;
    var originalFileName = '';
    var selectedFile = null;
    var lowPassFilter = null;

    var convolverNode = null;
    var reverbGainNode = null;
    var dryGainNode = null;
    var analyserNode = null;

    var fileInput = document.getElementById('fileInput');
    var tempoSlider = document.getElementById('tempo');
    var uploadImg = document.getElementById('upload_img');
    var fileNameDisplay = document.getElementById('fileName');
    var applyEditsButton = document.getElementById('applyEdits');
    var downloadImg = document.getElementById('download_img');
    var playPauseButton = document.getElementById('playPauseButton');
    var cdImg = document.getElementById("cd_img");
    var progressSlider = document.getElementById('progressSlider');
    var filterSlider = document.getElementById('filterSlider');
    var reverbMixSlider = document.getElementById('reverbMixSlider');


    var sliderMiddle = 1.5; // Middle value of the slider corresponds to normal speed
    tempoSlider.value = sliderMiddle;
    progressSlider.value = 0;

    uploadImg.addEventListener('click', function()
    {
        fileInput.click();
    });

    fileInput.addEventListener('change', function(event)
    {
        var file = event.target.files[0];
        if (file)
        {
            selectedFile = file;
            fileURL = URL.createObjectURL(file);
            originalFileName = file.name;

            var uploadText = document.getElementById('upload_text');
            if (uploadText)
            {
                uploadText.style.transform = 'translate(1px, 5px)';
            }

            tempoSlider.value = sliderMiddle; // Reset slider to normal speed

            try
            {
                loadAndPlayAudio(fileURL, file.name);

                // Reset progress bar
                progressSlider.max = 100;
                progressSlider.value = 0;

                fileNameDisplay.textContent = 'Selected file: ' + file.name;
                fileNameDisplay.style.display = 'block';
            }
            catch (error)
            {
                console.error("Error loading audio file:", error);
                alert("Failed to load audio. Please try again.");
            }
        }
        else
        {
            fileNameDisplay.textContent = 'No file selected';
            fileNameDisplay.style.display = 'none';
        }
    });

    async function loadReverbIR(url)
    {
        var response = await fetch(url);
        var arrayBuffer = await response.arrayBuffer();
        var audioContext = Howler.ctx;
        return audioContext.decodeAudioData(arrayBuffer);
    }
    
    window.addEventListener('resize', () => {
        visualizerCanvas.width = window.innerWidth / 2;
        visualizerCanvas.height = window.innerHeight;
        mirroredCanvas.width = window.innerWidth / 2;
        mirroredCanvas.height = window.innerHeight;
    });

    function createLowPassFilter(audioContext)
    {
        var filter = audioContext.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 1000; // Initial cutoff frequency in Hz
        return filter;
    }
    // Add visualizeAudio function
    function visualizeAudio() {
        const { visualizerCanvas, mirroredCanvas, visualizerContext, mirroredContext } = setupCanvases();
    
        const bufferLength = analyserNode.frequencyBinCount;
        const frequencyData = new Uint8Array(bufferLength);
    
        console.log('Buffer Length:', bufferLength);
    
        const visibleBars = Math.floor(bufferLength / 1.25);
        const barWidth = visualizerCanvas.width / visibleBars;
    
        function draw() {
            requestAnimationFrame(draw);
            analyserNode.getByteFrequencyData(frequencyData);
    
            // Debug: Check if data is populated
            if (frequencyData.every(value => value === 0)) {
                console.log("Frequency data is all zero");
            }
       
    
            visualizerContext.clearRect(0, 0, visualizerCanvas.width, visualizerCanvas.height);
            mirroredContext.clearRect(0, 0, mirroredCanvas.width, mirroredCanvas.height);
          
            let x = 0;
            for (let i = 0; i < visibleBars; i++) {
                const barHeight = frequencyData[i] * (visualizerCanvas.height / 255) * 2;  // Multiplied by 2 for visibility
                visualizerContext.fillStyle = `rgb(50, ${barHeight / 3}, 150)`;
                visualizerContext.fillRect(x, visualizerCanvas.height - barHeight, barWidth, barHeight);
                x += barWidth;
            }
        
    
            x = mirroredCanvas.width;
            for (let i = 0; i < visibleBars; i++) {
                const barHeight = frequencyData[i] * (visualizerCanvas.height / 255) * 2;  // Multiplied by 2 for visibility
                mirroredContext.fillStyle = `rgb(50, ${barHeight / 3}, 150)`;
                mirroredContext.fillRect(x - barWidth, mirroredCanvas.height - barHeight, barWidth, barHeight);
                x -= barWidth;
            }
        }
    
        draw();
    }
    
    
    // Modify setupVisualizer to call visualizeAudio
    function setupVisualizer() {
        if (!analyserNode) {
            return;
        }
        visualizeAudio(); // Call the new visualization function
    }

    // Define setupCanvases function if not already defined
    function setupCanvases() {
        const visualizerCanvas = document.getElementById('visualizerCanvas');
        const mirroredCanvas = document.getElementById('mirroredCanvas');
    
        // Dynamically set the canvas size based on the window size
        visualizerCanvas.width = window.innerWidth / 2;
        visualizerCanvas.height = window.innerHeight;
        mirroredCanvas.width = window.innerWidth / 2;
        mirroredCanvas.height = window.innerHeight;
    
        const visualizerContext = visualizerCanvas.getContext('2d');
        const mirroredContext = mirroredCanvas.getContext('2d');
    
        console.log('Canvas Sizes:', visualizerCanvas.width, visualizerCanvas.height); // Check if dimensions are correct
        console.log('Canvas Context:', visualizerContext, mirroredContext);
    
        return { visualizerCanvas, mirroredCanvas, visualizerContext, mirroredContext };
    }
    
    
    function loadAndPlayAudio(url, fileName) {
        var fileExtension = fileName.split('.').pop().toLowerCase();
        var supportedFormats = ['mp3', 'ogg', 'wav'];

        var isSupported = false;
        for (var i = 0; i < supportedFormats.length; i++) {
            if (fileExtension === supportedFormats[i]) {
                isSupported = true;
                break;
            }
        }

        if (!isSupported) {
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
            onload: async function() {
                var audioContext = Howler.ctx;

                // Create and connect the low-pass filter
                lowPassFilter = createLowPassFilter(audioContext);

                // Prepare source node
                var sourceNode = sound._sounds[0]._node;
                sourceNode.disconnect();

                // Create and load the reverb IR
                var irBuffer = await loadReverbIR('audio/ir.wav');
                convolverNode = audioContext.createConvolver();
                convolverNode.buffer = irBuffer;
                convolverNode.normalize = true;

                // Create gain nodes for wet/dry mix
                dryGainNode = audioContext.createGain();
                dryGainNode.gain.value = 0.5;   // 50% dry
                reverbGainNode = audioContext.createGain();
                reverbGainNode.gain.value = 0.5; // 50% wet

                // Create an analyser node here, connected after we mix dry & wet
                analyserNode = audioContext.createAnalyser();
                analyserNode.fftSize = 256;

                // Connect the chain:
                // Source -> LowPassFilter -> DryGainNode -> AnalyserNode -> Destination
                //                       \-> Convolver -> ReverbGainNode -> AnalyserNode -> Destination
                sourceNode.connect(lowPassFilter);
                lowPassFilter.connect(dryGainNode);
                lowPassFilter.connect(convolverNode);

                // Combine dry and wet signals before going to analyser
                dryGainNode.connect(analyserNode);
                reverbGainNode.connect(analyserNode);

                // Convolver feeds wet signal
                convolverNode.connect(reverbGainNode);

                // From analyser to destination
                analyserNode.connect(audioContext.destination);

                // Update reverb slider event
                if (reverbMixSlider) {
                    reverbMixSlider.addEventListener('input', function() {
                        var mix = parseFloat(reverbMixSlider.value);
                        dryGainNode.gain.value = 1 - mix;
                        reverbGainNode.gain.value = mix;
                        console.log('Reverb mix set to: ' + mix);
                    });
                }
                analyserNode.fftSize = 512;  // or 1024 for more resolution
                setupVisualizer(); // Call setupVisualizer after the analyser is ready

                playPauseButton.textContent = 'Pause';
                sound.play();
                startProgressInterval();
                cdImg.style.animation = "rotate 2s linear infinite";
            },
            onend: function() {
                playPauseButton.textContent = 'Play';
                stopProgressInterval();
                cdImg.style.animation = "none";
            }
        });
    }

    function mapTempoToPlaybackRate(tempo)
    {
        var minTempo = parseFloat(tempoSlider.min);
        var maxTempo = parseFloat(tempoSlider.max);
        var normalSpeed = sliderMiddle;

        if (tempo === normalSpeed)
        {
            return 1;
        }
        else if (tempo > normalSpeed)
        {
            return 1 + (tempo - normalSpeed) / (maxTempo - normalSpeed);
        }
        else
        {
            return 1 - (normalSpeed - tempo) / (normalSpeed - minTempo);
        }
    }

    playPauseButton.addEventListener('click', function()
    {
        if (sound)
        {
            if (sound.playing())
            {
                sound.pause();
                playPauseButton.textContent = 'Play';
                stopProgressInterval();
                cdImg.style.animation = "none";
            }
            else
            {
                sound.play();
                playPauseButton.textContent = 'Pause';
                startProgressInterval();
                cdImg.style.animation = "rotate 2s linear infinite";``
            }
        }
        else
        {
            alert('Please upload an audio file first.');
        }
    });

    progressSlider.addEventListener('input', function()
    {
        if (sound)
        {
            sound.seek(progressSlider.value);
        }
    });

    applyEditsButton.addEventListener('click', function()
    {
        if (sound)
        {
            var tempo = parseFloat(tempoSlider.value);
            var playbackRate = mapTempoToPlaybackRate(tempo);
            sound.rate(playbackRate);
            console.log('Applied playback rate: ' + playbackRate);

            updateBackgroundFilter(tempo);
        }
        else
        {
            alert('Please upload an audio file first.');
        }
    });

    function updateBackgroundFilter(tempo)
    {
        var midpoint = sliderMiddle;
        var brightness = 1;
        var contrast = 1;

        if (tempo <= midpoint)
        {
            brightness = 1 - (midpoint - tempo) * 0.1;
            contrast = 1 - (midpoint - tempo) * 0.05;
        }
        else
        {
            brightness = 1 + (tempo - midpoint) * 0.1;
            contrast = 1 + (tempo - midpoint) * 0.05;
        }

        if (brightness < 0.5)
        {
            brightness = 0.5;
        }
        if (brightness > 1.5)
        {
            brightness = 1.5;
        }
        if (contrast < 0.5)
        {
            contrast = 0.5;
        }
        if (contrast > 1.5)
        {
            contrast = 1.5;
        }

        document.body.style.setProperty('--brightness', brightness);
        document.body.style.setProperty('--contrast', contrast);

        console.log('Brightness: ' + brightness + ', Contrast: ' + contrast);
    }

    function startProgressInterval()
    {
        if (progressInterval)
        {
            clearInterval(progressInterval);
        }

        if (sound)
        {
            var duration = sound.duration();
            progressSlider.max = duration;
        }

        progressInterval = setInterval(function()
        {
            if (sound && sound.playing())
            {
                progressSlider.value = sound.seek();
            }
        }, 500);
    }

    function stopProgressInterval()
    {
        if (progressInterval)
        {
            clearInterval(progressInterval);
            progressInterval = null;
        }
    }

    downloadImg.addEventListener('click', async function()
    {
        if (!selectedFile)
        {
            alert('Please upload a file before downloading.');
            return;
        }

        try
        {
            var tempo = parseFloat(tempoSlider.value);
            var playbackRate = mapTempoToPlaybackRate(tempo);

            var processedBlob = await processAudioForDownload(fileURL, playbackRate);
            var downloadFileName = 'edited_' + originalFileName;
            downloadBlob(processedBlob, downloadFileName);
        }
        catch (error)
        {
            console.error('Error downloading file:', error);
            alert('Failed to download the file. Please try again.');
        }
    });

    async function processAudioForDownload(url, playbackRate)
    {
        var response = await fetch(url);
        var arrayBuffer = await response.arrayBuffer();

        var tempo = parseFloat(tempoSlider.value);
        var playbackRateAdjusted = mapTempoToPlaybackRate(tempo);
        var reverbMix = reverbMixSlider ? parseFloat(reverbMixSlider.value) : 0.5;
        var filterFreq = filterSlider ? parseFloat(filterSlider.value) : 1000;

        var audioContext = new AudioContext();
        var audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        var offlineContext = new OfflineAudioContext(
            audioBuffer.numberOfChannels,
            audioBuffer.duration * audioBuffer.sampleRate / playbackRateAdjusted,
            audioBuffer.sampleRate
        );

        var source = offlineContext.createBufferSource();
        source.buffer = audioBuffer;
        source.playbackRate.value = playbackRateAdjusted;

        var irArrayBuffer = await (await fetch('audio/ir.wav')).arrayBuffer();
        var irBuffer = await offlineContext.decodeAudioData(irArrayBuffer);

        var offlineLowPass = offlineContext.createBiquadFilter();
        offlineLowPass.type = 'lowpass';
        offlineLowPass.frequency.value = filterFreq;

        var offlineConvolver = offlineContext.createConvolver();
        offlineConvolver.buffer = irBuffer;
        offlineConvolver.normalize = true;

        var offlineDryGain = offlineContext.createGain();
        offlineDryGain.gain.value = 1 - reverbMix;

        var offlineReverbGain = offlineContext.createGain();
        offlineReverbGain.gain.value = reverbMix;

        source.connect(offlineLowPass);
        offlineLowPass.connect(offlineDryGain).connect(offlineContext.destination);
        offlineLowPass.connect(offlineConvolver);
        offlineConvolver.connect(offlineReverbGain).connect(offlineContext.destination);

        source.start();

        var renderedBuffer = await offlineContext.startRendering();
        return audioBufferToBlob(renderedBuffer);
    }

    function audioBufferToBlob(buffer)
    {
        var numOfChannels = buffer.numberOfChannels;
        var length = buffer.length * numOfChannels * 2 + 44;
        var wavBuffer = new ArrayBuffer(length);
        var view = new DataView(wavBuffer);

        function writeString(view, offset, string)
        {
            for (var i = 0; i < string.length; i++)
            {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        }

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

        var offset = 44;
        for (var i = 0; i < buffer.length; i++)
        {
            for (var channel = 0; channel < numOfChannels; channel++)
            {
                var sample = buffer.getChannelData(channel)[i];
                sample = Math.max(-1, Math.min(1, sample));
                if (sample < 0)
                {
                    sample = sample * 32768;
                }
                else
                {
                    sample = sample * 32767;
                }

                view.setInt16(offset, sample, true);
                offset += 2;
            }
        }

        return new Blob([view], { type: 'audio/wav' });
    }

    function downloadBlob(blob, filename)
    {
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    filterSlider.addEventListener('input', function()
    {
        if (lowPassFilter)
        {
            var frequency = parseFloat(filterSlider.value);
            lowPassFilter.frequency.value = frequency;
            console.log('Low-pass filter frequency set to: ' + frequency + ' Hz');
        }
    });
});
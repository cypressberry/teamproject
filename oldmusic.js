document.addEventListener('DOMContentLoaded', function () {
    let sound;

    // Elements
    const fileInput = document.getElementById('fileInput');
    const tempoSlider = document.getElementById('tempo');
    const applyEditsButton = document.getElementById('applyEdits');

    // Event Listeners
    fileInput.addEventListener('change', handleFileSelect);
    applyEditsButton.addEventListener('click', applyEdits);

    // Handle File Selection
    function handleFileSelect(event) {
        const file = event.target.files[0];
        if (file) {
            const url = URL.createObjectURL(file);
            loadAndPlayAudio(url, file.name);
        }
    }

    // Load and Play Audio
    function loadAndPlayAudio(url, fileName) {
        const fileExtension = fileName.split('.').pop().toLowerCase();
        const supportedFormats = ['mp3', 'ogg', 'wav'];

        if (!supportedFormats.includes(fileExtension)) {
            alert('Unsupported file format. Please upload an MP3, OGG, or WAV file.');
            return;
        }

        // Create a new Howl instance
        sound = new Howl({
            src: [url],
            format: [fileExtension],
            onload: function () {
                console.log('Audio loaded successfully.');
            }
        });

        // Play the audio
        sound.play();
    }

    // Apply Tempo Adjustments
    function applyEdits() {
        if (sound) {
            const tempoValue = parseFloat(tempoSlider.value);
            sound.rate(tempoValue); // Adjust playback speed
            console.log(`Applied tempo adjustment: ${tempoValue}`);
        } else {
            alert('Please upload and play an audio file first.');
        }
    }
});

const uploadImg = document.getElementById('upload_img');
const fileInput = document.getElementById('fileInput');
const fileNameDisplay = document.getElementById('fileName');
//const audioPlayer = document.getElementById('audio_player');
const audioElement = document.getElementById('audioElement');

uploadImg.addEventListener('click', () => {
    fileInput.click();
});


fileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
        const url = URL.createObjectURL(file);

        fileNameDisplay.textContent = `Selected file: ${file.name}`;
        fileNameDisplay.style.display = 'block';

        // Play audio
        audioElement.src = url; 
        audioPlayer.style.display = 'block'; 
        audioElement.play(); 
    } else {
        fileNameDisplay.textContent = 'No file selected';
    }
});
// Check for MediaRecorder support
if (!navigator.mediaDevices || !window.MediaRecorder) {
    alert('MediaRecorder is not supported in this browser.');
  }
  
  // DOM elements
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  const saveBtn = document.getElementById('saveBtn');
  const audio = document.getElementById('audio');
  const ratingDisplay = document.getElementById('ratingDisplay');
  const ratingInputs = document.querySelectorAll('.rating input');
  const recordingsGrid = document.getElementById('recordingsGrid');
  const canvas = document.getElementById('visualizer');
  const canvasCtx = canvas.getContext('2d');
  
  // Variables for recording
  let stream;
  let mediaRecorder;
  let recordedChunks = [];
  let currentBlob = null;
  
  // AudioContext and Analyser for visualization
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 2048;
  let animationFrameId;
  
  // Start recording
  startBtn.addEventListener('click', async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.ondataavailable = (e) => {
        recordedChunks.push(e.data);
      };
      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunks, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        audio.src = url;
        currentBlob = blob; // Save the blob for later use
        recordedChunks = []; // Reset for next recording
        saveBtn.disabled = false; // Enable save button after recording
      };
      mediaRecorder.start();
      startBtn.disabled = true;
      stopBtn.disabled = false;
    } catch (err) {
      console.error('Error accessing microphone:', err);
      alert('Could not access microphone. Please allow microphone access.');
    }
  });
  
  // Stop recording
  stopBtn.addEventListener('click', () => {
    mediaRecorder.stop();
    stream.getTracks().forEach(track => track.stop());
    startBtn.disabled = false;
    stopBtn.disabled = true;
  });
  
  // Update rating display
  ratingInputs.forEach(input => {
    input.addEventListener('change', () => {
      ratingDisplay.textContent = `You rated ${input.value} stars`;
    });
  });
  
  // Save recording to local storage
  saveBtn.addEventListener('click', () => {
    const selectedRating = document.querySelector('input[name="star-radio"]:checked');
    if (!selectedRating) {
      alert('Please select a rating before saving.');
      return;
    }
    const rating = selectedRating.value;
    if (!currentBlob) {
      alert('No recording to save.');
      return;
    }
    const reader = new FileReader();
    reader.readAsDataURL(currentBlob);
    reader.onloadend = function() {
      const base64data = reader.result;
      const timestamp = new Date().toISOString();
      let recordings = JSON.parse(localStorage.getItem('recordings')) || [];
      recordings.push({ timestamp, audio: base64data, rating });
      localStorage.setItem('recordings', JSON.stringify(recordings));
      alert('Recording saved!');
      renderRecordings();
    };
  });
  
  // Render saved recordings
  function renderRecordings() {
    const recordings = JSON.parse(localStorage.getItem('recordings')) || [];
    recordingsGrid.innerHTML = '';
    recordings.forEach(rec => {
      const div = document.createElement('div');
      div.classList.add('recording-item');
      const titleEl = document.createElement('h3');
      titleEl.textContent = rec.timestamp;
      const audioEl = document.createElement('audio');
      audioEl.controls = true;
      audioEl.src = rec.audio;
      const ratingEl = document.createElement('p');
      const rating = parseInt(rec.rating);
      ratingEl.textContent = `Rating: ${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}`;
      const downloadBtn = document.createElement('button');
      downloadBtn.textContent = 'Download';
      downloadBtn.addEventListener('click', () => {
        const a = document.createElement('a');
        a.href = rec.audio;
        a.download = `recording_${rec.timestamp}.webm`;
        a.click();
      });
      div.appendChild(titleEl);
      div.appendChild(audioEl);
      div.appendChild(ratingEl);
      div.appendChild(downloadBtn);
      recordingsGrid.appendChild(div);
  
      // Add event listeners for visualization
      audioEl.addEventListener('play', () => {
        const source = audioCtx.createMediaElementSource(audioEl);
        source.connect(analyser);
        analyser.connect(audioCtx.destination);
        visualize();
      });
      audioEl.addEventListener('pause', () => {
        cancelAnimationFrame(animationFrameId);
      });
      audioEl.addEventListener('ended', () => {
        cancelAnimationFrame(animationFrameId);
      });
    });
  }
  
  // Visualize frequency data
  function visualize() {
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);
    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    const barWidth = (canvas.width / bufferLength) * 2.5;
    let barHeight;
    let x = 0;
    for (let i = 0; i < bufferLength; i++) {
      barHeight = dataArray[i];
      canvasCtx.fillStyle = 'rgb(' + (barHeight + 100) + ',50,50)';
      canvasCtx.fillRect(x, canvas.height - barHeight / 2, barWidth, barHeight / 2);
      x += barWidth + 1;
    }
    animationFrameId = requestAnimationFrame(visualize);
  }
  
  // Add visualization to the main audio element
  audio.addEventListener('play', () => {
    const source = audioCtx.createMediaElementSource(audio);
    source.connect(analyser);
    analyser.connect(audioCtx.destination);
    visualize();
  });
  audio.addEventListener('pause', () => {
    cancelAnimationFrame(animationFrameId);
  });
  audio.addEventListener('ended', () => {
    cancelAnimationFrame(animationFrameId);
  });
  
  // Initial render of saved recordings
  renderRecordings();
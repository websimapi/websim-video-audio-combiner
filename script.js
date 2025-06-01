class VideoAudioCombiner {
    constructor() {
        this.videoFile = null;
        this.audioFile = null;
        this.videoElement = null;
        this.audioElement = null;
        this.init();
    }

    init() {
        this.bindEvents();
    }

    bindEvents() {
        const videoInput = document.getElementById('video-input');
        const audioInput = document.getElementById('audio-input');
        const combineBtn = document.getElementById('combine-btn');
        const downloadBtn = document.getElementById('download-btn');

        videoInput.addEventListener('change', (e) => this.handleVideoUpload(e));
        audioInput.addEventListener('change', (e) => this.handleAudioUpload(e));
        combineBtn.addEventListener('click', () => this.combineFiles());
        downloadBtn.addEventListener('click', () => this.downloadResult());
    }

    handleVideoUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        this.videoFile = file;
        const videoInfo = document.getElementById('video-info');
        const videoPreview = document.getElementById('video-preview');
        
        videoInfo.innerHTML = `
            <strong>${file.name}</strong><br>
            Size: ${this.formatFileSize(file.size)}<br>
            Type: ${file.type}
        `;

        const url = URL.createObjectURL(file);
        videoPreview.src = url;
        this.videoElement = videoPreview;

        this.showPreview();
        this.checkReadyToCombine();
    }

    handleAudioUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        this.audioFile = file;
        const audioInfo = document.getElementById('audio-info');
        const audioPreview = document.getElementById('audio-preview');
        
        audioInfo.innerHTML = `
            <strong>${file.name}</strong><br>
            Size: ${this.formatFileSize(file.size)}<br>
            Type: ${file.type}
        `;

        const url = URL.createObjectURL(file);
        audioPreview.src = url;
        this.audioElement = audioPreview;

        this.showPreview();
        this.checkReadyToCombine();
    }

    showPreview() {
        if (this.videoFile || this.audioFile) {
            document.getElementById('preview-section').style.display = 'grid';
        }
    }

    checkReadyToCombine() {
        const combineBtn = document.getElementById('combine-btn');
        combineBtn.disabled = !(this.videoFile && this.audioFile);
    }

    async combineFiles() {
        const combineBtn = document.getElementById('combine-btn');
        const btnText = combineBtn.querySelector('.btn-text');
        const spinner = combineBtn.querySelector('.loading-spinner');
        const progressSection = document.getElementById('progress-section');
        const progressFill = document.getElementById('progress-fill');
        const progressText = document.getElementById('progress-text');

        // Update UI
        combineBtn.disabled = true;
        btnText.textContent = 'Processing...';
        spinner.style.display = 'inline-block';
        progressSection.style.display = 'block';

        try {
            // Create canvas for video processing
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Wait for video metadata to load
            await new Promise((resolve) => {
                this.videoElement.addEventListener('loadedmetadata', resolve, { once: true });
                this.videoElement.load();
            });

            canvas.width = this.videoElement.videoWidth;
            canvas.height = this.videoElement.videoHeight;

            // Create audio context
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const audioBuffer = await this.loadAudioBuffer(audioContext);

            // Setup media recorder
            const stream = canvas.captureStream(30); // 30 FPS
            const audioSource = audioContext.createBufferSource();
            audioSource.buffer = audioBuffer;

            // Create a destination for the audio
            const dest = audioContext.createMediaStreamDestination();
            audioSource.connect(dest);
            
            // Add audio track to video stream
            dest.stream.getAudioTracks().forEach(track => {
                stream.addTrack(track);
            });

            const mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'video/webm;codecs=vp9,opus'
            });

            const chunks = [];
            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    chunks.push(event.data);
                }
            };

            // Start recording
            mediaRecorder.start();
            audioSource.start();

            // Play video and draw frames
            this.videoElement.currentTime = 0;
            this.videoElement.play();

            const duration = Math.min(this.videoElement.duration, audioBuffer.duration);
            const startTime = Date.now();

            const drawFrame = () => {
                if (this.videoElement.ended || this.videoElement.currentTime >= duration) {
                    mediaRecorder.stop();
                    return;
                }

                ctx.drawImage(this.videoElement, 0, 0, canvas.width, canvas.height);
                
                // Update progress
                const progress = (this.videoElement.currentTime / duration) * 100;
                progressFill.style.width = `${progress}%`;
                progressText.textContent = `Processing... ${Math.round(progress)}%`;

                requestAnimationFrame(drawFrame);
            };

            drawFrame();

            // Handle recording completion
            const combinedBlob = await new Promise((resolve) => {
                mediaRecorder.onstop = () => {
                    const blob = new Blob(chunks, { type: 'video/webm' });
                    resolve(blob);
                };
            });

            this.showResult(combinedBlob);

        } catch (error) {
            console.error('Error combining files:', error);
            alert('Error combining files. Please try again.');
        } finally {
            // Reset UI
            combineBtn.disabled = false;
            btnText.textContent = 'Combine Files';
            spinner.style.display = 'none';
            progressSection.style.display = 'none';
        }
    }

    async loadAudioBuffer(audioContext) {
        const arrayBuffer = await this.audioFile.arrayBuffer();
        return await audioContext.decodeAudioData(arrayBuffer);
    }

    showResult(blob) {
        const resultSection = document.getElementById('result-section');
        const resultVideo = document.getElementById('result-video');
        
        const url = URL.createObjectURL(blob);
        resultVideo.src = url;
        
        // Store blob for download
        this.resultBlob = blob;
        
        resultSection.style.display = 'block';
        resultSection.scrollIntoView({ behavior: 'smooth' });
    }

    downloadResult() {
        if (!this.resultBlob) return;

        const url = URL.createObjectURL(this.resultBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'combined-video.webm';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    new VideoAudioCombiner();
});


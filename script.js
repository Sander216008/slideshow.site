const { createFFmpeg, fetchFile } = FFmpeg;

const ffmpeg = createFFmpeg({ log: true });

const imagesInput = document.getElementById('images');
const audioInput = document.getElementById('audio');
const backgroundInput = document.getElementById('background');
const photosPerSlideInput = document.getElementById('photosPerSlide');
const slideDurationInput = document.getElementById('slideDuration');
const transitionDurationInput = document.getElementById('transitionDuration');
const startBtn = document.getElementById('startBtn');
const exportBtn = document.getElementById('exportBtn');
const preview = document.getElementById('preview');

let videoBlob;
let audioDuration = null;

imagesInput.addEventListener('change', updateDuration);
audioInput.addEventListener('change', updateDuration);
photosPerSlideInput.addEventListener('input', updateDuration);

async function updateDuration() {
  const images = [...imagesInput.files];
  const audio = audioInput.files[0];
  const photosPerSlide = parseInt(photosPerSlideInput.value) || 1;

  if (images.length === 0 || !audio) {
    slideDurationInput.disabled = false;
    transitionDurationInput.disabled = false;
    return;
  }

  const totalSlides = Math.ceil(images.length / photosPerSlide);

  const audioURL = URL.createObjectURL(audio);
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const audioBuffer = await fetch(audioURL).then(r => r.arrayBuffer()).then(buf => audioContext.decodeAudioData(buf));
  audioDuration = audioBuffer.duration;

  const newSlideDuration = audioDuration / totalSlides;
  slideDurationInput.value = newSlideDuration.toFixed(2);

  // disable manual editing
  slideDurationInput.disabled = true;
  transitionDurationInput.disabled = true;
}

startBtn.addEventListener('click', async () => {
  const images = [...imagesInput.files];
  const audio = audioInput.files[0];

  if (!images.length) {
    alert('Upload minimaal 1 afbeelding.');
    return;
  }

  const photosPerSlide = parseInt(photosPerSlideInput.value);
  const totalSlides = Math.ceil(images.length / photosPerSlide);

  let totalDuration = audioDuration || parseFloat(slideDurationInput.value) * totalSlides;
  const slideDuration = totalDuration / totalSlides;
  const transitionDuration = parseFloat(transitionDurationInput.value);

  await generateVideo(images, slideDuration, transitionDuration, audio);
});

exportBtn.addEventListener('click', () => {
  if (videoBlob) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(videoBlob);
    a.download = 'slideshow.mp4';
    a.click();
  } else {
    alert('Eerst een voorbeeld genereren.');
  }
});

async function generateVideo(images, slideDuration, transitionDuration, audioFile) {
  if (!ffmpeg.isLoaded()) await ffmpeg.load();

  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    const data = await fetchFile(img);
    ffmpeg.FS('writeFile', `img${i}.png`, data);
  }

  const inputList = images.map((_, i) => `file 'img${i}.png'\nduration ${slideDuration}`).join('\n') + `\nfile 'img${images.length - 1}.png'`;
  ffmpeg.FS('writeFile', 'input.txt', new TextEncoder().encode(inputList));

  await ffmpeg.run(
    '-f', 'concat',
    '-safe', '0',
    '-i', 'input.txt',
    '-vf', `format=yuv420p`,
    '-r', '25',
    '-pix_fmt', 'yuv420p',
    '-y', 'out.mp4'
  );

  if (audioFile) {
    ffmpeg.FS('writeFile', 'audio.mp3', await fetchFile(audioFile));
    await ffmpeg.run(
      '-i', 'out.mp4',
      '-i', 'audio.mp3',
      '-shortest',
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-strict', 'experimental',
      '-y', 'output.mp4'
    );
  }

  const outputName = audioFile ? 'output.mp4' : 'out.mp4';
  const data = ffmpeg.FS('readFile', outputName);
  videoBlob = new Blob([data.buffer], { type: 'video/mp4' });
  preview.src = URL.createObjectURL(videoBlob);
}
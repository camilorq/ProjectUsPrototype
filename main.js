const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

const recognition = new SpeechRecognition();
recognition.continuous = true;
recognition.interimResults = true;
const startTime = new Date().getTime();

const audioColorEmotions = new Map();
audioColorEmotions.set("neutral", "#e5e5e5");
audioColorEmotions.set("pos", "#79d485");
audioColorEmotions.set("neg", "#e04161");

window.onload = async function () {
  setupVideo();

  function setupVideo() {
    async function loadVideo() {
      navigator.getUserMedia =
        navigator.getUserMedia ||
        navigator.webkitGetUserMedia ||
        navigator.mozGetUserMedia ||
        navigator.msGetUserMedia;
      Promise.all([
        faceapi.loadFaceLandmarkModel("/static/models/"),
        faceapi.loadFaceRecognitionModel("/static/models/"),
        faceapi.loadTinyFaceDetectorModel("/static/models/"),
        faceapi.loadFaceLandmarkModel("/static/models/"),
        faceapi.loadFaceLandmarkTinyModel("/static/models/"),
        faceapi.loadFaceRecognitionModel("/static/models/"),
        faceapi.loadFaceExpressionModel("/static/models/"),
      ])
        .then(startVideo)
        .catch((err) => {
          console.log(`Error loading models: ${err}`);
        });
    }

    function startVideo() {
      navigator.mediaDevices
        .getUserMedia({ video: true })
        .then(function (stream) {
          video.srcObject = stream;
        })
        .catch(function (err) {
          console.log("Error requesting the camera: " + err.name);
        });
    }

    loadVideo();

    const video = document.getElementById("video");

    video.addEventListener("play", () => {
      const canvas = faceapi.createCanvasFromMedia(video);
      const landmark_canvas = faceapi.createCanvasFromMedia(video);
      document.getElementById("sc-div").append(canvas);
      document.getElementById("sc-div").append(landmark_canvas);

      const displaySize = {
        width: video.width,
        height: video.height,
      };
      faceapi.matchDimensions(canvas, displaySize);
      faceapi.matchDimensions(landmark_canvas, displaySize);
      canvas.setAttribute("class", "sc_canvas");
      landmark_canvas.setAttribute("class", "landmark_canvas");

      setInterval(async () => {
        const detections = await faceapi
          .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceExpressions();

        if (detections.length > 0 && detections[0].expressions != null) {
          const emotes = detections[0].expressions;

          const resizedDetections = faceapi.resizeResults(
            detections,
            displaySize
          );
          canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
          canvas
            .getContext("2d")
            .drawImage(video, 0, 0, canvas.width, canvas.height);

          compute_emotion_by_window(emotes);
          const img = canvas.toDataURL("image/webp");

          canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);

          landmark_canvas
            .getContext("2d")
            .clearRect(0, 0, canvas.width, canvas.height);
          faceapi.draw.drawDetections(landmark_canvas, resizedDetections);
          faceapi.draw.drawFaceLandmarks(landmark_canvas, resizedDetections);
          faceapi.draw.drawFaceExpressions(landmark_canvas, resizedDetections);
        }
      }, 100);
    });
  }

  //========================================== SPEECH RECOGNITION ==========================================================

  recognition.onresult = function (event) {
    const current = event.resultIndex;

    const seconds = Math.floor((new Date().getTime() - startTime) / 1000);

    if (event.results[current].isFinal) {
      const transcript = event.results[current][0].transcript;
      console.log(`RECOGNITION RESULT: "${transcript}" at ${seconds} seconds`);
      document.getElementById("transcript").innerText = transcript;
    }
  };

  recognition.onend = () => {
    recognition.start();
  };

  recognition.start();
};

function compute_emotion_by_window(emotions) {
  val_values = get_pos_neg_confidence(emotions);

  let max = Object.keys(val_values).reduce((a, b) =>
    val_values[a] > val_values[b] ? a : b
  );

  let dot = document.getElementById("my-sentiment-dot");
  let color = audioColorEmotions.get(max);
  //   console.log(`changing color to ${color} for ${max} emotion`);
  dot.style.backgroundColor = color;
}

function get_pos_neg_confidence(all_values) {
  valence_values = { pos: 0, neg: 0, neutral: 0 };

  for (key in all_values) {
    if (
      key == "angry" ||
      key == "disgusted" ||
      key == "fearful" ||
      key == "sad"
    ) {
      valence_values["neg"] += all_values[key];
    } else if (key == "happy" || key == "surprised") {
      valence_values["pos"] += all_values[key];
    } else if (key == "neutral") {
      valence_values["neutral"] += all_values[key];
    }
  }

  return valence_values;
}

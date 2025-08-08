import React, { useState, useRef, useEffect } from "react";
import { Camera, Download, Aperture } from "lucide-react";

type AppState = "landing" | "frame-selection" | "camera" | "result";
type PhotoMode = "single" | "triple";

interface CapturedPhoto {
  dataUrl: string;
  timestamp: number;
}

function App() {
  const [state, setState] = useState<AppState>("landing");
  const [photoMode, setPhotoMode] = useState<PhotoMode>("single");
  const [capturedPhotos, setCapturedPhotos] = useState<CapturedPhoto[]>([]);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (state !== "camera") return;

    const startCamera = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        streamRef.current = mediaStream;
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.onloadedmetadata = () =>
            videoRef.current?.play().catch(console.error);
        }
      } catch (err) {
        console.error("Camera error:", err);
        alert("Unable to access camera");
        setState("frame-selection");
      }
    };

    startCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [state]);

  const capturePhoto = (): string | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.save();

    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    return canvas.toDataURL("image/jpeg", 0.9);
  };

  const startCountdown = async () => {
    setIsCapturing(true);
    const photos: CapturedPhoto[] = [];
    const photoCount = photoMode === "single" ? 1 : 3;

    for (let i = 0; i < photoCount; i++) {
      for (let c = 3; c >= 1; c--) {
        setCountdown(c);
        await new Promise((r) => setTimeout(r, 1000));
      }
      setCountdown(null);
      await new Promise((r) => setTimeout(r, 200));

      const flashDiv = document.createElement("div");
      Object.assign(flashDiv.style, {
        position: "fixed",
        top: "0",
        left: "0",
        width: "100%",
        height: "100%",
        backgroundColor: "white",
        opacity: "0.9",
        zIndex: "9999",
        pointerEvents: "none",
      });
      document.body.appendChild(flashDiv);

      const dataUrl = capturePhoto();
      if (dataUrl) photos.push({ dataUrl, timestamp: Date.now() });

      setTimeout(() => {
        if (document.body.contains(flashDiv))
          document.body.removeChild(flashDiv);
      }, 150);

      if (i < photoCount - 1) {
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
    setCapturedPhotos(photos);
    setState("result");
    setIsCapturing(false);
  };

  const downloadPhotos = async () => {
    if (capturedPhotos.length === 0 || isDownloading) return;
    setIsDownloading(true);

    try {
      const holeSize = 20;
      const framePadding = 40;

      const firstImg = new Image();
      await new Promise<void>((resolve) => {
        firstImg.onload = () => resolve();
        firstImg.src = capturedPhotos[0].dataUrl;
      });
      const photoWidth = firstImg.width;
      const photoHeight = firstImg.height;

      let totalWidth = photoWidth + framePadding * 2 + holeSize * 2;
      let totalHeight =
        photoMode === "single"
          ? photoHeight + framePadding * 2
          : capturedPhotos.length * (photoHeight + framePadding) + framePadding;

      const canvas = document.createElement("canvas");
      canvas.width = totalWidth;
      canvas.height = totalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.fillStyle = "#111";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = "white";
      ctx.fillRect(holeSize, 0, canvas.width - holeSize * 2, canvas.height);

      const borderHeight = 16;
      ctx.fillStyle = "#111";
      ctx.fillRect(holeSize, 0, canvas.width - holeSize * 2, borderHeight);
      ctx.fillRect(
        holeSize,
        canvas.height - borderHeight,
        canvas.width - holeSize * 2,
        borderHeight,
      );

      ctx.fillStyle = "#111";
      const holeSpacing = totalHeight / 6;
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.arc(
          holeSize / 2,
          holeSpacing * (i + 1),
          holeSize / 2,
          0,
          Math.PI * 2,
        );
        ctx.fill();

        ctx.beginPath();
        ctx.arc(
          canvas.width - holeSize / 2,
          holeSpacing * (i + 1),
          holeSize / 2,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }

      for (let i = 0; i < capturedPhotos.length; i++) {
        const img = await new Promise<HTMLImageElement>((resolve) => {
          const im = new Image();
          im.onload = () => resolve(im);
          im.src = capturedPhotos[i].dataUrl;
        });

        ctx.drawImage(
          img,
          holeSize + framePadding,
          framePadding + i * (photoHeight + framePadding),
          photoWidth,
          photoHeight,
        );

        const date = new Date(capturedPhotos[i].timestamp);
        const dateStr = `bolt-booth.netlify.app ${date.getMonth() + 1}.${date.getDate()}.${String(date.getFullYear()).slice(-2)}`;

        const fontSize = Math.floor(photoHeight * 0.035);
        ctx.font = `${fontSize}px monospace`;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";

        const padding = 6;
        const textWidth = ctx.measureText(dateStr).width;
        const textX = holeSize + framePadding + 4;
        const textY = framePadding + i * (photoHeight + framePadding) + 4;

        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx.fillRect(
          textX - padding / 2,
          textY - padding / 2,
          textWidth + padding,
          fontSize + padding / 1.5,
        );

        ctx.fillStyle = "#ccc";
        ctx.fillText(dateStr, textX, textY);
      }

      const finalDataUrl = canvas.toDataURL("image/jpeg", 1.0);
      const link = document.createElement("a");
      link.href = finalDataUrl;
      link.download = `photo-booth-${photoMode}-${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => resetApp(), 1000);
    } catch (err) {
      console.error("Download error:", err);
      alert("Download failed");
    } finally {
      setIsDownloading(false);
    }
  };

  const FilmStripPreview = () => {
    if (!capturedPhotos.length) {
      return (
        <div className="bg-gray-900 p-4 rounded-lg shadow-2xl max-w-md mx-auto text-center text-white">
          No photos captured yet.
        </div>
      );
    }

    return (
      <div className="bg-gray-900 p-4 rounded-lg shadow-2xl max-w-md mx-auto">
        <div className="bg-white p-2 rounded flex flex-col space-y-2">
          {capturedPhotos.map((p) => (
            <img
              key={p.timestamp}
              src={p.dataUrl}
              alt="Photo"
              className="w-full object-contain rounded"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src =
                  "data:image/svg+xml;charset=UTF-8," +
                  encodeURIComponent(
                    `<svg width="200" height="150" xmlns="http://www.w3.org/2000/svg">
                      <rect width="200" height="150" fill="#f87171"/>
                      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#fff" font-family="monospace" font-size="14">Image failed to load</text>
                    </svg>`,
                  );
              }}
            />
          ))}
        </div>
      </div>
    );
  };

  const resetApp = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setState("landing");
    setCapturedPhotos([]);
    setCountdown(null);
    setIsCapturing(false);
  };

  if (state === "landing") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-800/20 via-transparent to-transparent"></div>

        <div className="text-center space-y-12 max-w-2xl relative z-10">
          <div className="space-y-4">
            <h1 className="shiny-text text-6xl md:text-8xl font-bold text-white mb-2 tracking-tight">
              Photo Booth
            </h1>
            <p className="text-xl text-purple-200 font-light">
              ✨ Capture the Moment
            </p>
          </div>

          <div className="flex justify-center">
            <button
              onClick={() => setState("frame-selection")}
              className="group relative inline-flex items-center justify-center w-24 h-24 bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 rounded-full hover:scale-110 active:scale-95 transition-all duration-300 shadow-2xl hover:shadow-purple-500/25"
              aria-label="Start photo booth"
            >
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-pink-400 to-purple-500 opacity-0 group-hover:opacity-20 transition-opacity duration-300"></div>
              <Aperture className="w-10 h-10 text-white relative z-10" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (state === "frame-selection") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
        <div className="w-full max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Style Selection
            </h2>
            <p className="text-purple-200 text-lg">choose an experience</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <button
              onClick={() => {
                setPhotoMode("single");
                setState("camera");
              }}
              className="group p-8 bg-gradient-to-br from-emerald-500/20 to-green-600/20 border-2 border-emerald-500/30 rounded-3xl hover:scale-105 hover:border-emerald-400/50 transition-all duration-300 backdrop-blur-sm"
            >
              <div className="flex flex-col items-center space-y-6">
                <div className="w-16 h-16 bg-gradient-to-br from-emerald-400 to-green-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <svg
                    version="1.1"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 313 313"
                    fill="white"
                    className="w-8 h-8"
                  >
                    <g>
                      <path
                        d="M283,3H30C13.458,3,0,16.458,0,33v247c0,16.542,13.458,30,30,30h253c16.542,0,30-13.458,30-30V33
                      C313,16.458,299.542,3,283,3z M283,33l0.01,131.228l-50.683-47.598c-3.544-3.327-8.083-5.159-12.78-5.159
                      c-5.715,0-11.063,2.681-14.673,7.354l-59.663,77.256c-1.934,2.504-5.036,3.999-8.299,3.999c-2.223,0-4.324-0.676-6.076-1.956
                      l-38.773-28.316c-3.862-2.821-8.865-4.374-14.085-4.374c-5.945,0-11.504,1.938-15.65,5.456L30,198.31V33H283z"
                      />
                      <path d="M115,122c17.093,0,31-13.907,31-31s-13.907-31-31-31S84,73.907,84,91S97.907,122,115,122z" />
                    </g>
                  </svg>
                </div>
                <div className="text-center">
                  <h3 className="text-3xl font-bold text-white mb-2">Single</h3>
                  <p className="text-emerald-200">Perfect for selfies</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => {
                setPhotoMode("triple");
                setState("camera");
              }}
              className="group p-8 bg-gradient-to-br from-blue-500/20 to-indigo-600/20 border-2 border-blue-500/30 rounded-3xl hover:scale-105 hover:border-blue-400/50 transition-all duration-300 backdrop-blur-sm"
            >
              <div className="flex flex-col items-center space-y-6">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <svg
                    version="1.1"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 391.377 391.377"
                    fill="white"
                    className="w-8 h-8"
                  >
                    <g>
                      <path
                        d="M387.456,91.78c-3.739-6.178-9.648-10.526-16.638-12.245L162.499,28.298c-2.106-0.519-4.27-0.781-6.433-0.781
                      c-12.471,0-23.259,8.45-26.235,20.551l-6.271,25.498L19.405,106.616c-13.918,4.416-22.089,18.982-18.602,33.163l50.1,203.696
                      c1.733,7.046,6.122,12.958,12.358,16.647c4.182,2.474,8.837,3.737,13.564,3.737c2.324,0,4.667-0.306,6.977-0.923l160.436-42.907
                      l63.58,15.638c2.106,0.519,4.271,0.781,6.435,0.781c12.471,0,23.259-8.451,26.233-20.55l50.102-203.698
                      C392.307,105.211,391.195,97.959,387.456,91.78z M79.246,333.102L30.421,134.595l84.742-26.89L79.732,251.763
                      c-1.721,6.99-0.608,14.243,3.131,20.422c3.738,6.178,9.646,10.527,16.639,12.247l84.249,20.721L79.246,333.102z M335.706,209.731
                      l-28.492-43.88c-3.492-5.379-9.295-8.59-15.523-8.59c-4.229,0-8.271,1.438-11.69,4.157l-60.656,48.255
                      c-1.882,1.497-3.724,3.642-5.06,6.452l-20.342,39.006l119.878-31.859L335.706,209.731z"
                      />
                    </g>
                  </svg>
                </div>
                <div className="text-center">
                  <h3 className="text-3xl font-bold text-white mb-2">Burst</h3>
                  <p className="text-blue-200">Photo booth vibes</p>
                </div>
              </div>
            </button>
          </div>

          <div className="mt-12 flex justify-center space-x-6">
            <button
              onClick={() => setState("landing")}
              className="bg-gray-800 text-white px-6 py-3 rounded-md hover:bg-gray-700 transition"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (state === "camera") {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
        <div className="relative inline-block">
          <video
            ref={videoRef}
            className="max-w-full max-h-[80vh] rounded-lg shadow-xl border-4 border-white"
            autoPlay
            muted
            playsInline
            style={{ transform: "scaleX(-1)" }}
          />
        </div>

        <canvas ref={canvasRef} style={{ display: "none" }} />

        <div className="mt-6 flex space-x-6">
          <button
            onClick={() => {
              if (!isCapturing) startCountdown();
            }}
            disabled={isCapturing}
            className="group relative inline-flex items-center justify-center w-24 h-24 bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 rounded-full hover:scale-110 active:scale-95 transition-all duration-300 shadow-2xl hover:shadow-purple-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Take photo(s)"
          >
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-pink-400 to-purple-500 opacity-0 group-hover:opacity-20 transition-opacity duration-300"></div>

            {countdown !== null ? (
              <span className="text-white text-4xl font-bold relative z-10 animate-pulse">
                {countdown}
              </span>
            ) : (
              <Camera className="w-10 h-10 text-white relative z-10" />
            )}
          </button>
        </div>
      </div>
    );
  }

  if (state === "result") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex flex-col items-center justify-center p-4">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-800/20 via-transparent to-transparent"></div>
        <h2 className="shiny-text text-4xl font-bold text-white mb-6">
          Photo Booth
        </h2>
        <FilmStripPreview />

        <div className="mt-8 flex space-x-6">
          <button
            onClick={downloadPhotos}
            disabled={isDownloading}
            className="group relative inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 rounded-full hover:scale-105 active:scale-95 transition-all duration-300 shadow-2xl hover:shadow-purple-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Download photos"
          >
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-pink-400 to-purple-500 opacity-0 group-hover:opacity-20 transition-opacity duration-300"></div>

            {isDownloading ? (
              <span className="text-white font-bold text-lg relative z-10 animate-pulse">
                Downloading...
              </span>
            ) : (
              <>
                <Download className="w-6 h-6 text-white relative z-10 mr-2" />
                <span className="text-white font-bold text-lg relative z-10">
                  Download
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  return null;
}

export default App;

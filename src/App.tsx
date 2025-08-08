import React, { useState, useRef, useEffect } from "react";
import { Camera, Download, ArrowLeft } from "lucide-react";

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

  // Start camera
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
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().catch(console.error);
          };
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

  // Capture one photo
  const capturePhoto = (): string | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1); // mirror horizontally
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.9);
  };

  // Countdown capture
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

      // Flash effect
      const flashDiv = document.createElement("div");
      flashDiv.style.position = "fixed";
      flashDiv.style.top = "0";
      flashDiv.style.left = "0";
      flashDiv.style.width = "100%";
      flashDiv.style.height = "100%";
      flashDiv.style.backgroundColor = "white";
      flashDiv.style.opacity = "0.9";
      flashDiv.style.zIndex = "9999";
      flashDiv.style.pointerEvents = "none";
      document.body.appendChild(flashDiv);

      const dataUrl = capturePhoto();
      if (dataUrl) photos.push({ dataUrl, timestamp: Date.now() });

      setTimeout(() => {
        if (document.body.contains(flashDiv)) {
          document.body.removeChild(flashDiv);
        }
      }, 150);

      if (i < photoCount - 1) {
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
    setCapturedPhotos(photos);
    setState("result");
    setIsCapturing(false);
  };

  // Download single or strip
  const downloadPhotos = async () => {
    if (capturedPhotos.length === 0 || isDownloading) return;
    setIsDownloading(true);
    try {
      const holeSize = 10;
      const framePadding = 20;
      const photoWidth = 400;
      const photoHeight = 300;

      let totalWidth = photoWidth + framePadding * 2 + holeSize * 2;
      let totalHeight;

      if (photoMode === "single") {
        totalHeight = photoHeight + framePadding * 2;
      } else {
        // Triple stacked vertically
        totalHeight =
          capturedPhotos.length * (photoHeight + framePadding) + framePadding;
      }

      const canvas = document.createElement("canvas");
      canvas.width = totalWidth;
      canvas.height = totalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Draw film strip background
      ctx.fillStyle = "#111";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw white photo area
      ctx.fillStyle = "white";
      ctx.fillRect(holeSize, 0, canvas.width - holeSize * 2, canvas.height);

      // Draw film strip holes
      ctx.fillStyle = "#111";
      const holeSpacing = totalHeight / 6;
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.arc(holeSize / 2, holeSpacing * (i + 1), holeSize / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(canvas.width - holeSize / 2, holeSpacing * (i + 1), holeSize / 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw photos
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
          photoHeight
        );

        // Add timestamp with proper spacing
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.font = "16px monospace";
        ctx.textAlign = "center";
        ctx.fillText(
          new Date(capturedPhotos[i].timestamp).toLocaleDateString(),
          canvas.width / 2,
          framePadding + i * (photoHeight + framePadding) + photoHeight + 16
        );
      }

      const finalDataUrl = canvas.toDataURL("image/jpeg", 0.9);
      const link = document.createElement("a");
      link.href = finalDataUrl;
      link.download = `photo-booth-${photoMode}-${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Auto return to start after download
      setTimeout(() => {
        resetApp();
      }, 1000);
    } catch (err) {
      console.error("Download error:", err);
      alert("Download failed");
    } finally {
      setIsDownloading(false);
    }
  };

  // FilmStripPreview component
  const FilmStripPreview = () => (
    <div className="bg-gray-900 p-4 rounded-lg shadow-2xl max-w-md mx-auto">
      <div className="bg-white p-2 rounded flex flex-col space-y-2">
        {capturedPhotos.map((p, i) => (
          <img
            key={i}
            src={p.dataUrl}
            alt={`Photo ${i + 1}`}
            className="w-full object-contain rounded"
          />
        ))}
      </div>
    </div>
  );


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
            <p className="text-xl text-purple-200 font-light">capture the moment</p>
          </div>

          <div className="flex justify-center">
            <button
              onClick={() => setState("frame-selection")}
              className="group relative inline-flex items-center justify-center w-24 h-24 bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 rounded-full hover:scale-110 active:scale-95 transition-all duration-300 shadow-2xl hover:shadow-purple-500/25"
            >
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-pink-400 to-purple-500 opacity-0 group-hover:opacity-20 transition-opacity duration-300"></div>
              <Camera className="w-10 h-10 text-white relative z-10" />
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
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">Choose A Style</h2>
            <p className="text-purple-200 text-lg">Select an experience</p>
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
                  <Camera className="w-8 h-8 text-white" />
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
                  <div className="grid grid-cols-1 gap-1">
                    <div className="w-6 h-2 bg-white rounded-sm"></div>
                    <div className="w-6 h-2 bg-white rounded-sm"></div>
                    <div className="w-6 h-2 bg-white rounded-sm"></div>
                  </div>
                </div>
                <div className="text-center">
                  <h3 className="text-3xl font-bold text-white mb-2">Burst</h3>
                  <p className="text-blue-200">Classic booth experience</p>
                </div>
              </div>
            </button>
          </div>

        </div>
      </div>
    );
  }

  if (state === "camera") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-lg">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-white mb-2">
              {photoMode === "single" ? "Get Ready for Your Selfie!" : "Strike a Pose!"}
            </h2>
            <p className="text-purple-200">
              {photoMode === "triple" ? "3 photos coming up" : "1 perfect shot"}
            </p>
          </div>

          <div className="relative rounded-2xl overflow-hidden shadow-2xl bg-black">
            <video
              ref={videoRef}
              className="w-full aspect-video object-cover scale-x-[-1]"
              playsInline
              muted
              autoPlay
            />
            {countdown && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                <div className="text-white text-8xl md:text-9xl font-bold animate-pulse">{countdown}</div>
              </div>
            )}
            {isCapturing && !countdown && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <div className="text-white text-2xl font-medium">Say Cheese! 📸</div>
              </div>
            )}
          </div>

          <div className="flex justify-center mt-8 space-x-4">
            <button
              disabled={isCapturing}
              onClick={startCountdown}
              className={`w-20 h-20 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full hover:scale-110 active:scale-95 transition-all duration-200 shadow-lg flex items-center justify-center ${
                isCapturing ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
              }`}
              aria-label="Take photo"
            >
              <Camera className="w-8 h-8 text-white" />
            </button>
          </div>

          <canvas ref={canvasRef} className="hidden" />
        </div>
      </div>
    );
  }

  if (state === "result") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-lg space-y-8">
          <h2 className="text-4xl font-bold text-white text-center mb-6">Your Photos</h2>

          <FilmStripPreview />

          <div className="flex justify-center space-x-4">
            <button
              onClick={downloadPhotos}
              disabled={isDownloading}
              className="px-8 py-3 bg-green-600 hover:bg-green-700 rounded-xl text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              <Download className="w-5 h-5" />
              <span>{isDownloading ? "Downloading..." : "Download"}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export default App;

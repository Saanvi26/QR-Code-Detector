import React, { useState, useEffect, useRef } from "react";
import "./App.css";

const PRIMARY_TABS = [
  { id: "url", label: "URL Safety" },
  { id: "upload", label: "Upload QR" },
  { id: "scan", label: "Live Scanner" }
];

function App() {
  // page state (home / test)
  const [page, setPage] = useState("home");

  // tab + URL states
  const [activeTab, setActiveTab] = useState("url");
  const [urlInput, setUrlInput] = useState("");
  const [urlResult, setUrlResult] = useState(null);
  const [urlLoading, setUrlLoading] = useState(false);

  // QR upload states
  const [qrFile, setQrFile] = useState(null);
  const [qrPreview, setQrPreview] = useState(null);
  const [qrResult, setQrResult] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);

  // camera / scanner
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [scanStatus, setScanStatus] = useState("idle");

  // --------------------
  // CAMERA HANDLING
  // --------------------
  useEffect(() => {
    if (activeTab === "scan") startCamera();
    else stopCamera();

    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const startCamera = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setScanStatus("unsupported");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      streamRef.current = stream;
      setScanStatus("active");
    } catch (err) {
      console.error("Camera start error:", err);
      setScanStatus("blocked");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      try {
        videoRef.current.srcObject = null;
      } catch {}
    }
    setScanStatus("idle");
  };

  // --------------------
  // URL SAFETY CHECK
  // --------------------
  const handleUrlCheck = async () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;

    setUrlLoading(true);
    setUrlResult(null);

    try {
      const res = await fetch("http://localhost:5000/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed })
      });

      const data = await res.json();

      if (!res.ok) {
        // support backend returning { detail: "..." } or { error: "..." }
        const errMsg = data?.detail || data?.error || "Prediction failed";
        throw new Error(errMsg);
      }

      // normalize shape (backend returns: url, prediction, verdict, confidence, message)
      setUrlResult({
        ...data,
        error: false
      });
    } catch (err) {
      console.error("URL check error:", err);
      setUrlResult({
        verdict: "Error",
        details: err.message || "Network error",
        error: true
      });
    } finally {
      setUrlLoading(false);
    }
  };

  // --------------------
  // QR UPLOAD
  // --------------------
  const handleQrUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setQrResult({ verdict: "Error", details: "Upload a valid image.", error: true });
      return;
    }

    setQrFile(file);
    setQrResult(null);

    const reader = new FileReader();
    reader.onloadend = () => setQrPreview(reader.result);
    reader.readAsDataURL(file);
  };

  // --------------------
  // ANALYZE QR CODE
  // --------------------
  const analyzeQr = async () => {
    if (!qrFile) return;

    setQrLoading(true);
    setQrResult(null);

    try {
      const form = new FormData();
      form.append("file", qrFile);

      // 1) decode
      const decodeRes = await fetch("http://localhost:5000/decode", {
        method: "POST",
        body: form
      });
      const decodeData = await decodeRes.json();

      if (!decodeRes.ok) {
        const errMsg = decodeData?.detail || decodeData?.error || "Failed to decode QR";
        throw new Error(errMsg);
      }

      const decodedUrl = decodeData.url;
      if (!decodedUrl) throw new Error("Decoded QR did not contain a URL");

      // 2) predict
      const predictRes = await fetch("http://localhost:5000/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: decodedUrl })
      });
      const predictData = await predictRes.json();

      if (!predictRes.ok) {
        const errMsg = predictData?.detail || predictData?.error || "Prediction failed";
        throw new Error(errMsg);
      }

      // include decodedUrl for easier UI rendering
      setQrResult({
        ...predictData,
        decodedUrl,
        error: false
      });
    } catch (err) {
      console.error("QR analyze error:", err);
      setQrResult({
        verdict: "Error",
        details: err.message || "Failed to analyze QR",
        error: true
      });
    } finally {
      setQrLoading(false);
    }
  };

  // Home hero panel
  const renderHome = () => (
    <section className="hero">
      <div className="hero-text">
        <p className="eyebrow">Trusted QR Intelligence</p>
        <h1>Scan smart, stay safe.</h1>
        <p className="lead">
          SentinelQR inspects URLs and QR codes in real-time so you know exactly
          where a code leads before you scan. Block malicious redirects, catch
          phishing attempts, and keep every interaction secure.
        </p>
        <div className="hero-cta">
          <button className="primary" onClick={() => setPage("test")}>
            Start Testing
          </button>
        </div>
        <div className="stats">
          <div>
            <span>2M+</span>
            <p>QRs inspected</p>
          </div>
          <div>
            <span>97.6%</span>
            <p>Malware Detection Accuracy</p>
          </div>
        </div>
      </div>
      <div className="hero-card">
        <p className="card-label">Live Insight</p>
        <div className="pulse" />
        <h3>Zero-trust QR defense</h3>
        <p>
          Every scan is vetted against threat feeds, sandboxing, and proprietary
          AI heuristics.
        </p>
        <ul>
          <li>URL sandbox preview</li>
          <li>Metadata fingerprinting</li>
          <li>Camera-based scanning</li>
        </ul>
      </div>
    </section>
  );

  // Test hub with tabs
  const renderTest = () => (
    <section className="test-hub">
      <div className="tab-bar">
        {PRIMARY_TABS.map((tab) => (
          <button
            key={tab.id}
            className={`tab ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="panel">
        {activeTab === "url" && (
          <div className="panel-content">
            <h3>Paste a URL from a QR code</h3>
            <p>We flag obvious red flags instantly before deeper backend scans.</p>
            <div className="url-checker">
              <input
                type="text"
                placeholder="https://example.com/promo"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleUrlCheck()}
              />
              <button
                onClick={handleUrlCheck}
                disabled={urlLoading || !urlInput.trim()}
              >
                {urlLoading ? "Analyzing..." : "Check safety"}
              </button>
            </div>

            {urlResult && (
              <div
                className={`result-card ${
                  urlResult.error
                    ? "error"
                    : urlResult.verdict === "malicious"
                    ? "malicious"
                    : "safe"
                }`}
              >
                <p className="result-label">
                  {urlResult.error
                    ? urlResult.verdict
                    : urlResult.verdict === "malicious"
                    ? "⚠️ Malicious URL Detected"
                    : "✅ Safe URL"}
                </p>

                {!urlResult.error && (
                  <>
                    <p style={{ marginBottom: "0.5rem" }}>
                      <strong>URL:</strong> {urlResult.url}
                    </p>
                    <h4>{urlResult.message}</h4>
                    {/* {typeof urlResult.confidence !== "undefined" && (
                      <p style={{ marginTop: "0.5rem", fontSize: "0.9rem" }}>
                        <strong>Confidence:</strong> {urlResult.confidence}%
                      </p>
                    )} */}
                  </>
                )}

                {urlResult.error && <p>{urlResult.details}</p>}
              </div>
            )}
          </div>
        )}

        {activeTab === "upload" && (
          <div className="panel-content">
            <h3>Upload a QR image</h3>
            <p>Drop a snapshot or screenshot to analyze metadata and content.</p>
            <label className="upload-tile">
              <input type="file" accept="image/*" onChange={handleQrUpload} />
              <span>Choose QR image</span>
            </label>

            {qrPreview && (
              <div className="preview-wrapper">
                <img src={qrPreview} alt="QR preview" />
                <button onClick={analyzeQr} disabled={qrLoading}>
                  {qrLoading ? "Analyzing..." : "Run quick scan"}
                </button>
              </div>
            )}

            {qrResult && (
              <div
                className={`result-card ${
                  qrResult.error
                    ? "error"
                    : qrResult.verdict === "malicious"
                    ? "malicious"
                    : "safe"
                }`}
              >
                <p className="result-label">
                  {qrResult.error
                    ? qrResult.verdict
                    : qrResult.verdict === "malicious"
                    ? "⚠️ Malicious QR Code Detected"
                    : "✅ Safe QR Code"}
                </p>

                {!qrResult.error && (
                  <>
                    <h4>{qrResult.message}</h4>
                    {/* {typeof qrResult.confidence !== "undefined" && (
                      // <p style={{ marginTop: "0.5rem", fontSize: "0.9rem" }}>
                      //   <strong>Confidence:</strong> {qrResult.confidence}%
                      // </p>
                    )} */}
                  </>
                )}

                {qrResult.error && (
                  <>
                    <p>{qrResult.details}</p>
                    {qrResult.decodedUrl && (
                      <p style={{ marginTop: "0.5rem", fontSize: "0.9rem" }}>
                        <strong>Decoded URL:</strong> {qrResult.decodedUrl}
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === "scan" && (
          <div className="panel-content">
            <h3>Point-and-scan with your camera</h3>
            <p>
              We never store footage. Grant access to preview the QR payload
              before opening it.
            </p>
            <div className={`scanner ${scanStatus}`}>
              <video ref={videoRef} autoPlay muted playsInline width="300" />
              <div className="scanner-overlay">
                <span />
              </div>
            </div>
            <div className="scan-status">
              {scanStatus === "active" && "Scanner is live—center the QR code."}
              {scanStatus === "idle" && "Enable the scanner to begin."}
              {scanStatus === "blocked" &&
                "Camera blocked. Update your browser permissions."}
              {scanStatus === "unsupported" &&
                "Camera API not supported on this device."}
            </div>
          </div>
        )}
      </div>
    </section>
  );

  return (
    <div className="app-shell">
      <header className="top-nav">
        <div className="brand">
          <span className="dot" />
          SentinelQR
        </div>
        <nav>
          <button
            className={page === "home" ? "active" : ""}
            onClick={() => setPage("home")}
          >
            Home
          </button>
          <button
            className={page === "test" ? "active" : ""}
            onClick={() => setPage("test")}
          >
            Test
          </button>
        </nav>
      </header>

      <main>{page === "home" ? renderHome() : renderTest()}</main>

      <footer>
        <p>© {new Date().getFullYear()} SentinelQR Labs. Built for safer scans.</p>
      </footer>
    </div>
  );
}

export default App;

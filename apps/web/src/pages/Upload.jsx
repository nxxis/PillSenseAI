import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../lib/api';

export default function Upload() {
  const [imagePreview, setImagePreview] = useState(null);
  const [file, setFile] = useState(null);
  const [phase, setPhase] = useState('idle'); // idle | uploading | processing
  const [uploadPct, setUploadPct] = useState(0);
  const [ocrPct, setOcrPct] = useState(0);
  const pollRef = useRef(null);
  const navigate = useNavigate();

  const getToken = () => localStorage.getItem('ps_token') || '';

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setUploadPct(0);
    setOcrPct(0);
    setPhase('idle');
    const url = URL.createObjectURL(f);
    setImagePreview(url);
  };

  const continueOcr = async () => {
    if (!file) return;

    setPhase('uploading');
    setUploadPct(0);

    try {
      const formData = new FormData();
      formData.append('image', file);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_URL}/ocr/start`, true);

      // 🔐 JWT header
      const token = getToken();
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

      xhr.upload.onprogress = (evt) => {
        if (evt.lengthComputable) {
          const pct = Math.round((evt.loaded / evt.total) * 100);
          setUploadPct(pct);
        }
      };

      xhr.onreadystatechange = () => {
        if (xhr.readyState === 4) {
          if (xhr.status >= 200 && xhr.status < 300) {
            const { jobId } = JSON.parse(xhr.responseText);
            startPolling(jobId);
          } else {
            setPhase('idle');
            alert(
              'Upload failed (auth or server). Are you logged in and is the API running?'
            );
          }
        }
      };

      xhr.send(formData);
    } catch (e) {
      console.error(e);
      setPhase('idle');
      alert('Network error.');
    }
  };

  const startPolling = (jobId) => {
    setPhase('processing');
    setOcrPct(1);

    const poll = async () => {
      try {
        // 🔐 Include JWT on status poll
        const token = getToken();
        const r = await fetch(`${API_URL}/ocr/status/${jobId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        if (!data.ok) throw new Error(data.error || 'status_error');

        setOcrPct(Math.max(1, data.percent || 0));

        if (data.done) {
          clearInterval(pollRef.current);
          pollRef.current = null;

          if (data.error) {
            setPhase('idle');
            alert('OCR failed. Please try another photo.');
            return;
          }

          navigate('/result', {
            state: {
              imageUrl: imagePreview,
              parsed: data.data,
            },
          });
        }
      } catch (e) {
        console.error('poll error', e);
      }
    };

    pollRef.current = setInterval(poll, 400);
    poll();
  };

  return (
    <section className="card">
      <h2>Upload or snap a label</h2>

      <label className="file-picker">
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={onFile}
        />
        <span>Select / Take a Photo</span>
      </label>

      {imagePreview && (
        <div className="preview">
          <img src={imagePreview} alt="Label preview" />
        </div>
      )}

      {phase !== 'idle' && (
        <>
          <p style={{ textAlign: 'center', fontSize: 14, marginBottom: 4 }}>
            Processing...
          </p>
          <div className="progress">
            <div
              className="bar"
              style={{
                width: `${phase === 'uploading' ? uploadPct : ocrPct}%`,
              }}
            />
          </div>
          <p className="muted" style={{ fontSize: 14, textAlign: 'center' }}>
            {phase === 'uploading' ? uploadPct : ocrPct}%
          </p>
        </>
      )}

      <button
        className="btn"
        disabled={!file || phase !== 'idle'}
        onClick={continueOcr}
      >
        {phase === 'idle' ? 'Continue' : 'Working…'}
      </button>
    </section>
  );
}

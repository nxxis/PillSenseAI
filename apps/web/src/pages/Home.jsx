import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <section className="card">
      <h1>Safer meds in seconds</h1>
      <p>
        Snap a prescription label. We’ll check for interactions and explain
        risks in plain language.
      </p>
      <Link to="/upload" className="btn">
        Get started
      </Link>

      <div className="features">
        <div className="feature">
          <h3>OCR + Parse</h3>
          <p>Extract drug, dose, and frequency from the label.</p>
        </div>
        <div className="feature">
          <h3>Interaction Check</h3>
          <p>Flag risky combos (e.g., Warfarin × Ibuprofen).</p>
        </div>
        <div className="feature">
          <h3>Plain-language Advice</h3>
          <p>Clear guidance powered by AI.</p>
        </div>
      </div>
    </section>
  );
}

import { Link } from 'react-router-dom';
import ocrParseImg from '../assets/ocr+prase.png';      // For OCR + Parse
import interactionImg from '../assets/123.png';       // For Interaction Check
import adviceImg from '../assets/9289709.png';        // For Plain-language Advice

export default function Home() {
  return (
    <section className="dashboard home-banner">
      <div className="home-banner-header">
        <h1>Our Features</h1>
        <p className="home-banner-subtitle">
          Next-level medication safety and clarity you'll love
        </p>
      </div>
      <div className="home-banner-cards">
        <div className="home-banner-card">
          <img src={ocrParseImg} alt="OCR + Parse" className="home-banner-img" />
          <h2>OCR + Parse</h2>
          <p>Extract drug, dose, and frequency from your prescription label.</p>
          <Link to="/upload" className="home-banner-btn">
            Try OCR
          </Link>
        </div>
        <div className="home-banner-card">
          <img src={interactionImg} alt="Interaction Check" className="home-banner-img" />
          <h2>Interaction Check</h2>
          <p>Flag risky combinations and get instant safety alerts.</p>
          <Link to="/upload" className="home-banner-btn">
            Check Interactions
          </Link>
        </div>
        <div className="home-banner-card">
          <img src={adviceImg} alt="Plain-language Advice" className="home-banner-img" />
          <h2>Plain-language Advice</h2>
          <p>Clear, AI-powered guidance for your medications.</p>
          <Link to="/upload" className="home-banner-btn">
            Get Advice
          </Link>
        </div>
      </div>
    </section>
  );
}

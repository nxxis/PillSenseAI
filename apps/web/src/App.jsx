import { Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
import Home from './pages/Home.jsx';
import Upload from './pages/Upload.jsx';
import Result from './pages/Result.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Profile from './pages/Profile.jsx';
import Meds from './pages/Meds.jsx'; // <-- add
import PrivateRoute from './components/PrivateRoute.jsx';

export default function App() {
  return (
    <div className="app">
      <Header />
      <main className="container">
        <Routes>
          {/* Public */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected */}
          <Route element={<PrivateRoute />}>
            <Route path="/profile" element={<Profile />} />
            <Route path="/upload" element={<Upload />} />
            <Route path="/result" element={<Result />} />
            <Route path="/meds" element={<Meds />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

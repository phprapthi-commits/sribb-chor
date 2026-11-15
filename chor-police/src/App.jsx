// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import HomePage from './pages/HomePage';
import LobbyPage from './pages/LobbyPage';
import GamePage from './pages/GamePage';

export default function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: 'rgba(45,16,87,0.95)',
            color: 'white',
            border: '1px solid rgba(139,92,246,0.4)',
            borderRadius: '12px',
          },
        }}
      />
      <Routes>
        <Route path="/"      element={<HomePage />} />
        <Route path="/lobby" element={<LobbyPage />} />
        <Route path="/game"  element={<GamePage />} />
        <Route path="*"      element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

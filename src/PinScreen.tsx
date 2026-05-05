import React, { useState, useEffect } from 'react';
import './PinScreen.css';

export default function PinScreen({ userId, onUnlock, onReset }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [mode, setMode] = useState('loading'); 

  // Create a unique storage key for THIS specific user
  const storageKey = `appPin_${userId}`;

  useEffect(() => {
    const savedPin = localStorage.getItem(storageKey);
    if (savedPin) {
      setMode('verify');
    } else {
      setMode('setup');
    }
  }, [storageKey]);

  const handleNumberClick = (num) => {
    if (pin.length < 4) {
      const newPin = pin + num;
      setPin(newPin);
      setError(false);

      if (newPin.length === 4) {
        processPin(newPin);
      }
    }
  };

  const processPin = (enteredPin) => {
    if (mode === 'setup') {
      localStorage.setItem(storageKey, enteredPin);
      onUnlock();
    } else if (mode === 'verify') {
      const savedPin = localStorage.getItem(storageKey);
      if (enteredPin === savedPin) {
        onUnlock(); 
      } else {
        setError(true); 
        setPin(''); 
      }
    }
  };

  const handleDelete = () => {
    setPin(pin.slice(0, -1));
    setError(false);
  };

  if (mode === 'loading') return <div className="pin-container">Loading secure environment...</div>;

  return (
    <div className="pin-container">
      <div className="pin-header">
        <h2>{mode === 'setup' ? 'Set up a 4-Digit PIN' : 'Enter PIN'}</h2>
        <p>{mode === 'setup' ? 'This protects your ledger on this device.' : 'Welcome back.'}</p>
      </div>

      <div className={`pin-display ${error ? 'error-shake' : ''}`}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className={`pin-dot ${i < pin.length ? 'filled' : ''}`} />
        ))}
      </div>
      
      {error && <p className="error-text">Incorrect PIN. Try again.</p>}

      <div className="number-pad">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
          <button key={num} onClick={() => handleNumberClick(num.toString())} className="pad-btn">
            {num}
          </button>
        ))}
        <button className="pad-btn empty"></button>
        <button onClick={() => handleNumberClick('0')} className="pad-btn">0</button>
        <button onClick={handleDelete} className="pad-btn delete">⌫</button>
      </div>

      {mode === 'verify' && (
        <button onClick={onReset} className="forgot-pin-btn">
          Forgot PIN? Log out and reset.
        </button>
      )}
    </div>
  );
}

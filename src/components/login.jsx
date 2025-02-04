import React from 'react';
import Button from '@mui/material/Button';

export default function Login() {
  const handleLogin = () => {
    window.location.href = 'http://localhost:1337/goto/auth';
  };

  return (
    <div className="login-container">
      <h1>Call Logs Dashboard</h1>
      <Button 
        variant="contained" 
        size="large"
        onClick={handleLogin}
      >
        Login with GoTo
      </Button>
    </div>
  );
}
import React, { useEffect, useState } from "react";

const AuthButton = () => {
  const [accessToken, setAccessToken] = useState(localStorage.getItem("accessToken"));

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const authCode = urlParams.get("code");

    if (authCode) {
      // إرسال الكود للسيرفر للحصول على الـ access token
      fetch("http://localhost:1337/goto/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code: authCode }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.access_token) {
            localStorage.setItem("accessToken", data.access_token);
            setAccessToken(data.access_token);

            // مسح الـ code من الـ URL بعد نجاح التوثيق
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        })
        .catch((error) => console.error("Error fetching access token:", error));
    }
  }, []);

  const handleAuth = () => {
    window.location.href = "http://localhost:1337/goto/auth"; // التوجيه إلى صفحة التوثيق
  };

  return (
    <div>
      <button onClick={handleAuth}>Authenticate with GoTo</button>
      {accessToken && <p>Authenticated! Token: {accessToken}</p>}
    </div>
  );
};


export default AuthButton;

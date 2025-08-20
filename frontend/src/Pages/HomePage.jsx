import { useState,useEffect } from 'react'

function HomePage(){
    const [message,setMessage] = useState("")

useEffect(() => {
  const fetchResponse = async () => {
    try {
      const response = await fetch("/api/hello");
      if (!response.ok) throw new Error("Network response was not ok");

      const data = await response.json();
      setMessage(data.message);
    } catch (error) {
      console.error("Fetch error:", error);
      setMessage("Failed to fetch from backend");
    }
  };
  fetchResponse();
}, []);

    return(
        <>
            <h1>This is the Home Page</h1>
            <h2>{message}</h2>
        </>
    )
}

export default HomePage;
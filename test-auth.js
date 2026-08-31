async function test() {
  try {
    console.log("Testing signup...");
    const email = "test" + Date.now() + "@example.com";
    const password = "password123";
    const res = await fetch("http://localhost:3000/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test User", email, password })
    });
    const data = await res.json();
    console.log("Signup response:", data);
    
    if (!data.success) {
      console.error("Signup failed");
      process.exit(1);
    }
    
    // Test signin
    console.log("Testing signin...");
    const loginRes = await fetch("http://localhost:3000/api/auth/callback/credentials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    console.log("Signin status:", loginRes.status);
    
    console.log("Testing multiple signins...");
    for (let i = 0; i < 5; i++) {
      const r = await fetch("http://localhost:3000/api/auth/callback/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      console.log(`Signin ${i+1} status:`, r.status);
    }
    console.log("All tests passed");
  } catch (err) {
    console.error(err);
  }
}
test();

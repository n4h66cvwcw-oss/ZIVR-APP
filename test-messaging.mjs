import { io } from "socket.io-client";

const BASE = "https://echo-stream.replit.app/api";

async function register(name) {
  const res = await fetch(`${BASE}/users/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ displayName: name }),
  });
  return res.json();
}

async function main() {
  console.log("Registering two test users...");
  const userA = await register("Test User A");
  const userB = await register("Test User B");
  console.log("User A:", userA.user.id);
  console.log("User B:", userB.user.id);

  console.log("Creating direct chat...");
  const chatRes = await fetch(`${BASE}/chats/direct`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Auth-Token": userA.authToken,
    },
    body: JSON.stringify({ myUserId: userA.user.id, theirUserId: userB.user.id }),
  });
  const chatData = await chatRes.json();
  const chatId = chatData.chatId;
  console.log("Chat ID:", chatId);

  const socketA = io(BASE, { path: "/api/socket.io", auth: { token: userA.authToken } });
  const socketB = io(BASE, { path: "/api/socket.io", auth: { token: userB.authToken } });

  await new Promise((resolve) => {
    let ready = 0;
    const check = () => { if (++ready === 2) resolve(); };
    socketA.on("connect", () => { socketA.emit("user:join", { userId: userA.user.id }); check(); });
    socketB.on("connect", () => { socketB.emit("user:join", { userId: userB.user.id }); check(); });
  });

  socketA.emit("chat:join", chatId);
  socketB.emit("chat:join", chatId);

  socketB.on("message:new", (msg) => {
    console.log("\n✅ SUCCESS — User B received in real time:", msg.text);
    process.exit(0);
  });

  socketA.on("error", (e) => console.log("Socket A error:", e));
  socketB.on("error", (e) => console.log("Socket B error:", e));

  setTimeout(() => {
    console.log("Sending message from User A -> User B...");
    socketA.emit("message:send", {
      chatId,
      senderId: userA.user.id,
      text: "Hello from the test script!",
      type: "text",
    });
  }, 1000);

  setTimeout(() => {
    console.log("\n❌ TIMEOUT — message was not received within 8 seconds.");
    process.exit(1);
  }, 8000);
}

main();

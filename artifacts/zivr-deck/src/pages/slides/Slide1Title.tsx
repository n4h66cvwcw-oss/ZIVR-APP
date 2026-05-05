const base = import.meta.env.BASE_URL;

export default function Slide1Title() {
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        backgroundColor: "#0A0E1A",
        fontFamily: "'Space Grotesk', sans-serif",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "flex-start",
        position: "relative",
        color: "#FFFFFF",
      }}
    >
      <img
        src={`${base}hero-messaging.png`}
        crossOrigin="anonymous"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity: 0.22,
        }}
        alt=""
      />

      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          background: "linear-gradient(105deg, rgba(10,14,26,0.97) 45%, rgba(10,14,26,0.4) 100%)",
        }}
      />

      <div
        style={{
          position: "absolute",
          top: "-20vh",
          right: "-8vw",
          width: "55vw",
          height: "55vw",
          borderRadius: "50%",
          backgroundColor: "#7B5EA7",
          opacity: 0.07,
          filter: "blur(10vw)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-15vh",
          left: "30vw",
          width: "40vw",
          height: "40vw",
          borderRadius: "50%",
          backgroundColor: "#4F7FFF",
          opacity: 0.06,
          filter: "blur(9vw)",
        }}
      />

      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          backgroundImage: "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
          backgroundSize: "4vw 4vw",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "absolute",
          top: "5vh",
          left: "5.5vw",
          display: "flex",
          alignItems: "center",
          gap: "0.9vw",
          zIndex: 10,
        }}
      >
        <div
          style={{
            width: "2.2vw",
            height: "2.2vw",
            background: "linear-gradient(135deg, #7B5EA7, #4F7FFF)",
            borderRadius: "0.45vw",
          }}
        />
        <span style={{ fontSize: "1.2vw", fontWeight: 700, letterSpacing: "-0.01em" }}>ZIVR</span>
      </div>

      <div
        style={{
          position: "relative",
          zIndex: 10,
          paddingLeft: "5.5vw",
          maxWidth: "58vw",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "0.6vh 1.3vw",
            backgroundColor: "rgba(123, 94, 167, 0.18)",
            border: "1px solid rgba(123, 94, 167, 0.4)",
            borderRadius: "2vw",
            color: "#B89DD4",
            fontSize: "0.95vw",
            fontWeight: 600,
            marginBottom: "4vh",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          Private Messaging, Reimagined
        </div>

        <h1
          style={{
            fontSize: "7.5vw",
            fontWeight: 800,
            margin: "0 0 3vh 0",
            lineHeight: 1.0,
            letterSpacing: "-0.04em",
          }}
        >
          ZIVR
        </h1>

        <p
          style={{
            fontSize: "1.7vw",
            fontWeight: 300,
            color: "rgba(255,255,255,0.65)",
            margin: "0 0 5vh 0",
            lineHeight: 1.55,
            maxWidth: "44vw",
            textWrap: "pretty",
          }}
        >
          The next generation of private, expressive messaging.
          Secure by design. Built for real conversations.
        </p>

        <div style={{ display: "flex", gap: "2.5vw" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.6vw",
              padding: "1vh 1.5vw",
              backgroundColor: "rgba(255,255,255,0.06)",
              borderRadius: "0.4vw",
              fontSize: "1vw",
              color: "rgba(255,255,255,0.75)",
            }}
          >
            <span style={{ color: "#7B5EA7", fontSize: "1.1vw" }}>&#128274;</span>
            AES-256 Encrypted
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.6vw",
              padding: "1vh 1.5vw",
              backgroundColor: "rgba(255,255,255,0.06)",
              borderRadius: "0.4vw",
              fontSize: "1vw",
              color: "rgba(255,255,255,0.75)",
            }}
          >
            <span style={{ color: "#4F7FFF", fontSize: "1.1vw" }}>&#9654;</span>
            iOS App Store
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.6vw",
              padding: "1vh 1.5vw",
              backgroundColor: "rgba(255,255,255,0.06)",
              borderRadius: "0.4vw",
              fontSize: "1vw",
              color: "rgba(255,255,255,0.75)",
            }}
          >
            <span style={{ color: "#B89DD4", fontSize: "1.1vw" }}>&#9733;</span>
            Real-time Messaging
          </div>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: "5vh",
          left: "5.5vw",
          fontSize: "0.85vw",
          color: "rgba(255,255,255,0.3)",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        ZIVR, INC. — 2026
      </div>

      <div
        style={{
          position: "absolute",
          bottom: "5vh",
          right: "5vw",
          fontSize: "0.85vw",
          color: "rgba(255,255,255,0.3)",
          letterSpacing: "0.05em",
        }}
      >
        01 / 08
      </div>
    </div>
  );
}

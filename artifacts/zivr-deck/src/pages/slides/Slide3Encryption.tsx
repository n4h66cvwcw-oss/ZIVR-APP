const base = import.meta.env.BASE_URL;

export default function Slide3Encryption() {
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
        alignItems: "center",
        position: "relative",
        color: "#FFFFFF",
      }}
    >
      <img
        src={`${base}hero-encryption.png`}
        crossOrigin="anonymous"
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: "55%",
          height: "100%",
          objectFit: "cover",
          opacity: 0.18,
        }}
        alt=""
      />
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: "55%",
          height: "100%",
          background: "linear-gradient(to right, #0A0E1A 15%, transparent 60%, rgba(10,14,26,0.5) 100%)",
        }}
      />

      <div
        style={{
          position: "absolute",
          top: "20vh",
          left: "20vw",
          width: "35vw",
          height: "35vw",
          borderRadius: "50%",
          backgroundColor: "#7B5EA7",
          opacity: 0.07,
          filter: "blur(10vw)",
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
          width: "82vw",
          display: "flex",
          gap: "6vw",
          alignItems: "center",
        }}
      >
        <div style={{ flex: "0 0 auto", maxWidth: "40vw" }}>
          <div
            style={{
              display: "inline-block",
              padding: "0.5vh 1.1vw",
              backgroundColor: "rgba(123,94,167,0.15)",
              border: "1px solid rgba(123,94,167,0.35)",
              borderRadius: "2vw",
              color: "#B89DD4",
              fontSize: "0.9vw",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.09em",
              marginBottom: "3vh",
            }}
          >
            Security
          </div>
          <h2
            style={{
              fontSize: "4.2vw",
              fontWeight: 800,
              margin: "0 0 3vh 0",
              lineHeight: 1.1,
              letterSpacing: "-0.03em",
            }}
          >
            End-to-End Encryption
          </h2>
          <p
            style={{
              fontSize: "1.4vw",
              fontWeight: 300,
              color: "rgba(255,255,255,0.65)",
              lineHeight: 1.6,
              margin: "0 0 4vh 0",
              maxWidth: "36vw",
              textWrap: "pretty",
            }}
          >
            Every message, every time. AES-256 encryption is applied to all messages and media before they leave your device.
          </p>
          <div
            style={{
              padding: "2.5vh 2vw",
              backgroundColor: "rgba(123,94,167,0.1)",
              border: "1px solid rgba(123,94,167,0.25)",
              borderRadius: "0.7vw",
              maxWidth: "36vw",
            }}
          >
            <div style={{ fontSize: "1.2vw", fontWeight: 600, marginBottom: "1vh", color: "#B89DD4" }}>Per-Chat Passcode Lock</div>
            <div style={{ fontSize: "1.1vw", fontWeight: 300, color: "rgba(255,255,255,0.6)", lineHeight: 1.5 }}>
              Optional per-chat passcode lock adds a second layer of protection — even if your phone is unlocked.
            </div>
          </div>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2vh" }}>
          <div
            style={{
              padding: "3vh 2.5vw",
              backgroundColor: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: "0.8vw",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: "5.5vw",
                fontWeight: 800,
                color: "#7B5EA7",
                lineHeight: 1,
                marginBottom: "0.8vh",
                letterSpacing: "-0.03em",
              }}
            >
              256
            </div>
            <div style={{ fontSize: "1vw", color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Bit AES Encryption
            </div>
          </div>
          <div
            style={{
              padding: "2vh 2.5vw",
              backgroundColor: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: "0.8vw",
              display: "flex",
              alignItems: "center",
              gap: "1.5vw",
            }}
          >
            <div
              style={{
                width: "2.8vw",
                height: "2.8vw",
                backgroundColor: "rgba(79,127,255,0.15)",
                borderRadius: "0.5vw",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                fontSize: "1.4vw",
                color: "#7FAEFF",
              }}
            >
              &#128274;
            </div>
            <div>
              <div style={{ fontSize: "1.15vw", fontWeight: 600, marginBottom: "0.4vh" }}>Device-Level Encryption</div>
              <div style={{ fontSize: "1vw", color: "rgba(255,255,255,0.45)", fontWeight: 300 }}>Messages encrypted before leaving your device</div>
            </div>
          </div>
          <div
            style={{
              padding: "2vh 2.5vw",
              backgroundColor: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: "0.8vw",
              display: "flex",
              alignItems: "center",
              gap: "1.5vw",
            }}
          >
            <div
              style={{
                width: "2.8vw",
                height: "2.8vw",
                backgroundColor: "rgba(123,94,167,0.15)",
                borderRadius: "0.5vw",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                fontSize: "1.4vw",
                color: "#B89DD4",
              }}
            >
              &#128065;
            </div>
            <div>
              <div style={{ fontSize: "1.15vw", fontWeight: 600, marginBottom: "0.4vh" }}>Screenshot Guard</div>
              <div style={{ fontSize: "1vw", color: "rgba(255,255,255,0.45)", fontWeight: 300 }}>Screen capture blocked on sensitive conversations</div>
            </div>
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
        }}
      >
        03 / 08
      </div>
    </div>
  );
}

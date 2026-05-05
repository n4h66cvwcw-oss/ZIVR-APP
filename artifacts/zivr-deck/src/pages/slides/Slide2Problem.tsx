export default function Slide2Problem() {
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
      <div
        style={{
          position: "absolute",
          top: "-10vh",
          right: "-5vw",
          width: "45vw",
          height: "45vw",
          borderRadius: "50%",
          backgroundColor: "#4F7FFF",
          opacity: 0.05,
          filter: "blur(9vw)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-20vh",
          left: "-10vw",
          width: "50vw",
          height: "50vw",
          borderRadius: "50%",
          backgroundColor: "#7B5EA7",
          opacity: 0.06,
          filter: "blur(11vw)",
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
          gap: "7vw",
          alignItems: "flex-start",
        }}
      >
        <div style={{ flex: "0 0 auto", maxWidth: "34vw" }}>
          <div
            style={{
              display: "inline-block",
              padding: "0.5vh 1.1vw",
              backgroundColor: "rgba(79,127,255,0.12)",
              border: "1px solid rgba(79,127,255,0.3)",
              borderRadius: "2vw",
              color: "#7FAEFF",
              fontSize: "0.9vw",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.09em",
              marginBottom: "3vh",
            }}
          >
            The Gap in the Market
          </div>
          <h2
            style={{
              fontSize: "3.8vw",
              fontWeight: 800,
              margin: "0 0 2.5vh 0",
              lineHeight: 1.1,
              letterSpacing: "-0.03em",
              textWrap: "balance",
            }}
          >
            The Problem with Messaging Today
          </h2>
          <p
            style={{
              fontSize: "1.4vw",
              fontWeight: 300,
              color: "rgba(255,255,255,0.6)",
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            Most apps choose between privacy and features — ZIVR delivers both.
          </p>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2.2vh", paddingTop: "2vh" }}>
          <div
            style={{
              padding: "2.2vh 2vw",
              backgroundColor: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderLeft: "3px solid #7B5EA7",
              borderRadius: "0.5vw",
            }}
          >
            <div style={{ fontSize: "1.25vw", fontWeight: 600, marginBottom: "0.6vh" }}>Conversations are unencrypted or easily intercepted</div>
            <div style={{ fontSize: "1.05vw", color: "rgba(255,255,255,0.5)", fontWeight: 300 }}>Most messaging platforms store messages in plaintext or use weak encryption.</div>
          </div>
          <div
            style={{
              padding: "2.2vh 2vw",
              backgroundColor: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderLeft: "3px solid #4F7FFF",
              borderRadius: "0.5vw",
            }}
          >
            <div style={{ fontSize: "1.25vw", fontWeight: 600, marginBottom: "0.6vh" }}>No personality or expression beyond basic emoji</div>
            <div style={{ fontSize: "1.05vw", color: "rgba(255,255,255,0.5)", fontWeight: 300 }}>Messaging lacks music, custom indicators, and real self-expression tools.</div>
          </div>
          <div
            style={{
              padding: "2.2vh 2vw",
              backgroundColor: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderLeft: "3px solid #7B5EA7",
              borderRadius: "0.5vw",
            }}
          >
            <div style={{ fontSize: "1.25vw", fontWeight: 600, marginBottom: "0.6vh" }}>Group coordination is fragmented and unreliable</div>
            <div style={{ fontSize: "1.05vw", color: "rgba(255,255,255,0.5)", fontWeight: 300 }}>Families and teams juggle multiple apps to share real-time status.</div>
          </div>
          <div
            style={{
              padding: "2.2vh 2vw",
              backgroundColor: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderLeft: "3px solid #4F7FFF",
              borderRadius: "0.5vw",
            }}
          >
            <div style={{ fontSize: "1.25vw", fontWeight: 600, marginBottom: "0.6vh" }}>No control over who sees what or for how long</div>
            <div style={{ fontSize: "1.05vw", color: "rgba(255,255,255,0.5)", fontWeight: 300 }}>Messages persist indefinitely with no self-destruct or access control.</div>
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
        02 / 08
      </div>
    </div>
  );
}

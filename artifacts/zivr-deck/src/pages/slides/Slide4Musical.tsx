export default function Slide4Musical() {
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
          top: "5vh",
          left: "25vw",
          width: "50vw",
          height: "50vw",
          borderRadius: "50%",
          backgroundColor: "#4F7FFF",
          opacity: 0.06,
          filter: "blur(12vw)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "0",
          right: "5vw",
          width: "35vw",
          height: "35vw",
          borderRadius: "50%",
          backgroundColor: "#7B5EA7",
          opacity: 0.07,
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
          width: "82vw",
        }}
      >
        <div style={{ display: "flex", gap: "6vw", alignItems: "flex-start" }}>
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
              Expression
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
              Musical Messages
              <span style={{ display: "block", color: "rgba(255,255,255,0.4)", fontSize: "3vw" }}>&amp; Expressive Tools</span>
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
              Say it with sound.
            </p>

            <div
              style={{
                marginTop: "3.5vh",
                padding: "2vh 2vw",
                backgroundColor: "rgba(79,127,255,0.08)",
                border: "1px solid rgba(79,127,255,0.2)",
                borderRadius: "0.8vw",
              }}
            >
              <div style={{ fontSize: "1.1vw", fontWeight: 600, color: "#7FAEFF", marginBottom: "0.8vh" }}>iTunes Integration</div>
              <div style={{ fontSize: "1vw", fontWeight: 300, color: "rgba(255,255,255,0.55)", lineHeight: 1.5 }}>
                Attach any song preview directly to your message. Share what you're listening to, right in the conversation.
              </div>
            </div>
          </div>

          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2vh" }}>
            <div
              style={{
                padding: "2vh 2vw",
                backgroundColor: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "0.7vw",
                display: "flex",
                gap: "1.5vw",
                alignItems: "flex-start",
              }}
            >
              <div
                style={{
                  width: "2.6vw",
                  height: "2.6vw",
                  background: "linear-gradient(135deg, #7B5EA7, #4F7FFF)",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  fontSize: "1.2vw",
                }}
              >
                &#9835;
              </div>
              <div>
                <div style={{ fontSize: "1.2vw", fontWeight: 600, marginBottom: "0.5vh" }}>Attach any song preview via iTunes</div>
                <div style={{ fontSize: "1vw", color: "rgba(255,255,255,0.5)", fontWeight: 300 }}>30-second previews from the full iTunes catalog</div>
              </div>
            </div>
            <div
              style={{
                padding: "2vh 2vw",
                backgroundColor: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "0.7vw",
                display: "flex",
                gap: "1.5vw",
                alignItems: "flex-start",
              }}
            >
              <div
                style={{
                  width: "2.6vw",
                  height: "2.6vw",
                  backgroundColor: "rgba(123,94,167,0.2)",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  fontSize: "1.2vw",
                }}
              >
                &#128516;
              </div>
              <div>
                <div style={{ fontSize: "1.2vw", fontWeight: 600, marginBottom: "0.5vh" }}>Custom animated typing indicators</div>
                <div style={{ fontSize: "1vw", color: "rgba(255,255,255,0.5)", fontWeight: 300 }}>Pick your own emoji — animated, bouncing, expressive</div>
              </div>
            </div>
            <div
              style={{
                padding: "2vh 2vw",
                backgroundColor: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "0.7vw",
                display: "flex",
                gap: "1.5vw",
                alignItems: "flex-start",
              }}
            >
              <div
                style={{
                  width: "2.6vw",
                  height: "2.6vw",
                  backgroundColor: "rgba(79,127,255,0.15)",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  fontSize: "1.2vw",
                  color: "#7FAEFF",
                }}
              >
                &#128248;
              </div>
              <div>
                <div style={{ fontSize: "1.2vw", fontWeight: 600, marginBottom: "0.5vh" }}>Self-destructing messages</div>
                <div style={{ fontSize: "1vw", color: "rgba(255,255,255,0.5)", fontWeight: 300 }}>Content disappears after reading — zero trace left behind</div>
              </div>
            </div>
            <div
              style={{
                padding: "2vh 2vw",
                backgroundColor: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "0.7vw",
                display: "flex",
                gap: "1.5vw",
                alignItems: "flex-start",
              }}
            >
              <div
                style={{
                  width: "2.6vw",
                  height: "2.6vw",
                  backgroundColor: "rgba(123,94,167,0.15)",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  fontSize: "1.2vw",
                  color: "#B89DD4",
                }}
              >
                &#128247;
              </div>
              <div>
                <div style={{ fontSize: "1.2vw", fontWeight: 600, marginBottom: "0.5vh" }}>Secure picture messages with screenshot guard</div>
                <div style={{ fontSize: "1vw", color: "rgba(255,255,255,0.5)", fontWeight: 300 }}>Photos protected from capture at the OS level</div>
              </div>
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
        04 / 08
      </div>
    </div>
  );
}

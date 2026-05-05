export default function Slide6Calling() {
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
          top: "-15vh",
          right: "-8vw",
          width: "50vw",
          height: "50vw",
          borderRadius: "50%",
          backgroundColor: "#4F7FFF",
          opacity: 0.06,
          filter: "blur(10vw)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-10vh",
          left: "10vw",
          width: "40vw",
          height: "40vw",
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
          display: "flex",
          gap: "7vw",
          alignItems: "center",
        }}
      >
        <div style={{ flex: "0 0 auto", maxWidth: "36vw" }}>
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
            Calls
          </div>
          <h2
            style={{
              fontSize: "4vw",
              fontWeight: 800,
              margin: "0 0 2.5vh 0",
              lineHeight: 1.1,
              letterSpacing: "-0.03em",
            }}
          >
            Voice &amp; Video Calling
          </h2>
          <p
            style={{
              fontSize: "1.4vw",
              fontWeight: 300,
              color: "rgba(255,255,255,0.6)",
              lineHeight: 1.6,
              margin: "0 0 4vh 0",
              maxWidth: "32vw",
              textWrap: "pretty",
            }}
          >
            Crystal-clear calls, built right in. No third-party app switching required.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "2vh" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "1.2vw" }}>
              <div
                style={{
                  width: "0.35vw",
                  height: "3.5vh",
                  background: "linear-gradient(to bottom, #7B5EA7, #4F7FFF)",
                  borderRadius: "0.2vw",
                  flexShrink: 0,
                }}
              />
              <div>
                <div style={{ fontSize: "1.15vw", fontWeight: 600 }}>Full voice and video within the app</div>
                <div style={{ fontSize: "1vw", color: "rgba(255,255,255,0.45)", fontWeight: 300, marginTop: "0.3vh" }}>No redirects, no third-party apps</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "1.2vw" }}>
              <div
                style={{
                  width: "0.35vw",
                  height: "3.5vh",
                  background: "linear-gradient(to bottom, #4F7FFF, #7B5EA7)",
                  borderRadius: "0.2vw",
                  flexShrink: 0,
                }}
              />
              <div>
                <div style={{ fontSize: "1.15vw", fontWeight: 600 }}>All calls encrypted end-to-end</div>
                <div style={{ fontSize: "1vw", color: "rgba(255,255,255,0.45)", fontWeight: 300, marginTop: "0.3vh" }}>Same AES-256 standard as messages</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "1.2vw" }}>
              <div
                style={{
                  width: "0.35vw",
                  height: "3.5vh",
                  background: "linear-gradient(to bottom, #7B5EA7, #4F7FFF)",
                  borderRadius: "0.2vw",
                  flexShrink: 0,
                }}
              />
              <div>
                <div style={{ fontSize: "1.15vw", fontWeight: 600 }}>Contact Groups organize who you call most</div>
                <div style={{ fontSize: "1vw", color: "rgba(255,255,255,0.45)", fontWeight: 300, marginTop: "0.3vh" }}>Quick access to your most important people</div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2.5vw" }}>
          <div
            style={{
              padding: "3.5vh 0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
              gap: "1.2vh",
              backgroundColor: "rgba(79,127,255,0.07)",
              border: "1px solid rgba(79,127,255,0.18)",
              borderRadius: "1.2vw",
            }}
          >
            <div
              style={{
                width: "5vw",
                height: "5vw",
                backgroundColor: "rgba(79,127,255,0.2)",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "2.2vw",
                color: "#7FAEFF",
                marginBottom: "0.5vh",
              }}
            >
              &#128222;
            </div>
            <div style={{ fontSize: "1.3vw", fontWeight: 700 }}>Voice Call</div>
            <div style={{ fontSize: "1vw", color: "rgba(255,255,255,0.45)", fontWeight: 300 }}>HD audio, end-to-end encrypted</div>
          </div>
          <div
            style={{
              padding: "3.5vh 0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
              gap: "1.2vh",
              backgroundColor: "rgba(123,94,167,0.07)",
              border: "1px solid rgba(123,94,167,0.22)",
              borderRadius: "1.2vw",
            }}
          >
            <div
              style={{
                width: "5vw",
                height: "5vw",
                backgroundColor: "rgba(123,94,167,0.2)",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "2.2vw",
                color: "#B89DD4",
                marginBottom: "0.5vh",
              }}
            >
              &#127909;
            </div>
            <div style={{ fontSize: "1.3vw", fontWeight: 700 }}>Video Call</div>
            <div style={{ fontSize: "1vw", color: "rgba(255,255,255,0.45)", fontWeight: 300 }}>Full video, no app switching</div>
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
        06 / 08
      </div>
    </div>
  );
}

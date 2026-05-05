export default function Slide5CheckIn() {
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
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "55vw",
          height: "55vw",
          borderRadius: "50%",
          backgroundColor: "#4F7FFF",
          opacity: 0.05,
          filter: "blur(14vw)",
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
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
        }}
      >
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
          Groups
        </div>
        <h2
          style={{
            fontSize: "4vw",
            fontWeight: 800,
            margin: "0 0 2vh 0",
            lineHeight: 1.1,
            letterSpacing: "-0.03em",
          }}
        >
          Broadcast Check-In Groups
        </h2>
        <p
          style={{
            fontSize: "1.4vw",
            fontWeight: 300,
            color: "rgba(255,255,255,0.6)",
            lineHeight: 1.55,
            maxWidth: "48vw",
            margin: "0 0 5vh 0",
          }}
        >
          Real-time group coordination, reimagined.
        </p>

        <div style={{ display: "flex", gap: "2.5vw", width: "100%", justifyContent: "center" }}>
          <div
            style={{
              flex: "1",
              maxWidth: "18vw",
              padding: "3vh 2vw",
              backgroundColor: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "0.8vw",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: "3.5vw",
                height: "3.5vw",
                backgroundColor: "rgba(79,127,255,0.15)",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 2vh",
                fontSize: "1.6vw",
                color: "#7FAEFF",
              }}
            >
              &#128228;
            </div>
            <div style={{ fontSize: "1.15vw", fontWeight: 600, marginBottom: "1vh" }}>Broadcast Status</div>
            <div style={{ fontSize: "1vw", color: "rgba(255,255,255,0.5)", fontWeight: 300, lineHeight: 1.5 }}>Share your location or status with the whole group at once</div>
          </div>
          <div
            style={{
              flex: "1",
              maxWidth: "18vw",
              padding: "3vh 2vw",
              backgroundColor: "rgba(123,94,167,0.08)",
              border: "1px solid rgba(123,94,167,0.22)",
              borderRadius: "0.8vw",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: "3.5vw",
                height: "3.5vw",
                backgroundColor: "rgba(123,94,167,0.2)",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 2vh",
                fontSize: "1.6vw",
                color: "#B89DD4",
              }}
            >
              &#128101;
            </div>
            <div style={{ fontSize: "1.15vw", fontWeight: 600, marginBottom: "1vh" }}>Families, Teams, Travel</div>
            <div style={{ fontSize: "1vw", color: "rgba(255,255,255,0.5)", fontWeight: 300, lineHeight: 1.5 }}>Purpose-built for the groups that matter most in your life</div>
          </div>
          <div
            style={{
              flex: "1",
              maxWidth: "18vw",
              padding: "3vh 2vw",
              backgroundColor: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "0.8vw",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: "3.5vw",
                height: "3.5vw",
                backgroundColor: "rgba(79,127,255,0.12)",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 2vh",
                fontSize: "1.6vw",
                color: "#7FAEFF",
              }}
            >
              &#128276;
            </div>
            <div style={{ fontSize: "1.15vw", fontWeight: 600, marginBottom: "1vh" }}>Push Notifications</div>
            <div style={{ fontSize: "1vw", color: "rgba(255,255,255,0.5)", fontWeight: 300, lineHeight: 1.5 }}>Instant alerts keep the whole group in sync in real time</div>
          </div>
          <div
            style={{
              flex: "1",
              maxWidth: "18vw",
              padding: "3vh 2vw",
              backgroundColor: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "0.8vw",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: "3.5vw",
                height: "3.5vw",
                backgroundColor: "rgba(123,94,167,0.15)",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 2vh",
                fontSize: "1.6vw",
                color: "#B89DD4",
              }}
            >
              &#10003;
            </div>
            <div style={{ fontSize: "1.15vw", fontWeight: 600, marginBottom: "1vh" }}>Read Receipts</div>
            <div style={{ fontSize: "1vw", color: "rgba(255,255,255,0.5)", fontWeight: 300, lineHeight: 1.5 }}>Confirm your message was seen — no more wondering</div>
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
        05 / 08
      </div>
    </div>
  );
}

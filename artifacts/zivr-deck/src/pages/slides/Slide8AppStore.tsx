export default function Slide8AppStore() {
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
          width: "65vw",
          height: "65vw",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(123,94,167,0.12) 0%, transparent 70%)",
          filter: "blur(6vw)",
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
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          maxWidth: "62vw",
          padding: "5vh 5vw",
          backgroundColor: "rgba(19,23,38,0.7)",
          backdropFilter: "blur(1vw)",
          border: "1px solid rgba(255,255,255,0.09)",
          borderRadius: "1.5vw",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.7vw",
            padding: "0.6vh 1.3vw",
            backgroundColor: "rgba(123,94,167,0.18)",
            border: "1px solid rgba(123,94,167,0.4)",
            borderRadius: "2vw",
            color: "#B89DD4",
            fontSize: "0.95vw",
            fontWeight: 600,
            marginBottom: "3.5vh",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          Shipping Now
        </div>

        <h2
          style={{
            fontSize: "4.5vw",
            fontWeight: 800,
            margin: "0 0 2.5vh 0",
            lineHeight: 1.1,
            letterSpacing: "-0.04em",
          }}
        >
          Built for the App Store
        </h2>

        <p
          style={{
            fontSize: "1.4vw",
            fontWeight: 300,
            color: "rgba(255,255,255,0.6)",
            margin: "0 0 4.5vh 0",
            lineHeight: 1.6,
            maxWidth: "44vw",
          }}
        >
          Production-ready, polished, and shipping. Available on iOS via the App Store.
        </p>

        <div style={{ display: "flex", gap: "2.5vw", marginBottom: "4vh" }}>
          <div
            style={{
              padding: "2vh 2.5vw",
              backgroundColor: "rgba(79,127,255,0.1)",
              border: "1px solid rgba(79,127,255,0.25)",
              borderRadius: "0.7vw",
              minWidth: "14vw",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "1.15vw", fontWeight: 700, color: "#7FAEFF", marginBottom: "0.5vh" }}>TestFlight</div>
            <div style={{ fontSize: "0.95vw", color: "rgba(255,255,255,0.45)", fontWeight: 300 }}>Beta distribution live</div>
          </div>
          <div
            style={{
              padding: "2vh 2.5vw",
              backgroundColor: "rgba(123,94,167,0.1)",
              border: "1px solid rgba(123,94,167,0.25)",
              borderRadius: "0.7vw",
              minWidth: "14vw",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "1.15vw", fontWeight: 700, color: "#B89DD4", marginBottom: "0.5vh" }}>OTA Updates</div>
            <div style={{ fontSize: "0.95vw", color: "rgba(255,255,255,0.45)", fontWeight: 300 }}>Skip the App Store wait</div>
          </div>
          <div
            style={{
              padding: "2vh 2.5vw",
              backgroundColor: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "0.7vw",
              minWidth: "14vw",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "1.15vw", fontWeight: 700, marginBottom: "0.5vh" }}>PDF Export</div>
            <div style={{ fontSize: "0.95vw", color: "rgba(255,255,255,0.45)", fontWeight: 300 }}>Conversation records</div>
          </div>
        </div>

        <div
          style={{
            fontSize: "1.1vw",
            color: "rgba(255,255,255,0.35)",
            letterSpacing: "0.05em",
          }}
        >
          ZIVR, INC. — 2026 &nbsp;&#183;&nbsp; zivr.app
        </div>
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
        08 / 08
      </div>
    </div>
  );
}

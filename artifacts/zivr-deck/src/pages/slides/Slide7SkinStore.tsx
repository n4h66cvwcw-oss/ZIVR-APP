export default function Slide7SkinStore() {
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
          top: "10vh",
          right: "10vw",
          width: "45vw",
          height: "45vw",
          borderRadius: "50%",
          backgroundColor: "#7B5EA7",
          opacity: 0.09,
          filter: "blur(11vw)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-5vh",
          left: "5vw",
          width: "35vw",
          height: "35vw",
          borderRadius: "50%",
          backgroundColor: "#4F7FFF",
          opacity: 0.05,
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
          gap: "6vw",
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
            Monetization
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
            Skin Store
            <span style={{ display: "block", color: "#7B5EA7" }}>&amp; ZivCoin</span>
          </h2>
          <p
            style={{
              fontSize: "1.4vw",
              fontWeight: 300,
              color: "rgba(255,255,255,0.6)",
              lineHeight: 1.6,
              margin: "0 0 3vh 0",
              maxWidth: "32vw",
            }}
          >
            Make ZIVR yours.
          </p>

          <div
            style={{
              padding: "2.5vh 2vw",
              background: "linear-gradient(135deg, rgba(123,94,167,0.15), rgba(79,127,255,0.1))",
              border: "1px solid rgba(123,94,167,0.3)",
              borderRadius: "0.8vw",
              maxWidth: "32vw",
            }}
          >
            <div style={{ fontSize: "1.1vw", fontWeight: 600, color: "#B89DD4", marginBottom: "0.8vh" }}>ZivCoin — In-App Currency</div>
            <div style={{ fontSize: "1vw", fontWeight: 300, color: "rgba(255,255,255,0.55)", lineHeight: 1.5 }}>
              Earn and spend ZivCoin on skins, typing indicators, and premium features. Regular new drops keep the store fresh.
            </div>
          </div>
        </div>

        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2vh 2vw" }}>
          <div
            style={{
              padding: "2.5vh 2vw",
              backgroundColor: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "0.7vw",
            }}
          >
            <div
              style={{
                width: "3vw",
                height: "3vw",
                background: "linear-gradient(135deg, #7B5EA7, #4F7FFF)",
                borderRadius: "0.5vw",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.4vw",
                marginBottom: "1.5vh",
              }}
            >
              &#127775;
            </div>
            <div style={{ fontSize: "1.15vw", fontWeight: 600, marginBottom: "0.6vh" }}>Exclusive Chat Themes</div>
            <div style={{ fontSize: "0.95vw", color: "rgba(255,255,255,0.45)", fontWeight: 300, lineHeight: 1.5 }}>Personalize every conversation with premium skins</div>
          </div>
          <div
            style={{
              padding: "2.5vh 2vw",
              backgroundColor: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "0.7vw",
            }}
          >
            <div
              style={{
                width: "3vw",
                height: "3vw",
                backgroundColor: "rgba(123,94,167,0.2)",
                borderRadius: "0.5vw",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.4vw",
                marginBottom: "1.5vh",
                color: "#B89DD4",
              }}
            >
              &#128516;
            </div>
            <div style={{ fontSize: "1.15vw", fontWeight: 600, marginBottom: "0.6vh" }}>Custom Typing Indicators</div>
            <div style={{ fontSize: "0.95vw", color: "rgba(255,255,255,0.45)", fontWeight: 300, lineHeight: 1.5 }}>Animated emoji indicators unlocked via ZivCoin</div>
          </div>
          <div
            style={{
              padding: "2.5vh 2vw",
              backgroundColor: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "0.7vw",
            }}
          >
            <div
              style={{
                width: "3vw",
                height: "3vw",
                backgroundColor: "rgba(79,127,255,0.15)",
                borderRadius: "0.5vw",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.4vw",
                marginBottom: "1.5vh",
                color: "#7FAEFF",
              }}
            >
              &#128176;
            </div>
            <div style={{ fontSize: "1.15vw", fontWeight: 600, marginBottom: "0.6vh" }}>Earn &amp; Spend ZivCoin</div>
            <div style={{ fontSize: "0.95vw", color: "rgba(255,255,255,0.45)", fontWeight: 300, lineHeight: 1.5 }}>In-app currency with Apple IAP integration</div>
          </div>
          <div
            style={{
              padding: "2.5vh 2vw",
              backgroundColor: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "0.7vw",
            }}
          >
            <div
              style={{
                width: "3vw",
                height: "3vw",
                background: "linear-gradient(135deg, #4F7FFF, #7B5EA7)",
                borderRadius: "0.5vw",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.4vw",
                marginBottom: "1.5vh",
              }}
            >
              &#128717;
            </div>
            <div style={{ fontSize: "1.15vw", fontWeight: 600, marginBottom: "0.6vh" }}>Regular New Drops</div>
            <div style={{ fontSize: "0.95vw", color: "rgba(255,255,255,0.45)", fontWeight: 300, lineHeight: 1.5 }}>Fresh content keeps the store exciting and engaging</div>
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
        07 / 08
      </div>
    </div>
  );
}

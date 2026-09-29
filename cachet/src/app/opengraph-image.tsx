import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "Cachet — Notes, sealed.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  const seal = await readFile(join(process.cwd(), "public/seal.svg"), "utf8");
  const sealSrc = `data:image/svg+xml;base64,${Buffer.from(seal).toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "80px 96px",
          background: "radial-gradient(900px 500px at 70% 0%, #3a3120 0%, #12110f 60%)",
          color: "#f4efe3",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 28, letterSpacing: 8, color: "#d9b25a", textTransform: "uppercase" }}>Cachet</div>
          <div style={{ fontSize: 120, lineHeight: 1, marginTop: 24, fontFamily: "serif" }}>Notes,</div>
          <div style={{ fontSize: 120, lineHeight: 1, fontStyle: "italic", color: "#e3c47a", fontFamily: "serif" }}>sealed.</div>
          <div style={{ fontSize: 30, marginTop: 36, color: "#b7ad99", maxWidth: 620 }}>
            One-time, key-protected and expiring share links for private notes.
          </div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain <img> */}
        <img src={sealSrc} width={340} height={340} alt="" />
      </div>
    ),
    size,
  );
}

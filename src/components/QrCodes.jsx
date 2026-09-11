"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

/**
 * One QR code per table. Each code carries a signed token
 * (/r/<slug>/t/<table>.<signature>) generated on the server, so a guest can't
 * change the table number by editing the URL.
 */
export default function QrCodes({ tablePaths, accent }) {
  const [codes, setCodes] = useState([]);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_BASE_URL || window.location.origin;
    setOrigin(base);

    Promise.all(
      tablePaths.map(async ({ table, path }) => {
        const url = `${base}${path}`;
        const dataUrl = await QRCode.toDataURL(url, {
          width: 420,
          margin: 1,
          errorCorrectionLevel: "M",
          color: { dark: "#15130f", light: "#ffffff" },
        });
        return { table, url, dataUrl };
      })
    ).then(setCodes);
  }, [tablePaths]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3 print:hidden">
        <button
          onClick={() => window.print()}
          className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper"
        >
          Print all codes
        </button>
        <p className="text-sm text-muted">
          Scan any of these with your phone camera to open the guest page for that table.
        </p>
      </div>

      {origin.includes("localhost") && (
        <p className="mb-4 rounded-xl bg-warn-soft px-3 py-2 text-xs text-warn print:hidden">
          These codes point at <code>{origin}</code>, which only works on this computer. To test on
          your phone, run <code>npm run dev -- -H 0.0.0.0</code> and set{" "}
          <code>NEXT_PUBLIC_BASE_URL</code> to your machine&apos;s network address. Before printing
          real table tents, set it to the final domain — printed codes can&apos;t be changed.
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {codes.map((c) => (
          <div
            key={c.table}
            className="break-inside-avoid rounded-card border border-line bg-raised p-3 text-center"
          >
            <img src={c.dataUrl} alt={`QR code for table ${c.table}`} className="mx-auto w-full" />
            <p className="mt-1 font-semibold" style={{ color: accent }}>
              Table {c.table}
            </p>
            <p className="break-all text-[9px] text-faint print:hidden">{c.url}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

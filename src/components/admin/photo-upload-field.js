"use client";
import { useState } from "react";

export default function PhotoUploadField({ currentUrl }) {
  const [preview, setPreview] = useState(currentUrl || null);
  return (
    <div>
      <label className="admin-label">Photo (JPEG/PNG/WebP, ≤ 3 MB)</label>
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="" style={{ width: 96, height: 96, objectFit: "cover", borderRadius: 8, marginBottom: 8 }} />
      ) : null}
      <input
        className="admin-input"
        name="photo"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) setPreview(URL.createObjectURL(f));
        }}
      />
    </div>
  );
}

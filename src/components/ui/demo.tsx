"use client";

import * as React from "react";

export const Component = () => {
  return (
    <div className="min-h-screen w-full relative bg-white">
      {/* Cool Blue Glow Right */}
      <div
        className="absolute inset-0 z-0"
        style={{
          background: "#ffffff",
          backgroundImage: `
            radial-gradient(
              circle at top right,
              rgba(70, 130, 180, 0.5),
              transparent 70%
            )
          `,
          filter: "blur(80px)",
          backgroundRepeat: "no-repeat",
        }}
      />
      {/* Your Content/Components */}
    </div>
  );
};

export default Component;

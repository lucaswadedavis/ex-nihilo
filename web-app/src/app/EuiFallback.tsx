"use client";
import React from "react";
import { EuiFallbackProps } from "./types";

export function EuiFallback({ data }: EuiFallbackProps) {
  return (
    <div className="bg-white p-4 rounded-lg shadow-md">
      <pre style={{ whiteSpace: "pre-wrap" }}>
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

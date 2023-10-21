"use client";
import React from "react";
import { EuiFallbackProps } from "./types";

export function EuiFallback({ data }: EuiFallbackProps) {
  try {
    data.data = JSON.parse(data.data);
  } catch (e) {
    console.log(e);
  }
  return (
    <pre style={{ whiteSpace: "pre-wrap" }}>
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

"use client";
import React from "react";
import { SimpleTable } from "./SimpleTable";

export const ResultArea = (data = []) => {
  return (
    <div>
      <h2 className="text-gray-700 text-sm font-bold mb-2">Result</h2>
      <SimpleTable data={data} />
    </div>
  );
};

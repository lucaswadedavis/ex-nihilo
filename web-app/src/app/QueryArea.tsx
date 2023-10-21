"use client";
import React from "react";

export const QueryArea = ({ queries = [] }) => (
  <div>
    <h2 className="text-gray-700 text-sm font-bold mb-2">Queries</h2>
    {queries?.map((query: any, index: number) => (
      <div key={`query-${query}-${index}`}>{query}</div>
    ))}
  </div>
);

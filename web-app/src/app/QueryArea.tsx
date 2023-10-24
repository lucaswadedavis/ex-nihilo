"use client";
import React from "react";

interface QueryAreaProps {
  queries: string[];
}

export const QueryArea = ({ queries = [] }: QueryAreaProps) => (
  <div>
    <h2 className="text-gray-700 text-sm font-bold mb-2">Queries</h2>
    {queries?.map((query: string, index: number) => (
      <div key={`query-${query}-${index}`} className="bg-white px-4 py-3 mb-4">
        {query}
      </div>
    ))}
  </div>
);

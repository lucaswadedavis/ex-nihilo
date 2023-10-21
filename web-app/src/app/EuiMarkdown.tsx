"use client";
import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { QueryArea } from "./QueryArea";
import { ResultArea } from "./ResultArea";
import { EuiFallbackProps } from "./types";
import { parseDirtyJSON } from "./utils";

export function EuiMarkdown({ data }: EuiFallbackProps) {
  const [isOpen, setIsOpen] = useState(false);
  try {
    if (typeof data.data === "string") {
      data.data = parseDirtyJSON(data?.data);
    }
  } catch (e) {
    console.log(e);
  }

  return (
    <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4">
      <h1 className="block text-gray-800 text-lg font-bold mb-2">
        {data?.user_input}
      </h1>
      <p
        className="text-gray-500 text-sm font-bold mb-2 cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      >
        Details
      </p>
      <div className="flex justify-between text-gray-700">
        <div className="w-1/2 p-4">
          {isOpen && <QueryArea queries={data?.queries} />}
        </div>
        <div className="w-1/2 p-4">{isOpen && ResultArea(data?.result)}</div>
      </div>
      <ReactMarkdown
        className="text-gray-700 text-base"
        remarkPlugins={[remarkGfm]}
      >
        {data?.data?.content}
      </ReactMarkdown>
    </div>
  );
}

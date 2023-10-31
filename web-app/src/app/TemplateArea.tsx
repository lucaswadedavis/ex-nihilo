"use client";
import React from "react";

interface TemplateAreaProps {
  template: string;
}

export const TemplateArea: React.FC<TemplateAreaProps> = ({ template }) => (
  <div>
    <h2 className="text-gray-700 text-sm font-bold mb-2">Template</h2>
    <div className="bg-white p-4">
      <pre style={{ whiteSpace: "pre-wrap", wordWrap: "break-word" }}>
        {template}
      </pre>
    </div>
  </div>
);

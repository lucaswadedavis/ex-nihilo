"use client";
import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { QueryArea } from "./QueryArea";
import { ResultArea } from "./ResultArea";
import { parseDirtyJSON } from "./utils";
import Handlebars from "handlebars";
import { TemplateArea } from "./TemplateArea";

interface EuiMarkdownProps {
  component: any;
  saveComponent: (component: any) => void;
  updateComponent: (component: any) => void;
  deleteComponent: (component: any) => void;
  saved: boolean;
}

export function EuiMarkdown({
  component,
  saved = false,
  saveComponent,
  updateComponent,
  deleteComponent,
}: EuiMarkdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  try {
    if (typeof component.data === "string") {
      component.data = parseDirtyJSON(component?.data);
    }
  } catch (e) {
    console.log(e);
  }

  // data.data is the handlebars template of html
  // data.result is the data to be passed into the handlebars template
  const template = Handlebars.compile(component?.data?.content);
  const md = template(component);
  console.log("template", component?.data?.content);

  return (
    <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4">
      <h1 className="block text-gray-800 text-lg font-bold mb-2">
        {component?.user_input}
      </h1>
      <p
        className="text-gray-500 text-sm font-bold mb-2 cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      >
        Details
      </p>
      {isOpen && (
        <div className="flex justify-between text-gray-700 bg-gray-300">
          <div className="w-1/2 p-4">
            <QueryArea queries={component?.queries} />
            <ResultArea result={component?.result} />
          </div>
          <div className="w-1/2 p-4">
            <TemplateArea template={component?.data?.content} />
          </div>
        </div>
      )}
      <ReactMarkdown
        className="text-gray-700 text-base"
        remarkPlugins={[remarkGfm]}
      >
        {/*data?.data?.content*/ md}
      </ReactMarkdown>
    </div>
  );
}

"use client";
import Handlebars from "handlebars";
import { useState } from "react";
import { QueryArea } from "./QueryArea";
import { ResultArea } from "./ResultArea";
import { TemplateArea } from "./TemplateArea";
import { parseDirtyJSON } from "./utils";

interface EuiHtmlProps {
  component: any;
  saveComponent: (component: any) => void;
  updateComponent: (component: any) => void;
  deleteComponent: (component: any) => void;
  saved: boolean;
}

export function EuiHtml({
  component,
  saved = false,
  saveComponent,
  updateComponent,
  deleteComponent,
}: EuiHtmlProps) {
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
  const html = template(component);
  //console.log("HTML", html);

  return (
    <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4 ">
      {saved && (
        <button
          className="bg-red-500 hover:bg-red-700 text-white text-xs font-bold py-2 px-4 rounded float-right"
          onClick={() => deleteComponent(component)}
        >
          Delete
        </button>
      )}
      <h1 className="block text-gray-800 text-lg font-bold mb-2">
        {component?.user_input}
      </h1>
      {!saved && (
        <button
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded float-right"
          onClick={() => saveComponent(component)}
        >
          Save Component
        </button>
      )}
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
      <div dangerouslySetInnerHTML={{ __html: html }} />
      {saved && (
        <button
          className="bg-orange-500 hover:bg-orange-700 text-white text-xs font-bold py-2 px-4 rounded float-right"
          onClick={() => updateComponent(component)}
        >
          Update
        </button>
      )}
      <div className="clear-both" />
    </div>
  );
}

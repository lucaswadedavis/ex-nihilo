"use client";

import React, { useRef, useState } from "react";
import ls from "./localStorage";
import { EuiFallback } from "./EuiFallback";
import { EuiHtml } from "./EuiHtml";
import { EuiMarkdown } from "./EuiMarkdown";
import { UNIVERSAL_ENDPOINT } from "./constants";

export default function Home() {
  const [messages, setMessages] = useState<string[]>([]);
  const [latestMessage, setLatestMessage] = useState("");
  const [responses, setResponses] = useState<any[]>([]);
  const [waitingForResponse, setWaitingForResponse] = useState(false);
  const [apiKey, setApiKey] = useState<string>(ls.getItem("apiKey") || "");
  const textInput = useRef<HTMLTextAreaElement>(null);

  const sendMessage = async (latestMessage: string) => {
    setMessages([...messages, latestMessage]);
    setLatestMessage("");
    setWaitingForResponse(true);
    console.log("sending message");
    const response = await fetch(UNIVERSAL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ message: latestMessage, api_key: apiKey }),
    });
    const latestResponse = await response.json();
    console.log(latestResponse);
    setWaitingForResponse(false);
    setResponses([...responses, latestResponse]);
    if (textInput && textInput.current) textInput.current.focus();
  };

  const renderSuggestion = (suggestion: string, index: number) => {
    return (
      <div
        key={`suggestion-${index}`}
        className="bg-gradient-to-r from-green-400 to-blue-500 shadow-md rounded-lg px-4 pt-4 pb-4 mb-4 cursor-pointer inline-block center"
        style={{ margin: 8 }}
        onClick={() => {
          setLatestMessage(suggestion);
          sendMessage(suggestion);
        }}
      >
        <p className="text-white font-bold">{suggestion}</p>
      </div>
    );
  };

  const renderSuggestions = () => {
    const suggestions = [
      "get all the tables in the database",
      "get all the planets from the planets table, then use the html_component to present them in a handsome table",
    ];
    return (
      <div className="w-full flex justify-center">
        {suggestions.map(renderSuggestion)}
      </div>
    );
  };

  const renderExplanation = () => {
    return (
      <div className="w-full">
        <p className="text-white font-bold mb-2 text-center w-full">
          Behind the scenes you have a SQLite database that you can query using
          natural language, and a flaky AI that will try to follow your
          instructions.
        </p>
        {renderSuggestions()}
      </div>
    );
  };

  const renderResponses = () => {
    if (responses.length === 0) return renderExplanation();
    return responses.map((response, index) => {
      let res = null;
      const componentName = response.component_name;
      if (componentName === "markdown_component") {
        res = <EuiMarkdown data={response} />;
      } else if (componentName === "html_component") {
        res = <EuiHtml data={response} />;
      } else {
        res = <EuiFallback data={response} />;
      }
      return (
        <div key={index} className="w-full">
          {res}
        </div>
      );
    });
  };

  const renderWaitingForResponseArea = () => {
    if (!waitingForResponse) return null;
    return (
      <div className="w-full">
        <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4">
          <p className="text-gray-500 text-sm font-bold mb-2">
            Waiting for response...
          </p>
        </div>
      </div>
    );
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-8 w-full h-screen">
      <h1 className="text-6xl mb-4 text-white">ex-nihilo</h1>
      {renderResponses()}
      {renderWaitingForResponseArea()}
      <div className="flex justify-between items-center w-full sticky">
        <textarea
          ref={textInput}
          className="chat-input bg-white rounded border-2 border-gray-300 p-4 mb-4 resize-y min-h-[3rem] focus:outline-none focus:ring-2 focus:ring-blue-600 flex-grow mr-4"
          placeholder="Type a message..."
          value={latestMessage}
          onChange={e => setLatestMessage(e.target.value)}
        />
        <button
          className="bg-orange-500 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded"
          onClick={() => {
            sendMessage(latestMessage);
          }}
        >
          Send
        </button>
      </div>
      <div className="w-full">
        <input
          className="api-input bg-white rounded border-2 border-gray-300 p-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-600"
          placeholder="Enter your API key..."
          type="password"
          value={apiKey}
          onChange={e => {
            setApiKey(e.target.value);
            ls.setItem("apiKey", e.target.value);
          }}
        />
      </div>
    </main>
  );
}

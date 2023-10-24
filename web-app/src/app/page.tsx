"use client";

import React, { useEffect, useRef, useState } from "react";
import ls from "./localStorage";
import { EuiFallback } from "./EuiFallback";
import { EuiHtml } from "./EuiHtml";
import { EuiMarkdown } from "./EuiMarkdown";
import { UNIVERSAL_ENDPOINT } from "./constants";
import { parseSuggestions } from "./utils";
import { EuiBarGraph } from "./EuiBarGraph";
import { v4 as uuid } from "uuid";
import { createName } from "./createName";
import { SQL_ENDPOINT } from "./constants";

interface Response {
  id: string;
  displayName: string;
  component_name: string;
  user_input: string;
  prompts: string[];
  queries: string[];
  data: any;
  result: Array<{ [key: string]: any }>;
}

export default function Home() {
  const [view, setView] = useState<"explore" | "saved">("explore");
  const [messages, setMessages] = useState<string[]>([]);
  const [latestMessage, setLatestMessage] = useState("");
  const [responses, setResponses] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([
    "Show me all the tables in the database",
  ]);
  const [waitingForResponse, setWaitingForResponse] = useState(false);
  const [apiKey, setApiKey] = useState<string>(ls.getItem("apiKey") || "");
  const [savedComponents, setSavedComponents] = useState<any[]>([]);
  const textInput = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const savedComponents = JSON.parse(ls.getItem("savedComponents") || "[]");
    setSavedComponents(savedComponents);
  }, []); // Empty dependency array ensures this runs only once on the first render

  const sendMessage = async (latestMessage: string) => {
    setMessages([...messages, latestMessage]);
    setSuggestions([]);
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
    let latestResponse = await response.json();
    latestResponse.id = uuid();
    latestResponse.displayName = createName();
    console.log(latestResponse);
    console.log(latestResponse.data);
    let suggestions: string[] = [];
    if (latestResponse?.data && typeof latestResponse.data === "string") {
      suggestions = parseSuggestions(latestResponse.data);
    }
    setWaitingForResponse(false);
    setResponses([...responses, latestResponse]);
    setSuggestions(suggestions);
    if (textInput && textInput.current) textInput.current.focus();
  };

  const saveComponent = (component: any) => {
    console.log("saving component", component);
    const formerMatch = savedComponents.find(c => c.id === component.id);
    let newSavedComponents = [];
    if (!formerMatch) {
      newSavedComponents = [...savedComponents, component];
    } else {
      newSavedComponents = savedComponents.map(c => {
        return c.id === component.id ? component : c;
      });
    }
    ls.setItem("savedComponents", JSON.stringify(newSavedComponents));
    setSavedComponents(newSavedComponents);
  };

  const updateComponent = async (component: any) => {
    // get component data and send the sql query to the backend
    console.log("sending message");
    const queries = component.queries;
    const response = await fetch(SQL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ queries }),
    });
    const result = await response.json();
    console.log(result);
    component.result = result.result;
    saveComponent(component);
  };

  const deleteComponent = async (component: any) => {
    console.log("delete component: ", component);
    const components = savedComponents.filter(
      c => c.id !== component.id && component.id
    );

    setSavedComponents(components);
    ls.setItem("savedComponents", JSON.stringify(components));
  };

  const renderSuggestion = (suggestion: string, index: number) => {
    return (
      <div
        key={`suggestion-${index}`}
        className="bg-gradient-to-r from-green-400 to-blue-500 shadow-md rounded-lg px-4 pt-4 pb-4 mb-4 cursor-pointer inline-block m-2"
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
    if (suggestions.length === 0) return null;
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
        <p>
          The AI has no memory, so every message you send is a new instruction.
        </p>
      </div>
    );
  };

  const renderResponses = (responses: Response[], saved = false) => {
    if (responses.length === 0) return renderExplanation();
    return responses.map((response, index) => {
      let res = null;
      console.log("response", response);
      const componentName = response.component_name;
      if (componentName === "markdown_component") {
        res = <EuiMarkdown data={response} />;
      } else if (componentName === "html_component") {
        res = (
          <EuiHtml
            component={response}
            saveComponent={saveComponent}
            updateComponent={updateComponent}
            deleteComponent={deleteComponent}
            saved={saved}
          />
        );
      } else if (componentName === "bargraph_component") {
        res = <EuiBarGraph data={response} />;
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
    const latestMessage = messages[messages.length - 1];
    return (
      <div className="w-full">
        <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4">
          <p className="text-gray-500 text-center font-bold text-4xl mb-2">
            {latestMessage}
          </p>
          <p className="text-gray-500 text-center font-bold mb-2">
            Waiting for response...
          </p>
        </div>
      </div>
    );
  };

  const renderTopNav = () => {
    if (!savedComponents.length) return null;
    console.log("savedComponents", savedComponents);
    return (
      <div className="text-white ">
        <span
          className="cursor-pointer"
          onClick={() => {
            setView("saved");
          }}
        >
          Saved Components
        </span>{" "}
        |{" "}
        <span
          className="cursor-pointer"
          onClick={() => {
            setView("explore");
          }}
        >
          Explore
        </span>
      </div>
    );
  };

  const renderChatArea = () => {
    return (
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
    );
  };

  const renderExploreView = () => {
    if (view !== "explore") return null;
    return (
      <>
        {renderResponses(responses)}
        {renderWaitingForResponseArea()}
        {renderSuggestions()}
        {renderChatArea()}
      </>
    );
  };

  const renderSavedView = () => {
    if (view !== "saved") return null;
    return (
      <div>
        {savedComponents.map((component, index) => {
          return (
            <div key={component.id}>
              <div>{component.displayName}</div>
              {renderResponses([component], true)}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-8 w-full h-screen">
      <h1 className="text-6xl mb-4 text-white">ex-nihilo</h1>
      {renderTopNav()}
      {renderExploreView()}
      {renderSavedView()}
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

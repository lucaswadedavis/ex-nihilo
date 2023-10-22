"use client";
import React, { useState } from "react";
import { QueryArea } from "./QueryArea";
import { ResultArea } from "./ResultArea";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { ResultAreaProps } from "./ResultArea";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const options = {
  responsive: true,
  plugins: {
    legend: {
      display: false,
    },
    title: {
      display: false,
    },
  },
};

interface BarGraphData {
  label: string;
  value: number;
}

interface EuiBarGraphProps {
  data: {
    user_input: string;
    data: string;
    queries: string[];
    result: ResultAreaProps["result"];
  };
}

interface ParsedData {
  content: BarGraphData[];
}

export const EuiBarGraph: React.FC<EuiBarGraphProps> = ({ data }) => {
  const [isOpen, setIsOpen] = useState(false);
  let parsedData: ParsedData = { content: [] };
  let content: BarGraphData[] = [];
  try {
    parsedData = JSON.parse(data.data);
    content = parsedData.content || [];
  } catch (e) {
    console.error(e);
  }
  const labels = content.map(item => item.label);
  const datasets = [
    {
      label: "Dataset 1",
      data: content.map(item => item.value),
      backgroundColor: "rgba(255, 99, 132, 0.5)",
    },
  ];
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
          {isOpen && <QueryArea queries={data?.queries || []} />}
        </div>
        <div className="w-1/2 p-4">
          {isOpen && <ResultArea result={data?.result} />}
        </div>
      </div>
      <Bar options={options} data={{ labels, datasets }} />
    </div>
  );
};

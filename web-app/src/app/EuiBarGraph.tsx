"use client";
import React from "react";
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
  };
}

interface ParsedData {
  content: BarGraphData[];
}

export const EuiBarGraph: React.FC<EuiBarGraphProps> = ({ data }) => {
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
      <Bar options={options} data={{ labels, datasets }} />
    </div>
  );
};

"use client";
import React from "react";

interface DataItem {
  [key: string]: any;
}

interface SimpleTableProps {
  data: DataItem[];
}

export const SimpleTable: React.FC<SimpleTableProps> = ({
  data = [],
}: SimpleTableProps) => {
  if (!Array.isArray(data) || data.length === 0 || !data[0]) return null;
  const keys = Object.keys(data[0]);
  const keyFingerprint = keys.join("-");
  return (
    <div className="overflow-auto max-h-screen">
      <table className="table-auto w-full text-left whitespace-no-wrap">
        <thead>
          <tr className="text-md font-medium text-gray-700 bg-gray-200">
            {keys.map((key: string, index: number) => {
              const keyName = `${keyFingerprint}-${index}`;
              return (
                <th key={"header" + keyName} className="px-4 py-3">
                  {key}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {data?.map((row: any, i: number) => {
            const keyName = `row-${keyFingerprint}-${i}`;
            return (
              <tr key={keyName} className="bg-white">
                {keys.map((key: string, j: number) => {
                  const keyName = `cell-${keyFingerprint}-${i}-${j}`;
                  return (
                    <td key={keyName} className="px-4 py-3 text-xs">
                      {row[key]}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

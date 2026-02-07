'use client';

import React from "react";

interface TimelineProps {
  events: {
    label: string;
    time: string | null;
  }[];
}

export default function OrderTimeline({ events }: TimelineProps) {
  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
        <svg className="h-5 w-5 text-gray-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Order Timeline
      </h2>

      <div className="relative border-l-2 border-gray-200 ml-3">
        {events.map((ev, idx) => (
          <div key={idx} className="mb-6 ml-6">
            <div className="absolute -left-3 top-1 w-3 h-3 bg-orange-500 rounded-full border border-white"></div>

            <p className="text-sm font-semibold text-gray-900">{ev.label}</p>
            <p className="text-xs text-gray-600 mt-1">
              {ev.time ? new Date(ev.time).toLocaleString() : "Pending"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

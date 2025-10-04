import React from 'react';

// Simple top progress bar using design tokens
export default function TopProgressBar() {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-1 overflow-hidden bg-transparent">
      <div className="h-full w-1/3 animate-[progress_1.2s_ease-in-out_infinite] rounded-r bg-primary"></div>
    </div>
  );
}

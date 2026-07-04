import { useState } from 'react';
import reactLogo from '@/assets/react.svg';
import wxtLogo from '/wxt.svg';

export default function Sider() {
  const [count, setCount] = useState(0);

  return (
    <div className="min-h-screen p-6 text-center">
      <div className="flex justify-center gap-4">
        <a href="https://wxt.dev" target="_blank" rel="noreferrer">
          <img src={wxtLogo} className="h-16 w-16" alt="WXT logo" />
        </a>
        <a href="https://react.dev" target="_blank" rel="noreferrer">
          <img src={reactLogo} className="h-16 w-16 animate-spin" alt="React logo" />
        </a>
      </div>
      <h1 className="mt-6 text-2xl font-bold">WXT + React</h1>
      <div className="mt-4">
        <button
          className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          onClick={() => setCount((count) => count + 1)}
        >
          count is {count}
        </button>
      </div>
      <p className="mt-4 text-sm text-gray-600">
        Edit <code>components/sider/index.tsx</code> and save to test HMR
      </p>
    </div>
  );
}
